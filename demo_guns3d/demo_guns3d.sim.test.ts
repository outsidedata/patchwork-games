// demo_guns3d: the manager booted as its page boots it and main loaded; a seat joins holding the G95, turns its view
// onto a plate, fires, knocks the plate down, reloads, and aims; and a seat swaps to the RPG-7, launches a rocket
// that knocks a plate down, reloads the tube and swaps on to the G95-L and round; and a seat holds the G95-L's beam
// on a plate, knocks it down, drains its cell and recharges it; and a seat fires the ion blaster's bolt into a plate.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './demo_guns3d.sim.ts'
import file from './demo_guns3d.scene.json' with { type: 'json' }
import defs from './assets/demo_guns3d.json' with { type: 'json' }
import sheet from './assets/demo_guns3d.guns.json' with { type: 'json' }
import reloading from './assets/moves/rifle-reload.move.json' with { type: 'json' }
import launcherReload from './assets/moves/launcher-reload.move.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat holds the G95, shoots a plate down and reloads', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  let seq = 0
  const press = (action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    const me = possessed(last.packet.rows)!
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me.id, action, args } })
  }
  const steps = (n: number) => { for (let i = 0; i < n; i++) truth.step(DT) }
  steps(2)
  const me = () => room.rows.find((r: Row) => r.kind === 'player')!
  const gun = () => me().data.gun
  const size = sheet.guns.g95.words.feed.magazine.size
  expect(gun().rounds + gun().chambered).toBe(size + 1)
  expect(gun().carry).toBe('ready')

  // the view turned until the eye's line runs through the nearest plate's middle
  const plate = room.rows.find((r: Row) => r.kind === 'plate' && r.data.pos[2] === 10 && r.data.pos[0] === 1)!
  const middle = [plate.data.pos[0], plate.data.pos[1] + defs.plate.post, plate.data.pos[2]]
  for (let i = 0; i < 4; i++) {
    const d = me().data
    const { yaw, pitch, dist, side } = d.look
    const pivot = [d.pos[0] - Math.cos(yaw) * side, d.pos[1] + d.lift, d.pos[2] + Math.sin(yaw) * side]
    const eye = [pivot[0] - Math.sin(yaw) * Math.cos(pitch) * dist, pivot[1] + Math.sin(pitch) * dist, pivot[2] - Math.cos(yaw) * Math.cos(pitch) * dist]
    const to = middle.map((v, k) => v - eye[k])
    press('look', Math.atan2(to[0], to[2]) - yaw, -Math.atan2(to[1], Math.hypot(to[0], to[2])) - pitch)
    steps(1)
  }

  // one press on semi: one round, and the plate goes down
  press('fire', 1)
  steps(2)
  press('fire', 0)
  steps(1)
  expect(gun().shots).toBe(1)
  expect(gun().fired.at(-1).hit).toBe(plate.id)
  expect(plate.data.down).toBeGreaterThan(0)
  expect(plate.data.hits).toBe(1)

  // a reload with a round still chambered: the magazine is full at the move's done, and the act over at its end
  press('reload')
  steps(1)
  expect(gun().move).toBe('reload')
  steps(Math.ceil(reloading.done / DT))
  expect(gun().rounds).toBe(size)
  expect(gun().act).toBe(true)
  steps(Math.ceil((reloading.length - reloading.done) / DT) + 1)
  expect(gun().act).toBe(false)

  // the aim key held carries the gun aimed, and let go, ready again
  press('aim', 1)
  steps(1)
  expect(gun().carry).toBe(defs.player.carries.aim)
  press('aim', 0)
  steps(1)
  expect(gun().carry).toBe(defs.player.carries.stand)
}, 10000)

test('a seat swaps to the RPG-7, launches a rocket that flies to a plate and knocks it down, reloads the tube, and swaps back', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  let seq = 0
  const press = (action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    const me = possessed(last.packet.rows)!
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me.id, action, args } })
  }
  const steps = (n: number) => { for (let i = 0; i < n; i++) truth.step(DT) }
  steps(2)
  const me = () => room.rows.find((r: Row) => r.kind === 'player')!
  const gun = () => me().data.gun
  const live = () => room.rows.find((r: Row) => r.kind === 'volley3d')!.data.live

  press('swap')
  steps(1)
  expect(gun().name).toBe('rpg7')
  expect(gun().loaded).toBe(1)
  expect(gun().carry).toBe('ready')

  // the view turned until the eye's line runs through the middle plate at 20 m
  const plate = room.rows.find((r: Row) => r.kind === 'plate' && r.data.pos[2] === 20 && r.data.pos[0] === 0)!
  const middle = [plate.data.pos[0], plate.data.pos[1] + defs.plate.post, plate.data.pos[2]]
  for (let i = 0; i < 4; i++) {
    const d = me().data
    const { yaw, pitch, dist, side } = d.look
    const pivot = [d.pos[0] - Math.cos(yaw) * side, d.pos[1] + d.lift, d.pos[2] + Math.sin(yaw) * side]
    const eye = [pivot[0] - Math.sin(yaw) * Math.cos(pitch) * dist, pivot[1] + Math.sin(pitch) * dist, pivot[2] - Math.cos(yaw) * Math.cos(pitch) * dist]
    const to = middle.map((v, k) => v - eye[k])
    press('look', Math.atan2(to[0], to[2]) - yaw, -Math.atan2(to[1], Math.hypot(to[0], to[2])) - pitch)
    steps(1)
  }

  // one press: one rocket on the ledger, the tube empty
  press('fire', 1)
  steps(2)
  press('fire', 0)
  steps(1)
  expect(gun().shots).toBe(1)
  expect(gun().loaded).toBe(0)
  expect(live()).toHaveLength(1)
  expect(live()[0].from).toBe(me().id)

  // it flies the 20 m in a third of a second and knocks the plate down
  steps(20)
  expect(live()[0].hit?.id).toBe(plate.id)
  expect(plate.data.down).toBeGreaterThan(0)
  expect(plate.data.hits).toBe(1)

  // a press on an empty tube launches nothing
  press('fire', 1)
  steps(2)
  press('fire', 0)
  steps(1)
  expect(gun().shots).toBe(1)

  // the reload loads the tube at its done
  const move = launcherReload
  press('reload')
  steps(1)
  expect(gun().move).toBe('reload')
  steps(Math.ceil(move.done / DT))
  expect(gun().loaded).toBe(1)
  // no swap while the act plays
  press('swap')
  steps(1)
  expect(gun().name).toBe('rpg7')
  steps(Math.ceil((move.length - move.done) / DT) + 1)
  expect(gun().act).toBe(false)

  // on to the G95-L, its cell full, the ion blaster, its cell full, and round to the G95, fresh in the hand
  press('swap')
  steps(1)
  expect(gun().name).toBe('g95-L')
  expect(gun().charge).toBe(sheet.guns['g95-L'].words.feed.cell.size)
  press('swap')
  steps(1)
  expect(gun().name).toBe('g95-I')
  expect(gun().charge).toBe(sheet.guns['g95-I'].words.feed.cell.size)
  press('swap')
  steps(1)
  expect(gun().name).toBe('g95')
  expect(gun().rounds + gun().chambered).toBe(sheet.guns.g95.words.feed.magazine.size + 1)
}, 10000)

test('a seat swaps to the G95-L, holds its beam on a plate, knocks it down, drains the cell and recharges it', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  let seq = 0
  const press = (action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    const me = possessed(last.packet.rows)!
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me.id, action, args } })
  }
  const steps = (n: number) => { for (let i = 0; i < n; i++) truth.step(DT) }
  steps(2)
  const me = () => room.rows.find((r: Row) => r.kind === 'player')!
  const gun = () => me().data.gun
  const laser = sheet.guns['g95-L']
  const size = laser.words.feed.cell.size
  const interval = 60 / laser.words.action.cycle.rpm

  press('swap')
  steps(1)
  press('swap')
  steps(1)
  expect(gun().name).toBe('g95-L')
  expect(gun().charge).toBe(size)

  const plate = room.rows.find((r: Row) => r.kind === 'plate' && r.data.pos[2] === 10 && r.data.pos[0] === 1)!
  const middle = [plate.data.pos[0], plate.data.pos[1] + defs.plate.post, plate.data.pos[2]]
  for (let i = 0; i < 4; i++) {
    const d = me().data
    const { yaw, pitch, dist, side } = d.look
    const pivot = [d.pos[0] - Math.cos(yaw) * side, d.pos[1] + d.lift, d.pos[2] + Math.sin(yaw) * side]
    const eye = [pivot[0] - Math.sin(yaw) * Math.cos(pitch) * dist, pivot[1] + Math.sin(pitch) * dist, pivot[2] - Math.cos(yaw) * Math.cos(pitch) * dist]
    const to = middle.map((v, k) => v - eye[k])
    press('look', Math.atan2(to[0], to[2]) - yaw, -Math.atan2(to[1], Math.hypot(to[0], to[2])) - pitch)
    steps(1)
  }

  // held for a second: a pulse every interval, each a straight line met at once, the first knocking the plate down,
  // and the newest pulse on the ledger never older than the beam's fade, so the page draws one beam the whole second
  press('fire', 1)
  const held = Math.round(1 / DT)
  let longest = 0
  const met = new Set<number>()
  for (let i = 0; i < held; i++) {
    steps(1)
    if (i > 0) longest = Math.max(longest, gun().fired.at(-1).age)
    for (const f of gun().fired) if (f.hit !== undefined) met.add(f.hit)
  }
  expect(longest).toBeLessThanOrEqual(laser.look.beam.fade)
  const pulses = gun().shots
  expect(Math.abs(pulses - held * DT / interval)).toBeLessThanOrEqual(1)
  expect(gun().charge).toBe(size - pulses)
  expect(met.has(plate.id)).toBe(true)
  expect(plate.data.down).toBeGreaterThan(0)
  for (const f of gun().fired) expect(f.move).toBe('shot')

  // let go: no pulse more
  press('fire', 0)
  steps(5)
  expect(gun().shots).toBe(pulses)
  expect(gun().held).toBe(false)

  // held until the cell is empty: the pulses stop at its size
  press('fire', 1)
  steps(Math.ceil(size * interval / DT) + 10)
  expect(gun().charge).toBe(0)
  expect(gun().shots).toBe(size)
  press('fire', 0)
  steps(1)

  // the reload fills the cell at its done
  press('reload')
  steps(1)
  expect(gun().move).toBe('reload')
  steps(Math.ceil(reloading.done / DT))
  expect(gun().charge).toBe(size)
  steps(Math.ceil((reloading.length - reloading.done) / DT) + 1)
  expect(gun().act).toBe(false)

  // a full cell plays no reload
  press('reload')
  steps(1)
  expect(gun().move).toBe('')
}, 20000)

test('a seat swaps to the ion blaster, fires a bolt that flies to a plate and knocks it down, and one press is one bolt', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  let seq = 0
  const press = (action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    const me = possessed(last.packet.rows)!
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me.id, action, args } })
  }
  const steps = (n: number) => { for (let i = 0; i < n; i++) truth.step(DT) }
  steps(2)
  const me = () => room.rows.find((r: Row) => r.kind === 'player')!
  const gun = () => me().data.gun
  const live = () => room.rows.find((r: Row) => r.kind === 'volley3d')!.data.live
  const size = sheet.guns['g95-I'].words.feed.cell.size

  for (let i = 0; i < 3; i++) {
    press('swap')
    steps(1)
  }
  expect(gun().name).toBe('g95-I')
  expect(gun().charge).toBe(size)

  const plate = room.rows.find((r: Row) => r.kind === 'plate' && r.data.pos[2] === 20 && r.data.pos[0] === 0)!
  const middle = [plate.data.pos[0], plate.data.pos[1] + defs.plate.post, plate.data.pos[2]]
  for (let i = 0; i < 4; i++) {
    const d = me().data
    const { yaw, pitch, dist, side } = d.look
    const pivot = [d.pos[0] - Math.cos(yaw) * side, d.pos[1] + d.lift, d.pos[2] + Math.sin(yaw) * side]
    const eye = [pivot[0] - Math.sin(yaw) * Math.cos(pitch) * dist, pivot[1] + Math.sin(pitch) * dist, pivot[2] - Math.cos(yaw) * Math.cos(pitch) * dist]
    const to = middle.map((v, k) => v - eye[k])
    press('look', Math.atan2(to[0], to[2]) - yaw, -Math.atan2(to[1], Math.hypot(to[0], to[2])) - pitch)
    steps(1)
  }

  // one press: one ion bolt on volley3d's ledger, one charge spent
  press('fire', 1)
  steps(2)
  press('fire', 0)
  steps(1)
  expect(gun().shots).toBe(1)
  expect(gun().charge).toBe(size - 1)
  expect(live()).toHaveLength(1)
  expect(live()[0].pattern).toBe('ion')
  expect(live()[0].from).toBe(me().id)

  // it flies the 20 m and knocks the plate down
  steps(20)
  expect(live()[0].hit?.id).toBe(plate.id)
  expect(plate.data.down).toBeGreaterThan(0)
}, 10000)
