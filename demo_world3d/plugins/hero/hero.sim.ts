// The hills' `player` rule (`hills.sim.ts` gives it as the `player` kind's), copied from demo_motion3d's
// `player.sim.ts`: the body an X Bot (`as: "xbot"`) moved by kinematics3d (`world.kinematics3d.kinds.xbot`) and
// played and drawn by motion3d (`world.motion3d.kinds.xbot`), every move it makes the X Bot's motion3d file's
// (`assets/xbot.motion3d.json`). Every seat is sent every `player` row. Its own fields, beside kinematics3d's and
// motion3d's: `stick` [x, z], the keys' way, right and forward; `fast`, the run key held; `guard`, the guard key
// held; `look` `{ yaw, pitch, dist }`, chasecamera3d's orbit about it, `lift` metres over its feet; `turning`
// [x, y], how far a gamepad's right stick is pushed right and down; `aim`, the way the camera looks, which
// motion3d points a carried prop along while an aim is up; `weapon`, the stance the draw key draws, one of the
// definition's `weapons`; `queued`, the key pressed and not yet played, `{ key, age }`, or null; and `stood`,
// once it stands on its slot's start.
//
// Facing. With an aim up (the upper half playing one of the definition's `aimOf`, each weapon's aim by its name)
// the legs keep the way they face and strafe, turned only when the look is more than its rig's `aim.across`
// (radians) to either side of them; the aim's pitch is held within the rig's `aim.up` and `aim.down`. With the
// guard key held the body faces the way the camera looks and strafes, its stance's guard moves (`guard`, the
// hero's state). Else it turns the way it goes.
//
// The input buffer. A key pressed is held (`queued`) and handed to motion3d's `press` each step until a move
// plays it, for at most the definition's `buffer.hold` seconds of steps it was free to play in, a newer key
// taking its place. While the body plays a one-shot pressed with a key (an attack, a roll), a key is held back,
// its seconds not counted, until the one-shot has played the share of itself `buffer.cancel` gives for that key
// after the one playing; and while the upper half plays a one-shot (a draw, a putting away, a shot), a key no
// move will play yet is held, its seconds not counted, until it has played out:
// `cancel[<key playing>][<key pressed>]`, else `cancel[<key playing>]["*"]`, else `cancel["*"]["*"]`.
// The guard key is held, not pressed: each step it is held `guard` is pressed and each step it is not,
// `unguard`, so a block or an aim comes up whenever it may and goes down when it is let go.
//
// The draw key draws `weapon` (`draw.<weapon>` to motion3d), and puts it away while it is drawn. The switch
// key, with no weapon in the hands nor one being drawn or put away, makes the next of `weapons` the one the
// draw key draws; else it is pressed to motion3d and `weapon` follows. Whichever weapon's stance is up is
// `weapon`.
//
// Abilities. What the body can do is gas3d's (`plugins/gas3d/gas3d.sim.ts`): its row's `gas` holds its attributes
// and the effects on it, started on its first step from the definition's `attributes` with its `effects` on (its
// mana regeneration), and stepped each step. The definition's `abilities` names the abilities of gas3d's file it
// has, each played by its `press` key: a key pressed that is one of them starts it only when gas3d says it may (no
// cooldown on, enough of what it costs), and once its move plays, its cost is paid, its cooldown put on, and it is
// the one the row is `casting`; one gas3d refuses is dropped.
//
// Blows. A move of the X Bot's `fight` activity lands its blow on the step its clip's playhead passes the moment its
// blow lands: the frame on which the fastest of its hands and feet moves furthest, read off the rig's measured
// `ends` (the punch's fist, the kick's foot). Then the ability it is `casting` is delivered: by `reach`, the
// nearest living mob within that many metres in front of the body is struck (hitscan3d's `strike`, its `hit` act,
// `mob.sim.ts`, handed a `Struck` naming the ability); by `bolt`, a volley3d round of that pattern is fired from
// `cast.ahead` metres in front of the body and `cast.up` over its feet, at the row's target, or else the nearest
// living mob in front, within the ability's `range`, `cast.aimUp` over its feet, its hurt naming the ability, so
// the mob it meets is struck the same way. `casts` on the row counts the rounds it has fired, which names each.
//
// Targeting. `target` is the id of the mob the seat has picked, or null. The target key cycles it through the living
// mobs within the definition's `target.range` metres, nearest first. A bolt flies at it while it lives and is within
// the ability's range.
//
// `before` stands it once on the ground at its slot's start: on the place whose data says `start` in the nav3d
// graph the start's `graph` names (`player.sim.ts`'s `root`), else at the start's `pos`; facing the start's
// `yaw`, its look along it. Each step its look turns while `turning` is held, at the definition's `camera.turn`
// across and `tilt` up and down a second at full push, within `minPitch` and `maxPitch`. The stick is its want:
// kinematics3d's `want`, the way the stick points from the camera's yaw, as hard as it is pushed (the clip it
// plays says how fast); and motion3d's `drive`, which moves and plays the body by it.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right stick, the
// same), `fast(v)` and `guard(v)` (1 held, 0 let go), `press(key)`, a key pressed, buffered as above; `target()`,
// the next target; `look(dyaw, dpitch)` and `zoom(by)`, the wheel's pixels. A seat's message arrives from outside the program,
// so each refuses arguments of the wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { activityOf, drive, motionOf, press } from '#plugins/motion3d/motion3d.sim.ts'
import { clipOf, playKind, rigOf } from '#plugins/motion3d/motion3d.play.ts'
import { nearest, relative } from '#plugins/kinematics3d/kinematics3d.sim.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { fire } from '#plugins/volley3d/volley3d.sim.ts'
import { strike } from '#plugins/hitscan3d/hitscan3d.sim.ts'
import { abilityOf, blocked, commit, start as gas, step } from '../gas3d/gas3d.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1

type Buffer = { hold: number; cancel: Record<string, Record<string, number>> }

// The view turns while the right stick is held, whatever the body does.
function view(me: Row, dt: number, k: any) {
  const d = me.data
  if (d.turning[0] === 0 && d.turning[1] === 0) return
  const c = k.camera
  d.look = { ...d.look, yaw: wrap(d.look.yaw - d.turning[0] * c.turn * dt), pitch: clamp(d.look.pitch + d.turning[1] * c.tilt * dt, c.minPitch, c.maxPitch) }
}

// The body stood once on the ground at its slot's start, facing the start's yaw, its look along it: at the place
// whose data says `start` in the graph the start names, else at the start's `pos`.
function stood(me: Row, w: W) {
  const d = me.data
  const start = w.find('start', s => s.data.slot === d.seat).data
  const at: number[] = start.graph ? graph(w, start.graph).places.find(p => p.data?.start === true)!.point.at : start.pos
  // The triangles beneath feet set at the start's height, then stood on them.
  d.pos = nearest(w, { triangles: {} }, [at[0], at[1], at[2]], me)
  d.yaw = start.yaw
  d.look = { ...d.look, yaw: start.yaw }
  d.stood = true
}

// The share of itself the one-shot the body plays must have played before `key` may follow it: none while the
// body plays no one-shot that a key pressed (Buffer, the header).
function lockedUntil(me: Row, w: W, buffer: Buffer, key: string): number {
  const d = me.data
  const m = motionOf(activityOf(w, me, d.activity), d.motion)
  if (!m?.press || d.state !== 'act' || clipOf(rigOf(w, playKind(me)), d.clip).loop) return 0
  const c = buffer.cancel
  return c[m.press]?.[key] ?? c[m.press]?.['*'] ?? c['*']['*']
}

// The key held in the buffer handed to motion3d, once it may follow what plays; dropped once played or held
// past `hold` seconds.
function buffered(me: Row, w: W, dt: number, k: any) {
  const d = me.data
  const q = d.queued
  if (!q) return
  const until = lockedUntil(me, w, k.buffer, q.key)
  const share = until > 0 ? d.clipT / clipOf(rigOf(w, playKind(me)), d.clip).dur : 1
  if (share < until) return
  if (act(me, w, q.key, k)) {
    d.queued = null
    return
  }
  if (upperBusy(me, w)) return
  d.queued = q.age + dt > k.buffer.hold ? null : { key: q.key, age: q.age + dt }
}

// Whether the upper half plays a one-shot of its own (a draw, a putting away, a shot), which holds the buffer
// as a body's one-shot does.
function upperBusy(me: Row, w: W): boolean {
  const d = me.data
  const m = d.upperActivity === null ? undefined : motionOf(activityOf(w, me, d.upperActivity), d.upperMotion)
  return !!m?.clips.length && typeof d.upper === 'string' && !clipOf(rigOf(w, playKind(me)), d.upper).loop
}

// A key played: the draw key draws or puts away `weapon`; the switch key with nothing drawn picks the next
// weapon; any other key is motion3d's. Whether it played.
function act(me: Row, w: W, key: string, k: any): boolean {
  const d = me.data
  const dealt = ability(me, w, key, k)
  if (dealt !== undefined) return dealt
  const weapons: string[] = k.weapons
  const next = weapons[(weapons.indexOf(d.weapon) + 1) % weapons.length]
  if (key === 'draw') return press(me, w, `draw.${d.weapon}`, d.stick)
  if (key !== 'switch') return press(me, w, key, d.stick)
  // No weapon in the hands, nor one being drawn or put away (the upper half's move carries none).
  const up = d.upperActivity === null ? undefined : motionOf(activityOf(w, me, d.upperActivity), d.upperMotion)
  if (!weapons.includes(up?.carry ?? '')) {
    d.weapon = next
    return true
  }
  // A weapon being drawn or put away: held until its stance is up, and switched from there.
  if (!press(me, w, 'switch', d.stick)) return false
  d.weapon = next
  return true
}

// The weapon whose stance is up, its own or its aim's: `weapons[i]` is aimed by `aims` where one names it
// (`aimOf`); none while no stance is up.
function stanceOf(me: Row, k: any): string | undefined {
  const u = me.data.upperMotion
  if (k.weapons.includes(u)) return u
  return Object.entries(k.aimOf as Record<string, string>).find(([, aim]) => aim === u)?.[0]
}

// The limbs a blow lands with: each hand's and foot's segment of the rig's measured `ends`.
const LIMBS = ['handL', 'handR', 'footL', 'footR']
// When a clip's blow lands, by the rig's `ends` and the clip's name: the time of the frame whose step its fastest
// limb's far end moves furthest on, of all four limbs (Blows, the header).
const blows = new WeakMap<object, Map<string, number>>()
function blowAt(rig: any, body: string, clip: string): number {
  let times = blows.get(rig)
  if (!times) blows.set(rig, (times = new Map()))
  const had = times.get(clip)
  if (had !== undefined) return had
  const e = rig.ends?.[body]?.[clip]
  if (!e) throw new Error(`hero: the rig measures no ends of ${clip} for ${body}; bake it`)
  let best = 0, at = 0
  for (const limb of LIMBS) {
    const f: number[][] = e[limb]
    for (let i = 1; i < f.length; i++) {
      const step = math.hypot(f[i][3] - f[i - 1][3], f[i][4] - f[i - 1][4], f[i][5] - f[i - 1][5])
      if (step > best) { best = step; at = i / e.fps }
    }
  }
  times.set(clip, at)
  return at
}

// The living mob nearest the body within `far` metres and in front of it, or undefined.
function nearestAhead(me: Row, w: W, far: number): Row | undefined {
  const d = me.data
  const ahead = [math.sin(d.yaw), math.cos(d.yaw)]
  let near: Row | undefined, best = far
  for (const z of w.all('mob')) {
    if (z.data.dead) continue
    const dx = z.data.pos[0] - d.pos[0], dz = z.data.pos[2] - d.pos[2]
    const gap = math.hypot(dx, dz)
    if (gap > best || dx * ahead[0] + dz * ahead[1] <= 0) continue
    near = z
    best = gap
  }
  return near
}

// The row's target while it is a living mob within `range` metres, or undefined.
function targetOf(me: Row, w: W, range: number): Row | undefined {
  const d = me.data
  if (d.target === null) return undefined
  const t = w.all('mob').find(z => z.id === d.target)
  if (!t || t.data.dead) return undefined
  return math.hypot(t.data.pos[0] - d.pos[0], t.data.pos[2] - d.pos[2]) <= range ? t : undefined
}

// The blow (Blows, the header): on the step a move of the `fight` activity carries its clip's playhead past the
// moment its blow lands, the ability the body is `casting` is delivered.
function blow(me: Row, w: W, k: any, was: { clip: unknown; t: number }) {
  const d = me.data
  if (d.activity !== 'fight' || d.state !== 'act' || typeof d.clip !== 'string') {
    d.casting = null
    return
  }
  if (d.casting === null) return
  const peak = blowAt(rigOf(w, playKind(me)), playKind(me), clipOf(rigOf(w, playKind(me)), d.clip).source)
  const from = was.clip === d.clip ? was.t : 0
  if (!(from < peak && d.clipT >= peak)) return
  const name: string = d.casting
  d.casting = null
  const ability = abilityOf(w, name)
  const ahead = [math.sin(d.yaw), math.cos(d.yaw)]
  const delivery = ability.delivery
  if ('reach' in delivery) {
    const near = nearestAhead(me, w, delivery.reach)
    if (near) strike(w, near, { damage: 0, by: me.id, ability: name, part: null, point: [...near.data.pos], dir: [ahead[0], 0, ahead[1]], what: 'body' })
    return
  }
  // A bolt flies from in front of the chest at the target's middle, or the nearest mob's in front.
  const target = targetOf(me, w, delivery.range) ?? nearestAhead(me, w, delivery.range)
  if (!target) return
  const c = k.cast
  const at = [d.pos[0] + ahead[0] * c.ahead, d.pos[1] + c.up, d.pos[2] + ahead[1] * c.ahead]
  const to = [target.data.pos[0], target.data.pos[1] + c.aimUp, target.data.pos[2]]
  fire(w, delivery.bolt, at, [to[0] - at[0], to[1] - at[1], to[2] - at[2]], { from: me.id, n: d.casts++, skip: [me.id], hurt: { damage: 0, by: me.id, ability: name } })
}

// A key that is the press of one of the definition's `abilities`: whether it was dealt with. One gas3d says may not
// start is dropped; one that may is pressed to motion3d, and once its move plays, its cost and cooldown are paid
// and it is the one the body is `casting`.
function ability(me: Row, w: W, key: string, k: any): boolean | undefined {
  const name = (k.abilities as string[]).find(a => abilityOf(w, a).press === key)
  if (name === undefined) return undefined
  if (blocked(w, me, name) !== undefined) return true
  if (!press(me, w, key, me.data.stick)) return false
  commit(w, me, name)
  me.data.casting = name
  return true
}

export const hero: Kind = {
  before(me, _dt, w) {
    if (me.data.stood) return
    stood(me, w)
    const k = def(w, me.kind)
    gas(w, me, k.attributes, k.effects)
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    step(w, me, dt)
    view(me, dt, k)
    const [wx, wz] = relative(d.stick, d.look.yaw)
    // With an aim up the legs keep the way they face, and strafe, turned only as far as keeps the aim within the
    // rig's `aim.across` of them; with the guard held they face the look; else they turn the way they go.
    const limits = rigOf(w, playKind(me)).aim
    if (!limits) throw new Error(`hero: the rig of ${playKind(me)} gives no aim limits`)
    const across = wrap(d.look.yaw - d.yaw)
    const aiming = Object.values(k.aimOf).includes(d.upperMotion)
    d.weapon = stanceOf(me, k) ?? d.weapon
    d.face = aiming ? (Math.abs(across) > limits.across ? wrap(d.look.yaw - Math.sign(across) * limits.across) : d.yaw) : d.guard ? d.look.yaw : null
    d.want = [wx, wz]
    // Aimed the way the camera looks: along its yaw, and down by its pitch within the rig's `aim.up` and `aim.down`.
    const up = clamp(-d.look.pitch, -limits.down, limits.up)
    d.aim = [math.sin(d.look.yaw) * math.cos(up), math.sin(up), math.cos(d.look.yaw) * math.cos(up)]
    // The guard held raises a block or an aim whenever one may come up, and let go lowers it.
    press(me, w, d.guard ? 'guard' : 'unguard', d.stick)
    buffered(me, w, dt, k)
    const was = { clip: d.clip, t: d.clipT }
    drive(me, w, dt, d.stick)
    blow(me, w, k, was)
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.stick = [x, 0 - (y as number)]
    },
    turn(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.turning = [x, y]
    },
    fast(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.fast = v === 1
    },
    guard(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.guard = v === 1
    },
    press(me, _w, _seat, key: unknown) {
      const d = me.data
      if (typeof key !== 'string' || !d.stood) return
      d.queued = { key, age: 0 }
    },
    target(me, w) {
      const d = me.data
      if (!d.stood) return
      const range = def(w, me.kind).target.range
      // The living mobs within range, nearest first; the one after the target, or the nearest.
      const near = w.all('mob')
        .filter(z => !z.data.dead)
        .map(z => ({ z, gap: math.hypot(z.data.pos[0] - d.pos[0], z.data.pos[2] - d.pos[2]) }))
        .filter(o => o.gap <= range)
        .sort((a, b) => a.gap - b.gap || a.z.id - b.z.id)
        .map(o => o.z.id)
      if (!near.length) {
        d.target = null
        return
      }
      const i = near.indexOf(d.target)
      d.target = near[(i + 1) % near.length]
    },
    look(me, w, _seat, dyaw: unknown, dpitch: unknown) {
      if (!finite(dyaw, dpitch)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, yaw: wrap(l.yaw + (dyaw as number)), pitch: clamp(l.pitch + (dpitch as number), c.minPitch, c.maxPitch) }
    },
    zoom(me, w, _seat, by: unknown) {
      if (!finite(by)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, dist: clamp(l.dist * math.exp((by as number) * c.zoom), c.minDist, c.maxDist) }
    },
  },
}
