// The field in a page as `index.html` makes one, with no canvas: one seat over a loopback on the game,
// in through the title's buttons, keys handed to the page's listeners as a browser hands them. What the
// HUD shows is the `hud` plugin's, and its own test's (`plugins/hud`).
// - The arrows walk the thing it plays and Space is its verb: the farmer put down what it carries.
// - A mark in the seat's own colour stands over the thing it plays, and goes when it leaves.
// - The farmer's look holds what it carries before it, over it to its side and behind its back facing
//   up, and the pile's draws what is on it.
// - The tray's house button takes the seat back to the title, and what it played stays in the field.
import { afterEach, expect, test, vi } from 'vitest'
import * as PIXI from 'pixi.js'
import { boot, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { keyCode } from '#plugins/player/player.plugin.ts'
import defs from './assets/farm2d.json'
import { sim } from './farm2d.sim.ts'
import file from './farm2d.scene.json'

vi.setConfig({ testTimeout: 60_000 })
type On = { type: string; f: (e: any) => void; capture: boolean }
const listening: On[] = []
vi.stubGlobal('addEventListener', (type: string, f: (e: any) => void, capture = false) => { listening.push({ type, f, capture: !!capture }) })
vi.stubGlobal('removeEventListener', (type: string, f: (e: any) => void, capture = false) => {
  const i = listening.findIndex(o => o.type === type && o.f === f && o.capture === !!capture)
  if (i >= 0) listening.splice(i, 1)
})
afterEach(() => { listening.length = 0 })
const send = (type: string, k: string) => {
  const e = { key: k, code: keyCode(k), repeat: false, target: null, preventDefault() {} }
  for (const capture of [true, false]) for (const o of listening.filter(o => o.type === type && o.capture === capture)) o.f(e)
}
PIXI.DOMAdapter.set({ ...PIXI.DOMAdapter.get(), createCanvas: () => ({ getContext: () => null }) as any })
// Node decodes the pictures the wad holds and no other: the bug's sheet, a plain file beside it, is
// stood in for.
vi.spyOn(PIXI.Assets, 'load').mockImplementation((async () => new PIXI.Texture()) as typeof PIXI.Assets.load)
const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const moment = () => new Promise(done => setTimeout(done, 5))
const h = defs.player.hud

// In through the title's button for `role`.
async function field(role: string) {
  const top = boot(structuredClone(file) as Scene, sim)
  const truths = await load(top, here)
  const tab = view(link(loopback(accept(manager(top)))), structuredClone(file) as Scene, here, me => {
    me.plugins.ui.canvas = { style: {}, addEventListener() {}, removeEventListener() {}, remove() {} }
  })
  const frames = async (n = 1) => { for (let i = 0; i < n; i++) { top.step(DT); await tab.frame(); await moment() } }
  const plugins = () => tab.client!.plugins
  const button = () => tab.client && plugins().ui.panel('title').getChildByLabel(`role-${role}`)
  for (let i = 0; i < 400 && !button(); i++) await frames(1)
  button()!.emit('pointertap', {} as any)
  for (let i = 0; i < 40 && tab.name !== 'field'; i++) await frames(1)
  expect(tab.name).toBe('field')
  const hud = () => plugins().ui.panel('hud')
  for (let i = 0; i < 400 && !hud().getChildByLabel('role'); i++) await frames(1)
  const me = possessed(plugins().wire.rows)!
  const room = truths.get('field')!
  const seat = () => room.rows.find(r => r.id === me.id)
  const held = () => room.rows.find(r => r.id === seat()!.data.held.id)!
  return { tab, frames, plugins, room, seat, held, hud }
}

test('the arrows walk the thing the seat plays, and Space puts down what the farmer carries, held in front of it until then', async () => {
  const { held, frames, plugins, room } = await field('farmer')
  const farmer = held()
  const from = [...farmer.data.pos]
  send('keydown', 'ArrowRight')
  await frames(20)
  send('keyup', 'ArrowRight')
  await frames(2)
  expect(farmer.data.pos[0]).toBeGreaterThan(from[0])
  expect(farmer.data.pos[1]).toBeCloseTo(from[1])
  // What it carries: the sprite of manure held up off the ground within a cell of the farmer; manure it
  // puts down lies on the ground at its feet.
  const manure = () => { const s = plugins().loader.get(defs.farmer.carry.manure.sheet); return s.texture(s.frameOf(defs.farmer.carry.manure.clip, 0, 0).id) }
  const [x, y] = plugins().render2d.place(farmer.data.pos), depth = () => plugins().render2d.depth(farmer.data.pos)
  const carried = () => plugins().render2d.layer('sprites').children.filter((c: any) => c instanceof PIXI.Sprite && c.visible && c.texture === manure() && Math.abs(c.x - x) < 16 && c.y < y - 1 && c.y > y - 16)
  expect(carried().length).toBe(0)
  farmer.data.carry = 'manure'
  await frames(2)
  // Walked right, it faces right: the load is in front of it, on its right, and drawn over it.
  expect(carried().length).toBe(1)
  expect(carried()[0].x).toBeGreaterThan(x)
  expect(carried()[0].zIndex).toBeGreaterThan(depth())
  // Turned to face up, the load is in front of it still, so behind its back as the page shows it.
  farmer.data.facing = 0.25
  await frames(2)
  expect(carried()[0].zIndex).toBeLessThan(depth())
  farmer.data.facing = 0
  send('keydown', ' ')
  send('keyup', ' ')
  await frames(3)
  expect(farmer.data.carry).toBe(null)
  expect(room.rows.filter(r => r.kind === 'manure').length).toBeGreaterThan(0)
  expect(carried().length).toBe(0)
})

test('a mark in the seat\'s own colour stands over the thing it plays, and the house button takes the seat to the title, its chicken staying in the field', async () => {
  const { held, frames, plugins, hud, tab, room } = await field('chicken')
  const hen = held()
  const air = plugins().render2d.layer('air')
  const marks = () => air.children.filter((c: any) => c instanceof PIXI.Graphics)
  expect(marks().length).toBe(1)
  const [x, y] = plugins().render2d.place(hen.data.pos)
  expect(marks()[0].x).toBe(Math.round(x))
  expect(marks()[0].y).toBeLessThan(y)
  hud().getChildByLabel('leave')!.emit('pointertap', {} as any)
  for (let i = 0; i < 40 && tab.name !== h.tray.leave.to; i++) await frames(1)
  expect(tab.name).toBe(h.tray.leave.to)
  expect(room.rows.some(r => r.id === hen.id)).toBe(true)
  expect(room.rows.some(r => r.kind === 'player')).toBe(false)
})

test('the pile draws what is on it, as many as its layout has places', async () => {
  const { room, frames, plugins } = await field('farmer')
  const pile = room.rows.find(r => r.kind === 'pile')!
  const [x, y] = plugins().render2d.place(pile.data.pos)
  // The places of the pile's layout, and which of them a sprite stands on.
  const places = defs.pile.layout.map(([dx, dy]) => `${Math.round(x + dx)},${Math.round(y + dy)}`)
  const drawn = () => places.filter(p => plugins().render2d.layer('sprites').children.some((c: any) => c instanceof PIXI.Sprite && `${c.x},${c.y}` === p))
  pile.data.items = []
  await frames(2)
  expect(drawn()).toEqual([])
  pile.data.items = ['leek', 'onion']
  await frames(2)
  expect(drawn()).toEqual(places.slice(0, 2))
  pile.data.items = Array.from({ length: defs.pile.layout.length + 5 }, () => 'potato')
  await frames(2)
  expect(drawn()).toEqual(places)
})
