// A wall: a box the hero climbs, one `actors` entry each, its size and the cells its faces are made of
// its definition's `size` (`[width, height, depth]` metres) and `cell` (metres), the climb plugin's
// `box` (its definition's `shape`, "box"). Its row is where its base's middle stands, `pos`, the way its
// front faces, `yaw`, and how far it leans back, `pitch` (radians about its own x through its base's
// middle: its front faces up that much; under 0 it leans out over the one climbing it). On its first step
// it stands that high over the ground under it (climb's `settle`; 0 on the ground), `placed` once it has.
// It has no other rule.
import type { Kind } from '#engine/engine.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const wall: Kind = {
  before(me, _dt, w) {
    settle(me, w)
  },
}
