// The field: a farm that never stops, three loops running side by side. Cows graze the pasture bare
// and drop manure; the farmer carries the manure to the tilled plot, where it grows a crop, and carries
// the ripe crops to the harvest pile in the chickens' yard; bugs creep in to nibble the pile, and the
// chickens peck them. Every farmer, cow and chicken is played by its brain until a seat takes it over
// (`player.sim.ts`, `plugins/roles`), and by its brain again when the seat leaves. The ledgers of sound
// (`audio`) and of particles (`particle2d`) carry what the rules raise; the sound menu (`settings`)
// sets this page's music and effects volumes.
import type { Scene, Sim } from '#engine/engine.ts'
import { audio } from '#plugins/audio/audio.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { particle2d } from '#plugins/particle2d/particle2d.sim.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { tilemap } from '#plugins/tilemap/tilemap.sim.ts'
import { bug } from './bug.sim.ts'
import { chicken } from './chicken.sim.ts'
import { cow } from './cow.sim.ts'
import { crop } from './crop.sim.ts'
import { farmer } from './farmer.sim.ts'
import { grass } from './grass.sim.ts'
import { house } from './house.sim.ts'
import { manure } from './manure.sim.ts'
import { pile } from './pile.sim.ts'
import { player } from './player.sim.ts'
import { produce } from './produce.sim.ts'
import { settings } from './settings.sim.ts'
import { start } from './start.sim.ts'
import { swarm } from './swarm.sim.ts'
import { tree } from './tree.sim.ts'
import file from './field.scene.json' with { type: 'json' }

export const sim: Sim = {
  scenemanager, loader, tilemap, audio, particle2d, settings, swarm,
  player, start, house, tree, grass, crop, manure, produce, pile, bug, farmer, cow, chicken,
}

export const scene = file as Scene
