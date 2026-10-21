// A tipping wall: a wall the hero climbs that tips back and forth about its base, one `actors` entry
// each, its size and cells its definition's `size` (`[width, height, depth]` metres) and `cell`, the
// climb plugin's `box` (its definition's `shape`, "box"), and how it tips its `tip` (radians to either
// side of how it stands) and `period` (seconds there and back). Its row is where its base's middle
// stands, `pos`, turned by `yaw` and tipped back by `pitch` (radians about its own x through its base's
// middle), as a wall is. On its first step it stands that high over the ground under it (climb's
// `settle`), `placed` once it has, and the pitch it stands at is `home`; each step after, `t` seconds on,
// it is tipped back from that by its tip times the sine of the way round its period, before anything
// holding it moves (`before`), so one climbing it is carried with it.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { settle } from './plugins/climb/climb.sim.ts'

export const tipper: Kind = {
  before(me, dt, w) {
    settle(me, w)
    const d = me.data, k = def(w, me.kind)
    if (d.home === null) d.home = d.pitch
    else d.t += dt
    d.pitch = d.home + k.tip * Math.sin((2 * Math.PI * d.t) / k.period)
  },
}
