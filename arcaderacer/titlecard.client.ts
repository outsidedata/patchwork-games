// The title screen's look: on the `title` panel, which `world.ui` makes modal, over a backdrop of bands,
// the game's name; and for the leader while the match is in the lobby (`leads` in the match plugin),
// the tagline, a button for each course with a line under it saying what the course is, and a hint. A
// button's press, by the pointer or by the ui's keys, sends `start` with the button's course at the
// title's `match` row, which the match addon answers. The course buttons are shown first, so the first
// takes the focus. What else the lobby shows is the match plugin's. Its definition, every word and
// place:
//   backdrop   { size, bands }: `bands` colours top to bottom, each an even share of `size`.
//   logo, tagline, hint   { at, anchor, text, style }.
//   courses    a list of { scene, label, blurb, at }: the button's top-left at `at`, its blurb
//              `blurb.at` under it (`blurbAt`, from the button's top-left), in `world.ui` style `button`
//              and `blurbStyle`.
//   button, blurbStyle, blurbAt   the style of every button and blurb, and where a blurb stands.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { leads } from './plugins/match/match.sim.ts'

export function setup() {}

export function tick(row: Row, plugins: Plugins) {
  const { ui, wire } = plugins
  const T = ui.PIXI as typeof PIXI
  const D = def(wire, row.kind)
  const text = (key: string, spec: { at: number[]; anchor: number[]; text: string; style: string }) => {
    const t = ui.show('title', key, () => new T.Text({ text: spec.text, style: ui.style(spec.style) })) as PIXI.Text
    t.anchor.set(spec.anchor[0], spec.anchor[1])
    t.position.set(spec.at[0], spec.at[1])
    return t
  }
  const match = wire.rows.find(r => r.kind === 'match')
  if (match?.data.match === 'lobby' && leads(wire.rows)) {
    // the buttons first, so the first course takes the focus
    ;(D.courses as { scene: string; label: string; blurb: string; at: number[] }[]).forEach((c, k) => {
      const b = ui.show('title', `course.${k}`, () => ui.button({ ...ui.style(D.button), label: c.label }).on('pointertap', () => wire.send(match.id, 'start', c.scene))) as PIXI.Container
      b.position.set(c.at[0], c.at[1])
      const blurb = ui.show('title', `blurb.${k}`, () => new T.Text({ text: c.blurb, style: ui.style(D.blurbStyle) })) as PIXI.Text
      blurb.anchor.set(0.5, 0)
      blurb.position.set(c.at[0] + D.blurbAt[0], c.at[1] + D.blurbAt[1])
    })
    text('tagline', D.tagline)
    text('hint', D.hint)
  }
  const back = ui.show('title', 'backdrop', () => {
    const g = new T.Graphics()
    const [w, h] = D.backdrop.size
    const bands = D.backdrop.bands as number[]
    bands.forEach((colour, k) => g.rect(0, (h * k) / bands.length, w, h / bands.length + 1).fill(colour))
    return g
  }) as PIXI.Graphics
  back.zIndex = -1
  back.parent?.sortChildren()
  text('logo', D.logo)
}

export function remove() {}
