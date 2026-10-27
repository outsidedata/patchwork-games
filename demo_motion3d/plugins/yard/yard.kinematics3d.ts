// yard's mod for kinematics3d (`world.kinematics3d.mods.states: ['yard']`, with `yard` in
// `world.shipped.plugins`): the game's own state words, which a move's `when` in the X Bot's motion3d
// file names.
//   fast   the run key held (the `player` row's `fast`)
import type { Row } from '#engine/engine.ts'

export const states = () => ({
  fast: (me: Row) => me.data.fast === true,
})
