// The row one seat possesses, and the body it plays: an X Bot (`as: "xbot"`) whose every step is
// motion3d's (`plugins/motion3d`, its numbers `world.motion3d.kinds.xbot`): walking on walker
// (`world.walker.kinds.xbot`, its activity `walk` walker's own), drawn and played by anim
// (`world.anim.kinds.xbot`), and the activities the zones it stands in offer. Every seat is sent every
// `player` row. Its own fields, beside walker's, anim's and motion3d's: `stick` [x, z], the keys' way,
// right and forward, which the ledge's logic reads too; `fast`, the run key held; `look` `{ yaw, pitch,
// dist }`, chasecamera3d's orbit about it, `lift` metres over its feet; `turning` [x, y], how far a
// gamepad's right stick is pushed right and down; `stood`, once it stands on its slot's start; and
// `stuck`, the ledge's (`plugins/zones/zones.motion3d.ts`).
//
// `before` stands it once on the ground at its slot's `start`, facing the start's `yaw`, its look along
// it. Each step its look turns while `turning` is held, at the definition's `camera.turn` across and
// `tilt` up and down a second at full push, the yaw less for a push right and the pitch more for a push
// down, within `minPitch` and `maxPitch`; it asks walker to go the way the stick points from the
// camera's yaw, at `walk` m/s or `run` with `fast` held, facing the way it goes; and motion3d steps it,
// which walks it while it is in `walk` and holds it while it plays what a space offers.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right
// stick, the same), `fast(v)` (1 held, 0 let go), `press(motion)`, a motion pressed (motion3d's
// `press`: `jump` walking's jump, `use` what the space it stands in offers), `look(dyaw, dpitch)` and
// `zoom(by)`, the wheel's pixels. A seat's message arrives from outside the program, so each refuses
// arguments of the wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { press, step } from '#plugins/motion3d/motion3d.sim.ts'
import { groundOf, relative } from '#plugins/walker/walker.sim.ts'

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
  d.pos = [x, groundOf(w).height(x, z), z]
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
    step(me, w, dt)
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
      if (typeof motion === 'string' && me.data.stood) press(me, w, motion)
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
