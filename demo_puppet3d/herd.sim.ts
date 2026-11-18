// The kinds of the herd and the herd.scene.json file next to this one: the AWOL animals as a crowd3d
// crowd, each drawn from a glb with a `walk` and an `idle` that puppet3d posed and wrote
// (`plugins/puppet3d/puppet3d.clips.ts`, run by the game's bake); some walking up and down their lines,
// the drover turning them back at each end, some standing. Every body is on the horse's skeleton, the
// first body's, whose clips crowd3d bakes and plays on every body.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { drover } from './drover.sim.ts'
import { beast } from './beast.sim.ts'
import { meadow } from './meadow.sim.ts'
import file from './herd.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, drover, beast, meadow }

export const scene = file as Scene
