// A door: a slab of its definition's `size` [across x, up, across z], a kinematic box3d body (made by
// the chamber's `kinds` mod) and solid to the walker (`plugins/chamber`'s ground). Closed it stands
// with its middle at `base`; while any `catcher` or `button` whose `name` its `by` lists is on, it
// sinks into the floor, its middle `size`'s height under `base`, moving `speed` metres a second toward
// whichever it is going to, as box3d's `target`.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const door: Kind = {
  tick(me, dt, w) {
    const { size, speed } = def(w, me.kind)
    const by: string[] = me.data.by
    const open = ['catcher', 'button'].some(k => w.all(k).some(s => by.includes(s.data.name) && s.data.on))
    const [bx, by0, bz] = me.data.base
    const goal = open ? by0 - size[1] : by0
    const y = me.data.pos[1]
    const step = Math.max(-speed * dt, Math.min(speed * dt, goal - y))
    me.data.open = open
    me.data.target = { pos: [bx, y + step, bz], rot: [0, 0, 0, 1] }
  },
}
