// moves: demo_walker's own plugin, the moves a walker body (`plugins/walker`) makes beside walking,
// played with anim's clips (`plugins/anim`): crouching, sitting on a chair, taking cover against a
// wall and sneaking along it, vaulting a low wall, running up a high one, and the tricks, a dodge roll,
// a running slide, a front flip and a backflip, and rolling out of a hard landing. It has no row and no
// page half. A rule hands each function its row, its `w` and its kind's `moves` numbers, `k` below.
//
// Two ways a move is played:
//   held    the clip is scrubbed by this plugin, as climber scrubs a ladder's: played with anim's
//           `play` at rate 0, holding the body, its `clipT` written each step, the body's root carried
//           along the clip's measured travel (anim's `at`) from the place it starts, turned by the clip's
//           turn where anim carries it (`carries`), and walker not asked to walk it. A move against a
//           thing (a chair, a wall) starts its clip where its end puts the body against the thing, and
//           the body is eased onto that start over `k.settle` seconds from where it stood (`slip`).
//           Sitting, cover's going in and coming out, the vault and the wall run are held.
//   played  the clip is played by anim as an act (`play`), carrying its own travel, which the rule's
//           stride carries by walker (`carry`), so a roll or a slide stops at a wall. The tricks are
//           played.
//
// The row carries walker's fields, anim's, the stick and `fast`, and its own:
//   crouch   true while crouched: anim's stance (`rig`) is `crouch`, and the rule walks at `k.crouch.speed`
//   move     the held move under way: `sit`, `seated`, `rise`, `in`, `hug`, `out`, `vault`, `wallrun`,
//            or '' for none
//   clock    seconds into a held move's clip; `anchor` [x, y, z] where its root starts and `turn0` the
//            way it faces then; `slip` [x, z, yaw] the body off that start, eased away
//   chair    [x, z, yaw] the chair it sits on; `wall` [ax, az, bx, bz, ox, oz, yaw, low] the side it hugs,
//            the yaw it faces there, and 1 for a low wall
//
// The numbers, `k`, the `moves` of the rule's kind's definition (`assets/demo_walker.json`):
//   settle   seconds a held move's start is eased over
//   crouch   `{ down, up, speed }`: the clips played going down and getting up while still, and the
//            speed crouched, m/s
//   seat     `{ sit, seated, rise, reach }`: the clips, and how near where sitting starts a body must be
//   cover    `{ stand, crouch, in, out, lowIn, lowOut, tall, low, hug, faces, speed, reach, margin }`:
//            the stances, the clips in and out of a wall `tall` metres or more over the body's feet and
//            of one `low` or more, each with its `mirror` turned the other way; `hug` metres from the
//            wall the body stands in cover, `faces` `wall` or `out`, the way it faces there; `speed`
//            m/s along it; how near (`reach`) a wall a body must be to take cover; and `margin`, how near
//            a wall's ends it may sneak
//   vault    `{ clip, low, high, near, far, run }`: over a wall `low` to `high` metres over the feet,
//            from `near` to `far` metres before it, at `run` m/s or faster
//   wallrun  `{ clip, low, high, near, far, run }`: up onto a wall `low` to `high` metres high, the same
//   tricks   `{ roll, slide, flip, backflip, landroll, land, slideAbove, flipAbove, rollAbove }`: the
//            clips; a slide only at `slideAbove` m/s or faster; a front flip at `flipAbove` or faster and
//            a backflip slower; and a hard landing (anim's `land` role, `land`) at `rollAbove` m/s across
//            the ground or faster rolls out with `landroll`
//
// `held(me, w, dt, k)` is one step of a held move, and false for a body making none (in cover, `hug`,
// the rule walks it). `hug(me, w, want, k)` is the velocity a body in cover walks at for the `want` the
// keys ask: along the wall at `k.cover.speed`, never past its margin from either end, facing the way it
// faces there (walker's `face`); keys pushing out from the wall leave cover instead, out toward the
// side they lean. `use(me, w, k)` sits on the nearest chair, takes cover against the nearest wall, or
// gets up or leaves cover, and is whether it did; `crouch(me, w, k)` crouches or stands; `jump(me, w,
// k)` vaults or runs up a wall in front of a running body, and is false where neither fits;
// `trick(me, k, name)` plays a trick; `landed(me, dt, k)`, asked after each stride, rolls out of a
// hard landing it has just begun. Each but `use` (which also gets up and leaves cover) and `hug`
// refuses, doing nothing, while the body is in the air, on a ladder, held or playing an act.
import type { Row, W } from '#engine/engine.ts'
import { at, carries, clipOf, numbersOf, play, rigOf, stop, animKind } from '#plugins/anim/anim.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf, numbers, stand } from '#plugins/walker/walker.sim.ts'
import { courseOf, faces, seats, type Face } from '../floors/floors.sim.ts'

const DEG = Math.PI / 180
const SHORT = 1e-6
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
// A point `f` metres along yaw θ's facing and `l` to its left, from (x, z).
const along = (x: number, z: number, yaw: number, f: number, l: number) =>
  [x + f * math.sin(yaw) + l * math.cos(yaw), z + f * math.cos(yaw) - l * math.sin(yaw)]
const yawOf = (x: number, z: number) => math.atan2(x, z)

export type Numbers = {
  settle: number
  crouch: { down: string; up: string; speed: number }
  seat: { sit: string; seated: string; rise: string; reach: number }
  cover: {
    stand: string; crouch: string; in: string; out: string; lowIn: string; lowOut: string; mirror: Record<string, string>
    tall: number; low: number; hug: number; faces: 'wall' | 'out'; speed: number; reach: number; margin: number
  }
  vault: { clip: string; low: number; high: number; near: number; far: number; run: number }
  wallrun: { clip: string; low: number; high: number; near: number; far: number; run: number }
  tricks: { roll: string; slide: string; flip: string; backflip: string; landroll: string; land: string; slideAbove: number; flipAbove: number; rollAbove: number }
}

// Where a held clip leaves the root at t, the way it faces, from its start.
function placed(w: W, me: Row, clip: string, anchor: number[], turn0: number, t: number) {
  const c = clipOf(rigOf(w, animKind(me)), clip)
  const [f, l, turn] = at(c.measure, Math.max(0, Math.min(c.dur, t)))
  const [x, z] = along(anchor[0], anchor[2], turn0, f * c.scale, l * c.scale)
  return { x, z, yaw: wrap(turn0 + (carries(c, numbersOf(w)).turns ? turn * DEG : 0)), dur: c.dur }
}

// Where a held clip must start for its end to stand the body at (x, z) facing `yaw`.
function startFor(w: W, me: Row, clip: string, x: number, z: number, yaw: number) {
  const c = clipOf(rigOf(w, animKind(me)), clip)
  const [f, l, turn] = at(c.measure, c.dur)
  const turn0 = wrap(yaw - (carries(c, numbersOf(w)).turns ? turn * DEG : 0))
  const [sx, sz] = along(x, z, turn0, -f * c.scale, -l * c.scale)
  return { x: sx, z: sz, yaw: turn0 }
}

// A held move begun: its clip from 0, the root's start, and the body's way off it to ease away.
function begin(me: Row, move: string, clip: string, anchor: number[], turn0: number) {
  const d = me.data
  d.move = move
  d.clock = 0
  d.anchor = anchor
  d.turn0 = turn0
  d.slip = [d.pos[0] - anchor[0], d.pos[2] - anchor[2], wrap(d.yaw - turn0)]
  d.vel = [0, 0, 0]
  d.want = [0, 0]
  play(me, clip, { holds: true, rate: 0 })
}

// The body where its held clip has it this step; and whether the clip has ended.
function scrub(me: Row, w: W, dt: number, k: Numbers): boolean {
  const d = me.data
  d.clock += dt
  const p = placed(w, me, d.clip, d.anchor, d.turn0, d.clock)
  const ease = Math.max(0, 1 - d.clock / k.settle)
  d.pos = [p.x + d.slip[0] * ease, d.anchor[1], p.z + d.slip[1] * ease]
  d.yaw = wrap(p.yaw + d.slip[2] * ease)
  d.clipT = Math.min(d.clock, p.dur - SHORT)
  d.vel = [0, 0, 0]
  d.grounded = true
  d.sliding = false
  return d.clock >= p.dur
}

// The body back on its feet on the ground where it stands, walking, in its stance.
function walkOn(me: Row, w: W) {
  const d = me.data
  d.move = ''
  d.slip = [0, 0, 0]
  d.want = [0, 0]
  d.pos = [d.pos[0], stand(numbers(me, w), groundOf(w), d.pos[0], d.pos[2]), d.pos[2]]
  d.grounded = true
  d.sliding = false
  stop(me, w)
}

// Whether the body is free to start a move: on the ground, on no ladder, holding no move, playing no act.
const free = (me: Row) => {
  const d = me.data
  return d.grounded && !d.ladder && !d.move && d.state !== 'act'
}

const speedOf = (me: Row) => math.hypot(me.data.vel[0], me.data.vel[2])

// ---------------------------------------------------------------- crouching

export function crouch(me: Row, w: W, k: Numbers) {
  const d = me.data
  if (!free(me)) return
  d.crouch = !d.crouch
  d.rig = d.crouch ? 'crouch' : 'stand'
  // Still, it goes down or gets up; moving, its gears change to the stance's.
  if (speedOf(me) < numbersOf(w).still) play(me, d.crouch ? k.crouch.down : k.crouch.up)
}

// ---------------------------------------------------------------- the moves held

export function held(me: Row, w: W, dt: number, k: Numbers): boolean {
  const d = me.data
  switch (d.move) {
    case '':
    case undefined:
      return false
    case 'sit':
      if (scrub(me, w, dt, k)) {
        d.move = 'seated'
        play(me, k.seat.seated, { holds: true })
      }
      return true
    case 'seated': {
      const [x, z, yaw] = d.chair
      d.pos = [x, d.anchor[1], z]
      d.yaw = yaw
      d.vel = [0, 0, 0]
      d.want = [0, 0]
      d.grounded = true
      return true
    }
    case 'rise':
    case 'out':
      if (scrub(me, w, dt, k)) {
        if (d.move === 'out') d.rig = d.crouch ? 'crouch' : 'stand'
        walkOn(me, w)
      }
      return true
    case 'in':
      if (scrub(me, w, dt, k)) {
        d.move = 'hug'
        d.slip = [0, 0, 0]
        d.rig = d.wall[7] ? k.cover.crouch : k.cover.stand
        stop(me, w)
      }
      return true
    case 'hug':
      return false
    case 'vault':
    case 'wallrun': {
      if (!scrub(me, w, dt, k)) return true
      // On its feet where the clip ends, running on the way it faced.
      const speed = (d.move === 'vault' ? k.vault : k.wallrun).run
      walkOn(me, w)
      d.vel = [math.sin(d.yaw) * speed, 0, math.cos(d.yaw) * speed]
      return true
    }
  }
  throw new Error(`moves: the body holds a move it knows nothing of, ${d.move}`)
}

// ---------------------------------------------------------------- sitting and cover

// A point's nearest place on a side, metres along it from its first end, and its distance out from it.
function onFace(f: Face, x: number, z: number) {
  const tx = f.b[0] - f.a[0], tz = f.b[1] - f.a[1]
  const len = math.hypot(tx, tz)
  const u = ((x - f.a[0]) * tx + (z - f.a[1]) * tz) / len
  const out = (x - f.a[0]) * f.out[0] + (z - f.a[1]) * f.out[1]
  return { u, len, out, t: [tx / len, tz / len] }
}

export function use(me: Row, w: W, k: Numbers): boolean {
  const d = me.data
  if (d.move === 'seated') {
    const [x, z, yaw] = d.chair
    begin(me, 'rise', k.seat.rise, [x, d.anchor[1], z], yaw)
    return true
  }
  if (d.move === 'hug') return leave(me, w, k, 0)
  if (!free(me)) return false
  const [x, y, z] = d.pos
  const course = courseOf(w)

  // The nearest chair whose sitting starts within reach.
  let best: { x: number; z: number; yaw: number; far: number } | undefined
  for (const s of seats(course)) {
    const start = startFor(w, me, k.seat.sit, s.x, s.z, s.yaw)
    const far = math.hypot(x - start.x, z - start.z)
    if (far <= k.seat.reach && (!best || far < best.far)) best = { ...s, far }
  }
  if (best) {
    const start = startFor(w, me, k.seat.sit, best.x, best.z, best.yaw)
    d.chair = [best.x, best.z, best.yaw]
    begin(me, 'sit', k.seat.sit, [start.x, y, start.z], start.yaw)
    return true
  }

  // The nearest wall within reach that stands at least `low` over the feet.
  let wall: { f: Face; u: number; out: number; t: number[] } | undefined
  for (const f of faces(course)) {
    const o = onFace(f, x, z)
    if (o.out < 0 || o.out > k.cover.reach || o.u < k.cover.margin || o.u > o.len - k.cover.margin) continue
    if (f.top - y < k.cover.low) continue
    if (!wall || o.out < wall.out) wall = { f, u: o.u, out: o.out, t: o.t }
  }
  if (!wall) return false
  const { f, u, t } = wall
  const low = f.top - y < k.cover.tall
  const ex = f.a[0] + t[0] * u + f.out[0] * k.cover.hug
  const ez = f.a[1] + t[1] * u + f.out[1] * k.cover.hug
  const yaw = k.cover.faces === 'wall' ? yawOf(-f.out[0], -f.out[1]) : yawOf(f.out[0], f.out[1])
  // The clip in, or its mirror, whichever starts nearer the body.
  const clip = low ? k.cover.lowIn : k.cover.in
  const [one, other] = [clip, k.cover.mirror[clip]].map(c => ({ c, s: startFor(w, me, c, ex, ez, yaw) }))
  const pick = math.hypot(x - one.s.x, z - one.s.z) <= math.hypot(x - other.s.x, z - other.s.z) ? one : other
  d.wall = [...f.a, ...f.b, ...f.out, yaw, low ? 1 : 0]
  begin(me, 'in', pick.c, [pick.s.x, y, pick.s.z], pick.s.yaw)
  return true
}

// Out of cover: the clip out, or its mirror, the one that ends the way `side` asks along the wall (1
// toward its second end, −1 its first, 0 whichever ends further out from it).
function leave(me: Row, w: W, k: Numbers, side: number): boolean {
  const d = me.data
  const [ax, az, bx, bz, ox, oz, yaw, low] = d.wall
  const clip = low ? k.cover.lowOut : k.cover.out
  const tx = bx - ax, tz = bz - az
  const ends = [clip, k.cover.mirror[clip]].map(c => {
    const p = placed(w, me, c, d.pos, yaw, Infinity)
    const dx = p.x - d.pos[0], dz = p.z - d.pos[2]
    return { c, out: dx * ox + dz * oz, side: dx * tx + dz * tz }
  })
  const pick = side === 0
    ? (ends[0].out >= ends[1].out ? ends[0] : ends[1])
    : (ends[0].side * side >= ends[1].side * side ? ends[0] : ends[1])
  begin(me, 'out', pick.c, [...d.pos], yaw)
  d.slip = [0, 0, 0]
  return true
}

export function hug(me: Row, w: W, want: number[], k: Numbers): number[] {
  const d = me.data
  const [ax, az, bx, bz, ox, oz, yaw] = d.wall
  // Pushed out from the wall, it leaves cover, toward the way the keys ask along it.
  const len = math.hypot(want[0], want[1])
  const tx = (bx - ax), tz = (bz - az)
  const tl = math.hypot(tx, tz)
  const ux = tx / tl, uz = tz / tl
  if (len > 0 && (want[0] * ox + want[1] * oz) / len > 0.7) {
    leave(me, w, k, Math.sign(want[0] * ux + want[1] * uz))
    return [0, 0]
  }
  // Along the wall at the cover speed, never past its margin from either end.
  const s = len > 0 ? (want[0] * ux + want[1] * uz) / len : 0
  const at = (d.pos[0] - ax) * ux + (d.pos[2] - az) * uz
  const room = s > 0 ? tl - k.cover.margin - at : at - k.cover.margin
  const v = room > 0 ? s * k.cover.speed : 0
  d.face = yaw
  return [ux * v, uz * v]
}

// ---------------------------------------------------------------- vault and wall run

export function jump(me: Row, w: W, k: Numbers): boolean {
  const d = me.data
  if (!free(me) || d.crouch) return false
  const speed = speedOf(me)
  const [x, y, z] = d.pos
  const fx = math.sin(d.yaw), fz = math.cos(d.yaw)
  for (const [move, m] of [['vault', k.vault], ['wallrun', k.wallrun]] as const) {
    if (speed < m.run) continue
    for (const f of faces(courseOf(w))) {
      const o = onFace(f, x, z)
      const head = -(fx * f.out[0] + fz * f.out[1])
      const rise = f.top - y
      if (head < 0.7 || o.out < m.near || o.out > m.far || o.u < 0 || o.u > o.len || rise < m.low || rise > m.high) continue
      // Square to the wall, from where the body is.
      const turn0 = yawOf(-f.out[0], -f.out[1])
      const end = placed(w, me, m.clip, [x, y, z], turn0, Infinity)
      // A vault lands where the ground is near the feet' height; a wall run ends on the wall's top.
      const ground = groundOf(w).height(end.x, end.z)
      if (move === 'vault' && Math.abs(ground - y) > numbers(me, w).step) continue
      if (move === 'wallrun' && Math.abs(ground - f.top) > numbers(me, w).step) continue
      begin(me, move, m.clip, [x, y, z], turn0)
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------- tricks

export function trick(me: Row, k: Numbers, name: 'roll' | 'slide' | 'flip') {
  const d = me.data
  if (!free(me) || d.crouch) return
  const speed = speedOf(me)
  if (name === 'roll') play(me, k.tricks.roll)
  if (name === 'slide' && speed >= k.tricks.slideAbove) play(me, k.tricks.slide)
  if (name === 'flip') play(me, speed >= k.tricks.flipAbove ? k.tricks.flip : k.tricks.backflip)
}

export function landed(me: Row, dt: number, k: Numbers) {
  const d = me.data
  if (d.state !== 'act' || d.clip !== k.tricks.land || d.clipT > dt * 1.5) return
  if (math.hypot(d.vel[0], d.vel[2]) >= k.tricks.rollAbove) play(me, k.tricks.landroll)
}
