// The kinds of the yard and the yard.scene.json file next to this one: a flat yard of sand with ramps, a
// landing and a block on it, lit by skydome3d's sun and sky, and motorcycles, `box3dvehicle` rows of the
// scene's `actors` (`world.box3dvehicle.vehicles.motorcycle`, every number of the bike and its look, drawn
// from the library's pro-ng kit baked into `assets/motorcycle/`), which the seat's `player` row holds and
// rides. Every number of the game's own kinds that never changes is its definition in
// `assets/demo_box3dvehicle.json`, which the scene's `world.defs` names.
//
// What stands in the yard is shapes3d's (`world.shapes3d.kinds`): `yard` the ground, a slab of sand;
// `ramp` and `landing`, a kicker and the ramp that catches a jump off it, down the lane and again off to the
// side; `block`, a wall. Each is a row of its kind with a `pos` and a
// `yaw` and no rule (`{}`): box3d is handed them as things that never move (`world.box3d.mods.fixed`) and solids
// draws them (`world.solids.mods.models`), so a tyre meets what is drawn. The sky is skydome3d's, the weather
// weather3d's (its weathers `assets/weathers.json`), the clouds clouds3d's. Each tyre of a bike lays a trail of
// marks on the ground and kicks up dust: particle3d's, in the effects file `assets/effects.json`, thrown from
// the sources box3dvehicle hands it (`world.particle3d.mods.sources`). Its ledger row is the one `particle3d`
// actor, and the plugin is listed after skydome3d, whose light the particles take.
//
// The parts of a bike are rows of the kinds `world.box3dvehicle` names, `chassis`, `wheel` and `joint`, with
// no rule of their own (`{}`): box3d makes their bodies and joints (`world.box3d.mods.kinds`).
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { box3dvehicle } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { weather3d } from '#plugins/weather3d/weather3d.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { parking } from './parking.sim.ts'
import file from './yard.scene.json' with { type: 'json' }

export const sim: Sim = {
  scenemanager, loader, box3d, box3dvehicle, skydome3d, weather3d, particle3d, player, start, parking,
  chassis: {}, wheel: {}, joint: {},
  yard: {}, ramp: {}, landing: {}, block: {},
}

export const scene = file as unknown as Scene
