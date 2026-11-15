// The kinds of main and the main.scene.json file next to this one: a room with a checkerboard floor,
// its walls shapes3d's boxes, in which a seat walks its `player` row, an X Bot, from its slot's start,
// and every `pad` on the floor plays one of particle3d's effects while the X Bot stands on it. The
// effects are particle3d's ledger row and its effects file; the floor and the walls are shapes3d's
// kinds, which walker walks on and round, solids draws, and the particles bounce off. Every number of
// the kinds that never changes is its definition in `assets/demo_particle3d.json`, which the scene's
// `world.defs` names; the floor's and the walls' are their `world.shapes3d.kinds` entries.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { pad } from './pad.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, particle3d, player, start, pad, floor: {}, wall: {} }

export const scene = file as Scene
