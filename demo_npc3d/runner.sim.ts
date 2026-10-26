// A runner: an NPC of npc3d with a walker body drawn by anim (the library's female soldier) whose one
// key is `go`: it walks where it is ordered (a `beacon`), round the pillars and keeping apart from the
// other runners, turning at walker's `turnRate`, and stands there (`plugins/npc3d/npc3d.sim.ts`).
import { npc } from '#plugins/npc3d/npc3d.sim.ts'

export const runner = npc
