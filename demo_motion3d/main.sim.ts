// The kinds of main and the main.scene.json file next to this one: a checkerboard yard on terrain3d's
// level land, where the seat's X Bot walks (motion3d's `walk`, the game's own `zones` plugin's, on
// shapes3d's ground), and the spaces offering motion3d the activities `zones` delivers
// (`plugins/zones/zones.motion3d.ts`): `partyzone` and `sadzone`, shapes3d's mats, offer `party` and
// `sad`; `ledgezone`, before the `wall` from below its lip up to it, offers `ledge`, held to its `Lip`
// line; `chairzone`, in front of the `chair` and its `chairback`, offers `chair`, held to its `Seat`
// point; and the stations past them (`assets/yard.mjs` writes them): the cold room, the bar, the rope,
// the rope swing, the climbing wall, the run wall, the vault, the edge, the stairs and the pool, the
// desk, the ceiling, the bed and the car. The things and the stations' spaces are shapes3d's kinds
// (`world.shapes3d.kinds`), none with a rule: what each is, how it looks and what it offers is its
// entry. The car is a kind of the game's own (`car.sim.ts`), which drives, and makes and carries its
// parts and its space. Every number that never changes is the scene's `world` or its definition in
// `assets/demo_motion3d.json`, which the scene's `world.defs` names. Where the seat's body starts is a
// `start` actor of the scene file.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { walker } from '#plugins/walker/walker.sim.ts'
import { car } from './car.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import file from './main.scene.json' with { type: 'json' }

// Every shapes3d kind of the scene, none with a rule.
const shapes = Object.fromEntries(Object.keys(file.world.shapes3d.kinds).map(kind => [kind, {}]))

export const sim: Sim = { ...shapes, scenemanager, loader, walker, player, start, car }

export const scene = file as Scene
