// The kinds of swarm and the swarm.scene.json file next to this one: 400 lamps drifting over a floor of
// pillars, no shadows. Every number of them that never changes is its definition in
// `assets/demo_lights3d.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { stage } from './stage.sim.ts'
import file from './swarm.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, stage }

export const scene = file as Scene
