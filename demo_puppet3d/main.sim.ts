// The kinds of main and the main.scene.json file next to this one: the AWOL horse at station 0 and the
// AWOL tiger at station 1, each going round a circle by paddock's `strider` at the pace the seat's
// `keeper` sets, and posed by puppet3d from its own sheet (`assets/awol/horse_1.json`,
// `assets/awol/tiger_1.json`) as the puppet the keeper picks: on four legs (puppet3d's `quadruped`) or
// upright on its hind legs (paddock's `upright`, `plugins/paddock/paddock.puppet3d.ts`); and Mixamo's X
// Bot at station 2, posed by cues alone (`assets/xbot/xbot.json`, written from a walk and an idle by
// `plugins/puppet3d/puppet3d.cues.py`), walking by its speed and idling still. Every number
// that never changes is its definition in `assets/demo_puppet3d.json`, which the scene's `world.defs`
// names, and its sheet.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { keeper, strider } from './plugins/paddock/paddock.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, skydome3d, player: keeper, horse: strider, tiger: strider, xbot: strider, lion: strider, cheetah: strider }

export const scene = file as Scene
