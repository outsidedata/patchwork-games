// A sliding wall's look: the shape of its definition, climb's (`show`, the browser half of the climb
// plugin): its box in its definition's `colour` at its row's `pos` as it slides, tipped back by its
// `pitch` and turned by its `yaw`, the mesh named `slider`, with its net drawn over it while its
// definition's `shown` is true, named `slider net`. It is drawn from its first tick: climb, a plugin the
// game ships, is on `plugins` from the first frame's ticks (`shipped`), which come after a new row's setup.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'

let id: number | undefined

export function setup(row: Row) {
  id = row.id
}

export function tick(row: Row, plugins: Plugins) {
  plugins.climb.show(row, plugins)
}

export function remove(plugins: Plugins) {
  if (id !== undefined) plugins.climb.hide(id, plugins)
}
