// A sphere: a ball the hero climbs, one `actors` entry each, its size and the cells its surface is made
// of its definition's `radius` (metres) and `cell` (metres), the climb plugin's `sphere` (its definition's
// `shape`, "sphere"). Its row is where its middle is, `pos`, turned by `yaw` and tipped back by `pitch`
// (radians), as a wall is. On its first step its middle stands that high over the ground under it
// (climb's `settle`), `placed` once it has. It has no other rule.
import type { Kind } from '#engine/engine.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const sphere: Kind = {
  before(me, _dt, w) {
    settle(me, w)
  },
}
