// demo_audio booted as the server boots it, with two connections in the lot: every car stands on its
// wheels on the ground in its row, and each seat holds the car of the spot its start names. A seat's
// pedal drives the car it holds and no other, every other car held braked by its spot; `next` and `back`
// move the seat along the row to the next free car, past one another seat holds, a pedal held down
// handed to the car taken; every car's engine runs up from idle under the throttle; no car's gearbox
// hunts at full throttle; and every car's engine is a manifest on the disk, each file it names a WAV
// beside it.
import { expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './demo_audio.sim.ts'
import file from './demo_audio.scene.json'
import lot from './lot.scene.json'

vi.setConfig({ testTimeout: 120_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const SPOTS = lot.actors.filter(a => a.is === 'spot') as { name: string; vehicle: string; x: number; z: number }[]

// The manager, the lot and two connections in it.
async function open() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const g = (await load(truth, here)).get('lot')!
  const seats = [0, 1].map(() => {
    const heard: { seat: number; rows: Row[] }[] = []
    const c = connection(manager(truth), d => heard.push({ seat: d.seat, rows: d.packet.rows }))
    return { c, last: () => heard[heard.length - 1] }
  })
  const step = (k: number) => { for (let i = 0; i < k; i++) truth.step(DT) }
  step(2)
  let seq = 0
  // A press from seat `s` at its own `player` row, stamped with the lot's step, as a page stamps it.
  const press = (s: number, action: string, ...args: unknown[]) => {
    const last = seats[s].last(), me = possessed(last.rows)!
    seats[s].c.take({ scene: 'lot', seat: last.seat, msg: { seq: ++seq, n: g.n, id: me.id, action, args: args as any[] } })
  }
  const row = (id: number) => g.rows.find(r => r.id === id)!
  const cars = () => g.rows.filter(r => r.kind === 'box3dvehicle')
  const carNamed = (name: string) => cars().find(c => c.data.vehicle === name)!
  const held = (s: number) => row(possessed(seats[s].last().rows)!.id).data.held?.id as number | undefined
  const chassis = (car: Row) => row(car.data.chassis).data
  return { g, seats, step, press, row, cars, carNamed, held, chassis }
}

test('every car stands on its wheels on the ground at its spot, and each seat holds the car of the spot its start names', async () => {
  const t = await open()
  t.step(120)
  expect(t.cars().map(c => c.data.vehicle).sort()).toEqual(SPOTS.map(s => s.vehicle).sort())
  for (const s of SPOTS) {
    const car = t.carNamed(s.vehicle), at = t.chassis(car).pos as number[]
    expect(Math.hypot(at[0] - s.x, at[2] - s.z)).toBeLessThan(0.3)
    for (const id of car.data.wheels as number[]) {
      const radius = lot.world.box3dvehicle.vehicles[s.vehicle as keyof typeof lot.world.box3dvehicle.vehicles].axles[0].wheel.radius
      expect(t.row(id).data.pos[1]).toBeGreaterThan(radius - 0.08)
      expect(t.row(id).data.pos[1]).toBeLessThan(radius * 1.6 + 0.08)
    }
  }
  const starts = lot.actors.filter(a => a.is === 'start') as { slot: number; spot: string }[]
  for (const s of starts) expect(t.held(s.slot)).toBe(t.carNamed(SPOTS.find(p => p.name === s.spot)!.vehicle).id)
})

test('a seat\'s pedal drives the car it holds, and no other: every other car stays braked where it stood', async () => {
  const t = await open()
  t.step(60)
  const before = Object.fromEntries(t.cars().map(c => [c.data.vehicle, [...t.chassis(c).pos]]))
  t.press(0, 'pedal', 1)
  t.step(180)
  const hatch = t.carNamed('hatch')
  expect(hatch.data.rpm).toBeGreaterThan(1500)
  expect(t.chassis(hatch).pos[0] - before.hatch[0]).toBeGreaterThan(3)
  for (const c of t.cars()) {
    if (c === hatch) continue
    expect(Math.hypot(...[0, 2].map(k => t.chassis(c).pos[k] - before[c.data.vehicle][k])), c.data.vehicle).toBeLessThan(0.1)
    // The muscle car is seat 1's, whose pedal is untouched; every car no seat holds its spot brakes.
    if (c.id !== t.held(1)) expect(c.data.brake, c.data.vehicle).toBe(1)
  }
})

test('next and back move the seat along the row to the next free car, past one another seat holds, and a pedal held down drives the car taken', async () => {
  const t = await open()
  t.step(60)
  // seat 0 holds the hatch, seat 1 the muscle car, next along the row: next skips it to the exotic.
  t.press(0, 'pedal', 1)
  t.press(0, 'next')
  t.step(2)
  expect(t.held(0)).toBe(t.carNamed('exotic').id)
  t.step(120)
  expect(t.carNamed('exotic').data.rpm).toBeGreaterThan(1500)
  expect(t.carNamed('hatch').data.brake).toBe(1)
  // back skips the muscle car again, to the hatch; back again goes round to the cart at the row's end.
  t.press(0, 'back')
  t.step(2)
  expect(t.held(0)).toBe(t.carNamed('hatch').id)
  t.press(0, 'back')
  t.step(2)
  expect(t.held(0)).toBe(t.carNamed('kart').id)
  t.press(0, 'back')
  t.step(2)
  expect(t.held(0)).toBe(t.carNamed('cart').id)
  expect(t.held(1)).toBe(t.carNamed('muscle').id)
})

test('every car\'s engine runs up from idle under the throttle, and the car drives off', async () => {
  const t = await open()
  t.step(60)
  const fleet = lot.world.box3dvehicle.vehicles as Record<string, { engine: { idle?: number; redline: number } }>
  const driven: string[] = []
  // The car seat `s` holds, driven at full throttle for two seconds and let go.
  const drive = (s: number) => {
    const car = t.cars().find(c => c.id === t.held(s))!
    const from = [...t.chassis(car).pos]
    t.press(s, 'pedal', 1)
    t.step(120)
    const e = fleet[car.data.vehicle].engine
    expect(car.data.rpm, car.data.vehicle).toBeGreaterThan((e.idle ?? 0) + 0.15 * (e.redline - (e.idle ?? 0)))
    expect(Math.hypot(t.chassis(car).pos[0] - from[0], t.chassis(car).pos[2] - from[2]), car.data.vehicle).toBeGreaterThan(1)
    t.press(s, 'pedal', 0)
    driven.push(car.data.vehicle)
  }
  // Seat 0 drives every car along the row but the one seat 1 holds, which seat 1 drives.
  for (let i = 0; i < SPOTS.length - 1; i++) {
    drive(0)
    t.press(0, 'next')
    t.step(2)
  }
  drive(1)
  expect(driven.sort()).toEqual(SPOTS.map(s => s.vehicle).sort())
})

test('at full throttle every car\'s gearbox only ever shifts up: no gear hunting', async () => {
  const t = await open()
  t.step(60)
  const shifts: Record<string, number[]> = {}
  // The car seat `s` holds, the pedal all the way down for ten seconds: every gear it is in, in order.
  const run = (s: number) => {
    const car = t.cars().find(c => c.id === t.held(s))!, gears: number[] = []
    t.press(s, 'pedal', 1)
    for (let i = 0; i < 600; i++) {
      t.step(1)
      if (gears[gears.length - 1] !== car.data.gear) gears.push(car.data.gear)
    }
    shifts[car.data.vehicle] = gears
    t.press(s, 'pedal', 0)
  }
  for (let i = 0; i < SPOTS.length - 1; i++) {
    run(0)
    t.press(0, 'next')
    t.step(2)
  }
  run(1)
  const said = Object.entries(shifts).map(([name, g]) => `${name} ${g.join('>')}`).join(', ')
  for (const gears of Object.values(shifts)) expect(gears.every((g, i) => i === 0 || g > gears[i - 1]), `gears: ${said}`).toBe(true)
  expect(Object.keys(shifts).sort()).toEqual(SPOTS.map(s => s.vehicle).sort())
})

test('every car\'s engine is a manifest in the catalogue, each file it names a WAV beside it', () => {
  const catalogue = lot.world.loader.assets as Record<string, { type: string; url: string }>
  const fleet = lot.world.box3dvehicle.vehicles as Record<string, { look: { sound: { engine: string } } }>
  for (const [name, v] of Object.entries(fleet)) {
    const entry = catalogue[v.look.sound.engine]
    expect(entry.type, name).toBe('json')
    const url = new URL(`../..${entry.url}`, here)
    const manifest = JSON.parse(readFileSync(url, 'utf8')) as { layers: { rpm: number; stems: Record<string, string> }[] }
    for (const l of manifest.layers) for (const f of Object.values(l.stems)) expect(readFileSync(new URL(f, url)).subarray(0, 4).toString('latin1'), f).toBe('RIFF')
  }
})
