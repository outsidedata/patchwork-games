// wall's scene, the wall.scene.json file next to this one: a wall of blocks (`block.sim.ts`, shapes3d
// boxes) across the middle of the flat ground, a runner (`runner.sim.ts`, a walker) and a passer
// (`passer.sim.ts`, a person) on one side, and a beacon (`beacon.sim.ts`) on the other that orders both
// to it on its first step. The scene names nav3d's `route` for npc3d, so each walks round the wall along
// its route over the scene's graph, `wall`, which the game's bake makes from the blocks and the ground
// (`assets/demo_npc3d.bake.ts`, `assets/wall.nav.json`). Its kinds are sight's (`sight.sim.ts`).
import type { Scene } from '#engine/engine.ts'
import file from './wall.scene.json' with { type: 'json' }

export { sim } from './sight.sim.ts'

export const scene = file as Scene
