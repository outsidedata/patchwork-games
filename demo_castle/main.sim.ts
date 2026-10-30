// The kinds of main and the main.scene.json file next to this one. Every number of them that never changes
// is its definition in `assets/demo_castle.json`, which the scene's `world.defs` names. Where each seat's
// body starts is a `start` actor of the scene file, one per slot. The scene extends procedural-castle's partial
// scene of the fortress's shapes (`assets/fortress.partial_scene.json`), every kind of which is `masonry`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { castle } from './castle.sim.ts'
import { visitor } from './visitor.sim.ts'
import { masonry } from './masonry.sim.ts'
import file from './main.scene.json' with { type: 'json' }
import shapes from './assets/fortress.partial_scene.json' with { type: 'json' }

const kinds: Sim = { scenemanager, loader, npc3d, player, start, castle, visitor }

// The fortress's kinds come from procedural-castle's file, made outside the program: one named as a kind of
// the game's would take that kind's rule.
const masonries = Object.keys(shapes.world.shapes3d.kinds)
const taken = masonries.filter(k => k in kinds)
if (taken.length) throw new Error(`assets/fortress.partial_scene.json names kinds the game has: ${taken.join(', ')}`)

export const sim: Sim = { ...kinds, ...Object.fromEntries(masonries.map(k => [k, masonry])) }

export const scene = file as Scene
