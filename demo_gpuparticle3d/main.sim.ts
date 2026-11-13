// The kinds of main and the main.scene.json file next to this one: a yard at dusk, its floor, its
// light and its blocks, over which a seat flies its `player` row, a craft, from its slot's start, and
// fires gpuparticle3d's effects with its keys. The effects are gpuparticle3d's ledger row and its effects
// file; a comet is a row an effect rides. Every number of the kinds that never changes is its
// definition in `assets/demo_gpuparticle3d.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { gpuparticle3d } from '#plugins/gpuparticle3d/gpuparticle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { comet } from './comet.sim.ts'
import { ground } from './ground.sim.ts'
import { sky } from './sky.sim.ts'
import { block } from './block.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, gpuparticle3d, player, start, comet, ground, sky, block }

export const scene = file as Scene
