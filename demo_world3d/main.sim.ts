// The kinds of main and the main.scene.json file next to this one. Every number of them that never changes
// is its definition in `assets/demo_world3d.json`, which the scene's `world.defs` names. Where each seat's
// body starts is a `start` actor of the scene file, one per slot. The place is pro-ng's town, `smallville.town`,
// world3d's (`world.world3d`): it draws it and plays its moving things, and hands what is walked on, the ways, the
// looks and the hollows to shapes3d, nav3d, supershader3d and lod3d. The ground round it is terrain3d's
// (`assets/demo_world3d.field.json`), which lod3d stands the grass, trees, boulders and stones on. The sky, its sun
// and its light are skydome3d's, its row and `world.skydome3d`, with no weather.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { visitor } from './visitor.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, skydome3d, particle3d, player, start, visitor }

export const scene = file as Scene
