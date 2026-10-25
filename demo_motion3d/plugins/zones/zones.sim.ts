// zones: demo_motion3d's own plugin, the activities its yard offers motion3d (`zones.motion3d.ts`) and
// the walking they hand back to. It has no row, no browser half and no numbers of its own.
//
// `underfoot(me, w, feet?)` is the ground a body of the row's walker numbers walks whose feet stand at
// y = `feet` (its own `pos` y when not given): shapes3d's ground (`plugins/shapes3d/shapes3d.walker.ts`'s
// `ground`), the top of the highest shape there no more than a step above the feet, else the land under
// the shapes (`world.shapes3d.mods.height`), every shape rising past that and starting below the head
// walked round. So a body walks round the yard's wall and chair, and stands on the wall's top once it
// has climbed onto it.
//
// `stride(me, w, dt)` walks the row by walker (`walk`, its `want`, `face` and `jump` as its rule set
// them) on that ground, has anim play it from how it moved (the `animate` motion3d hands it), and
// carries the travel of a clip that carries one, a landing's step, by walker's `carry` and its turn on
// its `yaw`.
import type { Row, W } from '#engine/engine.ts'
import type { Handed } from '#plugins/motion3d/motion3d.sim.ts'
import { ground } from '#plugins/shapes3d/shapes3d.walker.ts'
import { carry, numbers, walk, type Ground } from '#plugins/walker/walker.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))

export const underfoot = (me: Row, w: W, feet: number = me.data.pos[1]): Ground => ground(w, feet, numbers(me, w))

export function stride(me: Row, w: W, dt: number, handed: Handed) {
  const on = underfoot(me, w)
  walk(me, w, dt, on)
  const { travel } = handed.animate()
  if (travel.move[0] !== 0 || travel.move[1] !== 0) carry(me, w, travel.move, on)
  if (travel.yaw !== 0) me.data.yaw = wrap(me.data.yaw + travel.yaw)
}
