// The row one seat possesses. `addons/player` spawns it, sends it to that seat alone, and writes the
// slot it gave the connection into `seat`. The seat only looks at the stage: it plays as nothing.
import type { Kind } from '#engine/engine.ts'

export const player: Kind = {}
