// A crate: a box3d body (`pos`, `rot`, `vel`, `spin`), its body made from its definition by the
// chamber's `kinds` mod (`plugins/chamber/chamber.box3d.ts`). It has no rule of its own: box3d moves it.
import type { Kind } from '#engine/engine.ts'

export const crate: Kind = {}
