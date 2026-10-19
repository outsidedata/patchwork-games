// A seat's `player` row. It has no body to draw: what it plays, a farmer, a cow or a chicken, is drawn
// by sprite2d whoever plays it, and marked over its head by the `roles` plugin. For the row that is
// `mine`, the seat's own pieces:
// - Its keys: the arrows or w a s d are a stick, the way they point sent as `move`, y growing down the
//   field; Space sends `use`, the one verb of what it plays. Both are relayed to the thing it holds.
// - The air over the whole field (`air.effect`, at `air.at`, for as long as the page is here): petals
//   and pollen drifting. The song and the sounds are the game's `jukebox` plugin's, and everything
//   drawn over the field for it, its card, its task, its prompt and the tray, the game's `hud`
//   plugin's.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import type { Binds } from '#plugins/player/player.plugin.ts'

let ours = false
let air = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  air = false
  if (!ours) return
  plugins.player.bind({
    stick: [{ keys: [['ArrowLeft', 'a'], ['ArrowRight', 'd'], ['ArrowUp', 'w'], ['ArrowDown', 's']], send: (x, y) => ['move', x, y] }],
    press: { ' ': ['use'] },
  } satisfies Binds)
}

export function tick(row: Row, plugins: Plugins) {
  if (!ours) return
  const k = def(plugins.wire, row.kind), { particle2d } = plugins
  if (!air && particle2d.has(k.air.effect)) {
    particle2d.emit(k.air.effect, k.air.at, { life: Number.MAX_SAFE_INTEGER, layer: 'air' })
    air = true
  }
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
