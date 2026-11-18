// The herd's drover: one `drover` actor of the herd scene, and its clock. `time` is the seconds the
// truth has run, the steps taken times the step's `dt`, as the page's clock counts them, set at the
// start of every step; every beast's `since` is a time on it. A beast walking (a `speed` above 0) that
// has walked the length of its line, from `pos` to `to`, is turned back along it: its `pos` the end it
// came to, its `to` the end it set out from, its `yaw` half a turn on and its `since` now, so crowd3d
// walks it back, its stride kept.
import type { Kind } from '#engine/engine.ts'

export const drover: Kind = {
  before(me, dt, w) {
    me.data.time = (Math.round(me.data.time / dt) + 1) * dt
    const time = me.data.time
    for (const b of w.all('beast')) {
      if (b.data.speed === 0) continue
      const [x, y, z] = b.data.pos, [tx, ty, tz] = b.data.to
      if (b.data.speed * (time - b.data.since) < Math.hypot(tx - x, tz - z)) continue
      b.data.pos = [tx, ty, tz]
      b.data.to = [x, y, z]
      b.data.yaw = b.data.yaw + Math.PI
      b.data.since = time
    }
  },
}
