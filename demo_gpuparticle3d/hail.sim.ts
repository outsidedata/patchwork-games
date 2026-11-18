// Hail: a point in the air that an effect falls from for as long as the row is there. It is drawn by
// nothing but that effect. Its definition in the scene's defs file is `effect`, the effect's name.
//
// The row: `pos` [x, y, z], and `fx`, the ledger entry of its effect, 0 until it has thrown it. Its first
// step it emits the effect at its `pos`, `from` itself (`plugins/gpuparticle3d/gpuparticle3d.sim.ts`).
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { emit } from '#plugins/gpuparticle3d/gpuparticle3d.sim.ts'

export const hail: Kind = {
  before(me, _dt, w) {
    if (me.data.fx) return
    me.data.fx = emit(w, def(w, me.kind).effect, me.data.pos, { from: me.id }).id
  },
}
