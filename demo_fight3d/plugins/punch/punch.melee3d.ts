// punch's mod for melee3d (`addons/scenemanager`'s Mods): the word `punch`, a row that throws fists (`punch.sim.ts`).
// A scene names it in `world.melee3d.mods.behaviors: ['punch']`, and a kind of `world.melee3d.kinds` that gives
// `{ punch: {} }` is one; it has no numbers of its own, the fist's size being its kind's definition's `size`.
//   blades    the fist in flight, its tip where it has flown to and its guard `size` metres behind; none while none
//             flies.
//   limbs     none: nothing strikes the hand.
//   limp      never.
//   swinging  the fist's strike while one flies, open the whole way, struck as it sets off.
import type { Body } from '#plugins/melee3d/melee3d.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { fist } from './punch.sim.ts'

const punch: Body = {
  blades(from, me) {
    const b = fist(me, def(from, me.kind).size)
    return b ? [b] : []
  },
  limbs() {
    return []
  },
  limp() {
    return false
  },
  swinging(_from, me) {
    return me.data.fist ? { swing: me.data.fist.strike, open: true, strike: 0 } : null
  },
}

export const behaviors = (): Record<string, Body> => ({ punch })
