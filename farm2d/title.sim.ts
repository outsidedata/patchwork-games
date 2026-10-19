// The title: the game's name over a little farm drawn on the UI, its song playing, Play, which takes
// the seat to the field, and Sound, which opens the sound menu. A plain seat: it lists no `player`, so
// its keys are the UI's.
import type { Scene, Sim } from '#engine/engine.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { settings } from './settings.sim.ts'
import { titlecard } from './titlecard.sim.ts'
import file from './title.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, titlecard, settings }

export const scene = file as Scene
