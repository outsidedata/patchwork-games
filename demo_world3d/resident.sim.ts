// A resident of a place: a person stronghold's solvers planted at one of its landmarks (a seat on a bench, behind the
// counter, before the anvil), spawned there by world3d from the place's crowd file with its model as its `body` and the
// clips its solver named (`plugins/world3d/world3d.sim.ts`, People). An NPC of npc3d on its `crowd3d` body, drawn by
// crowd3d; on world3d's `linger` it plays its clips one after another where it stands, and never leaves, but to
// `attend` while the seat talks with it (`plugins/quest/quest.npc3d.ts`). Its numbers are its definition
// (`assets/demo_world3d.json`). Its own fields, beside npc3d's and crowd3d's: `clips`, world3d's; `who`, `known` and
// `state`, the quest plugin's: which person of the place's quests file it is, and its named numbers. Its rule is the
// quest plugin's `person` (`plugins/quest/quest.sim.ts`).
import type { Kind } from '#engine/engine.ts'
import { person } from './plugins/quest/quest.sim.ts'

export const resident: Kind = person
