// The kinds of main and the main.scene.json file next to this one: the seat's eye, its `player` row,
// and where it starts, flown over terrain3d's land, a checkerboard rolling gently, lit by environment3d;
// and the shapes3d shapes lod3d's layers grow on, each drawn by solids: the `plinth` (a box), the `tower`
// (a cylinder), the `ramp` (a tilted plane), the `slab` (a hyperplane, tilted), and the `hedge`, a kind
// laid down only for the spline it carries. The shapes have no rule: what each is, and how it looks, is
// its `world.shapes3d.kinds` entry. Every other number that never changes is the player's definition in
// `assets/demo_lod3d.json`, or the scene's `world`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, start, plinth: {}, tower: {}, ramp: {}, slab: {}, hedge: {} }

export const scene = file as Scene
