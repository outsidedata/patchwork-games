// demo_wormhole: the manager booted as its page boots it and main loaded; a seat joins and stands on
// its start; it puts the second portal on the wall it faces and the first on the floor at its feet,
// as its clicks do; dropped onto the floor portal, its body comes out of the wall portal's front going
// sideways at the speed it fell, and keeps that speed through the air until it lands.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './demo_wormhole.sim.ts'
import file from './demo_wormhole.scene.json' with { type: 'json' }
import shared from './demo_wormhole.partial_scene.json' with { type: 'json' }
import defs from './assets/demo_wormhole.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
// Two points or directions the same to the rounding of the sums that make them.
const near = (got: number[], want: number[]) => want.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 9))

test('a portal on the floor and one on the wall: a body dropped into the floor one flies out of the wall one at the speed it fell', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const me = possessed(heard[heard.length - 1].packet.rows)!
  const body = () => room.rows.find(r => r.id === me.id)!
  let seq = 0
  const press = (action: string, ...args: number[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me.id, action, args } })
    truth.step(DT)
  }
  const portal = (name: string) => room.rows.find(r => r.kind === 'portal' && r.data.name === name)!
  const [red, white] = defs.player.portals
  const wall = defs.chamber.levels.main.boxes[1]
  const { eye, sens } = defs.player

  // Facing the wall: the second portal on its face, at eye height, facing back.
  press('place', 1)
  near(portal(white).data.pos, [body().data.pos[0], eye, wall.max[2]])
  near(portal(white).data.normal, [0, 0, 1])
  near(portal(white).data.up, [0, 1, 0])

  // Looking down: the first portal on the floor ahead of its feet.
  press('look', 0, 1.2 / sens)
  press('place', 0)
  const a = portal(red).data
  expect(a.pos[1]).toBeCloseTo(0, 9)
  near(a.normal, [0, 1, 0])
  expect(a.to).toBe(white)

  // Dropped from 6 m over the floor portal.
  Object.assign(body().data, { pos: [a.pos[0], 6, a.pos[2]], vel: [0, 0, 0], grounded: false })
  let falling = 0
  for (let i = 0; i < 120 && body().data.jumps === 0; i++) {
    falling = body().data.vel[1]
    truth.step(DT)
  }
  const out = body().data
  expect(out.jumps).toBe(1)
  // Out of the wall portal's front, going along its normal at the speed it fell.
  expect(out.pos[2]).toBeGreaterThan(wall.max[2])
  expect(out.vel[2]).toBeGreaterThan(10)
  // The step it went through, it fell one step more under gravity first.
  expect(out.vel[2]).toBeCloseTo(-(falling - shared.world.walker.kinds.player.gravity * DT), 6)
  expect(Math.abs(out.vel[0])).toBeLessThan(1e-9)

  // Through the air it keeps that speed, until it lands.
  const thrown = out.vel[2], left = out.pos[2]
  let air = 0
  while (!body().data.grounded) {
    expect(body().data.vel[2]).toBeCloseTo(thrown, 9)
    truth.step(DT)
    air++
  }
  expect(body().data.pos[2]).toBeCloseTo(left + thrown * air * DT, 6)
})
