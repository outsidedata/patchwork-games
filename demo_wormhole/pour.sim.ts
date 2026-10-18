// The kinds of pour, the pouring experiment's scene, and the pour.scene.json file next to this one: a
// bin of four walls on the floor round the red portal, the white portal up on the far wall, and a
// `hopper` that fills the bin with balls on the first step, which pour through the floor and out of the
// wall.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { crate } from './crate.sim.ts'
import { ball } from './ball.sim.ts'
import { hopper } from './hopper.sim.ts'
import { chamber } from './plugins/chamber/chamber.sim.ts'
import { portal } from './plugins/portal/portal.sim.ts'
import file from './pour.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, box3d, player, start, chamber, portal, crate, ball, hopper }

// The file holds only what pour adds to the partial it extends, which the scenemanager merges in.
export const scene = file as unknown as Scene
