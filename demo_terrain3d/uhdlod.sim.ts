// The uhdlod.scene.json file next to this one: the UHD tier with its firs, grass and boulders placed by
// lod3d and drawn by instances3d, written by hand from the UHD tier's layers. Its kinds are every
// tier's, `uhd.sim.ts`'s.
import type { Scene } from '#engine/engine.ts'
import file from './uhdlod.scene.json' with { type: 'json' }

export { sim } from './uhd.sim.ts'

export const scene = file as Scene
