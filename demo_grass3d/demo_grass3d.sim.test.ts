// demo_grass3d: the manager booted as its page boots it and main loaded; a seat joins and takes the hatch
// its start names, the hatch settles on the meadow over the chunks the `ground` actor lists round it, and
// the pedal drives it off.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { sim } from './demo_grass3d.sim.ts'
import file from './demo_grass3d.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat takes the hatch, it settles on the meadow, and the pedal drives it', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  for (let i = 0; i < 120; i++) truth.step(DT)
  const chassis = () => room.rows.find(r => r.kind === 'car')!
  const me = room.rows.find(r => r.kind === 'player')!
  expect(me.data.held).toEqual({ kind: 'box3dvehicle', id: room.rows.find(r => r.kind === 'box3dvehicle')!.id })
  const [x, y, z] = chassis().data.pos
  expect(y - heightAt(room, x, z)).toBeGreaterThan(0)
  expect(y - heightAt(room, x, z)).toBeLessThan(1.5)
  const box3d = room.rows.find(r => r.kind === 'box3d')!
  expect(box3d.data.ground).toHaveLength(9)

  const last = heard[heard.length - 1]
  seat.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.packet.n, id: me.id, action: 'pedal', args: [1] } })
  for (let i = 0; i < 180; i++) truth.step(DT)
  const [x2, , z2] = chassis().data.pos
  expect(Math.hypot(x2 - x, z2 - z)).toBeGreaterThan(5)
})
