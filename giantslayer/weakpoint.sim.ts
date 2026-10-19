// A weak point on a colossus: a place on one of its limbs a hero holding on there can stab, one
// `actors` entry each. It names the colossus by `on` (the colossus's row is found by its kind and the
// point's `of`, the colossus's index in `w.all('colossus')`, on the first step), the segment it is on,
// how far `along` it (0 its first joint, 1 its second) and the angle `around` it, as a hold is
// (`plugins/climb`). Its `hp` starts at its definition's `hp`.
//
// `stab(power)`, a rule's (seat −1), takes `power` off its `hp`; at 0 it is `broken`, and the colossus
// it is on is hurt (its `hurt`).
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const weakpoint: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.on !== null) return
    d.on = w.all('colossus')[d.of].id
    d.hp = def(w, me.kind).hp
  },
  acts: {
    stab(me, w, seat, power: unknown) {
      const d = me.data
      if (seat !== -1 || d.broken || typeof power !== 'number') return
      d.hp = Math.max(0, d.hp - power)
      d.broken = d.hp === 0
      const giant = w.get(d.on)
      if (giant) w.call(giant, 'hurt', -1)
    },
  },
}
