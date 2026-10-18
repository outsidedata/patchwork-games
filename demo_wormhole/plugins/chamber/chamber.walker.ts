// chamber's ground for walker: the height a foot stands on is the chamber's, portals let in
// (`heightAt`, `chamber.sim.ts`). Named by `world.walker.mods.height: 'chamber'`.
import type { W } from '#engine/engine.ts'
import { heightAt } from './chamber.sim.ts'

export const height = (w: W, x: number, z: number) => heightAt(w, x, z)
