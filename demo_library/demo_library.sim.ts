// The manager. One row, naming the three scenes (art, kit, materials) and that every connection enters `art`.
import type { Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'

export const sim: Sim = { scenemanager }
