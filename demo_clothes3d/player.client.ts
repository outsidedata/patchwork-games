// One seat's `player` row (`player.sim.ts`). Its body is anim's to draw and its clothes clothing3d's. For
// the seat's own row, the one that is `mine`, its keys and the camera: the definition's `keys.stick`, the
// way to walk, sent as `stick`, and `keys.dress`, sent as `dress`. chasecamera3d follows the row.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  const keys = def(plugins.wire, row.kind).keys
  plugins.player.bind({
    stick: [{ keys: keys.stick, send: (x, y) => ['stick', x, y] }],
    press: Object.fromEntries(keys.dress.map((key: string) => [key, ['dress']])),
  } satisfies Binds)
  plugins.chasecamera3d.follow(row.id)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
