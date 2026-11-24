// demo_clothes3d: the manager booted as its page boots it and main loaded; a seat joins, its robed
// person stands on its slot's start wearing its definition's clothing, and `dress` takes the clothes
// off and puts them on again.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_clothes3d.sim.ts'
import file from './demo_clothes3d.scene.json' with { type: 'json' }
import defs from './assets/demo_clothes3d.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat joins main, stands on its start clothed, and dress takes the clothes off and on', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  truth.step(DT)
  const start = room.rows.find(r => r.kind === 'start' && r.data.slot === 0)!
  const me = () => room.rows.find(r => r.kind === 'player')!
  expect([me().data.pos[0], me().data.pos[2]]).toEqual(start.data.pos)
  expect(me().data.clothing).toEqual(defs.player.clothing)

  const dress = (seq: number) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq, n: last.packet.n, id: me().id, action: 'dress', args: [] } })
    truth.step(DT)
  }
  dress(1)
  expect(me().data.clothing).toEqual([])
  dress(2)
  expect(me().data.clothing).toEqual(defs.player.clothing)
})

test('every bystander stands on the ground where its entry puts it, wearing its definition\'s clothing', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  connection(manager(truth), () => {})
  truth.step(DT)
  truth.step(DT)
  const entries = (room.scene.actors ?? []).filter(a => a.is === 'bystander')
  const rows = room.rows.filter(r => r.kind === 'bystander')
  expect(rows.length).toBe(entries.length)
  expect(rows.length).toBeGreaterThan(1)
  for (const [i, row] of rows.entries()) {
    expect([row.data.pos[0], row.data.pos[2]]).toEqual(entries[i].pos)
    expect(row.data.grounded).toBe(true)
    expect(row.data.clothing).toEqual(defs.bystander.clothing)
  }
})
