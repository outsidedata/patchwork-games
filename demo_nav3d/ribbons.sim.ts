// The web of ribbons the people walk both faces of, one `actors` entry. It has no rule: its numbers are
// its definition in `assets/web.json` (its hubs, the ribbons between them and their twists, and how they
// look), which the graph the people walk and the ribbons drawn are worked out from (`assets/web.nav.ts`),
// and its look draws them.
import type { Kind } from '#engine/engine.ts'

export const ribbons: Kind = {}
