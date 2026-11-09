// A person of a place: one the place's solvers placed, spawned by world3d at the first landmark of its first chain from
// the place's crowd file, with its model as its `body` (`plugins/world3d/world3d.sim.ts`, People). An NPC of npc3d on
// its `crowd3d` body, drawn by crowd3d; on world3d's `loiter` it plays a loiter verb of the landmark it is at, and on
// its `transfer` it goes to another landmark of its chain on a transfer verb (`plugins/world3d/world3d.npc3d.ts`). Its
// numbers are its definition (`assets/demo_world3d.json`). Its own fields, beside npc3d's and crowd3d's: `chains`,
// `activities`, `at`, `going` and `transfer`, world3d's.
import type { Kind } from '#engine/engine.ts'
import { npc } from '#plugins/npc3d/npc3d.sim.ts'

export const person: Kind = npc
