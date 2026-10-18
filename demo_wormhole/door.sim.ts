// A door: a frame standing at `pos`, turned `yaw` about up, whose front is the side a player of the
// same `yaw` faces it from. The seat puts it down ahead of itself, spawning it the first time and
// moving it after (the `player` row's `place`). It has no rule of its own: the `player` row that walks
// through its front is taken out of the front of the door named `to` (`player.sim.ts`). Its
// definition gives its `width`, `height`, `post` and, by `name`, its colour.
import type { Kind } from '#engine/engine.ts'

export const door: Kind = {}
