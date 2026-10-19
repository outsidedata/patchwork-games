// The harvest pile: each produce on it (`items`) drawn from the definition's `sheet`, the clip its crop
// names, standing on the pile's `pos` moved by the next of the definition's `layout`, [x, y] in stage
// pixels, on the `sprites` layer, each later one sorted over the one before. A pile with more on it
// than `layout` has places shows the first that many; the HUD counts them all. While anything is on
// it, the harvest shines: the definition's `shine` effect kept running from the pile, on the `air`
// layer (`plugins/lasting`).
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { lasting } from './plugins/lasting/lasting.plugin.ts'

let shown: any[] = []
let shine = lasting()

export function setup() {
  shown = []
  shine = lasting()
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { render2d, loader } = plugins
  if (row.data.items.length) shine.keep(plugins.particle2d, k.shine, row.data.pos, { layer: 'air' })
  else shine.end()
  const s = loader.get(k.sheet)
  if (!s) return void loader.load(k.sheet)
  const items: string[] = row.data.items.slice(0, k.layout.length)
  while (shown.length < items.length) {
    const sprite = new render2d.PIXI.Sprite()
    sprite.roundPixels = true
    render2d.layer('sprites').addChild(sprite)
    shown.push(sprite)
  }
  while (shown.length > items.length) shown.pop().destroy()
  const [x, y] = render2d.place(row.data.pos), depth = render2d.depth(row.data.pos)
  items.forEach((clip, i) => {
    const frame = s.frameOf(clip, 0, 0), sprite = shown[i], [dx, dy] = k.layout[i]
    sprite.texture = s.texture(frame.id)
    sprite.anchor.set(frame.anchor[0] / frame.size[0], frame.anchor[1] / frame.size[1])
    sprite.position.set(Math.round(x + dx), Math.round(y + dy))
    sprite.zIndex = depth + i / k.layout.length
  })
}

export function remove() {
  shine.end()
  for (const s of shown) s.destroy()
  shown = []
}
