// stance's mod for kinematics3d (`world.kinematics3d.mods.states: ['stance']`, with `stance` in
// `world.shipped.plugins`): the game's own state words, which a move's `when` in the X Bot's motion3d file names.
//   fast   the run key held (the `player` row's `fast`)
//   guard  the guard key held (its `guard`): the body blocks standing, or strafes facing the way the camera looks
import type { Row } from '#engine/engine.ts'

export const states = () => ({
  fast: (me: Row) => me.data.fast === true,
  guard: (me: Row) => me.data.guard === true,
})
