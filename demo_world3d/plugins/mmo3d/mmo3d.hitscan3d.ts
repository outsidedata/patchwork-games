// mmo3d's mod for hitscan3d (`world.hitscan3d.mods.bodies: 'mmo3d'`, with `mmo3d` in `world.shipped.plugins`): every
// `mob` row as a body a shot or a round meets, one upright cylinder at its feet of its walker kind's `radius` and
// `height` (its `as`, `world.walker.kinds`), its part `body`. hitscan3d hits only those of the kinds
// `world.hitscan3d.kinds` lists.
import type { W } from '#engine/engine.ts'
import type { Body } from '#plugins/hitscan3d/hitscan3d.sim.ts'
import { numbers } from '#plugins/walker/walker.sim.ts'

export function bodies(w: W): Body[] {
  return w.all('mob').map(r => {
    const k = numbers(r, w)
    const pos = r.data.pos as number[]
    return { id: r.id, kind: 'mob', pos, shapes: [{ part: 'body', cylinder: { pos, radius: k.radius, height: k.height } }] }
  })
}
