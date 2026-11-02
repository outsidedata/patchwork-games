// The kinds of main and the main.scene.json file next to this one. Every number of them that
// never changes is its definition in `assets/demo_supershader3d.json`, which the scene's `world.defs`
// names, or, for the yard's shapes, their entry in the scene's `world.shapes3d.kinds`. Where the seat's
// eye starts is a `start` actor of the scene file, one per slot.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { block } from './block.sim.ts'
import { crate } from './crate.sim.ts'
import { post } from './post.sim.ts'
import { path } from './path.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, start, block, crate, post, path }

export const scene = file as Scene
