// The title in a page as `index.html` makes one, with no canvas: one seat over a loopback on the game,
// keys handed to the page's listeners as a browser hands them. The title card draws every piece its
// definition names where it says, the farm from the UI's own sheets; Enter presses the first role's
// button, and each role's button takes the seat to the field playing that role. A field with no seat
// free leaves the seat on the title, and after `full.after` seconds the card says so.
import { afterEach, expect, test, vi } from 'vitest'
import * as PIXI from 'pixi.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { boot, type Scene } from '#engine/engine.ts'
import { accept, connection, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { keyCode } from '#plugins/player/player.plugin.ts'
import { decodePng, unseal } from '#plugins/loader/loader.sim.ts'
import defs from './assets/farm2d.json'
import { sim } from './farm2d.sim.ts'
import file from './farm2d.scene.json'
import field from './field.scene.json'

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
// Every picture is in the scene's wad, and the loader reads it from there in node, pixel for pixel: a
// picture asked of PixiJS's `Assets` would be one fetched past the wad.
const asked: string[] = []
PIXI.DOMAdapter.set({ ...PIXI.DOMAdapter.get(), createCanvas: () => ({ getContext: () => null }) as any })
vi.spyOn(PIXI.Assets, 'load').mockImplementation((async (url: string) => {
  asked.push(url)
  throw new Error(`${url} was asked of PixiJS`)
}) as unknown as typeof PIXI.Assets.load)
const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const moment = () => new Promise(done => setTimeout(done, 5))
const k = defs.titlecard

async function title() {
  const top = boot(structuredClone(file) as Scene, sim)
  const truths = await load(top, here)
  const tab = view(link(loopback(accept(manager(top)))), structuredClone(file) as Scene, here, me => {
    me.plugins.ui.canvas = { style: {}, addEventListener() {}, removeEventListener() {}, remove() {} }
  })
  const frames = async (n = 1) => { for (let i = 0; i < n; i++) { top.step(DT); await tab.frame(); await moment() } }
  const plugins = () => tab.client!.plugins
  // Framed until every sheet the farm is drawn from has landed and the farm has been drawn from them.
  const ready = () => !!tab.client && Object.values(k.sheets).every(s => plugins().loader.ready(s)) && !!plugins().ui.panel('title').getChildByLabel(`crop-${k.crops.clips[0]}`)
  for (let i = 0; i < 400 && !ready(); i++) await frames(1)
  expect(ready()).toBe(true)
  return { top, truths, tab, frames, plugins }
}

test('the title card draws its words, a button for each role and the farm where its definition says', async () => {
  const { tab, plugins } = await title()
  expect(tab.name).toBe('title')
  const panel = plugins().ui.panel('title')
  const at = (label: string) => { const c = panel.getChildByLabel(label)!; return [c.x, c.y] }
  expect((panel.getChildByLabel('name') as PIXI.Text).text).toBe(k.name)
  expect(at('name')).toEqual(k.nameAt)
  expect((panel.getChildByLabel('tagline') as PIXI.Text).text).toBe(k.tagline)
  expect(at('tagline')).toEqual(k.taglineAt)
  expect((panel.getChildByLabel('help') as PIXI.Text).text).toBe(k.help)
  expect(at('help')).toEqual(k.helpAt)
  expect(at('sound')).toEqual(k.sound.at)
  for (const r of k.roles) {
    expect(at(`role-${r.with}`)).toEqual(r.at)
    expect(at(`figure-${r.with}`)).toEqual(r.figure.at)
    expect((panel.getChildByLabel(`figure-${r.with}`) as PIXI.Sprite).scale.x).toBe(r.figure.scale)
  }
  k.crops.clips.forEach((clip, i) => expect(at(`crop-${clip}`)).toEqual([k.crops.from[0] + i * k.crops.gap, k.crops.from[1]]))
  const wad = await unseal(readFileSync(join(process.cwd(), file.world.loader.wads[0])))
  for (const sheet of Object.values(k.sheets)) {
    const { data, pages } = plugins().loader.get(sheet)
    const sealed = decodePng(wad[data.pages[0].split('/').pop()!])
    expect([pages[0].source.width, pages[0].source.height, [...pages[0].source.resource]]).toEqual([sealed.width, sealed.height, [...sealed.data]])
  }
  expect(asked).toEqual([])
  expect(plugins().ui.focused(panel.getChildByLabel(`role-${k.roles[0].with}`)!)).toBe(true)
  expect(panel.getChildByLabel('full')).toBeNull()
})

test('Enter presses the first role\'s button, and the seat goes to the field playing it', async () => {
  const { tab, frames, truths, plugins } = await title()
  send('keydown', 'Enter')
  send('keyup', 'Enter')
  for (let i = 0; i < 20 && tab.name !== k.to; i++) await frames(1)
  expect(tab.name).toBe(k.to)
  await frames(2)
  const me = truths.get(k.to)!.rows.find(r => r.id === possessed(plugins().wire.rows)!.id)!
  expect(me.data.role).toBe(k.roles[0].with)
})

for (const r of k.roles) {
  test(`${r.label} takes the seat to the field playing ${r.with}`, async () => {
    const { tab, frames, truths, plugins } = await title()
    plugins().ui.panel('title').getChildByLabel(`role-${r.with}`)!.emit('pointertap', {} as any)
    for (let i = 0; i < 20 && tab.name !== k.to; i++) await frames(1)
    expect(tab.name).toBe(k.to)
    await frames(2)
    const room = truths.get(k.to)!
    const me = room.rows.find(x => x.id === possessed(plugins().wire.rows)!.id)!
    expect(room.rows.find(x => x.id === me.data.held.id)!.kind).toBe(r.with)
  })
}

test('a field with no seat free leaves the seat on the title, which says so after full.after seconds', async () => {
  const { top, tab, frames, plugins } = await title()
  // Every seat of the field taken by other connections, sent there by the title's own go.
  for (let i = 0; i < field.seats; i++) {
    let heard: any
    const other = connection(manager(top), d => { heard = d })
    top.step(DT)
    const ctrl = heard.packet.rows.find((x: any) => x.kind === 'scenemanager')
    other.take({ scene: heard.scene, seat: heard.seat, msg: { seq: 1, n: heard.packet.n, id: ctrl.id, action: 'go', args: [k.to, 'cow'] } })
    top.step(DT)
  }
  const panel = plugins().ui.panel('title')
  panel.getChildByLabel(`role-${k.roles[1].with}`)!.emit('pointertap', {} as any)
  await frames(Math.round(k.full.after / DT) - 2)
  expect(tab.name).toBe('title')
  expect(panel.getChildByLabel('full')).toBeNull()
  await frames(4)
  expect(tab.name).toBe('title')
  const full = panel.getChildByLabel('full') as PIXI.Text
  expect(full.text).toBe(k.full.text)
  expect([full.x, full.y]).toEqual(k.full.at)
})
