// A bending tube: a round tube standing up that bends at a joint as a limb does at its elbow, the hero
// climbs, one `actors` entry each, its size and cells its definition's `radius`, `length` and `cell`, the
// climb plugin's `cylinder` (its definition's `shape`, "cylinder"), where and how softly it bends its
// `bends` (`{ at, over }`, climb's bending: above `at` metres up it turns about its own x through that
// height, mixed in over `over` metres to either side), and how far and how fast its `most` (radians to
// either side of straight) and `period` (seconds there and back). Its row is where its base's middle
// stands, `pos`, turned by `yaw` and tipped back by `pitch` (radians), as a pillar is, and how far it is
// bent, `bend`. On its first step it stands that high over the ground under it (climb's `settle`),
// `placed` once it has; each step, `t` seconds on, it is bent its most times the sine of the way round
// its period, before anything holding it moves (`before`), so one climbing it is carried with it.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const tube: Kind = {
  before(me, dt, w) {
    const d = me.data, k = def(w, me.kind)
    if (d.placed) d.t += dt
    settle(me, w)
    d.bend = k.most * Math.sin((2 * Math.PI * d.t) / k.period)
  },
}
