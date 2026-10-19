// A farmer, whoever plays it. sprite2d draws its body by its `farmer` entry; this look adds the rest,
// for every farmer, on this page alone:
// - Dust kicked up at its feet while it walks, the definition's `dust` effect kept running from its
//   feet (`plugins/lasting`).
// - What it carries (`carry`), held in its hands before it: manure, the `carry.manure` sheet's clip, or
//   produce, the `carry.produce` sheet's clip its crop names. Where it is held is the one of
//   `carry.hold` for the way the farmer faces, right, up, left and down, each [x, y, after]: x and y
//   stage pixels off its feet, and `after` how far past the farmer's own depth it is sorted on the
//   `sprites` layer, which is past the place sprite2d's table gives the farmer's kind and short of a
//   stage pixel. So held before it facing down or to the side it is drawn over the farmer, and facing
//   up, `after` below 0, it is behind the farmer's back; whatever stands in front of the farmer stands
//   in front of it too. While the farmer walks, the load bobs `carry.bob` pixels up on every other
//   frame of its stride.
// - While it carries produce, a glint now and then off what it holds: the `carry.glint` effect kept
//   running from its feet, on the `air` layer, the effect's own box putting it about its hands.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { lasting } from './plugins/lasting/lasting.plugin.ts'

let dust = lasting()
let glint = lasting()
let held: any

export function setup(_row: Row, plugins: Plugins) {
  dust = lasting()
  glint = lasting()
  held = new plugins.render2d.PIXI.Sprite()
  held.visible = false
  plugins.render2d.layer('sprites').addChild(held)
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { particle2d, render2d, loader } = plugins
  if (row.data.clip === 'walk') dust.keep(particle2d, k.dust, row.data.pos)
  else dust.end()
  const carry: string | null = row.data.carry
  if (carry !== null && carry !== 'manure') glint.keep(particle2d, k.carry.glint, row.data.pos, { layer: 'air' })
  else glint.end()
  const [name, clip] = carry === null ? [] : carry === 'manure' ? [k.carry.manure.sheet, k.carry.manure.clip] : [k.carry.produce, carry]
  const s = name ? loader.get(name) : undefined
  if (name && !s) void loader.load(name)
  held.visible = !!s
  if (!s) return
  const frame = s.frameOf(clip, 0, 0)
  const [x, y] = render2d.place(row.data.pos)
  const [dx, dy, after] = k.carry.hold[Math.round(row.data.facing * 4) % 4]
  const bob = row.data.clip === 'walk' && row.data.frame % 2 === 1 ? k.carry.bob : 0
  held.texture = s.texture(frame.id)
  held.anchor.set(frame.anchor[0] / frame.size[0], frame.anchor[1] / frame.size[1])
  held.roundPixels = true
  held.position.set(Math.round(x + dx), Math.round(y + dy - bob))
  held.zIndex = render2d.depth(row.data.pos) + after
}

export function remove() {
  dust.end()
  glint.end()
  held.destroy()
}
