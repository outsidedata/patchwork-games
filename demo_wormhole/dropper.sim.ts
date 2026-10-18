// A dropper: a tube that keeps one row of its definition's `kind` in the world. Each step its last one
// (`made`) is gone, ended by a `field` or anything else, it spawns another at `pos`, at rest.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const dropper: Kind = {
  tick(me, _dt, w) {
    const { kind } = def(w, me.kind)
    if (me.data.made !== null && w.all(kind).some(r => r.id === me.data.made)) return
    me.data.made = w.spawn(kind, { pos: [...me.data.pos] }).id
  },
}
