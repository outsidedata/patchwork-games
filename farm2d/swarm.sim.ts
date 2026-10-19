// Where the bugs come from: one row, `next`, the seconds until the next bug creeps in. When it runs
// out a bug comes in at a point the die picks along one of its definition's `from`, each a stretch of
// the field's edge [[x, y], [x, y]] by the chickens' yard, unless `most` bugs are in the field
// already; either way the next comes `every` [least, most] seconds later. So bugs keep coming whether
// anyone pecks them or not, and never more than `most` at once.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { between } from './plugins/walk/walk.sim.ts'

export const swarm: Kind = {
  tick(me, dt, w) {
    const d = me.data, k = def(w, me.kind)
    d.next -= dt
    if (d.next > 0) return
    d.next = between(w, k.every)
    if (w.all('bug').length >= k.most) return
    const [[x0, y0], [x1, y1]] = k.from[Math.floor(w.die() * k.from.length)]
    const t = w.die()
    w.spawn('bug', { pos: [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t] })
  },
}
