// The kinds of marks and the marks.scene.json file next to this one: a room of crates, balls, a pillar,
// circling movers and swaying skinned fronds, guns firing by themselves into it, and every shot pressing
// a decal3d mark where it lands. Every number of them that never changes is its definition in
// `assets/demo_render3d.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { stage } from './stage.sim.ts'
import { shooters } from './shooters.sim.ts'
import file from './marks.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, stage, shooters }

export const scene = file as Scene
