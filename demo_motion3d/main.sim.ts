// The kinds of main and the main.scene.json file next to this one: a checkerboard yard on terrain3d's
// level land, where the seat's X Bot walks (motion3d's `walk`, the game's own `zones` plugin's, on
// shapes3d's ground), and the spaces offering motion3d the activities `zones` delivers
// (`plugins/zones/zones.motion3d.ts`): `partyzone` and `sadzone`, shapes3d's mats, offer `party` and
// `sad`; `ledgezone`, before the `wall` from below its lip up to it, offers `ledge`, held to its `Lip`
// line; `chairzone`, in front of the `chair` and its `chairback`, offers `chair`, held to its `Seat`
// point. The wall and the chair are solid shapes of their own; the spaces stand in nothing's way. None
// of these kinds has a rule: what each is, how it looks and what it offers is its
// `world.shapes3d.kinds` entry. Every number that never changes is the scene's `world` or its definition in
// `assets/demo_motion3d.json`, which the scene's `world.defs` names. Where the seat's body starts is a
// `start` actor of the scene file.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { walker } from '#plugins/walker/walker.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = {
  scenemanager, loader, walker, player, start,
  partyzone: {}, sadzone: {}, wall: {}, ledgezone: {}, chair: {}, chairback: {}, chairzone: {},
}

export const scene = file as Scene
