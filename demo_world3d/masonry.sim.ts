// The shapes of bridge: its field, ramps, deck and piers (`bridge.sim.ts`), drawn by solids from their looks. Every
// one of those kinds is this rule. shapes3d's ground stands the player on them. It has no rule. Main's and village's
// shapes are their place's, which world3d hands shapes3d, with no rows.
import type { Kind } from '#engine/engine.ts'

export const masonry: Kind = {}
