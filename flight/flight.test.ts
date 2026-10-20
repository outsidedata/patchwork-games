// flight booted as the server boots it, with a seat on the sky: the seat's pilot holds its slot's
// Cessna on its stand, and a pick takes another plane and lets the first go.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './flight.sim.ts'
import file from './flight.scene.json'
import defs from './assets/flight.json'

vi.setConfig({ testTimeout: 120_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const pickOf = (plane: string, mission: string, start: string) =>
  [defs.menu.planes.findIndex(p => p.type === plane), defs.menu.missions.findIndex(m => m.name === mission), defs.menu.starts.findIndex(s => s.name === start)]

test('the seat\'s pilot holds its slot\'s Cessna on its stand; a pick takes its slot\'s trainer and lets the Cessna go', async () => {
  const truth = boot(structuredClone(file) as Scene, sim)
  const sky = (await load(truth, here)).get('sky')!
  const heard: { seat: number; rows: Row[] }[] = []
  const c = connection(manager(truth), d => heard.push({ seat: d.seat, rows: d.packet.rows }))
  const step = (k: number) => { for (let i = 0; i < k; i++) truth.step(DT) }
  const held = () => sky.rows.find(r => r.id === sky.rows.find(r => r.kind === 'player')!.data.held?.id)!
  step(120)
  expect(held().data).toMatchObject({ type: 'cessna', stand: 'cessna 0', phase: 'seat', crashed: false })
  const last = heard[heard.length - 1]
  c.take({ scene: 'sky', seat: last.seat, msg: { seq: 1, n: 0, id: possessed(last.rows)!.id, action: 'pick', args: pickOf('trainer', 'free', 'ramp') } })
  step(2)
  expect(held().data).toMatchObject({ type: 'trainer', stand: 'trainer 0', phase: 'seat' })
  expect(sky.rows.find(r => r.kind === 'plane' && r.data.stand === 'cessna 0')!.data.phase).not.toBe('seat')
})
