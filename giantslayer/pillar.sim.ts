// A pillar: a thick cylinder the hero climbs, one `actors` entry each, its size and the cells its surface
// is made of its definition's `radius`, `length` and `cell` (metres), the climb plugin's `cylinder` (its
// definition's `shape`, "cylinder"). Its row is where its base's middle is, `pos`, turned by `yaw` and
// tipped back by `pitch` (radians; a half turn's half lays it on its back along the ground), as a wall
// is. On its first step its base stands that high over the ground under it (climb's `settle`), `placed`
// once it has. It has no other rule.
import type { Kind } from '#engine/engine.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const pillar: Kind = {
  before(me, _dt, w) {
    settle(me, w)
  },
}
