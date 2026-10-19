// The kinds of the gym and the gym.scene.json file next to this one: a flat plain of dry ground
// (terrain3d's field `assets/gym.json`) under a clear sky, the hero on its start and the colossus
// standing 40 m away, for trying the climb a piece at a time from `dev.html?scene=gym`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { colossus } from './colossus.sim.ts'
import file from './gym.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, skydome3d, player, start, colossus }

export const scene = file as Scene
