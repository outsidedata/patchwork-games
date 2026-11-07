// One of the town's people: an NPC of npc3d (`plugins/npc3d`) on its `crowd3d` body, drawn by crowd3d as
// a person of its `body`, going about the town on the fortress plugin's `tour` behaviour
// (`plugins/fortress/fortress.npc3d.ts`): from place to place of the graph along nav3d's routes. Like every
// crowd3d person, it walks through every other body. Its numbers are its definition (`assets/demo_castle.json`,
// `assets/bridge.json`): npc3d's, and its `tour`'s settings.
// Its own field, beside npc3d's and crowd3d's:
//   home   the tag of the place its actor stands it at; '' to stand it on one of the tour's places spread evenly
//          among the people of its kind: the k-th of n on the place k·m/n of the tour's m places, in order.
// `before` stands it once on its home, `going` that place's number, from now; the rest is npc3d's `npc`.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { npc, now } from '#plugins/npc3d/npc3d.sim.ts'
import { stops } from './plugins/fortress/fortress.npc3d.ts'

export const visitor: Kind = {
  ...npc,
  before(me, _dt, w) {
    const d = me.data
    if (d.going !== null) return
    const tour = def(w, me.kind).behaviors.tour
    let at: number
    if (d.home === '') {
      const places = stops(w, tour)
      const kin = w.all(me.kind)
      at = places[Math.floor(kin.indexOf(me) * places.length / kin.length)]
    } else {
      at = stops(w, { graph: tour.graph, places: [d.home] })[0]
    }
    const point = graph(w, tour.graph).places[at].point.at
    d.pos = [...point]
    d.to = [...point]
    d.going = at
    d.since = now(w)
  },
}
