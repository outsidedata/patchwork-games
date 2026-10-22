// terrain3d's mod for floors (`addons/scenemanager`'s mods), beside floors since a top-level plugin
// names no game's. A scene with `world.floors.mods: { height: 'terrain3d' }` stands the course's
// shapes on the land: `height(w, x, z)` is `rawAt`, the ground itself, under the water too, as
// terrain3d hands walker its own (`plugins/terrain3d/terrain3d.walker.ts`), so a body wades on the
// pond's bed and walker's `depth`, terrain3d's, says how deep it is.
import type { W } from '#engine/engine.ts'
import { rawAt } from '#plugins/terrain3d/terrain3d.sim.ts'

export const height = (w: W, x: number, z: number) => rawAt(w, x, z)
