// A resident of the tavern: a person stronghold's tavern solver planted at one of its landmarks (a seat on a bench,
// behind the counter), spawned there by world3d from the place's crowd file with its model as its `body` and the clips
// its solver named (`plugins/world3d/world3d.sim.ts`, People). An NPC of npc3d on its `crowd3d` body, drawn by crowd3d;
// on world3d's `linger` it plays its clips one after another where it stands, and never leaves. Its numbers are its
// definition (`assets/demo_world3d.json`). Its own field, beside npc3d's and crowd3d's: `clips`, world3d's.
import type { Kind } from '#engine/engine.ts'
import { npc } from '#plugins/npc3d/npc3d.sim.ts'

export const resident: Kind = npc
