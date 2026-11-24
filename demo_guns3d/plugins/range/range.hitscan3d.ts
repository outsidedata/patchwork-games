// range's mod for hitscan3d (`addons/scenemanager`'s mods), the server's. A scene with `world.hitscan3d.mods: {
// bodies: 'range' }` has a shot meet the range's standing plates: `bodies(w)` is each as an upright cylinder about the
// plate's middle, as wide and as tall as the plate (`range.sim.ts`'s `plates`), so a round through the plate strikes
// it and calls its `hit`.
import type { W } from '#engine/engine.ts'
import { plates } from './range.sim.ts'

export const bodies = (w: W) => plates(w)
