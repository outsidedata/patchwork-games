// A faith plate: a pad lying on the floor at `pos` that launches what stands on it at the velocity
// `launch` [x, y, z], metres a second. A `player` row on the ground whose feet are within its
// definition's `radius` of the pad's middle across the floor, and within `reach` above it, is thrown so
// (its `zap`); a row of a kind the portals take resting there, likewise (its `vel`).
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const plate: Kind = {
  tick(me, _dt, w) {
    const { radius, reach } = def(w, me.kind)
    const [x, y, z] = me.data.pos
    const on = (p: number[]) => Math.hypot(p[0] - x, p[2] - z) < radius && p[1] >= y - 0.05 && p[1] <= y + reach
    const [vx, vy, vz] = me.data.launch
    for (const p of w.all('player')) if (p.data.grounded && on(p.data.pos)) w.call(p, 'zap', -1, vx, vy, vz, 0)
    for (const k of def(w, 'portal').takes as string[]) for (const r of w.all(k)) {
      if (r.data.inside === null && on(r.data.pos) && Math.abs(r.data.vel[1]) < 0.5) r.data.vel = [vx, vy, vz]
    }
  },
}
