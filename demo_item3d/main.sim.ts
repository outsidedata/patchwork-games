// The kinds of main and the main.scene.json file next to this one. Every number of them that
// never changes is its definition in `assets/demo_item3d.json`, which the scene's `world.defs` names.
// Where the seat's eye starts is a `start` actor of the scene file, one per slot.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { guard } from './guard.sim.ts'
import { worker } from './worker.sim.ts'
import { villager } from './villager.sim.ts'
import { runner } from './runner.sim.ts'
import { wrench } from './wrench.sim.ts'
import { teststand } from './teststand.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, start, worker, guard, villager, runner, wrench, teststand, particle3d }

export const scene = file as Scene
