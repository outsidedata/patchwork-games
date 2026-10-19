// The farmhouse, on this page alone; sprite2d draws the house itself. Smoke curls from its chimney the
// whole time it stands: the effect its definition's `smoke` names, from its foot (`plugins/lasting`),
// the effect's own `at` lifting it to the chimney's top.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { lasting } from './plugins/lasting/lasting.plugin.ts'

let smoke = lasting()

export function setup() {
  smoke = lasting()
}

export function tick(row: Row, plugins: Plugins) {
  smoke.keep(plugins.particle2d, def(plugins.wire, row.kind).smoke, row.data.pos)
}

export function remove() {
  smoke.end()
}
