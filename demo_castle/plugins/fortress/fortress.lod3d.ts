// fortress's mod for lod3d (`addons/scenemanager`'s mods), the page's. A scene with `world.lod3d.mods: {
// hollows: ['fortress'] }` hands lod3d's drawers each building of the town as a box, so no grass is drawn
// inside one, through its floor.
//
// `hollows(plugins)` is the castle's definition's `hollows` (`assets/demo_castle.json`), each `{ at, half }`
// a box standing square to the world, `at` its middle and `half` its half sizes in metres, read off the town's
// walls, floors and roofs (`pro-ng`'s cut, `smallville.town.partial_scene.json`) from a metre under its floor to
// its top.
import type { Plugins } from '#engine/browser.ts'
import type { Hollow } from '#plugins/lod3d/lod3d.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

const SQUARE: Hollow['rot'] = [0, 0, 0, 1]

export function hollows(plugins: Plugins): Hollow[] {
  const boxes = def(plugins.wire, 'castle').hollows as { at: Hollow['at']; half: Hollow['half'] }[]
  return boxes.map(b => ({ at: b.at, rot: SQUARE, half: b.half }))
}
