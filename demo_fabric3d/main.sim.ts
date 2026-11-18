// The kinds of main and the main.scene.json file next to this one: a checkerboard yard on terrain3d's level
// land where every fabric of `assets/fabrics.json` is shown (fabric3d, `world.fabric3d`):
//   the flag      held along the top of the `mast`, a shapes3d cylinder, flying in the wind
//   the cloths    laid over the `table`, the `drum`, the `ramp` and the `slope`, shapes3d's box, cylinder,
//                 hyperplane and tilted plane, and left to fall on them
//   the capes     on the seat's X Bot and on each `wanderer`, held at the neck and draped on the capsules
//                 `world.fabric3d.capsules` makes of their bones (anim's bodies)
//   the ribbon    trailing from the `stick` the seat's X Bot carries in its left hand
//   the colours   the flag on the `pole` each wanderer carries in its right hand
//   the banner    towed behind the `tug`, which flies a circle over the yard (`tug.sim.ts`, `plugins/towing`)
// The seat's body (`player.sim.ts`) and the wanderers (`wanderer.sim.ts`) are X Bots walked by walker and
// played by anim. The things standing in the yard are shapes3d's kinds (`world.shapes3d.kinds`), none with
// a rule but the tug; `ground` is the yard's floor as a plane, for the fabrics to lie on. Every number that
// never changes is the scene's `world` or its definition in `assets/demo_fabric3d.json`, which the scene's
// `world.defs` names. Where the seat's body starts is a `start` actor of the scene file.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { walker } from '#plugins/walker/walker.sim.ts'
import { player } from './player.sim.ts'
import { spot } from './spot.sim.ts'
import { start } from './start.sim.ts'
import { tug } from './tug.sim.ts'
import { wanderer } from './wanderer.sim.ts'
import file from './main.scene.json' with { type: 'json' }

// Every shapes3d kind of the scene, none with a rule but the tug's.
const shapes = Object.fromEntries(Object.keys(file.world.shapes3d.kinds).map(kind => [kind, {}]))

export const sim: Sim = { ...shapes, scenemanager, loader, walker, player, spot, start, tug, wanderer }

export const scene = file as Scene
