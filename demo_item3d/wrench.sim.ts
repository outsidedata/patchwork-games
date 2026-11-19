// A wrench lying loose: a row item3d draws as its item (`world.item3d.kinds.wrench`), at its `pos`
// [x, y, z] metres, turned by its `rot` [x, y, z, w]. It has no rule. The seat's `use` ends it when the
// villager takes it and spawns it again where its definition's `lies` says when the villager puts it
// back (`player.sim.ts`).
import type { Kind } from '#engine/engine.ts'

export const wrench: Kind = {}
