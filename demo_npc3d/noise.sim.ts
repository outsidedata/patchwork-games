// A noise: a row made at a place (by a testbed, `truth.spawn('noise', { pos })`) that, on its first
// step, makes a `noise` sound at its `pos` [x, y, z] that carries its definition's `loud` metres and
// stays `last` seconds (npc3d's `raise`), and ends.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { raise } from '#plugins/npc3d/npc3d.sim.ts'

export const noise: Kind = {
  tick(me, _dt, w) {
    const { loud, last } = def(w, me.kind)
    raise(w, me, 'noise', me.data.pos, loud, last)
    w.end(me)
  },
}
