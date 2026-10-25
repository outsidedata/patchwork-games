// demo_cutscene: the manager booted as its page boots it and main loaded, a seat joined, and the
// intro played from `assets/intro.json`, whose game words `open` and `spawn` stagehand delivers: the
// gate opens at its cue, the wait on it holds the cue clock until it stands open, and the guard is
// spawned behind the wait; a skip from the seat lands the same yard at once.
import { expect, test } from 'vitest'
import { boot, type Scene, type Truth } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_cutscene.sim.ts'
import file from './demo_cutscene.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

async function joined() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  return { truth, room, heard, seat }
}
const of = (room: Truth, kind: string) => room.rows.find(r => r.kind === kind)

test('the intro opens the gate on its cue, holds until it stands open, then spawns the guard beyond it', async () => {
  const { truth, room } = await joined()
  const cs = () => of(room, 'cutscene')!.data
  const gate = () => of(room, 'gate')!.data
  let opened: number | undefined, spawned: number | undefined, open: number | undefined
  while (!cs().done && truth.n < 1200) {
    truth.step(DT)
    if (opened === undefined && gate().rate > 0) opened = cs().e
    if (open === undefined && gate().open === 1) open = cs().e
    if (spawned === undefined && of(room, 'guard')) spawned = cs().e
  }
  expect(cs().done).toBe(true)
  // `open` fires at 3 s, and the gate swings open over its 2 s.
  expect(opened).toBeCloseTo(3, 1)
  expect(open).toBeCloseTo(5, 1)
  // The spawn behind the wait comes on the step the gate stands open, not at its own 3 s.
  expect(spawned).toBeCloseTo(open!, 6)
  expect(of(room, 'guard')!.data).toMatchObject({ name: 'warden', pos: [0, 0, -5] })
  // The wait held the cue clock for the 2 s the gate took: the intro ran its 7 s and 2 more.
  expect(cs().e).toBeCloseTo(9, 1)
})

test('a skip from the seat ends the intro at once, the gate open and the guard there', async () => {
  const { truth, room, heard, seat } = await joined()
  for (let i = 0; i < 30; i++) truth.step(DT)
  const last = heard[heard.length - 1]
  const cutscene = of(room, 'cutscene')!
  expect(cutscene.data.running).toBe(true)
  seat.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.packet.n, id: cutscene.id, action: 'skip', args: [] } })
  truth.step(DT)
  truth.step(DT)
  expect(cutscene.data.done).toBe(true)
  expect(of(room, 'gate')!.data.open).toBe(1)
  expect(of(room, 'guard')!.data).toMatchObject({ name: 'warden', pos: [0, 0, -5] })
})
