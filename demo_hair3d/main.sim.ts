// The kinds of main and the main.scene.json file next to this one. Every number of them that never
// changes is its definition in `assets/demo_hair3d.json`, which the scene's `world.defs` names. Where
// the seat's body starts is a `start` actor of the scene file. walker's row keeps the ground for the
// truth and files the crowd the wanderers, walker's agents, walk among each step.
//
// The seat's X Bot and the wanderers walk on terrain3d's land, drawn by anim; hair3d grows the hairs
// its hairs file (`assets/hairs.json`, which `world.hair3d.hairs` names) gives each kind on the models
// anim draws (`world.hair3d.mods.skins`), each a three skinned mesh (`behaviors`: render3d's).
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { walker } from '#plugins/walker/walker.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { wanderer } from './wanderer.sim.ts'
import { spot } from './spot.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, walker, player, start, wanderer, spot }

export const scene = file as Scene
