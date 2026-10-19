// A cow, whoever plays it, on this page alone; sprite2d draws the cow itself. From its definition,
// each kept running while it holds (`plugins/lasting`):
// - while it walks, the effect `steps.effect` at its feet, `steps.scale` times its size, a cow's
//   heavier tread;
// - while it chews (`chew` above 0), the effect `munch.effect` from its mouth, the one of
//   `munch.mouth` for the way it faces, right, up, left and down, each [x, y, h] cells off its feet,
//   so bits of grass fall from its jaws.
// The fart while it chews is its rule's (`cow.sim.ts`), heard and seen alike on every page.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { lasting } from './plugins/lasting/lasting.plugin.ts'

let steps = lasting()
let munch = lasting()

export function setup() {
  steps = lasting()
  munch = lasting()
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { particle2d } = plugins, d = row.data
  if (d.clip === 'walk') steps.keep(particle2d, k.steps.effect, d.pos, { scale: k.steps.scale })
  else steps.end()
  if (d.chew > 0) {
    const [dx, dy, h] = k.munch.mouth[Math.round(d.facing * 4) % 4]
    munch.keep(particle2d, k.munch.effect, [d.pos[0] + dx, d.pos[1] + dy, h])
  } else munch.end()
}

export function remove() {
  steps.end()
  munch.end()
}
