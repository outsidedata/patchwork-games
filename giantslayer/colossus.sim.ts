// The colossus: a Mixamo body baked at its rig's `size` (`assets/colossus/colossus.rig.json`), drawn by
// anim, walking on walker. It stands breathing until a hero comes within its definition's `notice`
// metres, then turns to it and walks toward it at `pace` m/s, and stops `near` metres from it.
//
// The row: walker's and anim's fields; `placed`, stood on the ground once.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { groundOf, numbers, stand, walk } from '#plugins/walker/walker.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export const colossus: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.placed) return
    const [x, , z] = d.pos
    d.pos = [x, stand(numbers(me, w), groundOf(w), x, z), z]
    d.placed = true
  },
  tick(me, dt, w) {
    const d = me.data
    const k = def(w, me.kind)
    const hero = w.all('player')[0]
    d.want = [0, 0]
    d.face = null
    if (hero) {
      const dx = hero.data.pos[0] - d.pos[0], dz = hero.data.pos[2] - d.pos[2]
      const far = math.hypot(dx, dz)
      if (far < k.notice) {
        d.face = math.atan2(dx, dz)
        if (far > k.near) d.want = [(dx / far) * k.pace, (dz / far) * k.pace]
      }
    }
    walk(me, w, dt, groundOf(w))
    animate(me, w, dt)
  },
}
