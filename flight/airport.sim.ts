// The airfield: one `airport` actor of the sky, standing the model its definition in
// `assets/flight.json` names at the actor's `pos`, turned by its `yaw` about the vertical. Everything
// else of the field is its definition: the runway, taxiway, apron, hangars, tower and windsock, in the
// field's own frame (x east, z south, the runway's middle at its origin), the numbers the model was
// built from (`assets/airport.py`) and the land was flattened for (`assets/land.json`'s layer, 116 m).
// It has no rule; `airport.client.ts` draws it.
import type { Kind } from '#engine/engine.ts'

export const airport: Kind = {}
