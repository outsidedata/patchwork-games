// The kinds of the arena and the arena.scene.json file next to this one: the game's one fight. A
// basin of dry ground some 140 m across in a ring of crags (terrain3d's field `assets/arena.json`,
// ridged hills levelled toward the middle by a clearing, rock laid where the ground is steep), under
// a clear sky; the colossus standing in the middle with its three weak points (the back of its right
// calf, its back and the back of its head), and the hero's start 90 m off, facing it.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { colossus } from './colossus.sim.ts'
import { weakpoint } from './weakpoint.sim.ts'
import file from './arena.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, skydome3d, player, start, colossus, weakpoint }

export const scene = file as Scene
