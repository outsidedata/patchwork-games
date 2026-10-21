// The kinds of the yard and the yard.scene.json file next to this one: the flat plain of the gym
// (terrain3d's field `assets/gym.json`) under a clear sky, with one wall standing on it, the hero's
// start 6 m in front of it, facing it, a sphere 12 m to its side, its middle 6 m up, and on its other
// side a pillar 10 m off and a pole 16 m off, standing, and past them an inside corner 28 m off, its
// faces looking in toward the wall's side, and past the sphere a bowl 24 m off, a slab standing like the
// wall with a hollow pressed into its front, and a bumpy slab 34 m off, its front rising and falling in
// bumps and dips, and past it a wall 46 m off sliding to and fro along its width and one 58 m off tipping
// back and forth about its base, and a ball 70 m off, its middle 6 m up, swinging under a pivot 6 m over
// that, for climbing one shape at a time from `dev.html?scene=yard`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { bowl } from './bowl.sim.ts'
import { bumpy } from './bumpy.sim.ts'
import { corner } from './corner.sim.ts'
import { pillar } from './pillar.sim.ts'
import { pole } from './pole.sim.ts'
import { slider } from './slider.sim.ts'
import { sphere } from './sphere.sim.ts'
import { swinger } from './swinger.sim.ts'
import { tipper } from './tipper.sim.ts'
import { wall } from './wall.sim.ts'
import file from './yard.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, skydome3d, player, start, wall, sphere, pillar, pole, corner, bowl, bumpy, slider, tipper, swinger }

export const scene = file as Scene
