// A bending tube's look: the shape of its definition, climb's (`show`, the browser half of the climb
// plugin): its tube in its definition's `colour` at its row's `pos`, tipped back by its `pitch`, turned by
// its `yaw` and bent as its `bend` bends it, the mesh named `tube`, with its net drawn over it, bent too,
// while its definition's `shown` is true, named `tube net`. It is drawn from its first tick: climb, a
// plugin the game ships, is on `plugins` from the first frame's ticks (`shipped`), which come after a new
// row's setup.
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
