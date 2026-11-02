// demo_lod3d: the manager booted as its page boots it and main loaded; a seat joins, its `player` row,
// its eye, stands over the land on its slot's start, flies the way it looks, and never comes nearer the
// land than its `clear`.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { sim } from './demo_lod3d.sim.ts'
import file from './demo_lod3d.scene.json' with { type: 'json' }
import main from './main.scene.json' with { type: 'json' }
import defs from './assets/demo_lod3d.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

const seated = async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const last = heard[heard.length - 1]
  const me = possessed(last.packet.rows)!
  let seq = 0
  const press = (action: string, ...args: Arg[]) =>
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me.id, action, args } })
  const eye = () => room.rows.find(r => r.id === me.id)! as Row
  return { truth, room, press, eye }
}

test('a seat\'s eye stands over the land on its start and flies the way it looks', async () => {
  const { truth, room, press, eye } = await seated()
  const start = main.actors.find(a => a.is === 'start')!
  const [x, z] = start.at!
  expect(eye().data.pos).toEqual([x, heightAt(room, x, z) + defs.player.clear + start.up!, z])
  press('stick', 0, -1)
  for (let i = 0; i < 60; i++) truth.step(DT)
  // yaw 0 looks along +z, down by the start's pitch
  expect(eye().data.pos[2]).toBeCloseTo(z + defs.player.speed * DT * 60 * Math.cos(start.pitch!), 6)
})

test('the eye sinking never comes nearer the land than its clear', async () => {
  const { truth, room, press, eye } = await seated()
  press('down', 1)
  for (let i = 0; i < 240; i++) truth.step(DT)
  const [x, y, z] = eye().data.pos
  expect(y).toBeCloseTo(heightAt(room, x, z) + defs.player.clear, 6)
})
