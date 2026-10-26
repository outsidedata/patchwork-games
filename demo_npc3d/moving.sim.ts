// moving's scene, the moving.scene.json file next to this one: a line of runners (`runner.sim.ts`,
// walkers) and a line of passers (`passer.sim.ts`, people) behind three pillars, each ordered to the
// same place by a beacon (`beacon.sim.ts`, which the testbed makes): the runners turn at their turn
// rate, walk round the pillars, keep apart and stop near it; the passers turn at once and walk straight
// there through everything, as people do. Its kinds are sight's (`sight.sim.ts`).
import type { Scene } from '#engine/engine.ts'
import file from './moving.scene.json' with { type: 'json' }

export { sim } from './sight.sim.ts'

export const scene = file as Scene
