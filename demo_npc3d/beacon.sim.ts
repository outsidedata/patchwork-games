// A beacon: a row made at a place (by a testbed, `truth.spawn('beacon', { pos })`) that, on its first
// step, orders every row of the kinds its definition's `calls` lists to start its definition's `key` at
// its `pos` [x, y, z] (npc3d's `order`), and ends.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const beacon: Kind = {
  tick(me, _dt, w) {
    const { calls, key } = def(w, me.kind)
    for (const kind of calls) for (const row of w.all(kind)) w.call(row, 'order', -1, key, me.data.pos[0], me.data.pos[1], me.data.pos[2])
    w.end(me)
  },
}
