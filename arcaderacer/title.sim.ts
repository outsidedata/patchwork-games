// The title: the lobby, a plain seat on the course select, and the title.scene.json file next to this
// one. Its one kind of its own is the `titlecard`, the screen the leader picks a course on; the `match`
// row is the match plugin's, which the match addon keeps.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { titlecard } from './titlecard.sim.ts'
import { match } from './plugins/match/match.sim.ts'
import file from './title.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, titlecard, match }

export const scene = file as Scene
