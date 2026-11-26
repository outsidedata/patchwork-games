// The kinds of jolt and the jolt.scene.json file next to this one: the jolt alone. One X Bot (`foe.sim.ts`, a walker
// body played by anim) stands still on the checkerboard, and a `hand` with no body (`hand.sim.ts`) throws a fist
// (punch's, `plugins/punch`) at whatever point of it a seat aims at, of any of fight3d's strikes: melee3d sweeps the
// fist through its limbs and fight3d lands the blow there, freezing, shoving, bleeding and jolting it, as the X Bot's
// fist does in main. Its seat plays no body: the scene names no player plugin, so the seat sends only the hand's open
// `throw`. `dev.html?scene=jolt` is where it is played: a click on the body joins it, its every fight3d number on the
// panel, and a click on it then throws there.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { foe } from './foe.sim.ts'
import { hand } from './hand.sim.ts'
import file from './jolt.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, particle3d, foe, hand }

export const scene = file as unknown as Scene
