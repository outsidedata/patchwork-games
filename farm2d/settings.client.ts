// The sound menu: a menu the player opens, on the modal panel its definition's `panel` names, which
// the scene's `world.ui` opens with its `key` (Escape) when no other modal has the input; the title's
// Sound button and the field's speaker button open it with `ui.open`. `back` (Escape), its own key or
// Done closes it, and the focus goes back where it was. While it is up it holds every key, so the
// farmer stands and the game plays on under it.
//
// Every word, place and step is the `settings` definition's, and every value is the page's store's,
// which the server never sees and which lasts for every scene of this tab:
// - the `box` behind it all and its `title`;
// - each of `sliders`: its `label`, a bar at `barAt` filled to the store key `key` (in the `volume`
//   style, in its `muted` colour while everything is muted), that level as `levelText` at `levelAt`,
//   and `-` and `+` buttons at `down.at` and `up.at` that move it one of `steps` steps toward 0 or 1;
//   the level is kept as a whole number of steps over `steps`, so each value written is exact;
// - `mute`, a button at `mute.at` that turns the store key `mute.key` over, reading `mute.off` while
//   sound plays and `mute.on` while it is muted;
// - `done`, a button at `done.at` that closes the menu.
// The first thing shown is the first slider's `-`, so the focus starts there. The store keys are the
// ones the game's `jukebox` plugin mixes the song and the sounds by, so they change on the next frame.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export function setup() {}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { ui, store } = plugins, P = ui.PIXI as typeof PIXI
  if (!ui.opened(k.panel)) return
  const at = <T extends PIXI.Container>(c: T, [x, y]: number[]): T => { c.position.set(x, y); return c }
  const level = (key: string) => store.get(key) as number
  const turn = (key: string, by: number) => store.set(key, Math.min(k.steps, Math.max(0, Math.round(level(key) * k.steps) + by)) / k.steps)
  const muted = store.get(k.mute.key) === true

  const b = k.box
  ui.show(k.panel, 'box', () => new P.Graphics().roundRect(0, 0, b.size[0], b.size[1], b.radius).fill(b.fill).stroke({ color: b.edge, width: b.edgeWidth }))
  for (const s of k.sliders) {
    at(ui.show(k.panel, `${s.key}-down`, () => ui.button({ ...ui.style('small'), label: s.down.text }).on('pointertap', () => turn(s.key, -1))), s.down.at)
    at(ui.show(k.panel, `${s.key}-up`, () => ui.button({ ...ui.style('small'), label: s.up.text }).on('pointertap', () => turn(s.key, 1))), s.up.at)
  }
  const mute = at(ui.show(k.panel, 'mute', () => ui.button({ ...ui.style('wide'), label: k.mute.off }).on('pointertap', () => store.set(k.mute.key, !(store.get(k.mute.key) === true)))), k.mute.at)
  ;(mute.children[1] as PIXI.Text).text = muted ? k.mute.on : k.mute.off
  at(ui.show(k.panel, 'done', () => ui.button({ ...ui.style('wide'), label: k.done.text }).on('pointertap', () => ui.dismiss(k.panel))), k.done.at)

  const title = at(ui.show(k.panel, 'title', () => new P.Text({ text: '', style: ui.style('cardTitle'), anchor: 0.5 })), k.title.at)
  title.text = k.title.text
  const look = ui.style('volume')
  for (const s of k.sliders) {
    at(ui.show(k.panel, `${s.key}-label`, () => new P.Text({ text: '', style: ui.style('label') })), s.labelAt).text = s.label
    at(ui.show(k.panel, `${s.key}-bar`, () => ui.bar(look as any)), s.barAt).set(level(s.key), muted ? look.muted : look.fill)
    at(ui.show(k.panel, `${s.key}-level`, () => new P.Text({ text: '', style: ui.style('level'), anchor: { x: 1, y: 0 } })), s.levelAt).text =
      k.levelText.replace('{percent}', String(Math.round(level(s.key) * 100)))
  }
}

export function remove() {}
