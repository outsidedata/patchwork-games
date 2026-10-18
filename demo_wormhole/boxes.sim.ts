// The kinds of boxes, the box experiment's scene, and the boxes.scene.json file next to this one: main's
// room, seat and portals, with box3d standing the chamber's pieces as one fixed body and a `crate`
// dropped onto the floor ahead of the start.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { portal } from './portal.sim.ts'
import { crate } from './crate.sim.ts'
import { chamber } from './plugins/chamber/chamber.sim.ts'
import file from './boxes.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, box3d, player, start, chamber, portal, crate }

export const scene = file as Scene
