// A wall: a box the hero climbs, one `actors` entry each, its size and the cells its faces are made of
// its definition's `size` (`[width, height, depth]` metres) and `cell` (metres), the climb plugin's
// `box`. Its row is where its base's middle stands, `pos`, and the way its front faces, `yaw`. On its
// first step it stands on the ground under it (walker's), `placed` once it has. It has no other rule.
import type { Kind } from '#engine/engine.ts'
import { groundOf } from '#plugins/walker/walker.sim.ts'

export const wall: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.placed) return
    const [x, , z] = d.pos
    d.pos = [x, groundOf(w).height(x, z), z]
    d.placed = true
  },
}
