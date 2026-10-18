// A floor button: a plate lying on the floor at `pos`. `on` is whether a row of a kind its definition's
// `pressedBy` names stands on it: its `pos` within `radius` of the plate's middle across the floor, and
// within `reach` above it. A door naming its `name` opens while it is on.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const button: Kind = {
  tick(me, _dt, w) {
    const { radius, reach, pressedBy } = def(w, me.kind)
    const [x, y, z] = me.data.pos
    me.data.on = (pressedBy as string[]).some(k => w.all(k).some(r => {
      const [px, py, pz] = r.data.pos
      return Math.hypot(px - x, pz - z) < radius && py >= y - 0.05 && py <= y + reach
    }))
  },
}
