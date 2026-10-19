// The jukebox on a page as `index.html` makes one, with no canvas, one seat over a loopback on the
// game, in through the title's first role, the farmer. Node has no Web Audio, so synthaudio's calls the
// jukebox makes are recorded as each client is mounted, its context stood in as running or locked, and
// the page's clock is the test's. The song is played from a copy of the project; the store's levels set
// every track's level, the song's by Music and the sounds' by Effects, all 0 muted; a sound a rule
// raises plays its track's notes once, on time, and not while the context is locked. The cows, the
// chickens and the bugs raise sounds of their own all the while, so a sound's notes are read off its
// own track's.
import { afterEach, expect, test, vi } from 'vitest'
import * as PIXI from 'pixi.js'
import { boot, type Scene } from '#engine/engine.ts'
import type { Client } from '#engine/browser.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { keyCode } from '#plugins/player/player.plugin.ts'
import { sixteenth } from '#plugins/synthaudio/synthaudio.sim.ts'
import defs from '../../assets/farm2d.json'
import song from '../../assets/farmtune.json'
import { sim } from '../../farm2d.sim.ts'
import file from '../../farm2d.scene.json'

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
// The page's clock, in milliseconds.
let clock = 0
vi.spyOn(performance, 'now').mockImplementation(() => clock)

const DT = file.prefabs.engine.dt
const base = new URL('../../', import.meta.url).href
const moment = () => new Promise(done => setTimeout(done, 5))
const k = defs.audio
const step = sixteenth(song.bpm)
const own = (t: string) => (song.tracks as Record<string, any>)[t].instrument.params.gain as number

async function field(state = 'running') {
  const calls: unknown[][] = []
  const top = boot(structuredClone(file) as Scene, sim)
  const truths = await load(top, base)
  const tab = view(link(loopback(accept(manager(top)))), structuredClone(file) as Scene, base, (me: Client) => {
    me.plugins.ui.canvas = { style: {}, addEventListener() {}, removeEventListener() {}, remove() {} }
    const s = me.plugins.synthaudio
    s.context = { state }
    for (const name of ['audition', 'use', 'attack', 'release'] as const) {
      const real = s[name]
      s[name] = (...a: any[]) => { calls.push([name, ...(name === 'audition' || name === 'use' ? [structuredClone(a[0]), a[1]] : a), clock / 1000]); return real(...a) }
    }
  })
  const frames = async (n = 1) => { for (let i = 0; i < n; i++) { top.step(DT); clock += DT * 1000; await tab.frame(); await moment() } }
  const plugins = () => tab.client!.plugins
  for (let i = 0; i < 400 && !(tab.client && plugins().ui.panel('title').getChildByLabel(`role-${defs.titlecard.roles[0].with}`)); i++) await frames(1)
  send('keydown', 'Enter')
  send('keyup', 'Enter')
  for (let i = 0; i < 40 && tab.name !== 'field'; i++) await frames(1)
  for (let i = 0; i < 400 && !plugins().ui.panel('hud').getChildByLabel('role'); i++) await frames(1)
  expect(tab.name).toBe('field')
  const room = truths.get('field')!
  const me = possessed(plugins().wire.rows)!
  const seat = () => room.rows.find(r => r.id === me.id)!
  const farmer = () => room.rows.find(r => r.id === seat().data.held.id)!
  expect(farmer().kind).toBe('farmer')
  const named = (name: string) => calls.filter(c => c[0] === name)
  return { calls, named, frames, plugins, room, farmer }
}

test('the song plays from a copy of the project, every track at its own level times Music or Effects, all 0 muted, set again only when a level changes', async () => {
  const { named, frames, plugins } = await field()
  const played = named('audition')
  expect(played.length).toBeGreaterThan(0)
  for (const [, project, name] of played) {
    expect(name).toBe(k.project)
    expect(Object.keys((project as any).tracks)).toEqual(Object.keys(song.tracks))
  }
  const levels = () => {
    const [, project] = named('use').at(-1)!
    return Object.fromEntries(Object.entries((project as any).tracks).map(([t, v]: [string, any]) => [t, v.instrument.params.gain]))
  }
  const start = file.prefabs.store
  const want = (music: number, effects: number) => Object.fromEntries(Object.keys(song.tracks).map(t => [t, own(t) * (k.music.includes(t) ? music : effects)]))
  expect(levels()).toEqual(want(start.music, start.effects))
  const uses = named('use').length
  await frames(10)
  expect(named('use').length).toBe(uses)
  plugins().store.set('music', 0.2)
  await frames(1)
  expect(levels()).toEqual(want(0.2, start.effects))
  plugins().store.set('effects', 1)
  await frames(1)
  expect(levels()).toEqual(want(0.2, 1))
  plugins().store.set('muted', true)
  await frames(1)
  expect(Object.values(levels())).toEqual(Object.keys(song.tracks).map(() => 0))
  // The loader's own copy of the project is never changed.
  expect(plugins().loader.get(k.project).tracks.lead.instrument.params.gain).toBe(own('lead'))
})

// The farmer carrying manure, put down with Space, which rings the put sound from it.
const putDown = (farmer: () => any) => {
  farmer().data.carry = 'manure'
  send('keydown', ' ')
  send('keyup', ' ')
}

test('a thing put down plays the put track\'s notes once, each from its sixteenth for its length, at its velocity', async () => {
  const { named, frames, farmer } = await field()
  putDown(farmer)
  // The next step puts it down, and the page sees it on that frame, its clock one step on.
  const from = clock / 1000 + DT
  const track = k.sounds[defs.farmer.sounds.put as 'put']
  await frames(Math.ceil((8 * step) / DT))
  expect(farmer().data.carry).toBe(null)
  const notes = song.tracks[track as 'put'].patterns.fx.notes as [number, string, number, number][]
  // Each note started on the first frame at or after its sixteenth, and released on the first at or
  // after its end: within a frame of it.
  const attacks = named('attack').filter(c => c[1] === track), releases = named('release').filter(c => c[1] === track)
  expect(attacks.map(c => c.slice(1, 4))).toEqual(notes.map(([, note, , vel]) => [track, note, vel]))
  expect(releases.map(c => c.slice(1, 3))).toEqual(notes.map(([, note]) => [track, note]))
  notes.forEach(([at, , len], i) => {
    expect((attacks[i].at(-1) as number) - from - at * step).toBeGreaterThanOrEqual(-DT)
    expect((attacks[i].at(-1) as number) - from - at * step).toBeLessThanOrEqual(DT * 2)
    expect((releases[i].at(-1) as number) - from - (at + len) * step).toBeGreaterThanOrEqual(-DT)
    expect((releases[i].at(-1) as number) - from - (at + len) * step).toBeLessThanOrEqual(DT * 2)
  })
})

test('sounds are let go while synthaudio\'s context is locked', async () => {
  const { named, frames, farmer } = await field('suspended')
  putDown(farmer)
  await frames(Math.ceil((8 * step) / DT))
  expect(farmer().data.carry).toBe(null)
  expect(named('attack')).toEqual([])
})
