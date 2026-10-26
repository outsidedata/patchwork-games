// A guard: an NPC of npc3d with a walker body drawn by anim (the library's soldier on the shooter's
// rifle clips, `assets/swat.rig.json`, the rifle in its right hand). It wanders, goes to see what it
// hears and has not yet checked (`investigate`, the `checked` plugin's, its row's `checked`), chases
// what it notices of its definition's `threats` and shoots what of them it sees, as its definition's
// `behaviors` say (`plugins/npc3d/npc3d.sim.ts`, `plugins/checked/checked.npc3d.ts`).
import { npc } from '#plugins/npc3d/npc3d.sim.ts'

export const guard = npc
