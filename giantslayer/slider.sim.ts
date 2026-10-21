// A sliding wall: a wall the hero climbs that slides to and fro along its width, one `actors` entry
// each, its size and cells its definition's `size` (`[width, height, depth]` metres) and `cell`, the
// climb plugin's `box` (its definition's `shape`, "box"), and how it slides its `reach` (metres to either
// side of where it starts) and `period` (seconds there and back). Its row is where its base's middle
// stands, `pos`, turned by `yaw` and tipped back by `pitch` (radians), as a wall is. On its first step
// it stands that high over the ground under it (climb's `settle`), `placed` once it has, and that is
// `home`; each step after, `t` seconds on, it stands its reach times the sine of the way round its
// period from home along its own width (`x`), before anything holding it moves (`before`), so one
// climbing it is carried with it.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { heldWay, settle } from './plugins/climb/climb.sim.ts'

export const slider: Kind = {
  before(me, dt, w) {
    settle(me, w)
    const d = me.data, k = def(w, me.kind)
    if (!d.home) d.home = [...d.pos]
    else d.t += dt
    const along = heldWay(me, [1, 0, 0]), by = k.reach * Math.sin((2 * Math.PI * d.t) / k.period)
    d.pos = d.home.map((v: number, i: number) => v + along[i] * by)
  },
}
