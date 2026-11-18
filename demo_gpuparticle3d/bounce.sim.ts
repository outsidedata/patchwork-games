// The kinds of bounce and the bounce.scene.json file next to this one: gpuparticle3d's particles bouncing
// off what gpgpu3d holds, terrain3d's land, rolling hills, and shapes3d's shapes standing on it (crates, a
// wall, posts, a ramp and a tilted slab, each drawn by solids). `hail` rows keep an effect of falling
// balls running over them, and a seat flies its `player` row, the craft `overland` (`player.sim.ts`), and
// fires the scene's own shots at the land. The shapes' kinds have no rule: what each is, and how it
// looks, is its `world.shapes3d.kinds` entry. Every number of the kinds that never changes is its
// definition in `assets/bounce.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { gpuparticle3d } from '#plugins/gpuparticle3d/gpuparticle3d.sim.ts'
import { overland } from './player.sim.ts'
import { start } from './start.sim.ts'
import { sky } from './sky.sim.ts'
import { hail } from './hail.sim.ts'
import file from './bounce.scene.json' with { type: 'json' }

export const sim: Sim = {
  scenemanager, loader, gpuparticle3d, player: overland, start, sky, hail,
  crate: {}, wall: {}, post: {}, ramp: {}, slab: {},
}

export const scene = file as Scene
