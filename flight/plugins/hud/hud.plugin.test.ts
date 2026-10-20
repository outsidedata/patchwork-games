// The HUD on one page on the manager, as `index.html` makes it, through a loopback that holds every
// message `UP` steps' time on the way up and every packet `DOWN` on the way down, on a clock the test
// moves a step a frame, which is the page's clock too. What it shows is read off what the ui's `hud`
// panel holds: node has no canvas, so nothing is drawn, and what would be is read where it stands, each
// text by its label. The seat picks a plane, a mission and the air start from the menu's lists, as the
// FLY button does. The seat's plane is its `player` row, on the server and on the page (`possessed`).
// Where the test needs the plane held in an attitude it writes the server's row every
// step: at rest in the air, with no spin and the lever shut, nothing turns it, so the attitude the page
// draws is the one written. Every place is the `player` definition's `hud` in `assets/flight.json`.
import { expect, test, vi } from 'vitest'
import * as PIXI from 'pixi.js'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback, type Time } from '#addons/loopback/loopback.addon.ts'
import { possessed } from '#plugins/player/player.plugin.ts'
import { sim } from '../../flight.sim.ts'
import file from '../../flight.scene.json'
import defs from '../../assets/flight.json'

vi.setConfig({ testTimeout: 120_000 })

const DT = file.prefabs.engine.dt
const P = DT * 1000
const UP = 3
const DOWN = 3
const here = new URL('../../', import.meta.url).href
;(globalThis as any).addEventListener = () => {}
;(globalThis as any).removeEventListener = () => {}
let now = 0
vi.spyOn(performance, 'now').mockImplementation(() => now)

const surface = (s: Scene) => ({ addEventListener: () => {}, style: {} as any, width: s.prefabs.engine.width, height: s.prefabs.engine.height, remove() {} })
const place = (list: { type?: string; name?: string }[], v: string) => list.findIndex(x => (x.type ?? x.name) === v)

// The page's seat flying `plane` on `mission`, started in the air, a while after it picked.
async function flying(plane: string, mission: string) {
  now = 0
  const truth = boot(structuredClone(file) as Scene, sim)
  const air = (await load(truth, here)).get('sky')!
  const due: { at: number; f: () => void }[] = []
  const time: Time = { now: () => now, after: (ms, f) => { due.push({ at: now + ms, f }) } }
  const until = (t: number) => {
    for (;;) {
      due.sort((a, b) => a.at - b.at)
      if (!due.length || due[0].at > t) break
      const { at, f } = due.shift()!
      now = at
      f()
    }
    now = t
  }
  const p = view(link(loopback(accept(manager(truth)), time, { up: { delay: UP * P }, down: { delay: DOWN * P }, seed: 1 })), file as Scene, here, (me, s) => { me.plugins.render3d.canvas = surface(s) })
  // `n` frames, `hold` writing the server's rows before each step and `look` reading the panel after
  // each frame is drawn.
  let k = 0
  const frames = async (n: number, hold?: () => void, look?: () => void) => {
    for (let i = 0; i < n; i++) {
      k++
      until(k * P)
      hold?.()
      truth.step(DT)
      until(k * P)
      await p.frame()
      look?.()
    }
  }
  await frames(UP + DOWN + 30)
  const plugins = () => p.client!.plugins
  plugins().player.pick(place(defs.menu.planes, plane), place(defs.menu.missions, mission), place(defs.menu.starts, 'air'))
  await frames(UP + DOWN + 30)
  const player = () => air.rows.find(r => r.kind === 'player')!
  const panel = () => plugins().ui.panel('hud') as PIXI.Container
  const hud = () => panel().children.find(c => c.label === 'hud') as PIXI.Container | undefined
  const word = (key: string) => hud()?.children.find(c => c.label === key) as PIXI.Text | undefined
  return {
    air, frames, plugins, panel, hud, word,
    shown: (key: string) => !!word(key)?.visible,
    // The plane, the seat's `player` row, on the server, and as the page draws it.
    plane: player,
    drawn: () => possessed(p.client!.rows as Row[])!,
    // Every text the HUD shows this frame.
    showing: () => (hud()?.children ?? []).filter((c): c is PIXI.Text => c instanceof PIXI.Text && c.visible).map(c => c.label),
  }
}

test('the HUD goes while something else holds the camera and comes back when it lets go', async () => {
  const g = await flying('trainer', 'free')
  expect(g.hud()).toBeDefined()
  const owner = {}
  expect(g.plugins().render3d.claim(owner)).toBe(true)
  await g.frames(2)
  expect(g.hud()).toBeUndefined()
  g.plugins().render3d.release(owner)
  await g.frames(2)
  expect(g.hud()).toBeDefined()
})
