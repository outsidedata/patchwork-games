// The kinds of main and the main.scene.json file next to this one: a car driven through a meadow of
// grass3d's grass. The land is terrain3d's field `assets/meadow.json` (written by `assets/meadow.mjs`):
// rolling hills, flattened round the start, of the cc0 Grass004 ground, rock on the steep slopes, and a
// gravel track painted round the start, whose cover is 0, so no grass grows on it. The grass is grass3d's
// (its grasses file, `assets/grasses.json`, which `world.grass3d.grasses` names): it stands on the land, off the rock and the track, bends in weather3d's wind and
// gusts, and bends away from the car and lies down in its tracks. The sky is skydome3d's, the weather
// weather3d's (its weathers `assets/weathers.json`), the clouds clouds3d's.
//
// The car is box3dvehicle's hatch: a `box3dvehicle` row and the box3d rows it is made of, a `car` chassis,
// four `wheel`s and four `axle` joints, made by its `spot` actor (`spot.sim.ts`) on the land; box3d holds
// the land round it in chunks the `ground` actor lists (`ground.sim.ts`). The seat's `player` row holds the
// car its slot's `start` names and drives it (`player.sim.ts`). Every number of the game's own kinds that
// never changes is its definition in `assets/demo_grass3d.json`, which the scene's `world.defs` names.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { weather3d } from '#plugins/weather3d/weather3d.sim.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { box3dvehicle } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { spot } from './spot.sim.ts'
import { car } from './car.sim.ts'
import { wheel } from './wheel.sim.ts'
import { axle } from './axle.sim.ts'
import { ground } from './ground.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, skydome3d, weather3d, box3d, box3dvehicle, player, start, spot, car, wheel, axle, ground }

export const scene = file as unknown as Scene
