// demo_hair3d: the manager booted as its page boots it and main loaded; a seat joins, its X Bot stands
// on its slot's start, and the stick walks it forward at its definition's `walk`.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_hair3d.sim.ts'
import file from './demo_hair3d.scene.json' with { type: 'json' }
import defs from './assets/demo_hair3d.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat joins main, its body stands on its start, and the stick walks it', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const start = room.rows.find(r => r.kind === 'start' && r.data.slot === 0)!
  const me = () => room.rows.find(r => r.kind === 'player')!
  expect([me().data.pos[0], me().data.pos[2]]).toEqual(start.data.pos)
  expect(me().data.grounded).toBe(true)

  const last = heard[heard.length - 1]
  seat.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.packet.n, id: me().id, action: 'stick', args: [0, -1] } })
  for (let i = 0; i < 180; i++) truth.step(DT)
  expect(me().data.speed).toBeCloseTo(defs.player.walk, 1)
  expect(me().data.pos[2]).toBeGreaterThan(start.data.pos[1] + 2)
  expect(me().data.clip).toBe('walk')
})
