// demo_world3d: the manager booted as its page boots it and main loaded, on pro-ng's town as
// `yarn bake demo_world3d` wrote it, which world3d hands shapes3d and nav3d. A seat joins on the town's start place and
// stands on it; and the visitors go about the town until one reaches a place along nav3d's route. In the tavern, its
// people loiter on the verbs of its crowd file.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene, type W } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { bodies } from '#plugins/npc3d/npc3d.sim.ts'
import { GRAPH } from '#plugins/world3d/world3d.sim.ts'
import { sim } from './demo_world3d.sim.ts'
import { root } from './player.sim.ts'
import file from './demo_world3d.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

// The game booted with its entry `entry` and a seat in it, which steps only while a seat is in it.
async function main(entry = 'main') {
  const top = { ...file, prefabs: { ...file.prefabs, scenemanager: { ...file.prefabs.scenemanager, entry } } }
  const truth = boot(top as Scene, sim)
  const room = (await load(truth, import.meta.url)).get(entry)!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  return { truth, room, heard, seat }
}

test('a seat starts on the town\'s start place and stands there', async () => {
  const { truth, room } = await main()
  const me = () => room.rows.find(r => r.kind === 'player')!
  const w = { world: room.world, find: (kind: string) => room.rows.find(r => r.kind === kind)! } as unknown as W
  const [px, , pz] = root(w, GRAPH).point.at
  expect(me().data.pos[0]).toBeCloseTo(px, 5)
  expect(me().data.pos[2]).toBeCloseTo(pz, 5)
  for (let i = 0; i < 1 / DT; i++) truth.step(DT)
  expect(me().data.grounded).toBe(true)
  expect(me().data.pos[0]).toBeCloseTo(px, 2)
  expect(me().data.pos[2]).toBeCloseTo(pz, 2)
})

test('a visitor walks the town to one of its places and stops on it, its course written once a leg', async () => {
  const { truth, room } = await main()
  // a rule's view of the truth, as far as the loader and nav3d read it
  const w = { world: room.world, find: (kind: string) => room.rows.find(r => r.kind === kind)! } as unknown as W
  const places = graph(w, GRAPH).places
  const visitors = room.rows.filter(r => r.kind === 'visitor') as Row[]
  const time = () => room.rows.find(r => r.kind === 'npc3d')!.data.time
  const node = (going: number) => places[going].point
  // each visitor's walk: the row's lane (z) it set out from, how many times its course was written and how many legs
  type Walk = { from: number; writes: number; legs: number; since: number; leg: number }
  const walks = new Map<number, Walk>()
  let arrived: { v: Row; walk: Walk } | undefined
  for (let i = 0; i < 120 / DT && !arrived; i++) {
    truth.step(DT)
    for (const v of visitors) {
      let walk = walks.get(v.id)
      if (typeof v.data.going === 'number' && v.data.speed > 0 && !walk) walks.set(v.id, walk = { from: v.data.pos[2], writes: 1, legs: 1, since: v.data.since, leg: v.data.route?.leg ?? 0 })
      if (!walk) continue
      if (v.data.since !== walk.since) { walk.writes++; walk.since = v.data.since }
      if ((v.data.route?.leg ?? walk.leg) !== walk.leg) { walk.legs++; walk.leg = v.data.route.leg }
      if (v.data.speed === 0) {
        walks.delete(v.id)
        if (Math.abs(node(v.data.going).at[2] - walk.from) > 1) arrived = { v, walk }
      }
    }
  }
  expect(arrived).toBeDefined()
  const { v, walk } = arrived!
  // it stands on its place, at its height
  const [x, y, z] = bodies.crowd3d.where(v, time())
  const at = node(v.data.going).at
  expect(x).toBeCloseTo(at[0], 5)
  expect(z).toBeCloseTo(at[2], 5)
  expect(y).toBeCloseTo(at[1], 5)
  // its course was written as it set out on each leg and as it stopped, never every step
  expect(walk.legs).toBeGreaterThan(1)
  expect(walk.writes).toBeLessThanOrEqual(walk.legs + 1)
})

test('in the tavern, each person loiters on a clip of a loiter verb of its landmark: a drinker seated, the barmaid serving or talking', async () => {
  const { truth, room } = await main('tavern')
  const people = room.rows.filter(r => r.kind === 'person') as Row[]
  expect(people.length).toBeGreaterThan(1)
  const SEATED = ['sittingDrinking', 'sittingTalking', 'sittingLaughing']
  const BAR = ['bartending', 'talking']
  for (let i = 0; i < 60 / DT; i++) {
    truth.step(DT)
    for (const p of people) {
      expect(p.data.speed).toBe(0)
      expect(p.data.at === 'tavern_bar' ? BAR : SEATED).toContain(p.data.clip)
    }
  }
})
