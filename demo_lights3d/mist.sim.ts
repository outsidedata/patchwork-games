// The kinds of mist and the mist.scene.json file next to this one: a moor at night of standing stones and
// lamp posts, ground fog clumping and drifting through the lamps' light, a lantern wandering. Every
// number of them that never changes is its definition in `assets/demo_lights3d.json`, which the scene's
// `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { stage } from './stage.sim.ts'
import file from './mist.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, stage }

export const scene = file as Scene
