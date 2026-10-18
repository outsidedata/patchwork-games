// The kinds of gym, the sandbox, and the gym.scene.json file next to this one: one room with every
// thing the game has, and no order to any of it. The ramp up to a ledge, a back wall and a wall down
// the right side to put portals on, a bin of balls a `hopper` fills on the first step, a stack of
// crates and a `prism`, a `laser` firing across the back of the room, a `catcher` far from its beam
// that opens one `door`, and a `button` that opens another; the seat throws more crates and carries
// them.
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
import { chamber } from './plugins/chamber/chamber.sim.ts'
import { portal } from './plugins/portal/portal.sim.ts'
import file from './gym.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, box3d, player, start, chamber, portal, crate, ball, prism, hopper, laser, catcher, button, door }

// The file holds only what gym adds to the partial it extends, which the scenemanager merges in.
export const scene = file as unknown as Scene
