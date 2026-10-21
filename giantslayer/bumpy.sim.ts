// A bumpy slab: a slab standing like a wall whose front rises and falls in bumps and dips, as skin over
// muscle does, the hero climbs, one `actors` entry each, its size and the cells its faces are made of its
// definition's `size` (`[width, height, depth]` metres) and `cell`, and its bumps its `waves` (whole
// waves across and up its front) and `height` (metres), the climb plugin's `bumps` (its definition's
// `shape`, "bumps"). Its row is where its base's middle stands, `pos`, turned by `yaw` and tipped back by
// `pitch` (radians), as a wall is. On its first step it stands that high over the ground under it
// (climb's `settle`), `placed` once it has. It has no other rule.
import type { Kind } from '#engine/engine.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const bumpy: Kind = {
  before(me, _dt, w) {
    settle(me, w)
  },
}
