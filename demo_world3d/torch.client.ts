// A torch's look: its definition's `effect` emitted by particle3d at the row's `pos`, `from` the row, so
// it burns for as long as the row stands and goes out the frame it is gone. Its rolls are seeded with the
// row's id, so every page draws the same flames.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export function setup(row: Row, plugins: Plugins) {
  plugins.particle3d.emit(def(plugins.wire, row.kind).effect, row.data.pos, { from: row.id, seed: row.id })
}

export function tick() {}

export function remove() {}
