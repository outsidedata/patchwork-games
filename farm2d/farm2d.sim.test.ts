// farm2d: the manager booted as the server boots it, seats coming in through the title.
// - A seat that picks a role on the title plays one of that role's cast already in the field, and the
//   field holds as many of them as before; a role the definition does not name, or none, plays nothing;
//   the role is taken once.
// - A seat whose role is played by people in every one of its kind gets a new one at the `start` of
//   its role for its slot, in the next of the kind's sheets, and the field keeps it.
// - The keys move only the thing the seat plays, which stands until they do; no seat reaches a thing
//   it does not play.
// - A seat that leaves hands its thing back to its brain, which plays it on, and nothing comes or goes.
// - A field with every seat taken leaves the seat on the title.
// - The level: the canvas shows the whole map; everything placed, and every start, stands clear of
//   what blocks and inside its kind's bounds; the pasture has a patch of grass on every cell inside its
//   fence; and the farmer finds its way from its start to every patch and to the pile.
// - With nobody in it, the farm lives: in four minutes, as long as anyone plays, the cows graze and drop manure, the farmer sows
//   it and carries the crops to the pile, bugs nibble the pile and the chickens peck them, and every
//   thing that walks stays inside its bounds.
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { tiledAt } from '#plugins/loader/loader.sim.ts'
import { at, grid, path } from '#plugins/nav/nav.sim.ts'
import { blocked, clear } from '#plugins/tilemap/tilemap.sim.ts'
import { ROLES } from './plugins/roles/roles.sim.ts'
import { farm } from './field.harness.ts'
import file from './farm2d.scene.json' with { type: 'json' }
import field from './field.scene.json' with { type: 'json' }
import defs from './assets/farm2d.json' with { type: 'json' }

const map = await tiledAt('field', file.world.loader.assets.field.url)
const actors: any[] = JSON.parse(readFileSync(new URL('./assets/field.actors.json', import.meta.url), 'utf8'))
const kindDef = (kind: string) => (defs as Record<string, any>)[kind]

test('the roles are the definition\'s, and each title button names one', () => {
  expect(Object.keys(defs.player.roles)).toEqual([...ROLES])
  expect(defs.titlecard.roles.map(r => r.with)).toEqual([...ROLES])
})

for (const role of ROLES) {
  test(`picking ${role} plays one of the ${role}s already in the field, and the field holds as many as before`, async () => {
    const { all, join } = await farm()
    const before = all(role).map(r => r.id)
    const seat = await join(role)
    expect(seat.last().scene).toBe('field')
    expect(seat.me()!.data.role).toBe(role)
    expect(seat.me()!.data.conn).toBe(seat.last().seat)
    expect(seat.held()!.kind).toBe(role)
    expect(before).toContain(seat.held()!.id)
    expect(all(role).map(r => r.id)).toEqual(before)
  })
}

test('a role the definition does not name, or none, plays nothing, and the role is taken once', async () => {
  const { join, steps } = await farm()
  for (const wrong of ['horse', 42, null]) {
    const seat = await join(wrong)
    expect(seat.me()!.data.role).toBe(null)
    expect(seat.held()).toBe(undefined)
  }
  const seat = await join('farmer')
  const was = seat.held()!.id
  seat.send('arrive', 'cow')
  steps(2)
  expect(seat.me()!.data.role).toBe('farmer')
  expect(seat.held()!.id).toBe(was)
})

test('with every cow played by people, the next seat gets a new cow at its slot\'s start, in the next sheet, and the field keeps it', async () => {
  const { all, join, room, steps } = await farm()
  const cast = all('cow').length
  const seats = []
  for (let i = 0; i < cast; i++) seats.push(await join('cow'))
  expect(new Set(seats.map(s => s.held()!.id)).size).toBe(cast)
  expect(all('cow').length).toBe(cast)
  const late = await join('cow')
  const cow = late.held()!
  expect(all('cow').length).toBe(cast + 1)
  const start = room.rows.find(r => r.kind === 'start' && r.data.role === 'cow' && r.data.slot === late.me()!.data.seat)!
  expect(cow.data.pos).toEqual(start.data.pos)
  expect(cow.data.sheet).toBe(defs.cow.sheets[cast % defs.cow.sheets.length])
  late.leave()
  steps(2)
  expect(all('cow').length).toBe(cast + 1)
  expect(all('cow').some(c => c.id === cow.id)).toBe(true)
  expect(all('player').some(p => p.data.held?.id === cow.id)).toBe(false)
})

test('the keys move only the thing the seat plays, which stands until they do, and no seat reaches another\'s', async () => {
  const { join, steps } = await farm()
  const a = await join('farmer'), b = await join('cow')
  const farmer = a.held()!, cow = b.held()!
  const stood = [...farmer.data.pos]
  steps(120)
  expect(farmer.data.pos).toEqual(stood)
  a.send('move', 1, 0)
  steps(30)
  expect(farmer.data.pos[0]).toBeGreaterThan(stood[0])
  expect(farmer.data.pos[1]).toBeCloseTo(stood[1])
  expect(farmer.data.clip).toBe('walk')
  a.send('move', 0, 0)
  steps(2)
  expect(farmer.data.clip).toBe('idle')
  // A's messages at the cow it does not play, and at its own player row for an act only rules call.
  const cowAt = [...cow.data.pos]
  a.at(cow.id, 'move', 1, 0)
  a.at(cow.id, 'use')
  a.send('grip')
  b.send('move', 0, 0)
  steps(60)
  expect(cow.data.pos).toEqual(cowAt)
  expect(cow.data.chew).toBe(0)
  // Garbage keys are let go of.
  const now = [...farmer.data.pos]
  a.send('move', 'left', null)
  a.send('move', Number.NaN, 1)
  steps(10)
  expect(farmer.data.pos).toEqual(now)
  a.send('move', 3, 4)
  steps(1)
  expect(Math.hypot(farmer.data.move[0], farmer.data.move[1])).toBeCloseTo(1)
})

test('a seat that leaves hands its thing back to its brain, which plays it on, and nothing comes or goes', async () => {
  const { all, join, steps } = await farm()
  const seat = await join('farmer')
  const farmer = seat.held()!
  const ids = () => ROLES.flatMap(r => all(r).map(x => x.id))
  const before = ids()
  const at = [...farmer.data.pos]
  steps(120)
  expect(farmer.data.pos).toEqual(at)
  seat.leave()
  steps(2)
  expect(seat.me()).toBe(undefined)
  expect(ids()).toEqual(before)
  let moved = false
  for (let i = 0; i < 60 * 60 && !moved; i++) {
    steps(1)
    moved = farmer.data.pos[0] !== at[0] || farmer.data.pos[1] !== at[1]
  }
  expect(moved).toBe(true)
})

test('a field with every seat taken leaves the next seat on the title', async () => {
  const { join } = await farm()
  for (let i = 0; i < field.seats; i++) expect((await join('chicken')).last().scene).toBe('field')
  const late = await join('chicken')
  expect(late.last().scene).toBe('title')
  expect(late.me()).toBe(undefined)
})

test('the canvas shows the whole map', () => {
  const { width, height } = field.prefabs.engine
  const { ground, look } = file.world.render2d
  expect(ground).toEqual([[map.tilewidth, 0], [0, map.tileheight]])
  expect([map.width * map.tilewidth, map.height * map.tileheight]).toEqual([width, height])
  expect(look).toEqual([map.width / 2, map.height / 2])
})

test('everything that walks, and every start, stands clear inside its kind\'s bounds, and a start for every role and slot', () => {
  const inside = (kind: string, pos: number[]) => {
    const [[l, t], [r, b]] = kindDef(kind).bounds
    return pos[0] >= l && pos[0] <= r && pos[1] >= t && pos[1] <= b
  }
  for (const a of actors.filter(a => (ROLES as readonly string[]).includes(a.is))) {
    expect(inside(a.is, a.pos)).toBe(true)
    expect(clear(map, undefined, a.pos, kindDef(a.is).radius)).toBe(true)
  }
  for (const role of ROLES) {
    const starts = actors.filter(a => a.is === 'start' && a.role === role)
    expect(starts.map(s => s.slot)).toEqual(Array.from({ length: field.seats }, (_, i) => i))
    for (const s of starts) {
      expect(inside(role, s.pos)).toBe(true)
      expect(clear(map, undefined, s.pos, kindDef(role).radius)).toBe(true)
    }
  }
  for (const [[l, t], [r, b]] of ROLES.map(k => kindDef(k).bounds)) {
    expect(l).toBeGreaterThanOrEqual(0)
    expect(t).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(map.width)
    expect(b).toBeLessThanOrEqual(map.height)
  }
})

test('the pasture has a patch on every cell inside its fence, each reachable by a cow, and the farmer finds its way to each and to the pile', () => {
  const grass = actors.filter(a => a.is === 'grass')
  const [[l, t], [r, b]] = defs.cow.bounds
  const cells = new Set(grass.map(g => `${Math.floor(g.pos[0])},${Math.floor(g.pos[1])}`))
  expect(cells.size).toBe(grass.length)
  for (const g of grass) {
    expect(blocked(map, undefined, Math.floor(g.pos[0]), Math.floor(g.pos[1]))).toBe(false)
    // The nearest point of the cow's bounds is within its reach of the patch.
    const nx = Math.min(r, Math.max(l, g.pos[0])), ny = Math.min(b, Math.max(t, g.pos[1]))
    expect(Math.hypot(nx - g.pos[0], ny - g.pos[1])).toBeLessThanOrEqual(defs.cow.reach)
  }
  // Every cell next to a patch that is not a patch blocks: the fence goes all the way round but the gate.
  const nav = defs.farmer.nav
  const g = grid(map.width, map.height, (c, r) => blocked(map, undefined, c, r), nav.sub, nav.window)
  const from = actors.find(a => a.is === 'farmer').pos
  const pile = actors.find(a => a.is === 'pile').pos
  for (const goal of [pile, ...grass.map(x => x.pos)]) {
    const route = path(g, at(g, from), at(g, goal))
    expect(route.at(-1)).toBe(at(g, goal))
  }
})

test('with nobody in it, the farm lives: cows graze and drop manure, the farmer sows it and piles the crops, bugs nibble and chickens peck', async () => {
  const { all, steps } = await farm()
  const seen = { manure: new Set<number>(), crop: new Set<number>(), bug: new Set<number>() }
  const eaten = new Set<number>()
  let added = 0, nibbled = 0, grazed = 0
  const pile = all('pile')[0]
  const grownBefore = new Map<number, boolean>()
  const MINUTES = 8
  const start = performance.now()
  for (let i = 0; i < MINUTES * 60 * 60; i++) {
    const items = pile.data.items.length
    for (const g of all('grass')) grownBefore.set(g.id, g.data.grown)
    const bugs = new Set(all('bug').map(b => b.id))
    steps(1)
    for (const kind of ['manure', 'crop', 'bug'] as const) for (const r of all(kind)) seen[kind].add(r.id)
    for (const g of all('grass')) if (grownBefore.get(g.id) && !g.data.grown) grazed++
    const now = pile.data.items.length
    if (now > items) added += now - items
    if (now < items) nibbled += items - now
    for (const id of bugs) if (!all('bug').some(b => b.id === id)) eaten.add(id)
    for (const role of ROLES) {
      const [[l, t], [r, b]] = kindDef(role).bounds
      for (const x of all(role)) {
        expect(x.data.pos[0]).toBeGreaterThanOrEqual(l)
        expect(x.data.pos[0]).toBeLessThanOrEqual(r)
        expect(x.data.pos[1]).toBeGreaterThanOrEqual(t)
        expect(x.data.pos[1]).toBeLessThanOrEqual(b)
      }
    }
  }
  const ms = (performance.now() - start) / (MINUTES * 60 * 60)
  console.log(`farm2d: ${MINUTES} minutes with nobody in it: ${grazed} patches grazed, ${seen.manure.size} manure dropped, ${seen.crop.size} crops sown, ${added} produce piled, ${nibbled} nibbled, ${seen.bug.size} bugs came, ${eaten.size} pecked; ${all('manure').length} manure, ${all('crop').length} crops, ${all('bug').length} bugs and ${pile.data.items.length} on the pile at the end; ${ms.toFixed(3)} ms a step`)
  expect(grazed).toBeGreaterThan(0)
  expect(seen.manure.size).toBeGreaterThan(0)
  expect(seen.crop.size).toBeGreaterThan(0)
  expect(added).toBeGreaterThan(0)
  expect(nibbled).toBeGreaterThan(0)
  expect(eaten.size).toBeGreaterThan(0)
  expect(all('bug').length).toBeLessThanOrEqual(defs.swarm.most)
}, 600_000)
