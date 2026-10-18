// A lift: a platform of its definition's `size` [x, y, z], a kinematic box3d body (made by the chamber's
// `kinds` mod) the walker stands on (`plugins/chamber`'s ground). It rides between its middle at `a`
// and at `b`, `speed` metres a second, as box3d's `target`, turning back at each end and resting `wait`
// seconds there; `going` is the end it is riding to, and `rest` the seconds it has left to rest.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export const lift: Kind = {
  tick(me, dt, w) {
    const { speed, wait } = def(w, me.kind)
    if (me.data.rest > 0) {
      me.data.rest = Math.max(0, me.data.rest - dt)
      me.data.target = { pos: [...me.data.pos], rot: [0, 0, 0, 1] }
      return
    }
    const goal: number[] = me.data.going === 'b' ? me.data.b : me.data.a
    const d = [0, 1, 2].map(i => goal[i] - me.data.pos[i])
    const left = math.hypot(d[0], d[1], d[2])
    const step = speed * dt
    if (left <= step) {
      me.data.target = { pos: [...goal], rot: [0, 0, 0, 1] }
      me.data.going = me.data.going === 'b' ? 'a' : 'b'
      me.data.rest = wait
      return
    }
    me.data.target = { pos: [0, 1, 2].map(i => me.data.pos[i] + (d[i] / left) * step), rot: [0, 0, 0, 1] }
  },
}
