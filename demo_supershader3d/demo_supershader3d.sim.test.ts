// demo_supershader3d: the manager booted as its page boots it and main loaded. A seat enters main:
// its eye, its `player` row, stands `up` over the ground at its start, looking along the start, flies
// along the way it looks at its definition's speed, faster with boost, and never comes nearer the
// ground than `clear`. The yard's shapes stand where the scene puts them.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene, type Truth, type W } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { sim } from './demo_supershader3d.sim.ts'
import file from './demo_supershader3d.scene.json' with { type: 'json' }
import defs from './assets/demo_supershader3d.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
const k = defs.player

// The manager and main, a seat on it, and a way to send its `player` row an act.
async function seated() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  let seq = 0
  const last = () => heard[heard.length - 1]
  const me = () => possessed(last().packet.rows)!
  const act = (action: string, ...args: unknown[]) =>
    seat.take({ scene: last().scene, seat: last().seat, msg: { seq: ++seq, n: last().packet.n, id: me().id, action, args: args as any } })
  const steps = (n: number) => { for (let i = 0; i < n; i++) truth.step(DT) }
  const eye = () => room.rows.find(r => r.id === me().id)!.data
  return { truth, room, me, act, steps, eye }
}

// A truth as a rule is handed it.
const wOf = (t: Truth) => ({
  world: t.scene.world,
  all: (kind: string) => t.rows.filter(r => r.kind === kind),
  find: (kind: string, pred: (r: Row) => boolean = () => true) => t.rows.find(r => r.kind === kind && pred(r))!,
  get: (id: number) => t.rows.find(r => r.id === id)!,
}) as unknown as W

test('the eye stands up over the ground at its start, looking along the start', async () => {
  const { room, me, eye } = await seated()
  const start = room.rows.find(r => r.kind === 'start' && r.data.slot === me().data.seat)!.data
  const w = wOf(room)
  expect(eye().stood).toBe(true)
  expect(eye().pos[0]).toBe(start.at[0])
  expect(eye().pos[2]).toBe(start.at[1])
  expect(eye().pos[1]).toBeCloseTo(heightAt(w, start.at[0], start.at[1]) + k.clear + start.up, 9)
  expect(eye().look.yaw).toBe(start.yaw)
  expect(eye().look.pitch).toBe(start.pitch)
})

test('forward flies speed·pace metres a second along the way the eye looks, and boost multiplies it', async () => {
  const { act, steps, eye } = await seated()
  const was = [...eye().pos], { yaw, pitch } = eye().look
  act('stick', 0, -1)
  steps(30)
  const run = k.speed * DT * 30
  expect(eye().pos[0]).toBeCloseTo(was[0] + math.sin(yaw) * math.cos(pitch) * run, 6)
  expect(eye().pos[2]).toBeCloseTo(was[2] + math.cos(yaw) * math.cos(pitch) * run, 6)
  expect(eye().pos[1]).toBeCloseTo(was[1] - math.sin(pitch) * run, 6)
  const at = [...eye().pos]
  act('fast', 1)
  steps(30)
  const across = math.hypot(eye().pos[0] - at[0], eye().pos[2] - at[2])
  expect(across).toBeCloseTo(k.boost * run * math.cos(pitch), 6)
})

test('the eye never comes nearer the ground than clear, and the mouse turns it', async () => {
  const { room, act, steps, eye } = await seated()
  const w = wOf(room)
  const yaw = eye().look.yaw
  act('look', 0.3, k.camera.maxPitch)
  steps(1)
  expect(eye().look.pitch).toBe(k.camera.maxPitch)
  expect(eye().look.yaw).toBeCloseTo(yaw + 0.3, 9)
  act('down', 1)
  act('stick', 0, -1)
  act('fast', 1)
  for (let i = 0; i < 20; i++) {
    steps(15)
    const [x, y, z] = eye().pos
    expect(y).toBeGreaterThanOrEqual(heightAt(w, x, z) + k.clear - 1e-9)
  }
  const [x, y, z] = eye().pos
  expect(y).toBeCloseTo(heightAt(w, x, z) + k.clear, 9)
})

test('an act refuses arguments of the wrong kind and writes nothing', async () => {
  const { act, steps, eye } = await seated()
  const was = structuredClone(eye())
  act('stick', '1', 0)
  act('look', 'a', 0)
  act('fast', 2)
  act('pace', 'x')
  steps(2)
  expect(eye().stick).toEqual(was.stick)
  expect(eye().look).toEqual(was.look)
  expect(eye().fast).toBe(was.fast)
  expect(eye().pace).toBe(was.pace)
})

test('the yard\'s shapes stand where the scene puts them, each of its kind', async () => {
  const { room } = await seated()
  const of = (kind: string) => room.rows.filter(r => r.kind === kind)
  expect(of('block')).toHaveLength(3)
  expect(of('crate')).toHaveLength(3)
  expect(of('post')).toHaveLength(3)
  expect(of('path')).toHaveLength(2)
  expect(of('block')[0].data.pos).toEqual([8, 0, 6])
  expect(of('path')[1].data.yaw).toBe(-1.2)
})
