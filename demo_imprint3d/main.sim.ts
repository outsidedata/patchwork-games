// The kinds of main and the main.scene.json file next to this one: a car driven through snow, sand and mud
// that imprint3d lays over the land, and bodies walking through them, each leaving its prints. The land is
// terrain3d's field `assets/land.json` (written by `assets/land.mjs`): rolling hills, flattened round the start,
// of the cc0 Grass004 ground, with a patch of snow, of sand and of mud painted round the start, each its own
// surface drawn by its own cc0 maps. The soft ground is imprint3d's (its grounds file, `assets/grounds.json`,
// which `world.imprint3d.grounds` names): each ground lies over its surface's patch, pressed by the car's
// wheels and body (box3dvehicle's `hyperbox`) and by the bodies' capsules (anim's `capsule`) as gpgpu3d holds
// them, and fills back in over its own `recover` seconds.
//
// The car is box3dvehicle's hatch: a `box3dvehicle` row and the box3d rows it is made of, a `car` chassis, four
// `wheel`s and four `axle` joints, made by its `spot` actor (`spot.sim.ts`) on the land; box3d holds the land
// round it in chunks the `ground` actor lists (`ground.sim.ts`). The seat's `player` row holds the car its
// slot's `start` names and drives it (`player.sim.ts`). The `wanderer`s are X Bots walked by walker and played
// by anim, strolling between the `post`s (`wanderer.sim.ts`). Every number of the game's own kinds that never
// changes is its definition in `assets/demo_imprint3d.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { box3dvehicle } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { walker } from '#plugins/walker/walker.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { spot } from './spot.sim.ts'
import { car } from './car.sim.ts'
import { wheel } from './wheel.sim.ts'
import { axle } from './axle.sim.ts'
import { ground } from './ground.sim.ts'
import { wanderer } from './wanderer.sim.ts'
import { post } from './post.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, box3d, box3dvehicle, walker, player, start, spot, car, wheel, axle, ground, wanderer, post }

export const scene = file as unknown as Scene
