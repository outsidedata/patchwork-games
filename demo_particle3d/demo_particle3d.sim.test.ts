// demo_particle3d: the manager booted as its page boots it and main loaded; a seat joins, walks its X Bot
// from its start onto a pad that plays a stream, the pad's effect is on particle3d's ledger at the pad
// while the body stands there, and it stops once the body walks off.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_particle3d.sim.ts'
import file from './demo_particle3d.scene.json' with { type: 'json' }
import defs from './assets/demo_particle3d.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat walks onto a stream pad, its effect plays there, and stops when the seat walks off', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const body = () => room.rows.find(r => r.kind === 'player')!.data
  const plays = defs.pad.plays as Record<string, { effect: string; stream?: boolean }>
  const pad = room.rows.find(r => r.kind === 'pad' && plays[r.data.plays].stream)! as Row
  const ledger = () => room.rows.find(r => r.kind === 'particle3d')!.data.live as { id: number; effect: string; at: number[]; age: number; life: number }[]

  const last = heard[heard.length - 1]
  const me = last.packet.rows.find(r => r.kind === 'player')!
  let seq = 0
  const send = (action: string, args: unknown[]) =>
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me.id, action, args } as any })
  // The stick toward a point, from the camera's yaw 0: forward is +z, and right is −x.
  const toward = (x: number, z: number) => {
    const dx = x - body().pos[0], dz = z - body().pos[2], l = Math.hypot(dx, dz)
    send('stick', [-dx / l, -dz / l])
  }

  toward(pad.data.pos[0], pad.data.pos[2])
  for (let i = 0; i < 600 && !pad.data.on; i++) truth.step(DT)
  expect(pad.data.on).toBe(true)
  send('stick', [0, 0])
  for (let i = 0; i < 60; i++) truth.step(DT)
  const playing = ledger().find(e => e.effect === plays[pad.data.plays].effect)!
  expect(playing.at).toEqual(pad.data.pos)
  expect(playing.life).toBeGreaterThan(playing.age)

  toward(pad.data.pos[0], pad.data.pos[2] - 5)
  for (let i = 0; i < 300 && pad.data.on; i++) truth.step(DT)
  expect(pad.data.on).toBe(false)
  for (let i = 0; i < 60; i++) truth.step(DT)
  expect(ledger().some(e => e.id === playing.id)).toBe(false)
})
