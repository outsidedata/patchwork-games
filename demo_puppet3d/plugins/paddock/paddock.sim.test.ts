// paddock's `flier` in main: a seat joins, the hawk at its station takes off at the pace the keeper starts
// on, and the keeper brings it to a stand with the message the page's `1` key sends.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from '../../demo_puppet3d.sim.ts'
import file from '../../demo_puppet3d.scene.json' with { type: 'json' }
import defs from '../../assets/demo_puppet3d.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('the hawk rises to its height and comes to rest there, and settles onto the ground at a stand', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, new URL('../../demo_puppet3d.sim.ts', import.meta.url).href)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const hawk = (): Row => room.rows.find(r => r.kind === 'hawk')!
  const keeper = (): Row => room.rows.find(r => r.kind === 'player')!
  const f = defs.hawk.flight
  // every step: how high it is, and how much its rise changed
  let highest = 0, jolt = 0, was = hawk().data.rise as number
  const step = () => {
    truth.step(DT)
    const d = hawk().data
    highest = Math.max(highest, d.alt)
    jolt = Math.max(jolt, Math.abs(d.rise - was))
    was = d.rise
  }
  const until = (done: () => boolean, most: number) => {
    for (let i = 0; i < most && !done(); i++) step()
    expect(done()).toBe(true)
  }

  until(() => hawk().data.alt === f.height && hawk().data.rise === 0, 60 * 10)
  expect(highest).toBe(f.height)

  const last = heard[heard.length - 1]
  seat.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.packet.n, id: keeper().id, action: 'gait', args: [0] } })
  // the rise it lands at: its rise on the last step it is still in the air
  let landing = 0
  until(() => { if (hawk().data.alt > 0) landing = hawk().data.rise; return hawk().data.alt === 0 && hawk().data.speed === 0 }, 60 * 10)
  expect(landing).toBeGreaterThan(-f.lift * DT * 2)
  expect(jolt).toBeLessThanOrEqual(f.lift * DT + 1e-9)
})
