// The kinds of every demo_npc3d scene, and sight's scene, the sight.scene.json file next to this one,
// which lays out the game's partial (`demo_npc3d.partial_scene.json`): flat checkered ground, one
// sentry (`sentry.sim.ts`) facing +z and bystanders standing round it (`bystander.sim.ts`): some in
// its cone, one in its edge alone, one behind it, one past its range, one off to the side, and two
// hidden from it behind pillars (`pillar.sim.ts`), so what it sees is read off its row's `seen` and
// drawn by npc3d's cones. Every number of them that never changes is its definition in
// `assets/demo_npc3d.json`, which the scene's `world.defs` names. Where each seat's eye starts is a
// `start` actor of the scene file, one per slot.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { pillar } from './pillar.sim.ts'
import { block } from './block.sim.ts'
import { noise } from './noise.sim.ts'
import { beacon } from './beacon.sim.ts'
import { bystander } from './bystander.sim.ts'
import { sentry } from './sentry.sim.ts'
import { stroller } from './stroller.sim.ts'
import { runner } from './runner.sim.ts'
import { passer } from './passer.sim.ts'
import { guard } from './guard.sim.ts'
import { person } from './person.sim.ts'
import { intruder } from './intruder.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import file from './sight.scene.json' with { type: 'json' }

export const sim: Sim = {
  scenemanager, loader, npc3d, player, start, pillar, block, noise, beacon,
  bystander, sentry, stroller, runner, passer, guard, person, intruder,
}

export const scene = file as Scene
