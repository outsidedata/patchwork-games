// The hand: the manager booted into jolt as dev.html?scene=jolt boots it, and a seat throwing its fist at points of
// the standing X Bot, aimed as the page aims a click (punch's `aim` along a ray, through melee3d's limbs). A jab aimed
// at the face lands on the head, jolting the head's joints and shoving the body back the way it flew; a jab at the
// side of the left thigh lands on it and turns its hip; a throw the hand refuses lands nothing.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { limbs } from '#plugins/melee3d/melee3d.sim.ts'
import { aim } from './plugins/punch/punch.sim.ts'
import { sim } from './demo_fight3d.sim.ts'
import manifest from './demo_fight3d.scene.json' with { type: 'json' }

const DT = manifest.prefabs.engine.dt

async function jolt() {
  const file = structuredClone(manifest) as Scene
  file.prefabs.scenemanager.entry = 'jolt'
  const truth = boot(file, sim)
  const room = (await load(truth, import.meta.url)).get('jolt')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  for (let i = 0; i < 10; i++) truth.step(DT)
  let seq = 0
  const of = (kind: string) => room.rows.find(r => r.kind === kind)!
  const send = (id: number, action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id, action, args } })
  }
  const w = { world: room.world, all: (k: string) => room.rows.filter(r => r.kind === k), find: (k: string) => of(k), get: (id: number) => room.rows.find(r => r.id === id)! } as any
  // A throw of `strike` along `way` at where a ray from `from` first meets the foe, as the page's click sends it.
  const throwAt = (strike: string, from: number[], way: number[]) => {
    const met = aim(limbs(w, of('foe')), from, way)
    if (!met) throw new Error('the ray meets the foe nowhere')
    send(of('hand').id, 'throw', strike, ...met.point, ...way)
    return met
  }
  const until = (done: () => boolean) => { for (let i = 0; i < 120 && !done(); i++) truth.step(DT) }
  return { truth, of, send, w, throwAt, until }
}

test('a jab aimed at the face lands on the head: the head and neck are jolted and the body shoved back', async () => {
  const { of, w, throwAt, until } = await jolt()
  const head = limbs(w, of('foe')).find(l => l.limb === 'head')!
  const y = (head.a[1] + head.b[1]) / 2
  const met = throwAt('uajab', [0, y, 3], [0, 0, -1])
  expect(met.limb).toBe('head')
  until(() => of('foe').data.hits > 0)
  const foe: Row = of('foe')
  expect(foe.data.hits).toBe(1)
  expect(of('hand').data.struck).toEqual([`${foe.id}:head`])
  expect(Object.keys(foe.data.jolt)).toEqual(expect.arrayContaining(['Neck', 'Head']))
  expect(foe.data.shove[1]).toBeLessThan(0)
  // The hand is frozen for the jab's hitstop, its fist hanging where it met.
  expect(of('hand').data.stop).toBeGreaterThan(0)
})

test('a jab at the side of the left thigh lands on it and turns the hip', async () => {
  const { of, w, throwAt, until } = await jolt()
  const thigh = limbs(w, of('foe')).find(l => l.limb === 'uplegL')!
  const mid = thigh.a.map((v, i) => (v + thigh.b[i]) / 2)
  // The X Bot faces +z, so its left is +x: the fist comes in from its left, flying toward -x.
  const met = throwAt('uajab', [3, mid[1], mid[2]], [-1, 0, 0])
  expect(met.limb).toBe('uplegL')
  until(() => of('foe').data.hits > 0)
  expect(of('hand').data.struck).toEqual([`${of('foe').id}:uplegL`])
  expect(Object.keys(of('foe').data.jolt)).toEqual(expect.arrayContaining(['Hips', 'LeftUpLeg']))
  expect(of('foe').data.shove[0]).toBeLessThan(0)
})

test('a throw of a strike the hand has none of, a number not finite, or a way of no length is refused', async () => {
  const { of, send, until } = await jolt()
  const hand = of('hand').id
  send(hand, 'throw', 'nostrike', 0, 1.6, 0, 0, 0, -1)
  send(hand, 'throw', 'uajab', 0, 1.6, 0, 0, 0, Number.NaN)
  send(hand, 'throw', 'uajab', 0, 1.6, 0, 0, 0, 0)
  send(hand, 'throw', 'uajab', 0, 1.6, 0)
  until(() => false)
  expect(of('hand').data.thrown).toBe(0)
  expect(of('foe').data.hits).toBe(0)
})

test('a ray past the body meets no limb', async () => {
  const { of, w } = await jolt()
  expect(aim(limbs(w, of('foe')), [3, 1.2, 3], [0, 0, -1])).toBeNull()
})
