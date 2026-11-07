// fortress's mod for npc3d (`addons/scenemanager`'s mods): the visitors' going about the fortress. A scene
// with `world.npc3d.mods: { behaviors: 'fortress' }` has npc3d take its behaviour:
//   tour  goes from place to place of the fortress's graph. Its score is its `weight`. Its places are every
//         place of the graph `graph`, or, where it gives `places`, the graph's places those tags name
//         (`data.nav3d.tags`), in that order (`stops`). It rolls one of them other than the one it is going
//         to (its row's `going`), and walks there along npc3d's route (`world.npc3d.mods.route`, nav3d's) on
//         `clip` at `speed`, to that place's point, its height and all, so a person climbs each stair the
//         route goes up; there it stands on `stand` for seconds rolled within `stay`. A tag none of the
//         graph's places has throws, naming it.
// Its row's `going` is the place it is going to, or got to last: its number among the graph's places.
import type { W } from '#engine/engine.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { roll, travel, type Behavior, type Settings } from '#plugins/npc3d/npc3d.sim.ts'

// The tour's places, each its number among the graph's places.
export function stops(w: W, set: Settings): number[] {
  const all = graph(w, set.graph).places
  if (!set.places) return all.map((_, i) => i)
  return (set.places as string[]).map(tag => {
    const i = all.findIndex(p => p.data?.nav3d?.tags?.includes(tag))
    if (i < 0) throw new Error(`the tour goes to ${tag}, which no place of the graph ${set.graph} tags`)
    return i
  })
}

export function behaviors(): Record<string, Behavior> {
  const tour: Behavior = {
    score: (_me, _w, set) => set.weight,
    start(me, w, set, time, body) {
      const others = stops(w, set).filter(i => i !== me.data.going)
      const going = others[Math.min(others.length - 1, Math.floor(w.die() * others.length))]
      me.data.going = going
      me.data.until = travel(me, w, time, body, graph(w, set.graph).places[going].point.at, set.speed, set.clip)
    },
    arrive(me, w, set, time, body) {
      body.stand(me, w, time, set.stand)
      me.data.until = time + roll(w, set.stay)
    },
  }
  return { tour }
}
