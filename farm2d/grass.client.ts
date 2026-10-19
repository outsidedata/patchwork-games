// A patch of the pasture's grass, as it grows back, on this page alone; sprite2d draws the patch
// itself. From its definition: each stage it grows on, the effect `regrow` from it, and the step it is
// grown tall again, `grown` in its place.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let stage = 0

export function setup(row: Row) {
  stage = row.data.frame
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { particle2d } = plugins
  if (row.data.frame > stage && particle2d.has(k.regrow)) particle2d.emit(row.data.grown ? k.grown : k.regrow, row.data.pos)
  stage = row.data.frame
}

export function remove() {}
