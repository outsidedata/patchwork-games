// Where a seat's plane starts in the air: a `start` actor of the sky for each slot, each plane and each
// mission flown from the air: the slot in `slot`; the `plane` of `world.flight3d.planes` it starts;
// `from`, `air`; `mission`, the mission it starts. The plane starts at its `pos`, its nose `heading`
// radians clockwise from −z seen from above and `pitch` radians up (it flies its nose on its angle of
// attack), flying `speed` m/s along the heading with the lever at `throttle`, level at its plane's
// hands-off trim, as `assets/airstarts.mts` works it out and writes it. A plane started on the ramp
// starts on its stand (`stand.sim.ts`), and one started in the air on the formation in its slot off the
// lead (`plugins/mission`'s `inSlot`). The `player` row starts its seat's plane on the start of its slot,
// plane and mission. It has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}
