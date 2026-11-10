// mmo3d's mod for hitscan3d (`world.hitscan3d.mods.bodies: 'mmo3d'`, with `mmo3d` in `world.shipped.plugins`): every
// row of each kind the place's placements and spawns name (`mmo3d.sim.ts`'s `kindsOf`) that hitscan3d lists in
// `world.hitscan3d.kinds` as a body a shot or a round meets, one
// upright cylinder at its feet of its walker kind's `radius` and `height` (`world.walker.kinds`), its part `body`.
// hitscan3d hits only those of the kinds `world.hitscan3d.kinds` lists, and none whose `off` field is set.
import type { W } from '#engine/engine.ts'
import type { Body } from '#plugins/hitscan3d/hitscan3d.sim.ts'
import { numbers } from '#plugins/walker/walker.sim.ts'
import { kindsOf } from './mmo3d.sim.ts'

export function bodies(w: W): Body[] {
  return kindsOf(w).filter(kind => w.world.hitscan3d.kinds[kind]).flatMap(kind => w.all(kind).map(r => {
    const k = numbers(r, w)
    const pos = r.data.pos as number[]
    return { id: r.id, kind, pos, shapes: [{ part: 'body', cylinder: { pos, radius: k.radius, height: k.height } }] }
  }))
}
