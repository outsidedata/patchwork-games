// A maple, on this page alone; sprite2d draws the tree itself. Now and then a leaf lets go of its
// crown and drifts down, the whole time it stands: the effect its definition's `leaves` names, from
// its trunk's foot (`plugins/lasting`), the effect's own box putting each leaf in the crown.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { lasting } from './plugins/lasting/lasting.plugin.ts'

let leaves = lasting()

export function setup() {
  leaves = lasting()
}

export function tick(row: Row, plugins: Plugins) {
  leaves.keep(plugins.particle2d, def(plugins.wire, row.kind).leaves, row.data.pos)
}

export function remove() {
  leaves.end()
}
