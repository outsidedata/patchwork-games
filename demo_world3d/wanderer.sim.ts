// A wanderer of a place: a person going between a set of the place's landmarks over its nav, spawned by world3d at the
// first of them from the place's crowd file, with its model as its `body`, the clip it walks on and the clips it plays
// at each landmark (`plugins/world3d/world3d.sim.ts`, People). An NPC of npc3d on its `crowd3d` body, drawn by
// crowd3d; on world3d's `roam` it walks to another of its landmarks along nav3d's route, faces the way the landmark
// faces, and plays its clips there a while; while the seat talks with it, it stops where it is and turns to it
// (`attend`, `plugins/quest/quest.npc3d.ts`). Its numbers are its definition (`assets/demo_world3d.json`). Its own
// fields, beside npc3d's and crowd3d's: `walk`, `clips`, `landmarks` and `going`, world3d's; `who`, `known` and `state`,
// the quest plugin's. Its rule is the quest plugin's `person` (`plugins/quest/quest.sim.ts`).
import type { Kind } from '#engine/engine.ts'
import { person } from './plugins/quest/quest.sim.ts'

export const wanderer: Kind = person
