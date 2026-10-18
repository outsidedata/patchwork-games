// A ball: a box3d body (`pos`, `rot`, `vel`, `spin`) of its definition's `radius`, its body made from
// its definition by the chamber's `kinds` mod (`plugins/chamber/chamber.box3d.ts`). box3d moves it, and
// near a portal the portal's own world does (`plugins/portal`). It has no rule of its own.
import type { Kind } from '#engine/engine.ts'

export const ball: Kind = {}
