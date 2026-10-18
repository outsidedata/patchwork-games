// demo_wormhole: the manager booted as its page boots it and main loaded; a seat joins and stands on
// its start; it puts the first door down ahead, turns a quarter and puts the second down ahead, turns
// back, walks into the first door's front and comes out of the second's, facing out of it; and putting
// a door down again moves it.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './demo_wormhole.sim.ts'
import file from './demo_wormhole.scene.json' with { type: 'json' }
import defs from './assets/demo_wormhole.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat puts both doors down, walks through the first and out of the second, and moves a door by putting it down again', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const last = heard[heard.length - 1]
  const me = possessed(last.packet.rows)!
  const walker = () => room.rows.find(r => r.id === me.id)!
  const doors = () => room.rows.filter(r => r.kind === 'door')
  let seq = 0
  const press = (action: string, ...args: number[]) => {
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: heard[heard.length - 1].packet.n, id: me.id, action, args } })
    truth.step(DT)
  }
  const start = room.rows.find(r => r.kind === 'start' && r.data.slot === me.data.seat)!
  const { reach, sens, portals } = defs.player

  press('place', 0)
  const first = doors().find(d => d.data.name === portals[0])!
  expect(first.data.pos).toEqual([start.data.pos[0], 0, start.data.pos[2] - reach])
  expect(first.data.to).toBe(portals[1])

  // A quarter turn right, the second door ahead, and back.
  const quarter = Math.PI / 2 / sens
  press('look', quarter, 0)
  press('place', 1)
  const second = doors().find(d => d.data.name === portals[1])!
  expect(second.data.pos[0]).toBeCloseTo(start.data.pos[0] + reach)
  expect(second.data.pos[2]).toBeCloseTo(start.data.pos[2])
  expect(doors()).toHaveLength(2)
  press('look', -quarter, 0)

  press('move', 0, -1)
  for (let i = 0; i < 240 && walker().data.jumps === 0; i++) truth.step(DT)
  const w = walker().data
  expect(w.jumps).toBe(1)
  // Just out of the second door's front, facing out of it.
  const out = [Math.sin(second.data.yaw), Math.cos(second.data.yaw)]
  const ahead = (w.pos[0] - second.data.pos[0]) * out[0] + (w.pos[2] - second.data.pos[2]) * out[1]
  expect(ahead).toBeGreaterThan(0)
  expect(ahead).toBeLessThan(0.5)
  expect(Math.cos(w.yaw - (second.data.yaw + Math.PI))).toBeCloseTo(1, 5)

  // Putting the first door down again moves it, and makes no third.
  press('move', 0, 0)
  const was = [...first.data.pos]
  press('place', 0)
  expect(doors()).toHaveLength(2)
  expect(first.data.pos).not.toEqual(was)
})
