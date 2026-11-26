// The kinds of lightlab and the lightlab.scene.json file next to this one: stronghold's light lab (the library's
// `stronghold/solvers/lightlab`), a row of rooms each built to try one condition of light inside, built from its solver
// by the bake, the place `lightlab.art` of world3d's (`world.world3d`). Every file of it is under `assets/lightlab/`.
// Its definitions are main's (`assets/demo_world3d.json`). The seat's body starts on the lab street before the sun room.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { world3d } from '#plugins/world3d/world3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { person } from './person.sim.ts'
import file from './lightlab.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, skydome3d, particle3d, world3d, player, start, person }

export const scene = file as Scene
