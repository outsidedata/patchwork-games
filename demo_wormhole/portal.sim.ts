// A portal: an opening `width` by `height` (its definition's) centred on `pos`, lying on the face of
// the chamber's box `on`, its front facing `normal`, its top toward `up`. The seat's clicks put it
// where the reticle points, spawning it the first time and moving it after (the `player` row's
// `place`), and the chamber lets it into the ground (`plugins/chamber`). It has no rule of its own:
// the `player` row whose body goes in at its front comes out of the front of the portal named `to`.
import type { Kind } from '#engine/engine.ts'

export const portal: Kind = {}
