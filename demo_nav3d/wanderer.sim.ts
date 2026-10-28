// One of the cube's people: an NPC of npc3d (`plugins/npc3d`) on its `crowd3d` body, drawn by crowd3d as
// a person of its `body`, walking the inside of the cube on the wander plugin's `wander` behaviour
// (`plugins/wander/wander.npc3d.ts`): from node to node of the cube's graph along nav3d's routes, each leg
// onto the up of the node it goes to, so it walks over the edges onto the walls and the ceiling. Its
// numbers are the wanderer's definition in `assets/demo_nav3d.json`: npc3d's, and its `wander`'s.
// Its own field, beside npc3d's and crowd3d's:
//   home   the node it starts on, by its place in the graph's nodes.
// `before` stands it once on its `home` node, on that node's up, `going` that node, from now; the rest
// is npc3d's `npc`.
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
    const node = graph(w, name).nodes[d.home]
    if (!node) throw new Error(`wanderer ${me.id}'s home ${d.home} is no node of the graph ${name}`)
    const up = node.normal ?? [0, 1, 0]
    d.pos = [...node.at]
    d.to = [...node.at]
    d.normal = [...up]
    d.normalTo = [...up]
    d.going = d.home
    d.since = now(w)
  },
}
