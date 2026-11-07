// Where a seat's body starts: a `start` actor of the scene, one per slot, a row for the slot in `slot`, at
// the place whose data says `start` in the nav3d graph its `graph` names (`player.sim.ts`'s `root`), or, where `graph` is '', at its `pos`. The `player` row puts its seat's body on the start of its slot.
// It has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}
