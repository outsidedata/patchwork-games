// A ball, drawn: a sphere of its definition's `radius`, `detail` [around, down] segments, in the
// chamber's surface its `surface` names, where its row puts it, and on both sides of a portal while it
// passes through one (`plugins/portal`'s `seen`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { seen } from './plugins/portal/portal.plugin.ts'

let look: ReturnType<typeof seen>

export function setup(row: Row, plugins: Plugins) {
  const { radius, detail, surface } = def(plugins.wire, row.kind)
  look = seen(plugins, new (plugins.render3d.THREE as typeof THREE).SphereGeometry(radius, detail[0], detail[1]), surface, row.data.jumps)
  look.tick(row)
}

export function tick(row: Row) {
  look.tick(row)
}

export function remove() {
  look.remove()
}
