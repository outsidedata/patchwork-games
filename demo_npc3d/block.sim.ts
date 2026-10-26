// A block: a shapes3d box standing on the ground at its row's `pos`, turned by its `yaw`, the scene's
// `world.shapes3d.kinds.block` saying how big, which walkers walk round, which blocks a sight and a
// shot, which nav3d's bake reads as solid, and which solids draws by its look (`plugins/shapes3d`). It
// has no rule.
import type { Kind } from '#engine/engine.ts'

export const block: Kind = {}
