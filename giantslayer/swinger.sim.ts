// A swinging ball: a sphere the hero climbs, hung from a pivot and swinging back and forth under it as a
// pendulum does, one `actors` entry each, its size and cells its definition's `radius` and `cell`, the
// climb plugin's `sphere` (its definition's `shape`, "sphere"), and how it swings its `length` (metres
// from the pivot down to its middle), `swing` (radians to either side of hanging straight down) and
// `period` (seconds there and back). Its row is where its middle is, `pos`, turned by `yaw` and tipped
// back by `pitch` (radians), as a sphere is. On its first step its middle stands that high over the
// ground under it (climb's `settle`), `placed` once it has, hanging straight down from a pivot `length`
// over that, `home`; each step after, `t` seconds on, it has swung its swing times the sine of the way
// round its period, about its own x through the pivot: toward its front, its middle that far round the
// pivot and itself tipped back by as much (`pitch`), as one rigid thing swings, before anything holding
// it moves (`before`), so one climbing it is carried with it.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { heldWay, settle } from './plugins/climb/climb.sim.ts'

export const swinger: Kind = {
  before(me, dt, w) {
    settle(me, w)
    const d = me.data, k = def(w, me.kind)
    if (!d.home) d.home = [...d.pos]
    else d.t += dt
    const a = k.swing * Math.sin((2 * Math.PI * d.t) / k.period)
    d.pitch = a
    // Down from the pivot, swung: hanging straight down, turned toward its front by `a`.
    const front = heldWay({ data: { pos: d.home, yaw: d.yaw, pitch: 0 } }, [0, 0, 1])
    d.pos = d.home.map((v: number, i: number) => v + k.length * ((i === 1 ? 1 - Math.cos(a) : 0) + front[i] * Math.sin(a)))
  },
}
