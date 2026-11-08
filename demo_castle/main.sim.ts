// The kinds of main and the main.scene.json file next to this one. Every number of them that never changes
// is its definition in `assets/demo_castle.json`, which the scene's `world.defs` names. Where each seat's
// body starts is a `start` actor of the scene file, one per slot. The scene extends pro-ng's partial scene of the
// town's walk shapes (`assets/smallville.town.partial_scene.json`), every kind of which is `masonry`. The ground
// round them is terrain3d's (`assets/demo_castle.field.json`), which lod3d stands the grass, trees, boulders and
// stones on. The sky, its sun and its light are skydome3d's, its row and `world.skydome3d`, with no weather.
// Torches burn along the streets and on the towers (`torch.sim.ts`), lit by lights3d, which shadows them
// and lights the night's ground fog round them (`world.lights3d`).
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
import { torch } from './torch.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, skydome3d, particle3d, player, start, castle, visitor, torch }

export const scene = file as Scene
