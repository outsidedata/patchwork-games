// demo_particle3d: the manager booted as its page boots it and main loaded; a seat joins and its X Bot
// lands on the tile under its start, which lights and throws its effect at the stage at once. It walks
// onto a tile that plays a stream, the effect is on particle3d's ledger at the stage while the body
// stands there, and it stops once the body walks off. It walks onto the bolt's tile, and the bolt, a
// beam, is thrown from its `lift` over the stage with its end, `to`, on the stage.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_particle3d.sim.ts'
import file from './demo_particle3d.scene.json' with { type: 'json' }
import defs from './assets/demo_particle3d.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
const plays = defs.pad.plays as Record<string, { effect: string; lift?: number[]; to?: number[]; stream?: boolean }>

async function joined() {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const body = () => room.rows.find(r => r.kind === 'player')!.data
  const pads = room.rows.filter(r => r.kind === 'pad') as Row[]
  const stage = room.rows.find(r => r.kind === 'stage')!.data.pos as number[]
  const ledger = () => room.rows.find(r => r.kind === 'particle3d')!.data.live as { id: number; effect: string; at: number[]; to?: number[]; age: number; life: number }[]
  // Where a pad's entry is thrown from: the stage, its `lift` over it.
  const thrown = (pad: Row) => stage.map((v, i) => v + (plays[pad.data.plays].lift ?? [0, 0, 0])[i])
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
  return { truth, room, body, pads, stage, ledger, thrown, send, toward }
}

test('the seat lands on a tile that lights and throws its effect at the stage', async () => {
  const { truth, body, pads, ledger, thrown } = await joined()
  truth.step(DT)
  const under = pads.find(p => p.data.on)!
  expect(Math.abs(under.data.pos[0] - body().pos[0])).toBeLessThanOrEqual(defs.pad.size / 2)
  expect(Math.abs(under.data.pos[2] - body().pos[2])).toBeLessThanOrEqual(defs.pad.size / 2)
  const playing = ledger().find(e => e.effect === plays[under.data.plays].effect)!
  expect(playing.at).toEqual(thrown(under))
})

test('a seat walks onto a stream tile, its effect plays at the stage, and stops when the seat walks off', async () => {
  const { truth, pads, ledger, thrown, send, toward } = await joined()
  const pad = pads.find(r => plays[r.data.plays].stream)!

  toward(pad.data.pos[0], pad.data.pos[2])
  for (let i = 0; i < 600 && !pad.data.on; i++) truth.step(DT)
  expect(pad.data.on).toBe(true)
  send('stick', [0, 0])
  for (let i = 0; i < 60; i++) truth.step(DT)
  const playing = ledger().find(e => e.effect === plays[pad.data.plays].effect)!
  expect(playing.at).toEqual(thrown(pad))
  expect(playing.life).toBeGreaterThan(playing.age)

  toward(pad.data.pos[0], pad.data.pos[2] - 5)
  for (let i = 0; i < 300 && pad.data.on; i++) truth.step(DT)
  expect(pad.data.on).toBe(false)
  for (let i = 0; i < 60; i++) truth.step(DT)
  expect(ledger().some(e => e.id === playing.id)).toBe(false)
})

test('a seat walks onto the bolt tile, and the bolt is thrown from over the stage down to it', async () => {
  const { truth, pads, stage, ledger, thrown, toward } = await joined()
  const pad = pads.find(r => r.data.plays === 'bolt')!

  toward(pad.data.pos[0], pad.data.pos[2])
  for (let i = 0; i < 600 && !pad.data.on; i++) truth.step(DT)
  expect(pad.data.on).toBe(true)
  const playing = ledger().find(e => e.effect === 'bolt')!
  expect(playing.at).toEqual(thrown(pad))
  expect(playing.to).toEqual(stage.map((v, i) => v + plays.bolt.to![i]))
})
