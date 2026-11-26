// A hand with no body: it throws a fist (punch's, `plugins/punch`) at any point of a body, so a blow lands exactly
// where it is aimed, and fight3d (`world.fight3d.kinds.hand`) lands it as it lands the X Bot's: the same `Blow`, the
// strike's damage, knock and hitstop, the body frozen, shoved, bleeding and jolted. melee3d knows it by punch's word
// (`world.melee3d.kinds.hand`), so the fist is swept through the body's limbs as a fist of the X Bot's is.
//
// Its definition (`assets/demo_fight3d.json`'s `hand`): `speed`, m/s, how fast the fist flies; `run`, metres, how far
// short of the point it sets off and past it it flies; `size`, metres, the fist across, and how far behind its tip
// its blade reaches; `colour`, the ball punch's page half draws it as.
//
// The row: punch's `fist`, melee3d's `edges`, `swing` and `struck`, fight3d's `stop` (the hand's hitstop, through
// which its fist hangs where it met), and its own `thrown`, the throws it has taken.
//
// Its `tick`: frozen while `stop` lasts, else the fist flown on `speed` × dt; then fight3d's `strike`.
//
// `throw(strike, x, y, z, wx, wy, wz)`, open to every seat: a fist of fight3d's strike `strike` (one of the kind's
// `strikes`) thrown through the point [x, y, z] along the way [wx, wy, wz], made unit. It arrives from outside the
// program, so a strike the kind gives none for, a number that is not finite, or a way of no length is refused and
// writes nothing. A throw while a fist flies is a new swing: the fist in flight is put away, and the new one may land
// on a body the last one met.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { strike } from '#plugins/fight3d/fight3d.sim.ts'
import { fly, throws } from './plugins/punch/punch.sim.ts'

const finite = (v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))

export const hand: Kind = {
  tick(me, dt, w) {
    const d = me.data
    if (d.stop > 0) d.stop = Math.max(0, d.stop - dt)
    else fly(me, def(w, me.kind).speed * dt)
    strike(w, me, dt)
  },
  acts: {
    throw(me, w, _seat, name: unknown, ...v: unknown[]) {
      if (typeof name !== 'string' || v.length !== 6 || !finite(v)) return
      if (!Object.hasOwn(w.world.fight3d.kinds[me.kind].strikes, name)) return
      const [x, y, z, wx, wy, wz] = v as number[]
      const l = math.hypot(wx, wy, wz)
      if (!(l > 0)) return
      throws(me, name, [x, y, z], [wx / l, wy / l, wz / l], def(w, me.kind).run)
      // A new swing, even over one in flight: melee3d follows no path from where the last fist was, and nothing the
      // last one met is passed through.
      Object.assign(me.data, { edges: {}, swing: null, struck: [], stop: 0 })
      me.data.thrown += 1
    },
  },
  open: ['throw'],
}
