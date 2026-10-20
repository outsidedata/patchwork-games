// A ring of the course round the field: one `ring` actor of the sky for each, flown in `order`, its
// middle at `pos`, its face toward `yaw` (radians clockwise from north, −z, seen from above) and
// `pitch` up, so a plane flying that way passes through it. Its size and colours are its definition in
// `assets/flight.json`: `radius` (m, its inside), `tube` (m, the ring's thickness), `next` and `ahead`
// (colours of the seat's next ring and the rest), `glow`. A seat's ring course reads the rings
// (`rings`, `plugins/mission`); a ring has no rule, and `ring.client.ts` draws it.
import type { Kind } from '#engine/engine.ts'

export const ring: Kind = {}
