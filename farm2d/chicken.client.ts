// A chicken, whoever plays it, on this page alone; sprite2d draws the chicken itself. From its
// definition:
// - while it walks, the effect `steps.effect` at its feet, `steps.scale` times its size, kept running
//   (`plugins/lasting`);
// - each peck as it starts (`peck` rising from 0), the effect `scratch.effect` from its beak, the one
//   of `scratch.beak` for the way it faces, right and left, each [x, y] cells off its feet, so a peck
//   that finds no bug still throws up the dirt. A bug it eats bursts from the bug, by its rule.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { lasting } from './plugins/lasting/lasting.plugin.ts'

let steps = lasting()
let pecking = false

export function setup(row: Row) {
  steps = lasting()
  pecking = row.data.peck > 0
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { particle2d } = plugins, d = row.data
  if (d.clip === 'walk') steps.keep(particle2d, k.steps.effect, d.pos, { scale: k.steps.scale })
  else steps.end()
  if (d.peck > 0 && !pecking && particle2d.has(k.scratch.effect)) {
    const [dx, dy] = k.scratch.beak[Math.round(d.facing * 2) % 2]
    particle2d.emit(k.scratch.effect, [d.pos[0] + dx, d.pos[1] + dy])
  }
  pecking = d.peck > 0
}

export function remove() {
  steps.end()
}
