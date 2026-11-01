// wander's mod for npc3d (`addons/scenemanager`'s mods): the cube's people walking from place to place. A
// scene with `world.npc3d.mods: { behaviors: 'wander' }` has npc3d take its behaviour:
//   wander  goes from place to place of the graph `graph`. Its score is its `weight`. It rolls one of the
//           graph's places other than the one it is going to (its row's `going`), and walks there along
//           npc3d's route (`world.npc3d.mods.route`, nav3d's) on `clip` at `speed`, each leg onto the up
//           of the place it goes to; there it stands on `stand` for seconds rolled within `stay`.
// Its row's `going` is the place it is going to, or got to last, by its index in the graph's places.
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { roll, travel, type Behavior } from '#plugins/npc3d/npc3d.sim.ts'

export function behaviors(): Record<string, Behavior> {
  const wander: Behavior = {
    score: (_me, _w, set) => set.weight,
    start(me, w, set, time, body) {
      const { places } = graph(w, set.graph)
      // One of the others, each as likely.
      const pick = Math.min(places.length - 2, Math.floor(w.die() * (places.length - 1)))
      const going = pick >= me.data.going ? pick + 1 : pick
      me.data.going = going
      me.data.until = travel(me, w, time, body, places[going].point.at, set.speed, set.clip)
    },
    arrive(me, w, set, time, body) {
      body.stand(me, w, time, set.stand)
      me.data.until = time + roll(w, set.stay)
    },
  }
  return { wander }
}
