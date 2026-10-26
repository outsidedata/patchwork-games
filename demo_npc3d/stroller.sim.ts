// A stroller: an NPC of npc3d drawn by crowd3d that wanders and idles about, as its definition's
// `behaviors` say, looking at the sentries as it goes but acting on nothing it sees: what a sentry
// notices and remembers walking in and out of its sight (`plugins/npc3d/npc3d.sim.ts`).
import { npc } from '#plugins/npc3d/npc3d.sim.ts'

export const stroller = npc
