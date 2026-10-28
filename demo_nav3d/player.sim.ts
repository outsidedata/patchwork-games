// The seat's eye, its `player` row: it flies, and nothing stops it. `pos` [x, y, z] metres, `view`
// [yaw, pitch] radians (yaw θ looks along (sin θ, cos θ), pitch up). `before` puts it once on its
// slot's `start`, at that start's `pos` and `view`. Each step it moves its definition's `speed` metres
// a second, times its `fast` while `fast` is held, times 2 to the power of `pace`: along the way it
// looks, pitch and all, by `stick`'s y (back), across it by `stick`'s x (to the right), and straight up
// by `rise`. `look` turns the view by the radians it is handed, its pitch kept within the definition's
// `pitch` of level; `pace` takes the wheel's turn, a tenth of a power of two a notch.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

export const player: Kind = {
  before(me, _dt, w) {
    if (me.data.placed) return
    const start = w.find('start', s => s.data.slot === me.data.seat)
    me.data.pos = [...start.data.pos]
    me.data.view = [...start.data.view]
    me.data.placed = true
  },
  tick(me, dt, w) {
    const { speed, fast } = def(w, me.kind)
    const v = speed * (me.data.fast ? fast : 1) * math.pow(2, me.data.pace) * dt
    const [x, y] = me.data.stick
    const [yaw, pitch] = me.data.view
    const s = math.sin(yaw), c = math.cos(yaw), cp = math.cos(pitch), sp = math.sin(pitch)
    // Ahead is where it looks, (s cp, sp, c cp); its right (−c, 0, s); up (0, 1, 0).
    const ahead = -y, right = x, rise = me.data.rise
    const [px, py, pz] = me.data.pos
    me.data.pos = [
      px + (s * cp * ahead - c * right) * v,
      py + (sp * ahead + rise) * v,
      pz + (c * cp * ahead + s * right) * v,
    ]
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (!finite(x, y)) return
      me.data.stick = [clamp(x as number), clamp(y as number)]
    },
    rise(me, _w, _seat, v: unknown) {
      if (!finite(v)) return
      me.data.rise = clamp(v as number)
    },
    fast(me, _w, _seat, on: unknown) { me.data.fast = on === true || on === 1 },
    look(me, w, _seat, yaw: unknown, pitch: unknown) {
      if (!finite(yaw, pitch)) return
      const limit = def(w, me.kind).pitch
      const turned = me.data.view[0] + (yaw as number)
      me.data.view = [math.atan2(math.sin(turned), math.cos(turned)), Math.min(limit, Math.max(-limit, me.data.view[1] + (pitch as number)))]
    },
    pace(me, _w, _seat, dy: unknown) {
      if (!finite(dy)) return
      me.data.pace = Math.max(-4, Math.min(4, me.data.pace - Math.sign(dy as number) / 10))
    },
  },
}
