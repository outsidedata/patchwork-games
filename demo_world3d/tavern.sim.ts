// The kinds of tavern and the tavern.scene.json file next to this one: stronghold's tavern (the library's
// `stronghold/solvers/winterfell/tavern`), built from its solver by the bake, the place `tavern.art` of world3d's
// (`world.world3d`). Every file of it is under `assets/tavern/`. Its people are those of the place's crowd file, which
// world3d spawns: the residents the solver planted at its landmarks, each a `resident` row, and the wanderers going
// between its landmarks, each a `wanderer` row. Its definitions are main's (`assets/demo_world3d.json`). The seat's
// body starts outside the tavern's door. Its quests, its people's talk and what can be carried are the quest plugin's
// (`plugins/quest`), read off the tavern's quests file (`assets/tavern/tavern.art.quests.json`), its own state on the
// `story` row.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { world3d } from '#plugins/world3d/world3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { resident } from './resident.sim.ts'
import { wanderer } from './wanderer.sim.ts'
import { story } from './story.sim.ts'
import file from './tavern.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, skydome3d, particle3d, world3d, player, start, resident, wanderer, story }

export const scene = file as Scene
