// demo_fight3d: the manager booted as its page boots it and main loaded; a seat joins, its X Bot stands on its start
// facing the foe, and J lands the jab on it: the foe is frozen, shoved back the way the fist went, bleeds, and is
// jolted, the joints about where the fist met it bent at once over the clip it plays (as anim poses it, where melee3d
// meets its limbs), a small reaction from the front; the jolt springs back to nothing, and the foe walks back to its
// spot.
import { expect, test } from 'vitest'
import { boot, type Arg, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { Vector3 } from 'three'
import { posed } from '#plugins/anim/anim.sim.ts'
import { sim } from './demo_fight3d.sim.ts'
import file from './demo_fight3d.scene.json' with { type: 'json' }
import main from './main.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
const FOE = main.world.fight3d.kinds.foe

test('the jab lands on the foe, which is frozen, shoved, bleeds, is jolted and springs back, and walks back to its spot', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  let seq = 0
  const send = (action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: possessed(last.packet.rows)!.id, action, args } })
  }
  const w = { world: room.world, all: (k: string) => room.rows.filter(r => r.kind === k), find: (k: string) => room.rows.find(r => r.kind === k)!, get: (id: number) => room.rows.find(r => r.id === id)! } as any
  const foe = () => room.rows.find(r => r.kind === 'foe')!
  const blood = () => room.rows.find(r => r.kind === 'particle3d')!.data.live.length
  for (let i = 0; i < 10; i++) truth.step(DT)
  const at = foe().data.at as number[]
  const neck = () => new Vector3().setFromMatrixPosition([...posed(w, foe())].find(([b]) => b.endsWith('Neck'))![1])
  const standing = neck()

  send('press', 'light')
  for (let i = 0; i < 120 && foe().data.hits === 0; i++) truth.step(DT)
  expect(foe().data.hits).toBe(1)
  expect(foe().data.stop).toBeGreaterThan(0)
  expect(blood()).toBeGreaterThan(0)
  // Shoved away from the X Bot, which stands behind it on -z.
  expect(foe().data.shove[1]).toBeGreaterThan(0)
  // Jolted: joints of the limb the jab met turned, the neck bent off where it stood, and the small reaction from the
  // front played, the foe not knocked down.
  expect(Object.keys(foe().data.jolt).length).toBeGreaterThan(0)
  expect(neck().distanceTo(standing)).toBeGreaterThan(0.01)
  truth.step(DT)
  expect(foe().data.clip).toBe(FOE.anim.react.small.front)
  expect(foe().data.down).toBe(0)

  // The jolt springs back to nothing, and once recovered it walks back to its spot.
  const far = () => Math.hypot(foe().data.pos[0] - at[0], foe().data.pos[2] - at[1])
  for (let i = 0; i < 60 * 6 && (Object.keys(foe().data.jolt).length > 0 || far() > FOE.home); i++) truth.step(DT)
  expect(foe().data.jolt).toEqual({})
  expect(far()).toBeLessThanOrEqual(FOE.home)
})
