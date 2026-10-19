// The sound menu in a page as `index.html` makes one, with no canvas: one seat over a loopback on the
// game, keys handed to the page's listeners as a browser hands them, in as the title's first role, the
// farmer. On the field Escape and the
// speaker button open it and it holds the keys; its buttons move the music and effects levels in whole
// steps between 0 and 1 and turn the mute over, all in the page's store and nowhere on the server;
// Done and Escape close it. On the title the Sound button opens it over the title. What it set lasts
// into the next scene.
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
const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const moment = () => new Promise(done => setTimeout(done, 5))
const k = defs.settings
const start = file.prefabs.store

async function game() {
  const top = boot(structuredClone(file) as Scene, sim)
  const truths = await load(top, here)
  const tab = view(link(loopback(accept(manager(top)))), structuredClone(file) as Scene, here, me => {
    me.plugins.ui.canvas = { style: {}, addEventListener() {}, removeEventListener() {}, remove() {} }
  })
  const frames = async (n = 1) => { for (let i = 0; i < n; i++) { top.step(DT); await tab.frame(); await moment() } }
  const plugins = () => tab.client!.plugins
  const press = async (key: string) => { send('keydown', key); send('keyup', key); await frames(2) }
  const menu = () => plugins().ui.panel(k.panel)
  const tap = async (label: string) => { menu().getChildByLabel(label)!.emit('pointertap', {} as any); await frames(2) }
  const text = (label: string) => (menu().getChildByLabel(label) as PIXI.Text | null)?.text
  for (let i = 0; i < 400 && !(tab.client && plugins().ui.panel('title').getChildByLabel(`role-${defs.titlecard.roles[0].with}`)); i++) await frames(1)
  return { top, truths, tab, frames, plugins, press, menu, tap, text }
}

async function field() {
  const g = await game()
  await g.press('Enter')
  for (let i = 0; i < 40 && g.tab.name !== 'field'; i++) await g.frames(1)
  for (let i = 0; i < 400 && !g.plugins().ui.panel('hud').getChildByLabel('sound'); i++) await g.frames(1)
  expect(g.tab.name).toBe('field')
  // The farmer the seat plays, the title's first role.
  const me = possessed(g.plugins().wire.rows)!
  const rows = () => g.truths.get('field')!.rows
  const farmer = () => rows().find(r => r.id === rows().find(p => p.id === me.id)!.data.held.id)!
  expect(farmer().kind).toBe(defs.titlecard.roles[0].with)
  return { ...g, farmer }
}

test('Escape opens the menu on the field, focused on the first button, and it holds the keys', async () => {
  const { plugins, press, menu, text, farmer, frames } = await field()
  expect(plugins().ui.opened(k.panel)).toBe(false)
  await press('Escape')
  expect(plugins().ui.opened(k.panel)).toBe(true)
  expect(plugins().ui.modal()).toBe(k.panel)
  expect(plugins().ui.focused(menu().getChildByLabel(`${k.sliders[0].key}-down`)!)).toBe(true)
  expect(text('title')).toBe(k.title.text)
  for (const s of k.sliders) {
    expect(text(`${s.key}-label`)).toBe(s.label)
    expect(text(`${s.key}-level`)).toBe(`${Math.round((start as any)[s.key] * 100)}%`)
    const bar = menu().getChildByLabel(`${s.key}-bar`)!
    expect([bar.x, bar.y]).toEqual(s.barAt)
  }
  expect((menu().getChildByLabel('mute')!.children[1] as PIXI.Text).text).toBe(k.mute.off)
  const at = [...farmer().data.pos]
  send('keydown', 'ArrowLeft')
  await frames(20)
  send('keyup', 'ArrowLeft')
  expect(farmer().data.pos).toEqual(at)
  await press('Escape')
  expect(plugins().ui.opened(k.panel)).toBe(false)
  send('keydown', 'ArrowLeft')
  await frames(20)
  send('keyup', 'ArrowLeft')
  expect(farmer().data.pos[0]).toBeLessThan(at[0])
})

test('the buttons move each level a whole step at a time between 0 and 1, in the page\'s store alone', async () => {
  const { plugins, press, tap, text, truths } = await field()
  await press('Escape')
  const store = () => plugins().store
  await tap('music-down')
  expect(store().get('music')).toBe(Math.round(start.music * k.steps - 1) / k.steps)
  expect(text('music-level')).toBe(`${Math.round((Math.round(start.music * k.steps - 1) / k.steps) * 100)}%`)
  for (let i = 0; i < k.steps + 3; i++) await tap('music-down')
  expect(store().get('music')).toBe(0)
  expect(text('music-level')).toBe('0%')
  for (let i = 0; i < 3; i++) await tap('music-up')
  expect(store().get('music')).toBe(3 / k.steps)
  expect(text('music-level')).toBe('30%')
  for (let i = 0; i < k.steps + 3; i++) await tap('effects-up')
  expect(store().get('effects')).toBe(1)
  expect(text('effects-level')).toBe('100%')
  await tap('effects-down')
  expect(store().get('effects')).toBe((k.steps - 1) / k.steps)
  for (const t of truths.values()) for (const r of t.rows) expect(JSON.stringify(r.data)).not.toMatch(/"(music|effects|muted)"/)
})

test('Mute all turns the mute over and its label with it, the bars greyed while muted', async () => {
  const { plugins, press, tap, menu } = await field()
  await press('Escape')
  const label = () => (menu().getChildByLabel('mute')!.children[1] as PIXI.Text).text
  await tap('mute')
  expect(plugins().store.get(k.mute.key)).toBe(true)
  expect(label()).toBe(k.mute.on)
  await tap('mute')
  expect(plugins().store.get(k.mute.key)).toBe(false)
  expect(label()).toBe(k.mute.off)
})

test('Done and the speaker button close and open it', async () => {
  const { plugins, tap, frames } = await field()
  plugins().ui.panel('hud').getChildByLabel('sound')!.emit('pointertap', {} as any)
  await frames(2)
  expect(plugins().ui.opened(k.panel)).toBe(true)
  await tap('done')
  expect(plugins().ui.opened(k.panel)).toBe(false)
})

test('the title\'s Sound button opens it over the title, Escape closes it, and its levels last into the field', async () => {
  const { tab, plugins, press, tap, frames } = await game()
  const title = plugins().ui.panel('title')
  // Sound stands under the middle role's button.
  await press('ArrowRight')
  await press('ArrowDown')
  expect(plugins().ui.focused(title.getChildByLabel('sound')!)).toBe(true)
  await press('Enter')
  expect(plugins().ui.opened(k.panel)).toBe(true)
  expect(plugins().ui.modal()).toBe(k.panel)
  await tap('effects-down')
  await tap('effects-down')
  const set = plugins().store.get('effects')
  expect(set).toBe(Math.round(start.effects * k.steps - 2) / k.steps)
  await press('Escape')
  expect(plugins().ui.opened(k.panel)).toBe(false)
  expect(plugins().ui.focused(title.getChildByLabel('sound')!)).toBe(true)
  await press('ArrowUp')
  await press('Enter')
  for (let i = 0; i < 40 && tab.name !== 'field'; i++) await frames(1)
  expect(tab.name).toBe('field')
  expect(plugins().store.get('effects')).toBe(set)
})
