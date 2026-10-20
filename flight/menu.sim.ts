// The pick screen: one `menu` actor of the sky, which every page draws for its own seat
// (`menu.client.ts`) on the ui's `menu` panel, a modal. Its definition in `assets/flight.json` holds the
// planes it offers, in order (`planes`: each plane's `type` in `world.flight3d.planes`, its `name` and
// its `picture`, a ui texture of the loader), the missions (`missions`: each its `name` and `label`), where
// a plane may start (`starts`: each its `name`, `ramp` or `air`, and its `label`), and where and how
// everything on it is drawn. A pick reaches the seat's `player` as its `pick` act, by the places of the
// plane, the mission and the start in those lists. It has no rule.
import type { Kind } from '#engine/engine.ts'

export const menu: Kind = {}
