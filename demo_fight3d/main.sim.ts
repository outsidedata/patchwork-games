// The kinds of main and the main.scene.json file next to this one: a fight, and its one question, does a hit feel
// right. On terrain3d's level checkerboard land, the seat's X Bot (`player.sim.ts`, played by motion3d, unarmed: J the
// jab, cross and hook, K the roundhouse or, after a light, the uppercut and hurricane kick, L the MMA kick) faces a
// `foe` 1.4 metres ahead (`foe.sim.ts`, a walker body played by anim). Each strike lands with the striker its clip
// strikes by, a fist from the forearm to the knuckles or a shin from the knee to the toes (motion3d's mod for melee3d,
// its `strikers`), on the foe's limbs (anim's); fight3d (`world.fight3d`) freezes both, throws blood where it lands
// (particle3d's), shoves the foe the way the strike went and plays its reaction by the way the strike came and the
// blow's weight (anim's), then walks it back to its spot (walker's); a blow of a kick's weight or an uppercut's throws
// it across the ground and lays it down, and it gets up before it walks back. Every number that never changes is the scene's
// `world` or a definition in `assets/demo_fight3d.json`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { foe } from './foe.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, particle3d, player, start, foe }

export const scene = file as unknown as Scene
