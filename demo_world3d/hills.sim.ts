// The kinds of hills and the hills.scene.json file next to this one: the village's, on rolling hills
// (`assets/hills/hills.field.json`) in place of flat ground. Its place, `village-terrain3d.art` of world3d's
// (`world.world3d`), is the library's stronghold solver winterfell/village-terrain3d laid on that land by the bake
// (`assets/demo_world3d.bake.ts`, its `at`): its streets benched along the hills, every building on a pad of its own
// cut into them, its ways painted the field's `street`. Every file of it is under `assets/hills/`, written by the
// bake; its definitions are main's (`assets/demo_world3d.json`), the visitors touring the place's graph as they do in
// the village.
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
import file from './hills.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, skydome3d, particle3d, world3d, player, start, visitor, resident, wanderer }

export const scene = file as Scene
