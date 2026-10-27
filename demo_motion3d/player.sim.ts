// The row one seat possesses, and the body it plays: an X Bot (`as: "xbot"`) moved by motion3d
// (`plugins/motion3d`, its numbers `world.motion3d.kinds.xbot` and the X Bot's motion3d file,
// `assets/xbot.motion3d.json`), its clips played and drawn by motion3d. Every seat is sent
// every `player` row. Its own fields, beside kinematics3d's and motion3d's: `stick` [x, z], the keys'
// way, right and forward; `fast`, the run key held; `look` `{ yaw, pitch, dist }`, chasecamera3d's orbit
// about it, `lift` metres over its feet; `turning` [x, y], how far a gamepad's right stick is pushed
// right and down; `stood`, once it stands on its slot's start; and `stuck`, the way the stick pushed when
// the end of a lip, a bar or a ceiling stopped the body hanging from it, 0 for none: it hangs there until
// the stick lets go or pushes the other way.
//
// `before` stands it once on the ground at its slot's start, facing the start's `yaw`, its look along
// it. Each step its look turns while `turning` is held, at the definition's `camera.turn` across and
// `tilt` up and down a second at full push, the yaw less for a push right and the pitch more for a push
// down, within `minPitch` and `maxPitch`. Then motion3d's `step`; a free body walks: kinematics3d's
// `walk` (its numbers `world.kinematics3d.kinds.xbot`) on the yard's shapes and land (shapes3d's
// `ground`, the top of the highest shape no more than a step above its feet, every shape rising past
// that and starting below its head walked round), the way the stick points from the camera's yaw at
// `walk` m/s or `run` with `fast` held, facing the way it goes, motion3d playing the motion this rule
// picks from how it moved (`moving`) and the travel of a clip that carries one, a landing's step, carried by
// kinematics3d's `carry`, its turn on its `yaw`. A held body is the game's: this
// rule picks each step what it plays, by its activity:
//   party, sad, swing, vault   held where the clip puts it until the clip has played out, then walking
//   ledge   `use`, `bracedjump`, up onto the `Lip`; then `hang`; the stick across moves along it (`move`,
//           the clip that travels the way the stick pushes) until the hands would leave it; `use` with
//           the stick forward climbs (`bracedclimb`), with it back drops onto the `Drop` line
//           (`braceddrop`); either played out, walking
//   bar, ceiling   `use`, `freejump`, up onto the `Bar` line or the `Ceiling` plane; then `hang`; the
//           stick across moves along it; `use` drops onto the `Drop` (`freedrop`), then walking
//   rope    held to the `Rope`, `ropeclimb` playing while the stick is forward and held still while not,
//           up to the top; `use` lets go
//   climb   held to the wall's `Face`, `wallclimb` up while the stick is forward, `walldown` down while
//           it is back, held still while neither, stopping at its top and its foot; `use` lets go
//   wallrun `wallside` along the `Wall`, then walking from where it ends
//   edge    `teeter` at the `Edge`; `use` steps down off it onto its `Drop` line (`jumpdown`), then
//           walking; the stick back steps away, walking
//   stairs  up the `Flight` (`stairsup`) while the stick is forward, standing while it is not, walking
//           from the landing at its top
//   pool    `poolin` onto the `Float` plane; then floating (`tread`), swimming ahead (`swimunder`) while
//           the stick is forward, until the far wall; `use` by the far wall, the body within 1.2 m of the
//           `Lip` along it, climbs out at it (`bracedclimb`), then walking
//   desk    `typing` on the `Seat`; `use` stands at the `Side`, walking
//   bed     `liedown` onto the `Bed`, then `lie` (`bedidle`); `use` gets up at the `Foot`, walking
//   car     `carin` onto the `Seat`, then `pilot` (`drive`), the hands on `WheelL` and `WheelR` (the car
//           takes the stick: `car.sim.ts`); `jump` honks (`honk`); `use` gets out (`carout`), then walking
//   chair   `sitdown` onto the `Seat`, then `seated`; `use` stands up (`standup`), then walking
// Every hand and foot a motion pins is pinned to the point it is held to, the car's hands to its wheel.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right
// stick, the same), `fast(v)` (1 held, 0 let go), `press(motion)`, a motion pressed (`jump` walking's
// jump, `use` what the space it stands in offers, or what the activity it is in does with it),
// `look(dyaw, dpitch)` and `zoom(by)`, the wheel's pixels. A seat's message arrives from outside the
// program, so each refuses arguments of the wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { clipOf, playKind, rigOf } from '#plugins/motion3d/motion3d.play.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { activityOf, hold, leave, moving, offering, play, point, settle, step } from '#plugins/motion3d/motion3d.sim.ts'
import { carry, numbers, relative, walk } from '#plugins/kinematics3d/kinematics3d.sim.ts'
import { ground } from '#plugins/shapes3d/shapes3d.kinematics3d.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1

const hands = (p: string) => ({ LeftHand: p, RightHand: p })
const feet = (p: string) => ({ LeftFoot: p, RightFoot: p })

// The point of its space each motion plays against, and the hands and feet it pins and where.
type Aim = { root?: string; ik?: Record<string, string> }
const AIMS: Record<string, Record<string, Aim>> = {
  ledge: { use: { root: 'Lip', ik: hands('Lip') }, hang: { root: 'Lip', ik: hands('Lip') }, move: { root: 'Lip', ik: hands('Lip') }, climb: { root: 'Lip', ik: hands('Lip') }, drop: { root: 'Drop' } },
  bar: { use: { root: 'Bar', ik: hands('Bar') }, hang: { root: 'Bar', ik: hands('Bar') }, move: { root: 'Bar', ik: hands('Bar') }, drop: { root: 'Drop' } },
  ceiling: { use: { root: 'Ceiling', ik: hands('Ceiling') }, hang: { root: 'Ceiling', ik: hands('Ceiling') }, move: { root: 'Ceiling', ik: hands('Ceiling') }, drop: { root: 'Drop' } },
  rope: { use: { root: 'Rope', ik: hands('Rope') } },
  swing: { use: { root: 'Start' } },
  climb: { use: { root: 'Face', ik: { ...hands('Face'), ...feet('Face') } }, down: { root: 'Face', ik: { ...hands('Face'), ...feet('Face') } } },
  wallrun: { use: { root: 'Wall', ik: feet('Wall') } },
  vault: { use: { root: 'Vault' } },
  edge: { use: { root: 'Edge', ik: feet('Edge') }, down: { root: 'Drop' } },
  stairs: { use: { root: 'Flight' } },
  pool: { use: { root: 'Float' }, float: { root: 'Float' }, swim: { root: 'Float' }, out: { root: 'Lip', ik: hands('Lip') } },
  desk: { use: { root: 'Seat' } },
  bed: { use: { root: 'Bed' }, lie: { root: 'Bed' } },
  car: { use: { root: 'Seat' }, pilot: { root: 'Seat', ik: { LeftHand: 'WheelL', RightHand: 'WheelR' } }, honk: { root: 'Seat' }, out: { root: 'Seat' } },
  chair: { use: { root: 'Seat' }, seated: { root: 'Seat' }, stand: { root: 'Seat' } },
}
const aimOf = (activity: string, motion: string): Aim => AIMS[activity]?.[motion] ?? {}

// The motion of the activity the body is in played, against its point: its `clip`, or one picked.
function go(me: Row, w: W, motion: string, clip?: string) {
  const d = me.data
  const a = aimOf(d.activity, motion)
  play(me, w, d.activity, d.space, motion, a.root, a.ik, clip)
}

// The clip a held loop plays at, playing while `on` and held still while not (the row's `rate`).
const pace = (me: Row, on: boolean) => { me.data.rate = on ? 1 : 0 }

// One step of a body hanging (`hang`) or moving along what it hangs from (`move`): the clip of `move`'s
// that goes the way the stick pushes across (its measured travel, left or right of the body) until the
// end stops it, hanging still while the stick lets go or the end stops it.
function hanging(me: Row, w: W, dt: number) {
  const d = me.data
  const way = Math.sign(d.stick[0])
  const { stopped } = hold(me, w, dt)
  if (stopped) d.stuck = way
  if (way !== d.stuck) d.stuck = 0
  if (way === 0 || way === d.stuck) return go(me, w, 'hang')
  const rig = rigOf(w, playKind(me))
  const clips = activityOf(w, me, d.activity).motions.move.clips
  // The stick pushes right for a clip that travels to the body's right, its measured left below 0.
  const clip = clips.find(c => Math.sign(-clipOf(rig, c).measure.left) === way)
  if (!clip) throw new Error(`demo_motion3d: no clip of ${clips.join(', ')} moves the body ${way > 0 ? 'right' : 'left'}`)
  go(me, w, 'move', clip)
}

// One step of a body held until its clip has played out, `next` its motion after `use` (none, walking).
function through(me: Row, w: W, dt: number, next?: string) {
  const h = hold(me, w, dt)
  if (!h.ended) return
  if (next && me.data.motion === 'use') go(me, w, next)
  else leave(me, w, undefined, h.clip)
}

// One step of a held body, by its activity.
const STEPS: Record<string, (me: Row, w: W, dt: number) => void> = {
  party: (me, w, dt) => through(me, w, dt),
  sad: (me, w, dt) => through(me, w, dt),
  swing: (me, w, dt) => through(me, w, dt),
  vault: (me, w, dt) => through(me, w, dt),
  wallrun: (me, w, dt) => through(me, w, dt),
  ledge: (me, w, dt) => (me.data.motion === 'hang' || me.data.motion === 'move' ? hanging(me, w, dt) : through(me, w, dt, 'hang')),
  bar: (me, w, dt) => (me.data.motion === 'hang' || me.data.motion === 'move' ? hanging(me, w, dt) : through(me, w, dt, 'hang')),
  ceiling: (me, w, dt) => (me.data.motion === 'hang' || me.data.motion === 'move' ? hanging(me, w, dt) : through(me, w, dt, 'hang')),
  rope(me, w, dt) {
    const { stopped } = hold(me, w, dt)
    pace(me, me.data.stick[1] > 0 && !stopped)
  },
  climb(me, w, dt) {
    const d = me.data
    const way = Math.sign(d.stick[1])
    if (way > 0 && d.motion !== 'use') go(me, w, 'use')
    if (way < 0 && d.motion !== 'down') go(me, w, 'down')
    const { stopped } = hold(me, w, dt)
    pace(me, way !== 0 && !stopped)
  },
  edge(me, w, dt) {
    const d = me.data
    const h = hold(me, w, dt)
    if (d.motion === 'down') {
      if (h.ended) leave(me, w, undefined, h.clip)
      return
    }
    if (d.stick[1] < 0) leave(me, w)
  },
  stairs(me, w, dt) {
    // Before the first step is taken, the root at the flight's foot, where the clip's first lap stands
    // its feet on the first step; a lap on, on the next two.
    if (me.data.clipT === 0) me.data.along = 0
    const { stopped } = hold(me, w, dt)
    if (stopped) return leave(me, w)
    pace(me, me.data.stick[1] > 0)
  },
  pool(me, w, dt) {
    const d = me.data
    if (d.motion === 'float' || d.motion === 'swim') {
      const { stopped } = hold(me, w, dt)
      go(me, w, d.stick[1] > 0 && !stopped ? 'swim' : 'float')
      return
    }
    through(me, w, dt, 'float')
  },
  desk: (me, w, dt) => { hold(me, w, dt) },
  bed(me, w, dt) {
    const { ended } = hold(me, w, dt)
    if (ended && me.data.motion === 'use') go(me, w, 'lie')
  },
  car(me, w, dt) {
    const h = hold(me, w, dt)
    if (!h.ended) return
    if (me.data.motion === 'out') leave(me, w, undefined, h.clip)
    else go(me, w, 'pilot')
  },
  chair(me, w, dt) {
    const h = hold(me, w, dt)
    if (!h.ended) return
    if (me.data.motion === 'use') go(me, w, 'seated')
    else leave(me, w, undefined, h.clip)
  },
}

// A key pressed while the body is held, by its activity: what it does with it. Every held activity takes
// every key.
const PRESSES: Record<string, (me: Row, w: W, motion: string) => void> = {
  ledge(me, w, motion) {
    const d = me.data
    if (motion !== 'use' || (d.motion !== 'hang' && d.motion !== 'move')) return
    if (d.stick[1] > 0) go(me, w, 'climb')
    else if (d.stick[1] < 0) go(me, w, 'drop')
  },
  bar(me, w, motion) {
    if (motion === 'use' && (me.data.motion === 'hang' || me.data.motion === 'move')) go(me, w, 'drop')
  },
  ceiling(me, w, motion) {
    if (motion === 'use' && (me.data.motion === 'hang' || me.data.motion === 'move')) go(me, w, 'drop')
  },
  rope(me, w, motion) {
    if (motion === 'use') leave(me, w)
  },
  climb(me, w, motion) {
    if (motion === 'use') leave(me, w)
  },
  edge(me, w, motion) {
    if (motion === 'use' && me.data.motion === 'use') go(me, w, 'down')
  },
  pool(me, w, motion) {
    const d = me.data
    // Out by the far wall: the body's place on the water within a body's length of its far side.
    if (motion === 'use' && (d.motion === 'float' || d.motion === 'swim')) {
      const far = point(me, w, 'Lip').at
      if (Math.abs(far[2] - d.pos[2]) < 1.2) go(me, w, 'out')
    }
  },
  desk(me, w, motion) {
    if (motion !== 'use') return
    const { at, yaw } = point(me, w, 'Side')
    leave(me, w, [...at, yaw])
  },
  bed(me, w, motion) {
    if (motion !== 'use' || me.data.motion !== 'lie') return
    const { at, yaw } = point(me, w, 'Foot')
    leave(me, w, [...at, yaw])
  },
  car(me, w, motion) {
    const d = me.data
    if (d.motion === 'pilot' && motion === 'use') go(me, w, 'out')
    if (d.motion === 'pilot' && motion === 'jump') go(me, w, 'honk')
  },
  chair(me, w, motion) {
    if (motion === 'use' && me.data.motion === 'seated') go(me, w, 'stand')
  },
}

const WALKING = ['stand', 'walk', 'run', 'jump', 'fall', 'land']

// The motion of `walk` a free body plays, by how kinematics3d moved it this step, `was` whether it stood
// on the ground before it and `sink` how fast it fell then, m/s. In the air: leaving the ground rising,
// `jump`, played through, and `fall` once it has played out in the air; falling faster than the
// definition's `fall`, `fall`, until it comes down; falling slower (a step down a stair, or handed back
// a little over the floor), on as it was, or `stand`.
// Coming down from a jump or a fall, or after falling faster than the definition's `land`, `land`,
// played through. On the ground, slower than `world.motion3d.still`, `stand`; else `run` with the run
// key held and `walk` without.
function walking(me: Row, w: W, was: boolean, sink: number): string {
  const d = me.data
  const k = def(w, me.kind)
  const playing = (motion: string) => d.motion === motion && d.state === 'act'
  if (!d.grounded) {
    if (playing('jump') || playing('fall')) return d.motion
    if (d.motion === 'jump') return 'fall'
    if (was && d.vel[1] > 0) return 'jump'
    if (-d.vel[1] > k.fall) return 'fall'
    return WALKING.includes(d.motion) ? d.motion : 'stand'
  }
  if (playing('land') || (!was && (sink > k.land || d.motion === 'fall' || d.motion === 'jump'))) return 'land'
  if (d.speed < w.world.motion3d.still) return 'stand'
  return d.fast ? 'run' : 'walk'
}

// One step of a free body walking on the yard's shapes and land (the header): kinematics3d moves it,
// the game picks its motion, motion3d plays it (standing still in the cold room, its shiver over it).
function stride(me: Row, w: W, dt: number) {
  const d = me.data
  const on = ground(w, d.pos[1], numbers(me, w))
  const was = d.grounded
  const sink = -d.vel[1]
  walk(me, w, dt, on)
  const { travel } = moving(me, w, dt, walking(me, w, was, sink), d.speed)
  if (travel.move[0] !== 0 || travel.move[1] !== 0) carry(me, w, travel.move, on)
  if (travel.yaw !== 0) d.yaw = wrap(d.yaw + travel.yaw)
}

// The view turns while the right stick is held, whatever the body does.
function view(me: Row, dt: number, k: any) {
  const d = me.data
  if (d.turning[0] === 0 && d.turning[1] === 0) return
  const c = k.camera
  d.look = { ...d.look, yaw: wrap(d.look.yaw - d.turning[0] * c.turn * dt), pitch: clamp(d.look.pitch + d.turning[1] * c.tilt * dt, c.minPitch, c.maxPitch) }
}

// The body stood once on the ground at its slot's start, facing the start's yaw, its look along it.
function stood(me: Row, w: W) {
  const d = me.data
  const start = w.find('start', s => s.data.slot === d.seat).data
  const [x, z] = start.pos
  d.pos = [x, ground(w, 0, numbers(me, w)).height(x, z), z]
  d.yaw = start.yaw
  d.look = { ...d.look, yaw: start.yaw }
  d.grounded = true
  d.stood = true
}

export const player: Kind = {
  before(me, _dt, w) {
    if (!me.data.stood) stood(me, w)
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    view(me, dt, k)
    const [wx, wz] = relative(d.stick, d.look.yaw)
    const speed = d.fast ? k.run : k.walk
    d.face = null
    d.want = [wx * speed, wz * speed]
    const state = step(me, w)
    if (state === 'settling') return settle(me, () => stride(me, w, dt))
    if (state === 'free') return stride(me, w, dt)
    const held = STEPS[d.activity]
    if (!held) throw new Error(`demo_motion3d has no step for the activity ${d.activity}`)
    held(me, w, dt)
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
    press(me, w, _seat, motion: unknown) {
      const d = me.data
      if (typeof motion !== 'string' || !d.stood) return
      if (d.space !== null) {
        PRESSES[d.activity]?.(me, w, motion)
        return
      }
      if (motion === 'jump') {
        d.jump = true
        return
      }
      const found = offering(me, w, motion)
      if (!found) return
      const a = aimOf(found.activity, motion)
      play(me, w, found.activity, found.space, motion, a.root, a.ik)
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
