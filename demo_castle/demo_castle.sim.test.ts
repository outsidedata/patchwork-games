// demo_castle: the manager booted as its page boots it and main loaded, on procedural-castle's fortress as
// `yarn bake demo_castle` wrote it. A seat joins and runs from its start outside the south gate, up the
// gate's steps, through the gatehouse on its floor and out of the north gate into the ward; and the
// visitors go about the fortress until one climbs to a roof along nav3d's route. On bridge, the visitors
// walk over the bridge at its height, under it on the ground, and up and down its ramps.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene, type W } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { bodies } from '#plugins/npc3d/npc3d.sim.ts'
import { sim } from './demo_castle.sim.ts'
import file from './demo_castle.scene.json' with { type: 'json' }

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

test('a seat runs in at the south gate, through the gatehouse, and out into the ward', async () => {
  const { truth, room, heard, seat } = await main()
  const last = heard[heard.length - 1]
  const me = () => room.rows.find(r => r.kind === 'player')!
  // forward, as the W key sends it: y up the stick is −1
  seat.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.packet.n, id: me().id, action: 'stick', args: [0, -1] } })
  // the gatehouse stands from 20 to 28 metres south of the middle (+z), its floor 0.8 m up
  let inside = false
  for (let i = 0; i < 8 / DT; i++) {
    truth.step(DT)
    const [, y, z] = me().data.pos
    if (z > 21 && z < 27 && Math.abs(y - 0.8) < 0.01) inside = true
  }
  expect(inside).toBe(true)
  const [, y, z] = me().data.pos
  expect(z).toBeLessThan(18)
  expect(y).toBe(0)
  expect(me().data.grounded).toBe(true)
})

test('a visitor climbs to a roof along its route, its feet rising leg by leg, its course written once a leg', async () => {
  const { truth, room } = await main()
  // a rule's view of the truth, as far as the loader and nav3d read it
  const w = { world: room.world, find: (kind: string) => room.rows.find(r => r.kind === kind)! } as unknown as W
  const nodes = graph(w, 'fortress').nodes
  const visitors = room.rows.filter(r => r.kind === 'visitor') as Row[]
  const time = () => room.rows.find(r => r.kind === 'npc3d')!.data.time
  const feet = (v: Row) => bodies.crowd3d.where(v, time())[1]
  // each visitor's walk to a roof: where its feet stood when it set out, the heights they stood at on
  // the way, how many times its course was written and how many legs it walked
  type Walk = { from: number; heights: number[]; writes: number; legs: number; since: number; leg: number }
  const walks = new Map<number, Walk>()
  let climbed: { v: Row; walk: Walk } | undefined
  for (let i = 0; i < 120 / DT && !climbed; i++) {
    truth.step(DT)
    for (const v of visitors) {
      const roof = typeof v.data.going === 'string' && v.data.going.endsWith('roof')
      let walk = walks.get(v.id)
      if (roof && v.data.speed > 0 && !walk) walks.set(v.id, walk = { from: v.data.pos[1], heights: [], writes: 1, legs: 1, since: v.data.since, leg: v.data.route?.leg ?? 0 })
      if (!walk) continue
      walk.heights.push(feet(v))
      if (v.data.since !== walk.since) { walk.writes++; walk.since = v.data.since }
      if ((v.data.route?.leg ?? walk.leg) !== walk.leg) { walk.legs++; walk.leg = v.data.route.leg }
      if (v.data.speed === 0) {
        walks.delete(v.id)
        if (v.data.going.endsWith('roof')) climbed = { v, walk }
      }
    }
  }
  expect(climbed).toBeDefined()
  const { v, walk } = climbed!
  const roof = nodes.find(n => n.tags?.includes(v.data.going))!
  // it stands on the roof's node, its feet at the roof's height
  expect(feet(v)).toBeCloseTo(roof.at[1], 5)
  expect(roof.at[1] - walk.from).toBeGreaterThan(2)
  // its feet rose through the heights between, step by step, never more than a step's walk at once
  expect(walk.heights.filter(y => y > walk.from + 0.5 && y < roof.at[1] - 0.5).length).toBeGreaterThan(0.5 / DT)
  for (let k = 1; k < walk.heights.length; k++) expect(Math.abs(walk.heights[k] - walk.heights[k - 1])).toBeLessThan(1.4 * DT * 2)
  // its course was written as it set out on each leg and as it stopped, never every step
  expect(walk.legs).toBeGreaterThan(1)
  expect(walk.writes).toBeLessThanOrEqual(walk.legs + 1)
})

test('on bridge, visitors walk over the bridge at its height, under it on the ground, and up its ramps', async () => {
  const { truth, room } = await main('bridge')
  const visitors = room.rows.filter(r => r.kind === 'visitor') as Row[]
  const time = () => room.rows.find(r => r.kind === 'npc3d')!.data.time
  // the deck's top is 3 m up, from x −8 to 8, 2.5 m across z; the ramps run from it to the ground at x ±16
  let over = false, under = false, ramp = false
  for (let i = 0; i < 120 / DT && !(over && under && ramp); i++) {
    truth.step(DT)
    for (const v of visitors) {
      if (v.data.speed === 0) continue
      const [x, y, z] = bodies.crowd3d.where(v, time())
      const deck = Math.abs(x) < 8 && Math.abs(z) < 1.25
      if (deck && Math.abs(y - 3) < 1e-6) over = true
      if (deck && Math.abs(y) < 1e-6) under = true
      // on a ramp, its feet at the ramp's height there: 0 at its foot, 3 at its top
      if (Math.abs(x) > 9 && Math.abs(x) < 15 && Math.abs(z) < 1.25 && Math.abs(y - (16 - Math.abs(x)) * 0.375) < 1e-6) ramp = true
    }
  }
  expect({ over, under, ramp }).toEqual({ over: true, under: true, ramp: true })
})
