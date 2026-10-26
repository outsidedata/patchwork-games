// hearing's scene, the hearing.scene.json file next to this one: two guards (`guard.sim.ts`) about two
// pillars with nothing to hunt, so a noise made near enough (a `noise`, `noise.sim.ts`, which the
// testbed makes) is heard by each guard within its reach, which goes to see it. Its kinds are sight's
// (`sight.sim.ts`).
import type { Scene } from '#engine/engine.ts'
import file from './hearing.scene.json' with { type: 'json' }

export { sim } from './sight.sim.ts'

export const scene = file as Scene
