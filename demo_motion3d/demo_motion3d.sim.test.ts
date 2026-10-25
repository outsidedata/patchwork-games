// demo_motion3d: the manager booted as its page boots it and main loaded; a seat joins and its X Bot
// stands on its start, and walks to each space and presses the use key. On open ground the key does
// nothing. In the party and the sad zones it plays each zone's own clip, the body held where it stood
// until the clip has played out, then walking again. Under the wall's lip it hangs from the lip, its
// wrists on it; shimmies along it until its hands would leave it; climbs up onto the wall's top, or
// drops back to the ground. In front of the chair it sits, its hips on the seat, and stands again.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene, type Truth } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { ends } from '#plugins/anim/anim.sim.ts'
import type { Motion } from '#plugins/motion3d/motion3d.sim.ts'
import { behaviors } from './plugins/zones/zones.motion3d.ts'
import { sim } from './demo_motion3d.sim.ts'
import file from './demo_motion3d.scene.json' with { type: 'json' }
import rig from './assets/xbot.rig.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
const activities = behaviors()
const clipsOf = (word: string, motion: string) => (activities[word][motion] as Motion).clips!

async function joined() {
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
  const me = () => room.rows.find(r => r.id === possessed(heard[heard.length - 1].packet.rows)!.id)!
  const until = (done: () => boolean, most: number) => {
    for (let i = 0; i < most && !done(); i++) truth.step(DT)
    expect(done()).toBe(true)
  }
  const kinds = room.world.shapes3d.kinds
  const row = (kind: string) => room.rows.find(r => r.kind === kind)!
  // Walks to a place across the ground, looking toward it with the stick held forward, and stops there.
  const walkTo = (x: number, z: number, within: number) => {
    const [bx, , bz] = me().data.pos
    send('look', Math.atan2(x - bx, z - bz) - me().data.look.yaw, 0)
    send('stick', 0, -1)
    until(() => Math.hypot(me().data.pos[0] - x, me().data.pos[2] - z) < within, 60 * 12)
    send('stick', 0, 0)
    until(() => me().data.speed === 0, 60 * 2)
  }
  return { truth, room, send, me, until, kinds, row, walkTo }
}

// Where a bone stands in the world as the body's clip has it this step: its segment's start (anim's
// `ends`), in the body's frame, set on the row's place and turned by its yaw.
function boneAt(t: Truth, me: Row, segment: string): number[] {
  // The scene as a rule's `w` reads it, for anim to read the rig off.
  const w = { world: t.world, find: (kind: string) => t.rows.find(r => r.kind === kind)! } as never
  const [x, y, z] = ends(w, me, segment).slice(0, 3)
  const yaw = me.data.yaw, [px, py, pz] = me.data.pos
  return [px + z * Math.sin(yaw) + x * Math.cos(yaw), py + y, pz + z * Math.cos(yaw) - x * Math.sin(yaw)]
}
const mid = (a: number[], b: number[]) => a.map((v, i) => (v + b[i]) / 2)

test('the use key plays each zone\'s own clip in it, holding the body still, and nothing outside them', async () => {
  const { truth, send, me, until, kinds, row, walkTo } = await joined()
  const idle = me().data.clip
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('walk')
  expect(me().data.clip).toBe(idle)

  for (const zone of [row('partyzone'), row('sadzone')]) {
    walkTo(zone.data.pos[0], zone.data.pos[2], kinds[zone.kind].shape.box.size[0] / 4)
    const [word] = kinds[zone.kind].activities
    expect(me().data.offered).toEqual([word])
    send('press', 'use')
    truth.step(DT)
    expect(me().data.activity).toBe(word)
    expect(me().data.clip).toBe(clipsOf(word, 'use')[0])
    const at = [...me().data.pos]
    const dur = rig.table[me().data.clip as keyof typeof rig.table].dur
    for (let i = 0; i < Math.floor(dur / DT) - 1; i++) {
      truth.step(DT)
      expect(me().data.activity).toBe(word)
      expect(me().data.pos.slice(0, 3)).toEqual(at)
    }
    until(() => me().data.activity === 'walk', 3)
  }
})

// Walks up under the wall's lip and hangs from it: the hang's first step, the wrists on the lip.
async function hung() {
  const j = await joined()
  const { truth, send, me, until, kinds, row, walkTo } = j
  const zone = row('ledgezone'), wall = row('wall')
  const lip = kinds.ledgezone.points.Lip.line
  const lipZ = zone.data.pos[2] + lip.from[2], lipY = zone.data.pos[1] + lip.from[1]
  walkTo(zone.data.pos[0], zone.data.pos[2], 0.3)
  expect(me().data.offered).toEqual(['ledge'])
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('ledge')
  expect(me().data.clip).toBe(clipsOf('ledge', 'use')[0])
  until(() => me().data.motion === 'hang', 60 * 3)
  const wrists = mid(boneAt(j.room, me(), 'handL'), boneAt(j.room, me(), 'handR'))
  expect(wrists[1]).toBeCloseTo(lipY, 2)
  expect(wrists[2]).toBeCloseTo(lipZ, 2)
  return { ...j, zone, wall, lip, lipY }
}

test('under the wall it hangs from the lip, shimmies along it until the hands would leave it, and climbs up onto the top', async () => {
  const { truth, room, send, me, until, kinds, zone, wall, lip } = await hung()
  // The stick right: along the lip to the body's right, −x, until it stops short of the lip's end.
  send('stick', 1, 0)
  truth.step(DT)
  expect(me().data.clip).toBe('bracedright')
  const ends0 = zone.data.pos[0] + Math.min(lip.from[0], lip.to[0])
  until(() => me().data.motion === 'hang', 60 * 12)
  const hands = [boneAt(room, me(), 'handL'), boneAt(room, me(), 'handR')]
  for (const h of hands) expect(h[0]).toBeGreaterThanOrEqual(ends0 - 1e-6)
  expect(Math.min(...hands.map(h => h[0]))).toBeLessThan(ends0 + 0.05)
  for (let i = 0; i < 30; i++) {
    truth.step(DT)
    expect(me().data.motion).toBe('hang')
  }

  // Forward and use: up onto the wall's top, and walking there.
  send('stick', 0, -1)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe(clipsOf('ledge', 'climb')[0])
  send('stick', 0, 0)
  until(() => me().data.activity === 'walk', 60 * 3)
  const top = wall.data.pos[1] + kinds.wall.shape.box.size[1]
  // To the rig's measures, kept to 4 places.
  expect(me().data.pos[1]).toBeCloseTo(top, 3)
  for (let i = 0; i < 30; i++) truth.step(DT)
  expect(me().data.grounded).toBe(true)
  expect(me().data.pos[1]).toBeCloseTo(top, 6)
})

test('hanging, back and use drops it to the ground, walking', async () => {
  const { truth, send, me, until } = await hung()
  send('stick', 0, 1)
  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe(clipsOf('ledge', 'drop')[0])
  send('stick', 0, 0)
  until(() => me().data.activity === 'walk', 60 * 3)
  until(() => me().data.grounded && me().data.pos[1] === 0, 60)
})

test('in front of the chair it sits down, its hips on the seat, and stands up again', async () => {
  const { truth, room, send, me, until, kinds, row, walkTo } = await joined()
  const zone = row('chairzone')
  const seat = kinds.chairzone.points.Seat.point.at
  walkTo(zone.data.pos[0], zone.data.pos[2] - 0.3, 0.3)
  expect(me().data.offered).toEqual(['chair'])
  send('press', 'use')
  truth.step(DT)
  expect(me().data.activity).toBe('chair')
  expect(me().data.clip).toBe(clipsOf('chair', 'use')[0])
  until(() => me().data.motion === 'seated', 60 * 4)
  const hips = boneAt(room, me(), 'torso')
  expect(hips[0]).toBeCloseTo(zone.data.pos[0] + seat[0], 6)
  expect(hips[1]).toBeCloseTo(zone.data.pos[1] + seat[1], 6)
  expect(hips[2]).toBeCloseTo(zone.data.pos[2] + seat[2], 6)

  send('press', 'use')
  truth.step(DT)
  expect(me().data.clip).toBe(clipsOf('chair', 'stand')[0])
  until(() => me().data.activity === 'walk', 60 * 4)
  const at = [...me().data.pos]
  send('stick', 0, -1)
  for (let i = 0; i < 30; i++) truth.step(DT)
  expect(Math.hypot(me().data.pos[0] - at[0], me().data.pos[2] - at[2])).toBeGreaterThan(0.1)
})
