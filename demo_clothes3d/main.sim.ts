// The kinds of main and the main.scene.json file next to this one. Every number of them that never
// changes is its definition in `assets/demo_clothes3d.json`, which the scene's `world.defs` names. Where
// the seat's body starts is a `start` actor of the scene file. walker's row keeps the ground for the
// truth.
//
// The seat's robed person walks on terrain3d's land among robed bystanders, each drawn by anim as the bare
// body; clothing3d draws the models every row's `clothing` lists, the garments, on the bodies anim draws
// (`world.clothing3d.mods.bodies`), all of them one mesh in supershader3d's materials
// (`world.clothing3d.mods.looks`).
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { walker } from '#plugins/walker/walker.sim.ts'
import { player } from './player.sim.ts'
import { bystander } from './bystander.sim.ts'
import { start } from './start.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, walker, player, bystander, start }

export const scene = file as Scene
