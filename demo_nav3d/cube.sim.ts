// The glass cube the people walk the inside of, one `actors` entry. It has no rule: its numbers are its
// definition in `assets/demo_nav3d.json` (`size`, its middle `at`, and how it looks), which the graph
// the people walk is worked out from (`assets/cube.nav.ts`), and its look draws it.
import type { Kind } from '#engine/engine.ts'

export const cube: Kind = {}
