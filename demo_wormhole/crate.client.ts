// A crate, drawn: a box of its definition's `size` and `colour`, where its row puts it, and on both
// sides of a portal while it passes through one (`plugins/portal`'s `seen`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { seen } from './plugins/portal/portal.plugin.ts'

let look: ReturnType<typeof seen>

export function setup(row: Row, plugins: Plugins) {
  const { size, colour } = def(plugins.wire, row.kind)
  look = seen(plugins, new (plugins.render3d.THREE as typeof THREE).BoxGeometry(size, size, size), colour, row.data.jumps)
  look.tick(row)
}

export function tick(row: Row) {
  look.tick(row)
}

export function remove() {
  look.remove()
}
