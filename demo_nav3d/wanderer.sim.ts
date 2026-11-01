// One of the cube's people: an NPC of npc3d (`plugins/npc3d`) on its `crowd3d` body, drawn by crowd3d as
// a person of its `body`, walking the inside of the cube on the wander plugin's `wander` behaviour
// (`plugins/wander/wander.npc3d.ts`): from place to place of the cube's graph along nav3d's routes, each
// leg onto the up of the place it goes to, so it walks over the edges onto the walls and the ceiling. Its
// numbers are the wanderer's definition in `assets/demo_nav3d.json`: npc3d's, and its `wander`'s.
// Its own field, beside npc3d's and crowd3d's:
//   home   the place it starts on, by its index in the graph's places.
// `before` stands it once on its `home` place, on that place's up (its point's `normal`, or [0, 1, 0]),
// `going` that place, from now; the rest is npc3d's `npc`.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { npc, now } from '#plugins/npc3d/npc3d.sim.ts'

export const wanderer: Kind = {
  ...npc,
  before(me, _dt, w) {
    const d = me.data
    if (d.going !== null) return
    const name = def(w, me.kind).behaviors.wander.graph
    const place = graph(w, name).places[d.home]
    if (!place) throw new Error(`wanderer ${me.id}'s home ${d.home} is no place of the graph ${name}`)
    const up = place.point.normal ?? [0, 1, 0]
    d.pos = [...place.point.at]
    d.to = [...place.point.at]
    d.normal = [...up]
    d.normalTo = [...up]
    d.going = d.home
    d.since = now(w)
  },
}
