// A corner: two walls at a right angle the hero climbs inside, one `actors` entry each, their size,
// thickness and the cells their faces are made of its definition's `size` (`[along x, high, along z]`
// metres), `thick` and `cell` (metres), the climb plugin's `corner` (its definition's `shape`,
// "corner"). Its row is where its outer corner's foot stands, `pos`, turned by `yaw` and tipped back by
// `pitch` (radians), as a wall is. On its first step it stands that high over the ground under it
// (climb's `settle`), `placed` once it has. It has no other rule.
import type { Kind } from '#engine/engine.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const corner: Kind = {
  before(me, _dt, w) {
    settle(me, w)
  },
}
