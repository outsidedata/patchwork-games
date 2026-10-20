// A bowl: the back half of a hollow ball the hero climbs inside, one `actors` entry each, its size,
// thickness and the cells its faces are made of its definition's `radius` (the inside's), `thick` and
// `cell` (metres), the climb plugin's `bowl` (its definition's `shape`, "bowl"). Its row is where its
// middle is, `pos`, its open side looking the way its front does, turned by `yaw` and tipped back by
// `pitch` (radians), as a wall is. On its first step its middle stands that high over the ground under it
// (climb's `settle`), `placed` once it has. It has no other rule.
import type { Kind } from '#engine/engine.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const bowl: Kind = {
  before(me, _dt, w) {
    settle(me, w)
  },
}
