// Where a seat's hero starts: a `start` actor of the scene, one per slot, holding the slot in `slot`,
// the place in `pos` (its height is the ground's, found when the hero stands there) and the way it
// faces in `yaw`. The `player` row stands itself on the start of its slot. It has no rule and is not
// drawn.
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}
