// The quest plugin on demo_world3d's village and tavern, booted as the page boots them: every person of each place's
// quests file is found on one row; in the village, Agnes's bell is rung from the chapel loft and her quest ends, the
// pot Osric mends passes from him to the seat to Maud, and a person talked to stops and listens until the seat leaves
// it; in the tavern, the ale goes from Edith to Wat; and a seat cannot write the place's state itself.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene, type W } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { bodies } from '#plugins/npc3d/npc3d.sim.ts'
import { sim } from '../../demo_world3d.sim.ts'
import file from '../../demo_world3d.scene.json' with { type: 'json' }
import type { Quests } from './quest.sim.ts'

const DT = file.prefabs.engine.dt
const base = new URL('../../', import.meta.url).href

async function play(entry: string) {
  const top = { ...file, prefabs: { ...file.prefabs, scenemanager: { ...file.prefabs.scenemanager, entry } } }
  const truth = boot(top as Scene, sim)
  const room = (await load(truth, base)).get(entry)!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  let seq = 0
  const send = (id: number, action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id, action, args } })
  }
  for (let i = 0; i < 3; i++) truth.step(DT)
  const me = () => room.rows.find(r => r.kind === 'player')! as Row
  // a rule's view of the truth, as far as the loader and nav3d read it
  const w = { world: room.world, find: (kind: string) => room.rows.find(r => r.kind === kind)!, all: (kind: string) => room.rows.filter(r => r.kind === kind) } as unknown as W
  const q = json(w, 'quests') as Quests
  const story = () => room.rows.find(r => r.kind === 'story')!
  const person = (who: string) => room.rows.find(r => r.data.who === who)!
  const time = () => room.rows.find(r => r.kind === 'npc3d')!.data.time
  // the seat's body stood where a person stands now, or on a spot's place, and the seat's own press sent
  const standAt = (at: number[]) => { me().data.pos = [...at] }
  const toPerson = (who: string) => standAt(bodies.crowd3d.where(person(who), time()))
  const toSpot = (spot: string) => standAt(graph(w, q.graph).places.find(p => p.data?.nav3d?.tags?.includes(q.spots[spot].at))!.point.at)
  const press = (action: string, ...args: Arg[]) => { send(possessed(heard[heard.length - 1].packet.rows)!.id, action, ...args); truth.step(DT) }
  const said = () => q.lines[me().data.talk.line]
  const state = () => me().data.state
  return { truth, room, heard, send, me, q, story, person, toPerson, toSpot, press, said, state, time }
}

test('every person of the village\'s and the tavern\'s quests files is found on one row', async () => {
  for (const entry of ['village', 'tavern']) {
    const { room, q } = await play(entry)
    for (const who of Object.keys(q.people)) expect(room.rows.filter(r => r.data.who === who).length, `${entry}'s ${who}`).toBe(1)
  }
})

test('Agnes asks for the bell, it is rung from the chapel loft, and she pays for it', async () => {
  const { q, story, person, toPerson, toSpot, press, said, state, me, time } = await play('village')
  toPerson('agnes')
  press('use')
  expect(said().say).toBe(q.lines.find(l => l.to === 'agnes' && l.ask === 'hello' && l.if?.bell === 0)!.say)
  // she stops where she is and listens while the seat talks to her
  expect(person('agnes').data.doing).toBe('attend')
  expect(person('agnes').data.speed).toBe(0)
  press('reply', 0)
  expect(state().bell).toBe(1)
  press('leave')
  expect(me().data.talk).toBe(null)
  // she set out from the loft, where the rope is: once she has walked off it, the rope is what is nearest
  toSpot('rope')
  const rope = [...me().data.pos]
  for (let i = 0; i < 60 / DT && Math.hypot(...bodies.crowd3d.where(person('agnes'), time()).map((v, k) => v - rope[k])) < 3; i++) press('stick', 0, 0)
  toSpot('rope')
  expect(me().data.near?.to ?? 'rope').toBe('rope')
  press('use')
  expect(story().data.state.bell).toBe(1)
  expect(state().bell).toBe(2)
  press('leave')
  toPerson('agnes')
  press('use')
  expect(state().bell).toBe(3)
  expect(state().penny).toBe(3)
  // the bell pulled again falls still
  press('leave')
  toSpot('rope')
  press('use')
  expect(story().data.state.bell).toBe(0)
})

test('the pot Osric mends goes from him to the seat to Maud, and he is told', async () => {
  const { person, toPerson, press, state, me } = await play('village')
  toPerson('osric')
  press('use')
  press('reply', 0)
  expect(state().pot).toBe(1)
  expect(state().mend).toBe(1)
  press('leave')
  toPerson('maud')
  press('use')
  press('reply', 0)
  expect(state().pot).toBe(0)
  expect(person('maud').data.state.pot).toBe(1)
  expect(state().mend).toBe(2)
  press('leave')
  // Maud goes back about the houses once the seat has left her
  for (let i = 0; i < 2; i++) press('stick', 0, 0)
  expect(person('maud').data.doing).not.toBe('attend')
  toPerson('osric')
  press('use')
  expect(state().mend).toBe(3)
  expect(state().penny).toBe(2)
  expect(me().data.talk).not.toBe(null)
})

test('in the tavern, Edith\'s ale is carried to Wat and she pays for the legs', async () => {
  const { person, toPerson, press, state } = await play('tavern')
  toPerson('edith')
  press('use')
  press('reply', 0)
  expect(state().tankard).toBe(1)
  press('leave')
  toPerson('wat')
  press('use')
  press('reply', 0)
  expect(state().tankard).toBe(0)
  expect(person('wat').data.state.tankard).toBe(1)
  press('leave')
  toPerson('edith')
  press('use')
  expect(state().ale).toBe(3)
  expect(state().penny).toBe(1)
})

test('a seat cannot write the place\'s state or a person\'s itself', async () => {
  const { truth, story, person, send } = await play('village')
  send(story().id, 'mark', 'bell', 1)
  send(person('maud').id, 'mark', 'pot', 1)
  truth.step(DT)
  expect(story().data.state).toEqual({})
  expect(person('maud').data.state).toEqual({})
})
