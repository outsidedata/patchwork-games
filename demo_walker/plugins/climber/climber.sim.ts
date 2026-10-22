// climber: demo_walker's own plugin, a walker body (`plugins/walker`) that climbs ladders, played
// with anim's clips (`plugins/anim`): how a game makes a walker behaviour of its own. It has no row and
// no page half. A rule calls `climb` first each step, and walks only while it hands back false; after
// it walks, it calls `grab`, which starts a climb when the body asks for one.
//
// A ladder is a `ladder` row: `pos` [x, y, z] the foot of the wall it stands against, on the ground,
// and `yaw` the way out from that wall. Its top is the ground walker stands on `behind` metres in from
// the wall face (`groundOf`). Its definition (`assets/demo_walker.json`) holds every number:
//   clips     `{ mount, climb, top }`, the rig's clips: stepping onto the ladder from the ground, the
//             climbing loop, and climbing off the top onto the ground there.
//   standoff  metres from the wall face to the rungs.
//   hold      metres out from the rungs the climber's root stands while it climbs: how far the clips
//             hold the body off the ladder, read off the rig's measured hands and feet on the loop.
//   behind    metres in from the wall face the top is read at.
//   reach     metres: how near the place a climb starts from a body must be to start it.
//   settle    seconds over which a body that started a climb off that place is eased onto it.
//   leap      [out, up] m/s: the jump key on the ladder lets go, flinging the body out from the
//             wall and up at those speeds.
//   look      the ladder's look (`ladder.client.ts`).
//
// The climber's row carries walker's fields and anim's, the stick [x, z] its keys hold (forward +z),
// `jump`, and its own: `ladder` (the ladder row's id, 0 off one), `phase`, `clock` (seconds into the
// phase's clip), `rungs` (metres climbed, below), `level` (the height the root stands at through a
// `top` or `descend`) and `slip` [x, z, yaw] (where the body stood off the phase's start, eased away).
//
// Every clip is scrubbed, never run: each phase plays its clip with anim's `play` at rate 0, holding
// the body, and writes `clipT` itself each step, so the climb goes up and down the same clips and
// stops wherever the stick stops. The body's place is read off the clip's measured `travel` (anim's
// `at`), so its root is where the clip's hips are pinned, and its height off the measured hips (anim's
// `ends`, the torso's first end), so where one clip hands over to the next the hips stand where they
// stood:
//   mount    from the ground: the clip runs forward, the root carried along its travel from the
//            place it starts at, turned by its measured turn, onto the climbing spot, `hold` out from
//            the rungs and facing out from the wall, on the ground's height.
//   climb    `rungs` grows with the stick's forward at the loop's own speed, its measured rise a
//            lap over its length, and shrinks with the stick's back. A whole lap lifts the root by
//            that rise and the rest of it is the clip's playhead, so the drawn hips climb straight on
//            from lap to lap. Below 0 it goes on as `leave`; once the hips stand where the `top` clip
//            starts them for the top this ladder has (its first frame's hips under the top by its
//            last frame's less the still role's), it goes on as `top`. The jump key lets go: the
//            body is flung by `leap` and falls as walker has it.
//   top      the clip runs forward from the root's height, facing the wall, carried along its
//            travel over the top; at its end the body stands on the ground there and walks.
//   leave    `mount` run back to its start: the body steps off onto the ground and walks.
//   descend  `top` run back from its end, from a body on the top at the ladder that pushes out over
//            the edge; at its start the climb goes on at the `rungs` whose hips stand nearest its.
//
// `grab(me, w, ground)` starts a climb for a body on the ground, not held by a clip, pushing toward a
// ladder's wall within `reach` of where `mount` starts, or on its top pushing out over the edge within
// `reach` of where `top` ends, and hands back whether it did. `climb(me, w, dt)` is one step of a climb,
// and false for a body on no ladder.
import type { Row, W } from '#engine/engine.ts'
import { animKind, at, ends, momentOf, play, rigOf, stanceOf, stop, type Measure } from '#plugins/anim/anim.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf, numbers, stand, type Ground } from '#plugins/walker/walker.sim.ts'

const DEG = Math.PI / 180
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
// The clips' playheads stop this far short of a clip's end, since anim lets an act go at its end.
const SHORT = 1e-6

type Numbers = {
  clips: { mount: string; climb: string; top: string }
  standoff: number; hold: number; behind: number; reach: number; settle: number; leap: number[]
}

// A ladder as a climber reads it: its foot, the way out from its wall, the climbing spot, the top.
type Ladder = { row: Row; k: Numbers; foot: number[]; out: number[]; yaw: number; spot: number[]; top: number }

function ladderOf(w: W, row: Row, ground: Ground): Ladder {
  const k = def(w, row.kind) as Numbers
  const [x, y, z] = row.data.pos
  const yaw = row.data.yaw
  const out = [math.sin(yaw), math.cos(yaw)]
  const off = k.standoff + k.hold
  const top = ground.height(x - out[0] * k.behind, z - out[1] * k.behind)
  return { row, k, foot: [x, y, z], out, yaw, spot: [x + out[0] * off, z + out[1] * off], top }
}

// A point `f` metres along yaw θ's facing and `l` to its left, from (x, z).
const along = (x: number, z: number, yaw: number, f: number, l: number) =>
  [x + f * math.sin(yaw) + l * math.cos(yaw), z + f * math.cos(yaw) - l * math.sin(yaw)]

// What the climber's rig says of the climb: each clip's measures, and the hips' height in a clip at t.
function rigging(w: W, me: Row, k: Numbers) {
  const kind = animKind(me)
  const rig = rigOf(w, kind)
  const measure = (clip: string): Measure => {
    const m = rig.table[clip]
    if (!m) throw new Error(`climber:the rig of ${kind} has no clip ${clip}`)
    return m
  }
  const hips = (clip: string, t: number) => ends(w, me, 'torso', { clip, clipT: t })[1]
  const still = momentOf(rig, stanceOf(rig, me.data), 'still')
  if (still === undefined) throw new Error(`climber:the rig of ${kind} names no still role`)
  const mount = measure(k.clips.mount), loop = measure(k.clips.climb), top = measure(k.clips.top)
  const rise = hips(k.clips.climb, loop.dur) - hips(k.clips.climb, 0)
  if (!(rise > 0)) throw new Error(`climber:the climbing loop ${k.clips.climb} rises ${rise} m a lap`)
  return {
    mount, loop, top, rise, hips,
    // The hips' height of the still role, of the top clip's first and last frames, and of the mount's last.
    standing: hips(still, 0),
    topStart: hips(k.clips.top, 0),
    topEnd: hips(k.clips.top, top.dur),
    mounted: hips(k.clips.mount, mount.dur),
    loopStart: hips(k.clips.climb, 0),
  }
}

// Where the mount clip starts the root, and the way it faces: so that its travel ends on the spot,
// facing out from the wall.
function mountStart(l: Ladder, m: Measure) {
  const [f, left, turn] = at(m, m.dur)
  const yaw = wrap(l.yaw - turn * DEG)
  const [x, z] = along(l.spot[0], l.spot[1], yaw, -f, -left)
  return { x, z, yaw }
}

// The top clip's root at t: from the spot, facing the wall.
function topAt(l: Ladder, m: Measure, t: number) {
  const [f, left] = at(m, t)
  const yaw = wrap(l.yaw + Math.PI)
  return along(l.spot[0], l.spot[1], yaw, f, left)
}

// The playhead held short of the clip's end.
const scrub = (me: Row, m: Measure, t: number) => { me.data.clipT = Math.max(0, Math.min(m.dur - SHORT, t)) }

// A clip begun at full weight, where the last clip's pose meets its own.
function cut(me: Row, clip: string) {
  play(me, clip, { holds: true, rate: 0 })
  me.data.blend = 1
  me.data.from = null
}

// The body still, on the ground, on no ladder.
function off(me: Row, w: W, ground: Ground) {
  const d = me.data
  d.ladder = 0
  d.phase = ''
  d.slip = [0, 0, 0]
  d.vel = [0, 0, 0]
  d.want = [0, 0]
  d.pos = [d.pos[0], stand(numbers(me, w), ground, d.pos[0], d.pos[2]), d.pos[2]]
  d.grounded = true
  d.sliding = false
  stop(me, w)
}

// The share of the slip left `elapsed` seconds into a phase.
const left = (k: Numbers, elapsed: number) => Math.max(0, 1 - elapsed / k.settle)

export function grab(me: Row, w: W, ground: Ground): boolean {
  const d = me.data
  if (d.ladder || !d.grounded || d.state === 'act') return false
  const speed = math.hypot(d.want[0], d.want[1])
  if (!(speed > 0)) return false
  const [x, y, z] = d.pos
  for (const row of w.all('ladder')) {
    const l = ladderOf(w, row, ground)
    const r = rigging(w, me, l.k)
    // From the ground: pushing toward the wall, near where the mount starts.
    const s = mountStart(l, r.mount)
    if (Math.abs(y - l.foot[1]) <= numbers(me, w).step && math.hypot(x - s.x, z - s.z) <= l.k.reach && -(d.want[0] * l.out[0] + d.want[1] * l.out[1]) > speed / 2) {
      d.ladder = row.id
      d.phase = 'mount'
      d.clock = 0
      d.slip = [x - s.x, z - s.z, wrap(d.yaw - s.yaw)]
      play(me, l.k.clips.mount, { holds: true, rate: 0 })
      return true
    }
    // From the top: pushing out over the edge, near where the top clip ends.
    const [tx, tz] = topAt(l, r.top, r.top.dur)
    if (Math.abs(y - l.top) <= numbers(me, w).step && math.hypot(x - tx, z - tz) <= l.k.reach && d.want[0] * l.out[0] + d.want[1] * l.out[1] > speed / 2) {
      d.ladder = row.id
      d.phase = 'descend'
      d.clock = r.top.dur
      d.level = l.top + r.standing - r.topEnd
      d.slip = [x - tx, z - tz, wrap(d.yaw - wrap(l.yaw + Math.PI))]
      play(me, l.k.clips.top, { holds: true, rate: 0 })
      scrub(me, r.top, r.top.dur)
      return true
    }
  }
  return false
}

export function climb(me: Row, w: W, dt: number): boolean {
  const d = me.data
  if (!d.ladder) return false
  const ground = groundOf(w)
  const l = ladderOf(w, w.get(d.ladder), ground)
  const { k } = l
  const r = rigging(w, me, k)
  const base = l.foot[1] + r.mounted - r.loopStart
  d.vel = [0, 0, 0]
  d.want = [0, 0]
  d.grounded = true
  d.sliding = false
  const jump = d.jump
  d.jump = false

  switch (d.phase) {
    case 'mount':
    case 'leave': {
      d.clock = d.phase === 'mount' ? d.clock + dt : d.clock - dt
      const t = Math.max(0, Math.min(r.mount.dur, d.clock))
      const s = mountStart(l, r.mount)
      const [f, lf, turn] = at(r.mount, t)
      const [x, z] = along(s.x, s.z, s.yaw, f, lf)
      const ease = d.phase === 'mount' ? left(k, d.clock) : 0
      d.pos = [x + d.slip[0] * ease, l.foot[1], z + d.slip[1] * ease]
      d.yaw = wrap(s.yaw + turn * DEG + d.slip[2] * ease)
      scrub(me, r.mount, t)
      if (d.phase === 'mount' && d.clock >= r.mount.dur) {
        d.phase = 'climb'
        d.rungs = 0
        d.slip = [0, 0, 0]
        cut(me, k.clips.climb)
        return climbing(me, l, r, base, 0)
      }
      if (d.phase === 'leave' && d.clock <= 0) off(me, w, ground)
      return true
    }
    case 'climb': {
      if (jump) {
        d.ladder = 0
        d.phase = ''
        d.vel = [l.out[0] * k.leap[0], k.leap[1], l.out[1] * k.leap[0]]
        d.grounded = false
        stop(me, w)
        return true
      }
      d.rungs += d.stick[1] * (r.rise / r.loop.dur) * dt
      if (d.rungs < 0) {
        d.phase = 'leave'
        d.clock = r.mount.dur
        cut(me, k.clips.mount)
        return climb(me, w, 0)
      }
      climbing(me, l, r, base, d.rungs)
      const hips = d.pos[1] + r.hips(k.clips.climb, d.clipT)
      if (hips >= l.top + r.standing - r.topEnd + r.topStart) {
        d.phase = 'top'
        d.clock = 0
        d.level = hips - r.topStart
        cut(me, k.clips.top)
        return climb(me, w, 0)
      }
      return true
    }
    case 'top':
    case 'descend': {
      d.clock = d.phase === 'top' ? d.clock + dt : d.clock - dt
      const t = Math.max(0, Math.min(r.top.dur, d.clock))
      const [x, z] = topAt(l, r.top, t)
      const ease = d.phase === 'descend' ? left(k, r.top.dur - d.clock) : 0
      d.pos = [x + d.slip[0] * ease, d.level, z + d.slip[1] * ease]
      d.yaw = wrap(l.yaw + Math.PI + d.slip[2] * ease)
      scrub(me, r.top, t)
      if (d.phase === 'top' && d.clock >= r.top.dur) off(me, w, ground)
      if (d.phase === 'descend' && d.clock <= 0) {
        // The climb goes on at the rungs whose hips stand nearest the top clip's first frame's.
        const want = d.level + r.topStart - base
        const frames = Math.max(1, Math.round(r.loop.frames ?? r.loop.dur * 30))
        let best = 0, err = Infinity
        const lap0 = Math.floor((want - r.loopStart) / r.rise)
        for (let lap = lap0 - 1; lap <= lap0 + 1; lap++) {
          for (let f = 0; f < frames; f++) {
            const t = (f / frames) * r.loop.dur
            const e = Math.abs(lap * r.rise + r.hips(k.clips.climb, t) - want)
            if (e < err) { err = e; best = Math.max(0, lap * r.rise + (f / frames) * r.rise) }
          }
        }
        d.phase = 'climb'
        d.rungs = best
        d.slip = [0, 0, 0]
        cut(me, k.clips.climb)
        climbing(me, l, r, base, best)
      }
      return true
    }
  }
  throw new Error(`climber:the body is on ladder ${d.ladder} in no phase it knows, ${d.phase}`)
}

// The body on the climbing loop `rungs` metres up: its whole laps in its height, the rest its playhead.
function climbing(me: Row, l: Ladder, r: ReturnType<typeof rigging>, base: number, rungs: number): true {
  const d = me.data
  const laps = Math.floor(rungs / r.rise)
  d.pos = [l.spot[0], base + laps * r.rise, l.spot[1]]
  d.yaw = l.yaw
  scrub(me, r.loop, (rungs / r.rise - laps) * r.loop.dur)
  return true
}
