// The kinds of main and the main.scene.json file next to this one: the AWOL horse, tiger, lion and
// cheetah at stations 0, 1, 3 and 4, each going round a circle by paddock's `strider` at the pace the
// seat's `keeper` sets, posed by puppet3d from its definition and its sheet (`assets/awol/<animal>.json`):
// on four legs by the `pureQuadrupedDriver`, or upright on its hind legs by paddock's `upright`
// (`plugins/paddock/paddock.puppet3d.ts`), as the keeper says; and Mixamo's X Bot at station 2, going
// round by paddock's `pacer`, posed by cues alone, a walk and an idle written from clips by
// `plugins/puppet3d/puppet3d.cues.py`, weighed by its speed; and at station 5 the horse ridden, one
// body of two layouts: the horse, and the X Bot hung on its back (`body:spine 4`), seated by cues on
// the horse's own senses, so it rides each stride the horse's solver stands. Each animal and the X Bot
// play cue sheets of the library's over that (`assets/cues/`), each naming only its own bones: a tail's
// wag, ears, a look round, a roar, grazing, a nod, a wave. At station 6 the pegasus: the horse, and a
// pair of wings (`assets/wings/`) hung on its back as a second layout, beating by the library's `flap`
// sheet while the horse walks under its solver. Every number that never changes is its
// definition in `assets/demo_puppet3d.json`, which the scene's `world.defs` names, and its sheet.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { keeper, pacer, strider } from './plugins/paddock/paddock.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, skydome3d, player: keeper, horse: strider, tiger: strider, xbot: pacer, lion: strider, cheetah: strider, rider: strider, pegasus: strider }

export const scene = file as Scene
