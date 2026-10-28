// wander's mod for npc3d (`addons/scenemanager`'s mods): the cube's people walking from node to node. A
// scene with `world.npc3d.mods: { behaviors: 'wander' }` has npc3d take its behaviour:
//   wander  goes from node to node of the graph `graph`. Its score is its `weight`. It rolls one of the
//           graph's nodes other than the one it is going to (its row's `going`), and walks there along
//           npc3d's route (`world.npc3d.mods.route`, nav3d's) on `clip` at `speed`, each leg onto the up
//           of the node it goes to; there it stands on `stand` for seconds rolled within `stay`.
// Its row's `going` is the node it is going to, or got to last, by its place in the graph's nodes.
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { roll, travel, type Behavior } from '#plugins/npc3d/npc3d.sim.ts'

export function behaviors(): Record<string, Behavior> {
  const wander: Behavior = {
    score: (_me, _w, set) => set.weight,
    start(me, w, set, time, body) {
      const { nodes } = graph(w, set.graph)
      // One of the others, each as likely.
      const pick = Math.min(nodes.length - 2, Math.floor(w.die() * (nodes.length - 1)))
      const going = pick >= me.data.going ? pick + 1 : pick
      me.data.going = going
      me.data.until = travel(me, w, time, body, nodes[going].at, set.speed, set.clip)
    },
    arrive(me, w, set, time, body) {
      body.stand(me, w, time, set.stand)
      me.data.until = time + roll(w, set.stay)
    },
  }
  return { wander }
}
