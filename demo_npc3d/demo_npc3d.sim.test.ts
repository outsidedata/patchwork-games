// npc3d on the game: each scene booted as its page boots it, a seat joined on it, and what the NPCs
// sense and do read off the rows.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './demo_npc3d.sim.ts'
import file from './demo_npc3d.scene.json' with { type: 'json' }
import defs from './assets/demo_npc3d.json' with { type: 'json' }
import { words } from '#plugins/shapes3d/shapes3d.sim.ts'
import { bodyOf, eyes } from '#plugins/npc3d/npc3d.sim.ts'

const DT = file.prefabs.engine.dt
const base = new URL('./', import.meta.url).href

// The game booted with a seat on `entry`, and that scene's truth.
async function scene(entry: string) {
  const top = { ...file, prefabs: { ...file.prefabs, scenemanager: { ...file.prefabs.scenemanager, entry } } }
  const truth = boot(top as Scene, sim)
  const room = (await load(truth, base)).get(entry)!
  connection(manager(truth), () => {})
  const run = (seconds: number) => { for (let i = 0; i < Math.round(seconds / DT); i++) truth.step(DT) }
  return { truth, room, run }
}

const time = (room: { rows: Row[] }) => room.rows.find(r => r.kind === 'npc3d')!.data.time
// Where a row's feet stand: a walker's `pos`, a person's course at the time.
const feet = (r: Row, t: number) => {
  if (r.data.since === undefined) return [r.data.pos[0], r.data.pos[2]]
  const gone = r.data.speed * (t - r.data.since)
  return [r.data.pos[0] + Math.sin(r.data.yaw) * gone, r.data.pos[2] + Math.cos(r.data.yaw) * gone]
}
const at = (room: { rows: Row[] }, kind: string, x: number, z: number) => room.rows.find(r => r.kind === kind && r.data.pos[0] === x && r.data.pos[2] === z)!

test('the sentry sees who stands in its cone or its edge with nothing between, and nobody else', async () => {
  const { room, run } = await scene('sight')
  run(1)
  const sentry = room.rows.find(r => r.kind === 'sentry')!
  const seen = [at(room, 'bystander', 2, 5), at(room, 'bystander', -3, 4), at(room, 'bystander', -3, -1)].map(r => r.id).sort((a, b) => a - b)
  expect(sentry.data.seen).toEqual(seen)
  // In its cone but behind a pillar, and past its range.
  for (const [x, z] of [[-7, 7], [4.5, 9], [1, 15], [6, 1], [0, -6]]) expect(sentry.data.seen).not.toContain(at(room, 'bystander', x, z).id)
})

test('the sentry grows aware of what it sees, notices it, remembers it once it turns away, and forgets it', async () => {
  const { room, run } = await scene('sight')
  const sentry = room.rows.find(r => r.kind === 'sentry')!
  const near = at(room, 'bystander', 2, 5).id, edge = at(room, 'bystander', -3, -1).id
  run(0.5)
  expect(sentry.data.noticing[near].aware).toBeGreaterThan(0)
  expect(sentry.data.noticing[near].aware).toBeLessThan(1)
  expect(sentry.data.facts).toEqual([])
  // Seen in the edge alone, it is noticed more slowly than one near the middle of the cone.
  expect(sentry.data.noticing[edge].aware).toBeLessThan(sentry.data.noticing[near].aware)
  run(defs.sentry.notice.time * 2)
  expect(sentry.data.noticing[near].aware).toBe(1)
  expect(sentry.data.facts.map((f: any) => f.type)).toContain('bystander')

  sentry.data.face = Math.PI
  run(2)
  expect(sentry.data.seen).not.toContain(near)
  expect(sentry.data.noticing[near].aware).toBe(1)
  expect(sentry.data.facts.map((f: any) => f.type)).toContain('bystander')
  run(defs.sentry.memory)
  expect(sentry.data.noticing[near]).toBeUndefined()
})

test('a walking person sees the way it walks, on every step, whichever way it turns', async () => {
  const { room, run } = await scene('notice')
  const stroller = room.rows.find(r => r.kind === 'stroller')!
  const body = bodyOf('stroller', defs.stroller)
  const ways = new Set<number>()
  let walked = 0
  for (let i = 0; i < 40 / DT; i++) {
    run(DT)
    // The way its walk carries it now: where its course puts it a moment on, against where now.
    const t = time(room), now = feet(stroller, t), next = feet(stroller, t + DT / 10)
    const dx = next[0] - now[0], dz = next[1] - now[1]
    if (Math.hypot(dx, dz) < 1e-9) continue
    walked++
    const heading = Math.atan2(dx, dz)
    ways.add(Math.round(heading * 4))
    const off = Math.atan2(Math.sin(eyes(stroller, body, t) - heading), Math.cos(eyes(stroller, body, t) - heading))
    expect(Math.abs(off)).toBeLessThan(1e-9)
  }
  // It walked, and turned to walk more than one way.
  expect(walked).toBeGreaterThan(1 / DT)
  expect(ways.size).toBeGreaterThan(1)
})

test('a guard turns its head to a noise within its reach of the way its body faces', async () => {
  const { room, run } = await scene('hearing')
  run(0.5)
  room.spawn('noise', { pos: [-10, 0, 2] })
  const guard = room.rows.filter(r => r.kind === 'guard').sort((a, b) => a.data.pos[0] - b.data.pos[0])[0]
  const body = bodyOf('guard', defs.guard)
  const reach = (defs.guard.look.reach * Math.PI) / 180
  let turned = false
  for (let i = 0; i < 3 / DT; i++) {
    run(DT)
    expect(Math.abs(guard.data.look)).toBeLessThanOrEqual(reach + 1e-9)
    if (guard.data.gaze === null) continue
    const off = Math.atan2(Math.sin(guard.data.gaze - eyes(guard, body, time(room))), Math.cos(guard.data.gaze - eyes(guard, body, time(room))))
    if (Math.abs(off) < 1e-6) turned = true
  }
  expect(turned).toBe(true)
})

test('a noise is heard by the guards within its reach, who go to see it', async () => {
  const { room, run } = await scene('hearing')
  run(0.5)
  const [x, z] = [-10, 2]
  room.spawn('noise', { pos: [x, 0, z] })
  run(0.1)
  const guards = room.rows.filter(r => r.kind === 'guard')
  const near = guards.filter(g => Math.hypot(g.data.pos[0] - x, g.data.pos[2] - z) <= defs.noise.loud)
  const far = guards.filter(g => Math.hypot(g.data.pos[0] - x, g.data.pos[2] - z) > defs.noise.loud)
  expect(near.length).toBeGreaterThan(0)
  for (const g of near) expect(g.data.facts.map((f: any) => f.type)).toContain('noise')
  for (const g of far) expect(g.data.facts).toEqual([])
  run(1)
  for (const g of near) expect(g.data.doing).toBe('investigate')
  // Each checks it where it got to, within the seconds a guard remembers what it heard: no farther
  // than its walk's `arrive` from the noise.
  const checkedAt = new Map<number, number>()
  for (let i = 0; i < defs.guard.memory / DT && checkedAt.size < near.length; i++) {
    run(DT)
    for (const g of near) {
      const noise = g.data.facts.find((f: any) => f.type === 'noise')
      if (checkedAt.has(g.id) || !noise || g.data.checked.noise !== noise.time) continue
      checkedAt.set(g.id, Math.hypot(g.data.pos[0] - x, g.data.pos[2] - z))
    }
  }
  expect(checkedAt.size).toBe(near.length)
  for (const far of checkedAt.values()) expect(far).toBeLessThan(defs.guard.arrive + 0.05)
})

test('ordered to one place, the walkers stop near it apart from each other and the people walk straight onto it', async () => {
  const { room, run } = await scene('moving')
  run(0.5)
  const [x, z] = [0, 12]
  room.spawn('beacon', { pos: [x, 0, z] })
  run(0.1)
  const runners = room.rows.filter(r => r.kind === 'runner'), passers = room.rows.filter(r => r.kind === 'passer')
  for (const r of [...runners, ...passers]) expect(r.data.doing).toBe('go')
  run(25)
  const t = time(room)
  for (const r of passers) {
    expect(r.data.speed).toBe(0)
    const [px, pz] = feet(r, t)
    expect(Math.hypot(px - x, pz - z)).toBeLessThan(1e-6)
  }
  const radius = defs.runner.radius
  for (const r of runners) {
    expect(r.data.goal).toBeNull()
    expect(Math.hypot(r.data.pos[0] - x, r.data.pos[2] - z)).toBeLessThan(4)
  }
  for (let i = 0; i < runners.length; i++) for (let j = i + 1; j < runners.length; j++) {
    const a = runners[i].data.pos, b = runners[j].data.pos
    expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThan(2 * radius - 0.05)
  }
})

// How far (x, z) stands from the nearest block of the wall's footprint, 0 on one.
function fromWall(room: { rows: Row[]; world: any }) {
  const size = room.world.shapes3d.kinds.block.shape.box.size
  const blocks = room.rows.filter(r => r.kind === 'block').map(b => ({ pos: b.data.pos, size, yaw: b.data.yaw }))
  return (x: number, z: number) => Math.min(...blocks.map(b => words.box.gap(b, x, z)))
}

test('sent across the wall, the walker and the person go round it along their routes and stop where they were sent', async () => {
  const { room, run } = await scene('wall')
  const runner = room.rows.find(r => r.kind === 'runner')!, passer = room.rows.find(r => r.kind === 'passer')!
  const goal = room.rows.find(r => r.kind === 'beacon')!.data.pos
  const gap = fromWall(room)
  run(2 * DT)
  for (const r of [runner, passer]) {
    expect(r.data.doing).toBe('go')
    expect(r.data.route.points.length).toBeGreaterThan(1)
    expect(r.data.route.points.at(-1)).toEqual([goal[0], goal[2]])
  }
  const legs = new Map<number, number>()
  for (let i = 0; i < 25 / DT && (runner.data.goal !== null || passer.data.speed > 0); i++) {
    run(DT)
    const t = time(room)
    for (const r of [runner, passer]) {
      const [x, z] = feet(r, t)
      expect(gap(x, z)).toBeGreaterThan(defs.runner.radius - 0.05)
      if (r.data.route) legs.set(r.id, Math.max(legs.get(r.id) ?? 0, r.data.route.leg))
    }
  }
  // Each went past the wall's end from one place of its route to the next, and stopped where it was sent.
  expect(legs.get(runner.id)).toBeGreaterThan(0)
  expect(legs.get(passer.id)).toBeGreaterThan(0)
  const [px, pz] = feet(passer, time(room))
  expect(passer.data.speed).toBe(0)
  expect(Math.hypot(px - goal[0], pz - goal[2])).toBeLessThan(1e-6)
  expect(runner.data.goal).toBeNull()
  expect(Math.hypot(runner.data.pos[0] - goal[0], runner.data.pos[2] - goal[2])).toBeLessThan(defs.runner.arrive + 0.05)
  for (const r of [runner, passer]) expect(r.data.route).toBeNull()
})

test('a walker held up on the way to a place of its route asks for a new route from where it stands', async () => {
  const { room, run } = await scene('wall')
  const runner = room.rows.find(r => r.kind === 'runner')!
  run(2 * DT)
  const first = runner.data.route
  // Sentries stand round the first place it walks to, so it cannot get there.
  const [x, z] = first.points[first.leg]
  for (const [dx, dz] of [[0, 0], [0.65, 0], [-0.65, 0], [0, 0.65], [0, -0.65]]) room.spawn('sentry', { pos: [x + dx, 0, z + dz] })
  const goal = first.points.at(-1)
  // The step its route was asked again: a new one, or none for a way now straight, while it still walks
  // on, its route not yet at its last place; where it stood then.
  let asked: number[] | undefined
  for (let i = 0; i < 25 / DT && runner.data.goal !== null; i++) {
    const was = runner.data.route
    run(DT)
    if (!asked && runner.data.goal !== null && was.leg < was.points.length - 1 && runner.data.route?.points !== was.points) asked = [runner.data.pos[0], runner.data.pos[2]]
  }
  expect(asked).toBeDefined()
  // Asked from where it was held up, short of the place it could not get to.
  expect(Math.hypot(asked![0] - x, asked![1] - z)).toBeGreaterThan(defs.runner.arrive)
  // And got to where it was sent.
  expect(runner.data.doing).toBe('go')
  expect(runner.data.goal).toBeNull()
  expect(Math.hypot(runner.data.pos[0] - goal[0], runner.data.pos[2] - goal[1])).toBeLessThan(defs.runner.arrive + 0.05)
})

test('in the town the guards hunt the intruders down, and the people run from the shots', async () => {
  const { room, run } = await scene('town')
  let shots = 0, panicked = new Set<number>(), attacked = new Set<number>(), routed = new Set<number>()
  const fired = new Set<number>()
  for (let s = 0; s < 600 && room.rows.some(r => r.kind === 'intruder' && !r.data.dead); s++) {
    run(0.5)
    for (const r of room.rows) {
      if (r.kind === 'person' && r.data.doing === 'panic') panicked.add(r.id)
      if (r.kind === 'guard' && r.data.doing === 'attack') attacked.add(r.id)
      if (r.data.route) routed.add(r.id)
    }
    for (const sound of room.rows.find(r => r.kind === 'npc3d')!.data.sounds) if (sound.type === 'shot' && !fired.has(sound.id)) { fired.add(sound.id); shots++ }
  }
  expect(room.rows.filter(r => r.kind === 'intruder' && !r.data.dead)).toEqual([])
  expect(attacked.size).toBeGreaterThan(0)
  expect(shots).toBeGreaterThan(0)
  expect(panicked.size).toBeGreaterThan(0)
  // They walk round the pillars along routes over the town's graph.
  expect(routed.size).toBeGreaterThan(0)
})
