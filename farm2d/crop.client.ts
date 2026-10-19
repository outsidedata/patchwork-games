// A crop, as it grows, on this page alone; sprite2d draws the plant itself. From its definition:
// - each stage it grows on, short of ripe, the effect `sprout` from it;
// - the step it ripens, the effect `ripen` from it;
// - for as long as it stands ripe, the effect `glint` from it, on the `air` layer (`plugins/lasting`),
//   so a crop ready to pick twinkles until the farmer picks it.
// A crop already ripe when the page first sees it glints and does not ripen again.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { lasting } from './plugins/lasting/lasting.plugin.ts'

let stage = 0
let ripe = false
let glint = lasting()

export function setup(row: Row) {
  stage = row.data.frame
  ripe = row.data.ripe
  glint = lasting()
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { particle2d } = plugins
  if (!particle2d.has(k.ripen)) return
  if (row.data.frame > stage && !row.data.ripe) particle2d.emit(k.sprout, row.data.pos)
  if (row.data.ripe && !ripe) particle2d.emit(k.ripen, row.data.pos)
  stage = row.data.frame
  ripe = row.data.ripe
  if (ripe) glint.keep(particle2d, k.glint, row.data.pos, { layer: 'air' })
  else glint.end()
}

export function remove() {
  glint.end()
}
