// The kinds of gallery and the gallery.scene.json file next to this one: a mirror-polished floor, metal
// balls from smooth to rough, moving lamps and a ball, reflected by a probe drawn again a face at a
// time. Every number of them that never changes is its definition in `assets/demo_lights3d.json`, which
// the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { stage } from './stage.sim.ts'
import file from './gallery.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, stage }

export const scene = file as Scene
