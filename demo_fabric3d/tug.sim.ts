// The tug: a shapes3d box (`world.shapes3d.kinds.tug`) that flies a level circle over the yard, towing the
// banner fabric3d holds to its tail (`plugins/towing`). Its definition: `centre` [x, y, z], the circle's
// middle and height, `radius` metres, and `speed` metres a second. Its row carries `round`, the radians it
// has flown round the circle, beside shapes3d's `pos`, `yaw` and `was`. Each step it flies on and is moved
// there by shapes3d's `move`, nose along the circle.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { move } from '#plugins/shapes3d/shapes3d.sim.ts'

export const tug: Kind = {
  tick(me, dt, w) {
    const k = def(w, me.kind)
    const round = (me.data.round + (k.speed / k.radius) * dt) % (2 * Math.PI)
    me.data.round = round
    const [cx, cy, cz] = k.centre
    move(w, me, [cx + math.sin(round) * k.radius, cy, cz + math.cos(round) * k.radius], round + Math.PI / 2)
  },
}
