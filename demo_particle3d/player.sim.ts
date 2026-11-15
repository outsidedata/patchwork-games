// The row one seat possesses, and the body it plays: an X Bot (`as: "xbot"`) that walker walks
// (`plugins/walker`, its numbers `world.walker.kinds.xbot`) on shapes3d's ground (the room's floor, and
// round its walls), and anim plays (its `world.anim.kinds.xbot`). `addons/player` spawns it and writes the
// slot it gave the connection into `seat`, and every seat is sent it. Its own fields, beside walker's and
// anim's: `stick` [x, z], the keys' way, right and forward; `turning` [x, y],
// how far a gamepad's right stick is pushed right and down; `look` `{ yaw, pitch, dist }`,
// chasecamera3d's orbit about it, `lift` metres over its feet; and `stood`, once it stands on its slot's
// start. Every number is the player's definition in `assets/demo_particle3d.json`.
//
// `before` stands it once on the ground at its slot's `start` (`pos` [x, z]), facing the start's `yaw`,
// its look along it. Each step its look turns while `turning` is held, at the definition's `camera.turn`
// across and `tilt` up and down a second at full push, within `minPitch` and `maxPitch`; it runs the way
// the stick points from the camera's yaw, facing the way it goes, at `run` m/s, on shapes3d's ground for its feet (`shapes3d.walker.ts`'s `ground`); anim plays it from how it
// moved, and the travel of a clip that carries one, a landing's step, is carried by walker's `carry` and
// its turn on its `yaw`.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `turn(x, y)` (the right stick,
// the same), `jump`, `look(dyaw, dpitch)` the mouse dragged and `zoom(by)`
// the wheel's pixels. A seat's message arrives from outside the program, so each refuses arguments of
// the wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { land } from '#plugins/shapes3d/shapes3d.sim.ts'
import { ground } from '#plugins/shapes3d/shapes3d.walker.ts'
import { carry, numbers, relative, walk } from '#plugins/walker/walker.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1

// shapes3d's ground for a body whose feet stand at y = `feet`.
const underfoot = (me: Row, w: W, feet: number) => ground(w, feet, numbers(me, w))

export const player: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.stood) return
    const start = w.find('start', s => s.data.slot === d.seat).data
    const [x, z] = start.pos
    d.pos = [x, underfoot(me, w, land(w)(w, x, z)).height(x, z), z]
    d.yaw = start.yaw
    d.look = { ...d.look, yaw: start.yaw }
    d.grounded = true
    d.stood = true
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    if (d.turning[0] !== 0 || d.turning[1] !== 0) {
      const c = k.camera
      d.look = { ...d.look, yaw: wrap(d.look.yaw - d.turning[0] * c.turn * dt), pitch: clamp(d.look.pitch + d.turning[1] * c.tilt * dt, c.minPitch, c.maxPitch) }
    }
    const [wx, wz] = relative(d.stick, d.look.yaw)
    d.face = null
    d.want = [wx * k.run, wz * k.run]
    const on = underfoot(me, w, d.pos[1])
    walk(me, w, dt, on)
    const { travel } = animate(me, w, dt)
    if (travel.move[0] !== 0 || travel.move[1] !== 0) carry(me, w, travel.move, on)
    if (travel.yaw !== 0) d.yaw = wrap(d.yaw + travel.yaw)
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.stick = [x, 0 - (y as number)]
    },
    turn(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.turning = [x, y]
    },
    jump(me) {
      me.data.jump = true
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
