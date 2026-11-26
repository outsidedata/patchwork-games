// The row one seat possesses, and the body it fights with: an X Bot (`as: "xbot"`) moved by kinematics3d
// (`world.kinematics3d.kinds.xbot`) and played and drawn by motion3d (`world.motion3d.kinds.xbot`), unarmed, every move
// it makes the X Bot's motion3d file's (`assets/xbot.motion3d.json`). Every seat is sent every `player` row. Its own
// fields, beside kinematics3d's, motion3d's, melee3d's and fight3d's: `stick` [x, z], the keys' way, right and forward;
// `fast`, the run key held; `guard`, the guard key held; `look` `{ yaw, pitch, dist }`, chasecamera3d's orbit about
// it, `lift` metres over its feet; `turning` [x, y], how far a gamepad's right stick is pushed right and down;
// `target`, the middle of the nearest row of the definition's `targets` kinds within its `lock` metres, or null, which
// motion3d bends a strike onto (its Warp); and `stood`, once it stands on its slot's start.
//
// Facing. With the guard key held the body faces the way the camera looks and strafes (`guard`, stance's state).
// Else it turns the way it goes.
//
// The keys. Each key pressed is held in motion3d's input buffer (`queue`; the X Bot's motion3d file's `buffer`): a
// light pressed during a light plays the next of its chain once the first has struck, and a roll pressed during one
// cuts it short once it may. The guard key is held, not pressed: each step it is held `guard` is pressed and each
// step it is not, `unguard`.
//
// `before` stands it once on the ground at its slot's start, facing the start's `yaw`, its look along it. Each step
// its look turns while `turning` is held, at the definition's `camera.turn` across and `tilt` up and down a second at
// full push, the yaw less for a push right and the pitch more for a push down, within `minPitch` and `maxPitch`. The
// stick is its want: kinematics3d's `want`, the way the stick points from the camera's yaw, as hard as it is pushed
// (the clip it plays says how fast); and motion3d's `drive`, which moves and plays the body by it, honouring the
// row's `stop` (motion3d's Hitstop). Then its strikes land (fight3d's `strike`): the fist or shin its swing strikes
// with, swept by melee3d through the foe, lands a blow on the first limb it meets and freezes the body for the
// strike's hitstop.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right stick, the same),
// `fast(v)`, `guard(v)` and `jumping(v)` (1 held, 0 let go; `jumping` is the jump key, motion3d's `jumpHeld`, so a
// jump let go of as it rises is cut short), `press(key)`, a key pressed, queued to motion3d; `look(dyaw, dpitch)` and
// `zoom(by)`, the wheel's pixels. A seat's message arrives from outside the program, so each refuses arguments of the
// wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { drive, press, queue } from '#plugins/motion3d/motion3d.sim.ts'
import { nearest, relative } from '#plugins/kinematics3d/kinematics3d.sim.ts'
import { strike } from '#plugins/fight3d/fight3d.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1

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
  // The triangles beneath feet set at the land's level, then stood on them.
  d.pos = nearest(w, { triangles: {} }, [x, 0, z], me)
  d.yaw = start.yaw
  d.look = { ...d.look, yaw: start.yaw }
  d.stood = true
}

// The middle of the nearest standing row of the `targets` kinds within `lock` metres across the ground, at its feet,
// or null.
function targetOf(me: Row, w: W, targets: string[], lock: number): number[] | null {
  const [x, , z] = me.data.pos
  let best: number[] | null = null, most = lock
  for (const t of targets.flatMap(kind => w.all(kind))) {
    if (t.data.limp) continue
    const far = math.hypot(t.data.pos[0] - x, t.data.pos[2] - z)
    if (far <= most) { most = far; best = [...t.data.pos] }
  }
  return best
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
    // With the guard held the legs face the look; else they turn the way they go.
    d.face = d.guard ? d.look.yaw : null
    d.want = [wx, wz]
    // The guard held raises a block whenever one may come up, and let go lowers it.
    press(me, w, d.guard ? 'guard' : 'unguard', d.stick)
    // The target a strike is bent onto (motion3d's Warp): the nearest of `targets` within `lock` metres.
    d.target = targetOf(me, w, k.targets, k.lock)
    drive(me, w, dt, d.stick)
    // The fist or shin swept through what it meets.
    strike(w, me, dt)
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
    jumping(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.jumpHeld = v === 1
    },
    press(me, w, _seat, key: unknown) {
      if (typeof key !== 'string' || !me.data.stood) return
      queue(me, w, key)
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
