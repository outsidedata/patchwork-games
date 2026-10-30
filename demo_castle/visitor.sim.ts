// One of the fortress's people: an NPC of npc3d (`plugins/npc3d`) on its `crowd3d` body, drawn by crowd3d as
// a person of its `body`, going about the fortress on the fortress plugin's `tour` behaviour
// (`plugins/fortress/fortress.npc3d.ts`): from place to place along nav3d's routes over the fortress's
// graph, which procedural-castle wrote (`assets/fortress.nav.json`), each leg one straight course from node to
// node, its height and all, so it climbs each stair and each door's steps the graph goes up. Every link of
// that graph is one the scene states: through a door, along a stair, across a room, or on the ground where its
// straight line crosses no building. Like
// every crowd3d person, it walks through every other body. Its numbers are the visitor's definition in
// `assets/demo_castle.json`: npc3d's, and its `tour`'s settings.
// Its own field, beside npc3d's and crowd3d's:
//   home   the place its actor stands it at.
// `before` stands it once on its `home`'s node, `going` that place, from now, facing as its actor has it;
// the rest is npc3d's `npc`.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { npc, now } from '#plugins/npc3d/npc3d.sim.ts'

export const visitor: Kind = {
  ...npc,
  before(me, _dt, w) {
    const d = me.data
    if (d.going !== null) return
    const name = def(w, me.kind).behaviors.tour.graph
    const node = graph(w, name).nodes.find(n => n.tags?.includes(d.home))
    if (!node) throw new Error(`visitor ${me.id}'s home ${d.home} is no place of the graph ${name}`)
    d.pos = [...node.at]
    d.to = [...node.at]
    d.going = d.home
    d.since = now(w)
  },
}
