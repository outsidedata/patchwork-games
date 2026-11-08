// The kinds of village and the village.scene.json file next to this one: main's, on the library's pro-ng village
// (`pro-ng/scenes/village/village.art.json`, compiled from stronghold's village solver) in place of smallville, the
// place `village.art` of world3d's (`world.world3d`). Every file of it is under `assets/village/`, written by the
// bake; its definitions are main's (`assets/demo_world3d.json`), the visitors touring the place's graph as they do in
// main. Where the seat's body starts is the village's start place, marked in its metadata. Its quests, its people's
// talk, what can be carried and the bell are the quest plugin's (`plugins/quest`), read off the village's quests file
// (`assets/village/village.art.quests.json`), its own state on the `story` row.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { world3d } from '#plugins/world3d/world3d.sim.ts'
import { visitor } from './visitor.sim.ts'
import { resident } from './resident.sim.ts'
import { wanderer } from './wanderer.sim.ts'
import { story } from './story.sim.ts'
import file from './village.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, skydome3d, particle3d, world3d, player, start, visitor, resident, wanderer, story }

export const scene = file as Scene
