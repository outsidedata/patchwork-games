// The row one seat possesses, and the body it plays: an X Bot (`as: "xbot"`) moved by kinematics3d
// (`world.kinematics3d.kinds.xbot`) and played and drawn by motion3d (`world.motion3d.kinds.xbot`), every
// move it makes the X Bot's motion3d file's (`assets/xbot.motion3d.json`). Every seat is sent every
// `player` row. Its own fields, beside kinematics3d's and motion3d's: `stick` [x, z], the keys' way,
// right and forward; `fast`, the run key held; `look` `{ yaw, pitch, dist }`, chasecamera3d's orbit about
// it, `lift` metres over its feet; `turning` [x, y], how far a gamepad's right stick is pushed right and
// down; `aim`, the way the camera looks, which motion3d points the rifle along while it is up; and
// `stood`, once it stands on its slot's start. With the rifle up (the upper half's `aim`) the legs keep
// the way they face and strafe, turned only when the look is more than its rig's `aim.across`
// (radians) to either side of them; the aim's pitch is held within the rig's `aim.up` and `aim.down`.
//
// `before` stands it once on the ground at its slot's start, facing the start's `yaw`, its look along
// it. Each step its look turns while `turning` is held, at the definition's `camera.turn` across and
// `tilt` up and down a second at full push, the yaw less for a push right and the pitch more for a push
// down, within `minPitch` and `maxPitch`. The stick is its want: kinematics3d's `want`, the way the stick
// points from the camera's yaw at `walk` m/s or `run` with `fast` held, facing the way it goes; and
// motion3d's `drive`, which moves and plays the body by it.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right
// stick, the same), `fast(v)` (1 held, 0 let go), `press(key)`, a key pressed, handed to motion3d's
// `press` with the stick, and `jump` the body's jump where motion3d takes it for no move; `look(dyaw,
// dpitch)` and `zoom(by)`, the wheel's pixels. A seat's message arrives from outside the program, so each
// refuses arguments of the wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { drive, press } from '#plugins/motion3d/motion3d.sim.ts'
import { playKind, rigOf } from '#plugins/motion3d/motion3d.play.ts'
import { ground, relative } from '#plugins/kinematics3d/kinematics3d.sim.ts'

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
  // The ground beneath feet set at the land's level, then stood on it.
  d.pos = [x, 0, z]
  d.pos = [x, ground(me, w).height(x, z), z]
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
    // With the rifle up the legs keep the way they face, and strafe, turned only as far as keeps the aim
    // within the rig's `aim.across` of them; else they turn the way they go.
    const limits = rigOf(w, playKind(me)).aim
    if (!limits) throw new Error(`player: the rig of ${playKind(me)} gives no aim limits`)
    const across = wrap(d.look.yaw - d.yaw)
    d.face = d.upperMotion !== 'aim' ? null : Math.abs(across) > limits.across ? wrap(d.look.yaw - Math.sign(across) * limits.across) : d.yaw
    d.want = [wx * speed, wz * speed]
    // Aimed the way the camera looks: along its yaw, and down by its pitch within the rig's `aim.up` and `aim.down`.
    const up = clamp(-d.look.pitch, -limits.down, limits.up)
    d.aim = [math.sin(d.look.yaw) * math.cos(up), math.sin(up), math.cos(d.look.yaw) * math.cos(up)]
    drive(me, w, dt, d.stick)
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
    press(me, w, _seat, key: unknown) {
      const d = me.data
      if (typeof key !== 'string' || !d.stood) return
      if (!press(me, w, key, d.stick) && key === 'jump' && d.space === null) d.jump = true
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
