// The kinds of main and the main.scene.json file next to this one: a place pro-ng built, drawn by world3d from the
// files its build wrote into `assets/builds/`, the game's link to its folder in the system's temp folder.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { library } from './library.sim.ts'
import { chosen } from './plugins/library/library.place.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, skydome3d, particle3d, player, start, library }

// The place the page's address asks for, and the library's own entries, written in before anything boots it
// (`chosen`), so every page and the server read the same scene.
export const scene = file as Scene
await chosen(file)
