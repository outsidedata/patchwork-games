// The kinds of glossy and the glossy.scene.json file next to this one: a polished yard of pillars and
// glowing movers, reflected by render3d's screen-space reflections. Every number of them that never
// changes is its definition in `assets/demo_render3d.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { stage } from './stage.sim.ts'
import file from './glossy.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, stage }

export const scene = file as Scene
