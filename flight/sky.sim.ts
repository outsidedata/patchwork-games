// The kinds of the sky and the sky.scene.json file next to this one. Every aircraft is a `plane`
// (`plane.sim.ts`), the kind `world.flight3d.kinds` lists, flown by `world.flight3d` and its catalogue of
// planes, which flight3d's browser half draws: each seat's plane of each type kept on its slot's stand,
// the circuit's traffic and the formation's leads, each kept on a `stand` (`stand.sim.ts`). A seat's
// `player` row is its pilot (`player.sim.ts`), which holds the plane it flies; a plane no seat holds is
// flown by the game's `pilot` plugin (`plugins/pilot`): round the circuit, home to its stand, or round
// the formation's loop. A seat's mission, the ring course or the formation, is its progress on its
// `player` row, run by the game's `mission` plugin (`plugins/mission`). The land is terrain3d's field,
// `world.terrain3d`, handed to flight3d as its ground (`world.flight3d.mods`), so a plane rolls on it on
// its wheels and crashes into it otherwise; the field is levelled at 116 m under the `airport`. The sky
// is skydome3d's, its row the day, the sun and the weather, `world.skydome3d` its look. Every
// number of the sky's own kinds that never changes is its definition in `assets/flight.json`, which the
// scene's `world.defs` names. Each seat picks its plane and mission on the `menu`, and its plane starts
// on its stand before the plane's hangar, or in the air at the `start` actor of its slot, that plane and
// that mission.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { airport } from './airport.sim.ts'
import { menu } from './menu.sim.ts'
import { plane } from './plane.sim.ts'
import { player } from './player.sim.ts'
import { ring } from './ring.sim.ts'
import { stand } from './stand.sim.ts'
import { start } from './start.sim.ts'
import file from './sky.scene.json' with { type: 'json' }

export const sim: Sim = { loader, scenemanager, skydome3d, player, plane, airport, menu, ring, stand, start }

export const scene = file as Scene
