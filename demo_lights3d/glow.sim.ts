// The kinds of glow and the glow.scene.json file next to this one: a dark room and a pro-ng kit thing whose glowing
// material lights the room by being drawn, with nothing placed by hand (the kit `assets/kit-glow.glb`, baked by
// `assets/demo_lights3d.bake.ts`). Every number of them that never changes is its definition in
// `assets/demo_lights3d.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { stage } from './stage.sim.ts'
import file from './glow.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, stage }

export const scene = file as Scene
