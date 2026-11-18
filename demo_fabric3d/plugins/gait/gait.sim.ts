// gait: demo_fabric3d's own plugin, one step of a body that walker walks and anim plays, which the
// `player` and `wanderer` kinds each call on their own row. It has no row and no page half.
//
// `stride(me, w, dt)` walks the row by walker (`walk`, its `want`, `face` and `jump` as its rule set
// them) on the ground the scene's `world.walker.mods` make (`groundOf`), has anim play it from how it
// moved (`animate`), and carries the travel of a clip that carries one, a landing's step, by walker's
// `carry` and its turn on its `yaw`. It hands back the ground it walked on.
import type { Row, W } from '#engine/engine.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { carry, groundOf, walk, type Ground } from '#plugins/walker/walker.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))

export function stride(me: Row, w: W, dt: number): Ground {
  const ground = groundOf(w)
  walk(me, w, dt, ground)
  const { travel } = animate(me, w, dt)
  if (travel.move[0] !== 0 || travel.move[1] !== 0) carry(me, w, travel.move, ground)
  if (travel.yaw !== 0) me.data.yaw = wrap(me.data.yaw + travel.yaw)
  return ground
}
