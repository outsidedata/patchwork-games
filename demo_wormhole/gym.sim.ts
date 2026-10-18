// The kinds of gym, the sandbox, and the gym.scene.json file next to this one: one room with every
// thing the game has, and no order to any of it. The ramp up to a ledge, a back wall and a wall down
// the right side to put portals on, a bin of balls a `hopper` fills on the first step, a stack of
// crates and a `prism`, a `laser` firing across the back of the room, a `catcher` far from its beam
// that opens one `door`, and a `button` that opens another; a dark pillar portals will not stick to, a
// `field` that eats crates and balls and closes the portals of whoever walks through it, a bounce pad
// in the near left corner, a faith `plate` that throws the seat at the back wall, a `dropper` that
// keeps a crate in the room, and a `lift` riding up and down in the back left corner; the seat throws more crates, harder the longer it holds, and
// carries them.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { crate } from './crate.sim.ts'
import { ball } from './ball.sim.ts'
import { prism } from './prism.sim.ts'
import { hopper } from './hopper.sim.ts'
import { laser } from './laser.sim.ts'
import { catcher } from './catcher.sim.ts'
import { button } from './button.sim.ts'
import { door } from './door.sim.ts'
import { field } from './field.sim.ts'
import { plate } from './plate.sim.ts'
import { dropper } from './dropper.sim.ts'
import { lift } from './lift.sim.ts'
import { chamber } from './plugins/chamber/chamber.sim.ts'
import { portal } from './plugins/portal/portal.sim.ts'
import file from './gym.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, box3d, player, start, chamber, portal, crate, ball, prism, hopper, laser, catcher, button, door, field, plate, dropper, lift }

// The file holds only what gym adds to the partial it extends, which the scenemanager merges in.
export const scene = file as unknown as Scene
