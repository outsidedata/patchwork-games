// town's scene, the town.scene.json file next to this one: everything at once. Five pillars, three
// guards (`guard.sim.ts`), ten people (`person.sim.ts`) and two intruders (`intruder.sim.ts`). The
// people idle, wander and stand talking at the pillars, and keep away from an intruder they notice; the
// intruders wander and run from a guard they notice; the guards wander, chase an intruder they notice
// to where they last saw it and shoot it once they see it; a shot sends every person who hears it
// running and every guard who hears it to see. Its kinds are sight's (`sight.sim.ts`).
import type { Scene } from '#engine/engine.ts'
import file from './town.scene.json' with { type: 'json' }

export { sim } from './sight.sim.ts'

export const scene = file as Scene
