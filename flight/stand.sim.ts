// Where a plane is kept: a `stand` actor of the sky for every plane, which names it (`name`, the plane's
// `stand`). `slot` is the seat slot whose plane it keeps, or -1 for one no seat keeps (the traffic and
// the formation's leads). The plane stands at its `pos`, its nose `heading` radians clockwise from −z
// seen from above and `pitch` radians up (a tailskid plane sits nose up), flying `speed` m/s along the
// heading with the lever at `throttle`: a stand on the apron has no speed, and a stand in the air is
// where a plane that only flies starts, and starts again after a crash. A stand in the air flies level
// at its speed, as `assets/airstarts.mts` works it out and writes it. It has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const stand: Kind = {}
