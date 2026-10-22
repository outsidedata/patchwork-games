// The kinds of main and the main.scene.json file next to this one. Every number of them that
// never changes is its definition in `assets/demo_walker.json`, which the scene's `world.defs` names.
// Where each seat's body starts is a `start` actor of the scene file, one per slot.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { course } from './course.sim.ts'
import { ladder } from './ladder.sim.ts'
import { wanderer } from './wanderer.sim.ts'
import { spot } from './spot.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, start, course, ladder, wanderer, spot }

export const scene = file as Scene
