// stance's mod for kinematics3d (`world.kinematics3d.mods.states: ['stance']`, with `stance` in
// `world.shipped.plugins`): the game's own state words, which a move's `when` in the X Bot's motion3d
// file names, each read off the body's row.
//   fast   the body runs (its `fast`)
//   guard  the body guards (its `guard`)
//   near   a space offers the body an activity (motion3d's `offered`)
//   armed  a weapon's stance is up: its upper half plays one of its definition's `weapons`
import type { Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const states = () => ({
  fast: (me: Row) => me.data.fast === true,
  guard: (me: Row) => me.data.guard === true,
  near: (me: Row) => Array.isArray(me.data.offered) && me.data.offered.length > 0,
  armed: (me: Row, w: W) => {
    const u = me.data.upperMotion
    return typeof u === 'string' && (def(w, me.kind).weapons as string[]).includes(u)
  },
})
