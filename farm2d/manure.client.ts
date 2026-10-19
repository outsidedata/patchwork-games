// A pile of manure, on this page alone; sprite2d draws the pile itself. For as long as it lies, the
// effect its definition's `stink` names rises off it (`plugins/lasting`): stink lines and flies
// buzzing round it, gone the frame it is picked up.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { lasting } from './plugins/lasting/lasting.plugin.ts'

let stink = lasting()

export function setup() {
  stink = lasting()
}

export function tick(row: Row, plugins: Plugins) {
  stink.keep(plugins.particle2d, def(plugins.wire, row.kind).stink, row.data.pos)
}

export function remove() {
  stink.end()
}
