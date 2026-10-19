// A farmer, whoever plays it. sprite2d draws its body by its `farmer` entry; this look adds the rest,
// for every farmer, on this page alone:
// - Dust kicked up at its feet while it walks, the definition's `dust.effect` every `dust.every`
//   seconds.
// - What it carries (`carry`), held over its head `carry.lift` stage pixels above its feet: manure,
//   the `carry.manure` sheet's clip, or produce, the `carry.produce` sheet's clip its crop names. It is
//   on the `sprites` layer sorted `carry.after` past the farmer's own depth, which is past the place
//   sprite2d's table gives the farmer's kind and short of a stage pixel, so it is drawn over the
//   farmer and whatever stands in front of the farmer stands in front of it too.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let dusted = 0
let held: any

export function setup(_row: Row, plugins: Plugins) {
  dusted = 0
  held = new plugins.render2d.PIXI.Sprite()
  held.visible = false
  plugins.render2d.layer('sprites').addChild(held)
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { particle2d, render2d, loader } = plugins
  if (row.data.clip === 'walk' && particle2d.has(k.dust.effect)) {
    dusted -= plugins.wire.scene.prefabs.engine.dt
    if (dusted <= 0) {
      particle2d.emit(k.dust.effect, row.data.pos)
      dusted = k.dust.every
    }
  }
  const carry: string | null = row.data.carry
  const [name, clip] = carry === null ? [] : carry === 'manure' ? [k.carry.manure.sheet, k.carry.manure.clip] : [k.carry.produce, carry]
  const s = name ? loader.get(name) : undefined
  if (name && !s) void loader.load(name)
  held.visible = !!s
  if (!s) return
  const frame = s.frameOf(clip, 0, 0)
  const [x, y] = render2d.place(row.data.pos)
  held.texture = s.texture(frame.id)
  held.anchor.set(frame.anchor[0] / frame.size[0], frame.anchor[1] / frame.size[1])
  held.roundPixels = true
  held.position.set(Math.round(x), Math.round(y - k.carry.lift))
  held.zIndex = render2d.depth(row.data.pos) + k.carry.after
}

export function remove() {
  held.destroy()
}
