// The kinds of main and the main.scene.json file next to this one: the glass cube, the people who walk
// its inside (wanderers, npc3d's NPCs on crowd3d bodies, over nav3d's graph of the cube), the npc3d row,
// and the seat's flying eye and its start. Every number of them that never changes is its definition in
// `assets/demo_nav3d.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { cube } from './cube.sim.ts'
import { wanderer } from './wanderer.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, player, start, cube, wanderer }

export const scene = file as Scene
