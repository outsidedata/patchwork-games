// notice's scene, the notice.scene.json file next to this one: the sentry of `sight` facing +z and one
// stroller (`stroller.sim.ts`) wandering in and out of its sight round two pillars, looking at the
// sentry as it goes, so the sentry is seen growing aware of it, noticing it, remembering where it last
// saw it once it is gone, and forgetting it, and the stroller's own sight turns with it as it walks.
// Its kinds are sight's (`sight.sim.ts`).
import type { Scene } from '#engine/engine.ts'
import file from './notice.scene.json' with { type: 'json' }

export { sim } from './sight.sim.ts'

export const scene = file as Scene
