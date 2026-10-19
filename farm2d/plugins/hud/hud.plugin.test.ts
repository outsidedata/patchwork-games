// The HUD on a page as `index.html` makes one, with no canvas, one seat over a loopback on the game, in
// through the title's button for its role. The field is stilled first: every brain stood for good, the
// swarm sent no more bugs, and nothing lying in it, so each test puts down only what it reads.
// - The card names the role and says its task, the tray counts the harvest, the bugs and the manure as
//   they change, the bug's icon from the UI's own entry; the house goes to the title, which shows
//   neither.
// - The farmer: fetch the manure, marked; Space picks it up beside it; carrying it, plant it, marked on
//   the free soil nearest, Plant on soil and Drop off it; carrying produce, stash it at the pile, Stash
//   beside the pile and Drop away from it; with nothing to pick up, wait.
// - The cow: graze the tall grass, marked, Eat beside it; chewing, nothing but its task; with none
//   grown, rest.
// - The chicken: hunt the bugs in its yard, marked, Peck beside one; a bug outside the yard is not its;
//   with none, guard.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import defs from '../../assets/farm2d.json'
import { page } from '../../field.harness.ts'

vi.setConfig({ testTimeout: 60_000 })
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})
// Node decodes the pictures the wad holds and no other: the bug's sheet is a plain file beside it, so
// PixiJS's own load stands in, a new texture each call, and the UI's entry and the game's are two.
beforeEach(() => { vi.spyOn(PIXI.Assets, 'load').mockImplementation((async () => new PIXI.Texture()) as typeof PIXI.Assets.load) })
afterEach(() => { vi.restoreAllMocks() })
const h = defs.player.hud

// The field stilled with the seat playing `role`, and what the HUD panel shows.
async function field(role: 'farmer' | 'cow' | 'chicken') {
  const f = await page(role)
  const panel = () => f.plugins().ui.panel('hud')
  const text = (label: string) => (panel().getChildByLabel(label) as PIXI.Text | null)?.text
  const shown = (label: string) => panel().getChildByLabel(label)
  const verb = () => (shown('prompt')?.children[3] as PIXI.Text | undefined)?.text
  // Where the marker was pinned, and the canvas point of a world point.
  const marked = () => { const m = shown('marker'); return m && [m.x, m.y] }
  const at = (pos: number[]) => { const p = f.plugins().ui.project(pos); return [p.x, p.y] }
  return { ...f, text, shown, verb, marked, at }
}

test('the card names the role and says its task, the tray counts the harvest, the bugs and the manure as they change, and the house goes to the title', async () => {
  const { tab, room, kind, frames, text, shown, plugins } = await field('cow')
  expect(text('role')).toBe(defs.player.roles.cow.name)
  expect(text('task')).toBe(defs.player.roles.cow.tasks.rest)
  kind('pile')[0].data.items = ['leek', 'onion', 'leek']
  room.spawn('manure', { pos: [12, 12] })
  room.spawn('manure', { pos: [13, 12] })
  room.spawn('bug', { pos: [23, 1] })
  await frames(2)
  expect([text('harvest'), text('bugs'), text('manure')]).toEqual(['3', '1', '2'])
  // The bug's icon is drawn from the UI's own entry of the plain file, never the game's.
  const bugs = h.tray.counts.find(c => c.of === 'bugs')!
  const ui = plugins().loader.get(bugs.sheet), game = plugins().loader.get('bug')
  const frame = ui.frameOf(bugs.clip, 0, 0)
  expect((shown('bugs-icon') as PIXI.Sprite).texture).toBe(ui.texture(frame.id))
  expect((shown('bugs-icon') as PIXI.Sprite).texture).not.toBe(game.texture(frame.id))
  // The house takes the seat to the title, which shows neither the card nor the tray.
  shown('leave')!.emit('pointertap', {} as any)
  for (let i = 0; i < 40 && tab.name !== h.tray.leave.to; i++) await frames(1)
  expect(tab.name).toBe(h.tray.leave.to)
  await frames(2)
  expect(shown('tray')).toBe(null)
  expect(shown('card')).toBe(null)
})

test('the farmer fetches the manure and plants it on the soil, stashes the produce at the pile, and waits with nothing to pick up', async () => {
  const { room, kind, thing: farmer, frames, text, shown, verb, marked, at } = await field('farmer')
  const tasks = defs.player.roles.farmer.tasks, verbs = h.verbs
  expect(text('task')).toBe(tasks.wait)
  expect(shown('marker')).toBe(null)
  expect(shown('prompt')).toBe(null)

  farmer.data.pos = [6.2, 6.8]
  const manure = room.spawn('manure', { pos: [3.5, 10.5] })
  await frames(2)
  expect(text('task')).toBe(tasks.fetch)
  expect(marked()).toEqual(at(manure.data.pos))
  expect(shown('prompt')).toBe(null)
  farmer.data.pos = [manure.data.pos[0] + defs.farmer.reach * 0.5, manure.data.pos[1]]
  await frames(2)
  expect(verb()).toBe(verbs.pick.text)
  expect(shown('marker')).toBe(null)

  // Carrying manure: off the soil it would drop it, and the free soil nearest is marked.
  room.end(manure)
  farmer.data.carry = 'manure'
  farmer.data.pos = [10.5, 2.5]
  await frames(2)
  expect(text('task')).toBe(tasks.plant)
  // Off the soil it would drop it, and the free soil nearest, the plot's corner cell (11, 2), is marked.
  expect(verb()).toBe(verbs.drop.text)
  expect(marked()).toEqual(at([11.5, 2.5]))
  // On it, it would plant it, and the marker has done its work.
  farmer.data.pos = [11.5, 2.5]
  await frames(2)
  expect(verb()).toBe(verbs.plant.text)
  expect(shown('marker')).toBe(null)
  // With a crop growing there that cell is not free: from the left of the plot the next nearest,
  // (11, 3), is marked.
  room.spawn('crop', { pos: [11.5, 2.5] })
  farmer.data.pos = [9, 2.5]
  await frames(2)
  expect(text('task')).toBe(tasks.plant)
  expect(verb()).toBe(verbs.drop.text)
  expect(marked()).toEqual(at([11.5, 3.5]))

  // Carrying produce: the pile, Drop away from it and Stash beside it.
  for (const c of kind('crop')) room.end(c)
  farmer.data.carry = 'leek'
  farmer.data.pos = [12, 10]
  await frames(2)
  const pile = kind('pile')[0]
  expect(text('task')).toBe(tasks.stash)
  expect(verb()).toBe(verbs.drop.text)
  expect(marked()).toEqual(at(pile.data.pos))
  farmer.data.pos = [pile.data.pos[0] - defs.farmer.reach * 0.5, pile.data.pos[1]]
  await frames(2)
  expect(verb()).toBe(verbs.stash.text)
  expect(shown('marker')).toBe(null)

  // Carrying nothing, a ripe crop and produce lying loose: the nearest is the one marked.
  farmer.data.carry = null
  farmer.data.pos = [6.2, 6.8]
  const ripe = room.spawn('crop', { pos: [12.5, 3.5], clip: 'leek', frame: 5, ripe: true })
  const loose = room.spawn('produce', { pos: [8, 6.8], clip: 'onion' })
  await frames(2)
  expect(text('task')).toBe(tasks.gather)
  expect(marked()).toEqual(at(loose.data.pos))
  room.end(loose)
  await frames(2)
  expect(text('task')).toBe(tasks.pick)
  expect(marked()).toEqual(at(ripe.data.pos))
})

test('the cow grazes the tall grass, eats beside it, says nothing more while it chews, and rests with none grown', async () => {
  const { kind, thing: cow, frames, text, shown, verb, marked, at } = await field('cow')
  const tasks = defs.player.roles.cow.tasks
  expect(text('task')).toBe(tasks.rest)
  expect(shown('marker')).toBe(null)
  const grass = kind('grass')[10]
  grass.data.frame = 3
  grass.data.grown = true
  cow.data.pos = [grass.data.pos[0] + 2, grass.data.pos[1]]
  await frames(2)
  expect(text('task')).toBe(tasks.graze)
  expect(marked()).toEqual(at(grass.data.pos))
  expect(shown('prompt')).toBe(null)
  cow.data.pos = [grass.data.pos[0] + defs.cow.reach * 0.5, grass.data.pos[1]]
  await frames(2)
  expect(verb()).toBe(h.verbs.eat.text)
  cow.data.chew = 1000
  await frames(2)
  expect(text('task')).toBe(tasks.chew)
  expect(shown('prompt')).toBe(null)
  expect(shown('marker')).toBe(null)
})

test('the chicken hunts the bugs in its yard, pecks beside one, leaves a bug outside its yard alone, and guards with none', async () => {
  const { room, thing: hen, frames, text, shown, verb, marked, at } = await field('chicken')
  const tasks = defs.player.roles.chicken.tasks
  expect(text('task')).toBe(tasks.guard)
  // A bug far outside the yard is not the chicken's.
  room.spawn('bug', { pos: [2, 2] })
  await frames(2)
  expect(text('task')).toBe(tasks.guard)
  expect(shown('marker')).toBe(null)
  const bug: Row = room.spawn('bug', { pos: [21, 12] })
  bug.data.turn = 1e9
  hen.data.pos = [19, 9]
  await frames(1)
  expect(text('task')).toBe(tasks.hunt)
  expect(marked()).toEqual(at(bug.data.pos))
  hen.data.pos = [bug.data.pos[0] - defs.chicken.reach * 0.5, bug.data.pos[1]]
  await frames(1)
  expect(verb()).toBe(h.verbs.peck.text)
  // Pecking already, it can peck no more until it has done.
  hen.data.peck = 1000
  await frames(1)
  expect(shown('prompt')).toBe(null)
})
