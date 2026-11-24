// The kinds of main and the main.scene.json file next to this one: the range. Every number of them that never
// changes is its definition in `assets/demo_guns3d.json`, which the scene's `world.defs` names. Where each seat's
// body starts is a `start` actor of the scene file, one per slot.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { plate } from './plate.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, particle3d, player, start, plate }

export const scene = file as Scene
