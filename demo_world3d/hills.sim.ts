// The kinds of hills and the hills.scene.json file next to this one: the village's, on rolling hills
// (`assets/hills/hills.field.json`) in place of flat ground. Its place, `village-terrain3d.art` of world3d's
// (`world.world3d`), is the library's stronghold solver winterfell/village-terrain3d laid on that land by the bake
// (`assets/demo_world3d.bake.ts`, its `at`): its streets benched along the hills, every building on a pad of its own
// cut into them, its ways painted the field's `street`. Every file of it is under `assets/hills/`, written by the
// bake; its definitions are its own (`assets/hills/hills.json`), main's but for the player's, the visitors touring
// the place's graph as they do in the village. The seat plays demo_motion3d's X Bot: the `player` rule here is hero's
// (`plugins/hero/hero.sim.ts`), moved by kinematics3d and played and drawn by motion3d. The place's mobs are placed by
// its mmo3d file (`assets/hills/hills.mmo3d.json`) and spawned by the `mmo3d` row (`plugins/mmo3d/mmo3d.sim.ts`): a
// zombie and a zombie man near the start, each its own kind running mmo3d's `mob`, npc3d NPCs that hunt the hero.
// What has happened is factsdb's (`plugins/factsdb`): the hero's facts on its row, the place's on the `factsdb` row.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { hero as player } from './plugins/hero/hero.sim.ts'
import { start } from './start.sim.ts'
import { world3d } from '#plugins/world3d/world3d.sim.ts'
import { visitor } from './visitor.sim.ts'
import { person } from './person.sim.ts'
import { zombie } from './zombie.sim.ts'
import { zombie_man } from './zombie_man.sim.ts'
import { mmo3d } from './plugins/mmo3d/mmo3d.sim.ts'
import { volley3d } from '#plugins/volley3d/volley3d.sim.ts'
import { factsdb } from './plugins/factsdb/factsdb.sim.ts'
import { old_woman } from './old_woman.sim.ts'
import { smith } from './smith.sim.ts'
import { priest } from './priest.sim.ts'
import file from './hills.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, skydome3d, particle3d, volley3d, world3d, player, start, visitor, person, mmo3d, factsdb, zombie, zombie_man, old_woman, smith, priest }

export const scene = file as Scene
