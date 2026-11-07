// The kinds of village and the village.scene.json file next to this one: main's, on the library's pro-ng village
// (`pro-ng/scenes/village/village.art.json`, compiled from stronghold's village solver) in place of smallville. Every
// file of it is under `assets/village/`, written by the bake; its definitions are main's (`assets/demo_castle.json`),
// naming the same catalogue entries, which village's catalogue points at the village's files. Where the seat's body
// starts is the village's start place, marked in its metadata.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { castle } from './castle.sim.ts'
import { visitor } from './visitor.sim.ts'
import file from './village.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, skydome3d, particle3d, player, start, castle, visitor }

export const scene = file as Scene
