// A crate: a box3d body (`pos`, `rot`, `vel`, `spin`) of its definition's `size`, its body made from
// its definition by the chamber's `kinds` mod (`plugins/chamber/chamber.box3d.ts`). box3d moves it, and
// near a portal the portal's own world does (`plugins/portal`, which names it `inside` that portal and
// keeps its speed in `drift`). It has no rule of its own.
import type { Kind } from '#engine/engine.ts'

export const crate: Kind = {}
