// The kinds of main and the main.scene.json file next to this one. Every number of them that
// never changes is its definition in `assets/demo_wormhole.json`, which the scene's `world.defs` names.
// The seat walks its `player` row in the `chamber`, standing it first on its slot's `start`, and puts
// down two `portal`s; each takes whoever goes in at its front out of the front of the other.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { portal } from './portal.sim.ts'
import { chamber } from './plugins/chamber/chamber.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, start, chamber, portal }

// The file holds only what main adds to the partial it extends, which the scenemanager merges in.
export const scene = file as unknown as Scene
