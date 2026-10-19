// The title's card, on the UI's modal `title` panel, every place and word of it the `titlecard`
// definition's:
// - the sky over the grass, `sky` [sky, grass] split at `horizon`;
// - the game's `name` at `nameAt` in the `name` style, and the `tagline` under it at `taglineAt`;
// - a button for each of `roles`, its `label` at `at`, `size`, in `fill` and `focus`, which takes the
//   seat to the scene `to` names as the role `with` names (core's `go`, its args the `player` row's
//   `arrive`); the modal focuses the first, so Enter or Space presses it as a click does, and the
//   arrows move the focus between them;
// - Sound, a button at `sound.at`, `sound.size`, which opens the menu `sound.opens` names
//   (`settings.client.ts`);
// - when a role's button was pressed and the page is still on the title `full.after` seconds of the
//   page's steps later, the field had no seat free: `full.text` at `full.at` in the `full` style, until
//   the next press;
// - a little farm on the grass, drawn from the UI's own sheets (`sheets`): each role's `figure`, its
//   sheet's clip playing at `at`, `scale` times its size, under its button; and the ripe stage of each
//   of `crops.clips` in a row from `crops.from`, `crops.gap` apart; each frame's anchor, its feet, on
//   its point;
// - `help` at `helpAt` in the `help` style.
// The farm plays its clips at the sheets' own times. The song is the game's `jukebox` plugin's.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def, play } from '#plugins/loader/loader.sim.ts'

// Each clip's frame and time shown, by the thing's key.
let frames: Record<string, [number, number]> = {}
// The page's seconds since a role's button was last pressed, or null since none was.
let since: number | null = null

export function setup() {
  frames = {}
  since = null
}

// One frame of a sheet's clip as a UI sprite, `key` on the panel, its anchor on (x, y).
function figure(plugins: Plugins, key: string, sheetName: string, clip: string, at: number[], scale: number, still?: number) {
  const { ui, loader, wire } = plugins
  const s = loader.get(sheetName)
  if (!s) {
    void loader.load(sheetName)
    return
  }
  let i: number
  if (still === undefined) {
    const [f, ft] = frames[key] ?? [0, 0]
    frames[key] = play(s.data, clip, f, ft, wire.scene.prefabs.engine.dt)
    i = frames[key][0]
  } else i = still
  const frame = s.frameOf(clip, 0, i)
  const sprite = ui.show('title', key, () => new ui.PIXI.Sprite())
  sprite.texture = s.texture(frame.id)
  sprite.anchor.set(frame.anchor[0] / frame.size[0], frame.anchor[1] / frame.size[1])
  sprite.scale.set(scale)
  sprite.roundPixels = true
  sprite.position.set(at[0], at[1])
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind), { ui } = plugins, { PIXI } = ui
  const { width, height, dt } = plugins.wire.scene.prefabs.engine
  ui.show('title', 'sky', () => new PIXI.Graphics().rect(0, 0, width, k.horizon).fill(k.sky[0]).rect(0, k.horizon, width, height - k.horizon).fill(k.sky[1]))

  const name = ui.show('title', 'name', () => new PIXI.Text({ text: k.name, style: ui.style('name'), anchor: 0.5 }))
  name.position.set(k.nameAt[0], k.nameAt[1])
  const tagline = ui.show('title', 'tagline', () => new PIXI.Text({ text: k.tagline, style: ui.style('tagline'), anchor: 0.5 }))
  tagline.position.set(k.taglineAt[0], k.taglineAt[1])

  for (const r of k.roles) {
    const button = ui.show('title', `role-${r.with}`, () =>
      ui.button({ size: r.size, radius: 4, fill: k.fill, focus: k.focus, label: r.label, text: ui.style('button') })
        .on('pointertap', () => {
          since = 0
          plugins.scenemanager.go(k.to, r.with)
        }))
    button.position.set(r.at[0], r.at[1])
  }
  const sound = ui.show('title', 'sound', () =>
    ui.button({ size: k.sound.size, radius: 4, fill: k.fill, focus: k.focus, label: k.sound.label, text: ui.style('button') })
      .on('pointertap', () => ui.open(k.sound.opens)))
  sound.position.set(k.sound.at[0], k.sound.at[1])

  if (since !== null) since += dt
  if (since !== null && since >= k.full.after) {
    const full = ui.show('title', 'full', () => new PIXI.Text({ text: k.full.text, style: ui.style('full'), anchor: 0.5 }))
    full.position.set(k.full.at[0], k.full.at[1])
  }

  for (const r of k.roles) figure(plugins, `figure-${r.with}`, k.sheets[r.figure.sheet], r.figure.clip, r.figure.at, r.figure.scale)
  const crops = plugins.loader.get(k.sheets.crops)
  k.crops.clips.forEach((clip: string, i: number) => {
    const ripe = crops ? crops.data.clips[clip].runs[0].length - 1 : 0
    figure(plugins, `crop-${clip}`, k.sheets.crops, clip, [k.crops.from[0] + i * k.crops.gap, k.crops.from[1]], 1, ripe)
  })

  const help = ui.show('title', 'help', () => new PIXI.Text({ text: k.help, style: ui.style('help'), anchor: 0.5 }))
  help.position.set(k.helpAt[0], k.helpAt[1])
}

export function remove() {}
