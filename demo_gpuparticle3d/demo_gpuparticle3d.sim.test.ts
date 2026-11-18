// demo_gpuparticle3d: the manager booted as its page boots it and main loaded; a seat joins, its craft
// stands on its slot's start, flies forward on the stick, and its blast key puts a blast on
// gpuparticle3d's ledger where the craft aims, on the ground. And bounce: a seat sent there flies over
// terrain3d's land, its hail on the ledger, its shrapnel thrown where the craft aims on the land.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_gpuparticle3d.sim.ts'
import file from './demo_gpuparticle3d.scene.json' with { type: 'json' }
import { land, type Field } from '#plugins/terrain3d/terrain3d.sim.ts'
import defs from './assets/demo_gpuparticle3d.json' with { type: 'json' }
import bounce from './assets/bounce.json' with { type: 'json' }
import hills from './assets/hills.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

test('a seat joins main, its craft stands on its start, the stick flies it, and the blast key blasts the ground it aims at', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const start = room.rows.find(r => r.kind === 'start' && r.data.slot === 0)!.data
  const craft = () => room.rows.find(r => r.kind === 'player')!.data
  expect(craft().pos).toEqual(start.pos)

  const last = heard[heard.length - 1]
  const me = last.packet.rows.find(r => r.kind === 'player')!
  const send = (seq: number, action: string, args: unknown[]) =>
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq, n: last.packet.n, id: me.id, action, args } as any })
  send(1, 'stick', [0, -1])
  for (let i = 0; i < 60; i++) truth.step(DT)
  expect(craft().pos[2]).toBeGreaterThan(start.pos[2] + defs.player.speed * 0.5)

  send(2, 'stick', [0, 0])
  send(3, 'fire', ['blast'])
  truth.step(DT)
  const blast = room.rows.find(r => r.kind === 'gpuparticle3d')!.data.live.find((e: any) => e.effect === 'blast')
  expect(blast.at).toEqual(craft().aim)
  expect(blast.at[1]).toBe(0)
})

test('a seat sent to bounce flies over the land: the hail falls from its row, and the shrapnel key throws shrapnel where the craft aims, on the land', async () => {
  const truth = boot({ ...file, prefabs: { ...file.prefabs, scenemanager: { ...file.prefabs.scenemanager, entry: 'bounce' } } } as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('bounce')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const live = () => room.rows.find(r => r.kind === 'gpuparticle3d')!.data.live
  const hail = room.rows.find(r => r.kind === 'hail')!
  expect(live().find((e: any) => e.effect === 'hail')).toMatchObject({ id: hail.data.fx, from: hail.id, at: hail.data.pos })

  const last = heard[heard.length - 1]
  const me = last.packet.rows.find(r => r.kind === 'player')!
  seat.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.packet.n, id: me.id, action: 'fire', args: ['shrapnel'] } as any })
  truth.step(DT)
  const aim = room.rows.find(r => r.kind === 'player')!.data.aim
  const lift = bounce.player.shots.shrapnel.emits[0].lift
  expect(live().find((e: any) => e.effect === 'shrapnel').at).toEqual(aim.map((v: number, i: number) => v + lift[i]))
  // the aim is on the land, to the ray's last halving
  expect(Math.abs(aim[1] - land(hills as Field).height(aim[0], aim[2]))).toBeLessThan(1e-3)
})
