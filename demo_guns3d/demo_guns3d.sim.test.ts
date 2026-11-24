// demo_guns3d: the manager booted as its page boots it and main loaded; a seat joins holding the G95, turns its view
// onto a plate, fires, knocks the plate down, reloads, and aims.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './demo_guns3d.sim.ts'
import file from './demo_guns3d.scene.json' with { type: 'json' }
import defs from './assets/demo_guns3d.json' with { type: 'json' }
import sheet from './assets/demo_guns3d.guns.json' with { type: 'json' }
import reloading from './assets/moves/rifle-reload.move.json' with { type: 'json' }

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
