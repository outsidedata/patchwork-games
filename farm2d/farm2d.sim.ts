// The manager. One row, naming the game's one scene, the field, which every connection enters.
import type { Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'

export const sim: Sim = { scenemanager }
