// The kinds of main and the main.scene.json file next to this one. Every number of them that
// never changes is its definition in `assets/demo_wormhole.json`, which the scene's `world.defs` names.
// The seat walks its `player` row on a grid `floor`, which the `player` row stands on its slot's
// `start`, among the `prop`s; the seat puts down two `door`s, and each takes whoever walks through its
// front out of the front of the other.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { floor } from './floor.sim.ts'
import { door } from './door.sim.ts'
import { prop } from './prop.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, start, floor, door, prop }

export const scene = file as Scene
