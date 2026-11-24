// The kinds of combat and the combat.scene.json file next to this one: the first stage of motion3d's combat lift
// (`plugins/motion3d/combat-lift.md`), reached through `dev.html?scene=combat`, and its one question: does a hit feel
// right. On terrain3d's level checkerboard land, the seat's X Bot (`player.sim.ts`, played by motion3d, the sword and
// shield drawn with G) faces a `foe` 2.2 metres ahead (`foe.sim.ts`, a walker body played by anim). Its blade is a
// melee3d blade (motion3d's mod, `motion3d.melee3d.ts`), the foe's limbs melee3d limbs (anim's, `anim.melee3d.ts`); a
// blow freezes both, throws blood where it lands (particle3d's), and the foe flinches by the way the blade came and
// the blow's weight, then walks back to its spot (the combat plugin, `plugins/combat`). Every number that never
// changes is the scene's `world` or a definition in `assets/combat.json`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { foe } from './foe.sim.ts'
import file from './combat.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, particle3d, player, start, foe }

export const scene = file as unknown as Scene
