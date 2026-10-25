// The kinds of main and the main.scene.json file next to this one. Every number of them that
// never changes is its definition in `assets/demo_cutscene.json`, which the scene's `world.defs` names.
// The intro is the cutscene's, standing on the flat yard at height 0; its steps in the game's own
// words, `open` and `spawn`, are delivered by the game's own `stagehand`
// (`plugins/stagehand/stagehand.cutscene.ts`), which the scene names in `world.cutscene.mods`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { cutscene, mark } from '#plugins/cutscene/cutscene.sim.ts'
import { player } from './player.sim.ts'
import { yard } from './yard.sim.ts'
import { gate } from './gate.sim.ts'
import { guard } from './guard.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, cutscene: cutscene(() => 0), mark, player, yard, gate, guard }

export const scene = file as Scene
