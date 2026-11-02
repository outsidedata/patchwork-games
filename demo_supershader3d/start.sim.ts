// Where a seat's eye starts: a `start` actor of the scene, one per slot, holding `slot`, `at` [x, z],
// `up` metres over the ground there, and the `yaw` and `pitch` it looks along. The `player` row
// stands its eye on the start of its slot. It has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}
