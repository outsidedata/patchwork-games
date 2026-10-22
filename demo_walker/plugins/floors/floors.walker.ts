// floors' mod for walker (`addons/scenemanager`'s mods). A scene with
// `world.walker.mods: { height: 'floors', solids: 'floors' }` stands walker's bodies on the course's
// shapes and walks them round its trees (`floors.sim.ts`), over the ground the scene's
// `world.floors.mods.height` names, which every point no shape covers is asked of.
//
// `height(w, x, z)` is the higher of that ground and the highest shape over (x, z). `solids(w, x, z,
// r)` is every trunk reaching within r of (x, z).
import type { W } from '#engine/engine.ts'
import { mod } from '#addons/scenemanager/scenemanager.addon.ts'
import { courseOf, posts, top } from './floors.sim.ts'

type Height = (w: W, x: number, z: number) => number

// The ground under the shapes, found once per world.
const unders = new WeakMap<object, Height>()
function under(w: W): Height {
  let h = unders.get(w.world)
  if (!h) {
    h = mod<Height>(w.world, 'floors', 'height')
    if (!h) throw new Error('floors stands the course on the ground its mods make, and the scene names no world.floors.mods.height')
    unders.set(w.world, h)
  }
  return h
}

export const height = (w: W, x: number, z: number) => {
  const ground = under(w)(w, x, z)
  const t = top(courseOf(w), x, z)
  return t === undefined ? ground : Math.max(ground, t)
}

export const solids = (w: W, x: number, z: number, r: number) => posts(courseOf(w), x, z, r)
