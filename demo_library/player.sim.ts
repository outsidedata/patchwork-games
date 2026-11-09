// The row one seat possesses. `addons/player` spawns it, sends it to that seat alone, and writes the
// slot it gave the connection into `seat`. It looks at the place the scene draws and moves nothing.
import type { Kind } from '#engine/engine.ts'

export const player: Kind = {}
