// The kinds of main and the main.scene.json file next to this one. Every number of them that never changes
// is its definition in `assets/demo_castle.json`, which the scene's `world.defs` names. Where each seat's
// body starts is a `start` actor of the scene file, one per slot. The scene extends pro-ng's partial scene of the
// town's walk shapes (`assets/smallville.town.partial_scene.json`), every kind of which is `masonry`, as are
// the ground's, `yard`, `field` and `verge`, which lod3d stands the grass, trees, boulders and stones on.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { castle } from './castle.sim.ts'
import { masonry } from './masonry.sim.ts'
import file from './main.scene.json' with { type: 'json' }
import shapes from './assets/smallville.town.partial_scene.json' with { type: 'json' }

const kinds: Sim = { scenemanager, loader, player, start, castle }

// The town's kinds come from pro-ng's file, made outside the program: one named as a kind of the game's would
// take that kind's rule.
const town = Object.keys(shapes.world.shapes3d.kinds)
const taken = town.filter(k => k in kinds)
if (taken.length) throw new Error(`assets/smallville.town.partial_scene.json names kinds the game has: ${taken.join(', ')}`)
// and the ground the town stands on, main's own shapes (its `world.shapes3d.kinds`): the yard under it and the
// fields round it
const masonries = [...town, ...Object.keys(file.world.shapes3d.kinds)]

export const sim: Sim = { ...kinds, ...Object.fromEntries(masonries.map(k => [k, masonry])) }

export const scene = file as Scene
