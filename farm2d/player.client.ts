// A seat's `player` row. It has no body to draw: what it plays, a farmer, a cow or a chicken, is drawn
// by sprite2d whoever plays it, and marked over its head by the `roles` plugin. For the row that is
// `mine`, the seat's own pieces:
// - Its keys: the arrows or w a s d are a stick, the way they point sent as `move`, y growing down the
//   field; Space sends `use`, the one verb of what it plays. Both are relayed to the thing it holds.
// - Petals drifting on the air over the whole field (`air.effect`, at `air.at`, for as long as the
//   page is here). The song and the sounds are the game's `jukebox` plugin's.
// - On the UI's `hud` panel, from its definition's `hud`, in the `score` style unless said: `role`,
//   its text with `{name}` the name of the role it plays (`roles.<role>.name`), at `role.at`; under
//   it in the `help` style the role's `help` at `help.at`; and `status` at `status.at`, its text with
//   `{harvest}` the produce on the pile, `{bugs}` the bugs in the field and `{manure}` the manure
//   lying in it. While it has no role yet, none of the three. A speaker button at `sound.at`, in the
//   `chip` style, opens the sound menu `sound.opens` names (`settings.client.ts`), as Escape does,
//   and a house button at `leave.at` takes the seat back to the scene `leave.to` names; whatever it
//   played stays in the field and its brain plays it on.
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
  hud(row, plugins, k)
}

function hud(row: Row, plugins: Plugins, k: any) {
  const { ui, wire } = plugins, { PIXI } = ui, h = k.hud
  const sound = ui.show('hud', 'sound', () =>
    ui.button({ ...ui.style('chip'), label: h.sound.label }).on('pointertap', () => ui.open(h.sound.opens)))
  sound.position.set(h.sound.at[0], h.sound.at[1])
  const leave = ui.show('hud', 'leave', () =>
    ui.button({ ...ui.style('chip'), label: h.leave.label }).on('pointertap', () => plugins.scenemanager.go(h.leave.to)))
  leave.position.set(h.leave.at[0], h.leave.at[1])

  const role = row.data.role === null ? undefined : k.roles[row.data.role]
  if (!role) return
  const line = ui.show('hud', 'role', () => new PIXI.Text({ style: ui.style('score') }))
  line.text = h.role.text.replace('{name}', role.name)
  line.position.set(h.role.at[0], h.role.at[1])
  const help = ui.show('hud', 'help', () => new PIXI.Text({ style: ui.style('help') }))
  help.text = role.help
  help.position.set(h.help.at[0], h.help.at[1])

  const count = (kind: string) => wire.rows.filter(r => r.kind === kind).length
  const pile = wire.rows.find(r => r.kind === 'pile')
  const status = ui.show('hud', 'status', () => new PIXI.Text({ style: ui.style('score') }))
  status.text = h.status.text
    .replace('{harvest}', String(pile ? pile.data.items.length : 0))
    .replace('{bugs}', String(count('bug')))
    .replace('{manure}', String(count('manure')))
  status.position.set(h.status.at[0], h.status.at[1])
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
