// The one point of the room every pad's effect is thrown from: a `stage` actor of the scene, a row at
// its `pos` [x, y, z] on the floor, and nothing else. Each `pad` throws its effect from the stage, its
// entry's `lift` over it, wherever the pad lies. It has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const stage: Kind = {}
