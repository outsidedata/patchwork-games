// The kinds of the yard and the yard.scene.json file next to this one: the flat plain of the gym
// (terrain3d's field `assets/gym.json`) under a clear sky, with one wall standing on it, the hero's
// start 6 m in front of it, facing it, and a sphere 12 m to its side, its middle 6 m up, for climbing one
// shape at a time from `dev.html?scene=yard`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { sphere } from './sphere.sim.ts'
import { wall } from './wall.sim.ts'
import file from './yard.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, skydome3d, player, start, wall, sphere }

export const scene = file as Scene
