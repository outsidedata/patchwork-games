// A bowl: a slab standing like a wall with a hollow pressed into the middle of its front, the hero
// climbs in and out of, one `actors` entry each, its size and the cells its faces are made of its
// definition's `size` (`[width, height, depth]` metres) and `cell`, and its hollow the dent its `radius`
// ball makes pressed `depth` metres in (metres), the climb plugin's `dish` (its definition's `shape`,
// "dish"). Its row is where its base's middle stands, `pos`, turned by `yaw` and tipped back by `pitch`
// (radians), as a wall is. On its first step it stands that high over the ground under it (climb's
// `settle`), `placed` once it has. It has no other rule.
import type { Kind } from '#engine/engine.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const bowl: Kind = {
  before(me, _dt, w) {
    settle(me, w)
  },
}
