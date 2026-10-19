// The hero's keys, camera and HUD, for the seat's own row alone; anim draws the body of every seat's.
// w a s d are the stick, sent as `move`; shift held runs; space jumps; e or the right button held
// grips (`grip`); f or the left button held charges a stab and let go strikes (`attack`). A click
// takes the pointer, and the mouse moved under it turns the camera (`look`), which chasecamera3d sits
// on.
//
// The HUD, on the `hud` panel, read off the seat's own row and the weak points' rows as this page has
// them, at the places and in the words of the player definition's `hud`: the grip as a bar (its
// `low` colour under `hud.grip.low`), the stab's charge as a bar while it is held, the health, and how
// many weak points are left of all of them; and once the colossus is dead, `hud.fallen` on the
// `banner` panel.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  plugins.chasecamera3d.follow(row.id)
  plugins.player.bind({
    stick: [{ keys: ['a', 'd', 'w', 's'], send: (x, y) => ['move', x, y] }],
    hold: [
      { keys: ['Shift'], send: v => ['run', v] },
      { keys: ['e', 'Mouse2'], send: v => ['grip', v] },
      { keys: ['f', 'Mouse0'], send: v => ['attack', v] },
    ],
    press: { ' ': ['jump'] },
    pointer: (dx, dy) => ['look', dx, dy],
  } satisfies Binds)
}

// A line's words with each `{field}` filled in.
const fill = (text: string, values: Record<string, number>) => text.replace(/\{(\w+)\}/g, (_, k) => String(values[k]))

export function tick(row: Row, plugins: Plugins) {
  if (!ours) return
  const { ui } = plugins
  const { Text } = ui.PIXI as typeof PIXI
  const k = def(plugins.wire, row.kind)
  const h = k.hud
  const d = row.data
  const at = <T extends PIXI.Container>(c: T, [x, y]: number[]): T => { c.position.set(x, y); return c }
  const label = (panel: string, key: string, style: string) => ui.show(panel, key, () => new Text({ text: '', style: ui.style(style) }))

  at(label('hud', 'grip.label', 'label'), h.grip.label.at).text = h.grip.label.text
  const grip = ui.style('grip')
  at(ui.show('hud', 'grip', () => ui.bar(grip)), h.grip.bar.at).set(d.grip, d.grip < h.grip.low ? grip.low : grip.fill)
  if (d.charging) {
    at(label('hud', 'charge.label', 'label'), h.charge.label.at).text = h.charge.label.text
    const charge = ui.style('charge')
    at(ui.show('hud', 'charge', () => ui.bar(charge)), h.charge.bar.at).set(d.charge, charge.fill)
  }
  at(label('hud', 'health', 'label'), h.health.at).text = fill(h.health.text, { hp: d.hp, most: k.hp })
  const points = plugins.wire.rows.filter(r => r.kind === 'weakpoint')
  at(label('hud', 'left', 'label'), h.left.at).text = fill(h.left.text, { left: points.filter(p => !p.data.broken).length, all: points.length })
  if (plugins.wire.rows.some(r => r.kind === 'colossus' && r.data.dead)) {
    const fallen = at(label('banner', 'fallen', 'banner'), h.fallen.at)
    fallen.anchor.set(h.fallen.anchor[0], h.fallen.anchor[1])
    fallen.text = h.fallen.text
  }
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
