// A person in the town: an NPC of npc3d drawn by crowd3d. It idles, wanders and stands about the
// pillars, keeps away from what it notices of its definition's `threats`, and runs from a shot it
// hears and has not yet checked (`panic`, the `checked` plugin's, its row's `checked`), as its
// definition's `behaviors` say (`plugins/npc3d/npc3d.sim.ts`, `plugins/checked/checked.npc3d.ts`).
import { npc } from '#plugins/npc3d/npc3d.sim.ts'

export const person = npc
