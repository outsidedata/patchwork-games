// The pick screen (`menu.sim.ts`), drawn by every page for its own seat on the ui's `menu` panel, a
// modal: it opens by itself the first frame a seat that has not picked yet is seen (its `player` row's
// `picked`), closes by itself the frame the seat has picked, however it picked, and opens on the
// panel's key, `m`, after; `back` closes it. Everything is placed by the `menu`
// definition, inside the panel's `size`:
//   background  the panel filled in `background`, the `title` across it at `titleAt` in the `big` style.
//   FLY         a button `flySize` at `flyAt`, shown first so the menu opens with it focused: pressed, it
//               sends the seat's `pick` act with the plane, mission and start chosen and closes the menu.
//   planes      a card `cardSize` for each of `planes`, side by side from `cardAt`, `cardGap` apart: its
//               picture (`picture`, a ui texture, drawn `pictureSize` once it has landed), its `name` at
//               `nameAt` down it in `style`, and at `statsAt` its top and stall speed at y = 0, worked
//               out from its sheet (flight3d's `topSpeed` and `stallSpeed`), in `small`. Pressed, a card
//               is the plane chosen.
//   missions    a button `missionSize` for each of `missions`, side by side from `missionAt`,
//               `missionGap` apart, its `label` in `style`. Pressed, it is the mission chosen.
//   starts      a button `startSize` for each of `starts`, side by side from `startAt`, `startGap` apart,
//               its `label` in `style`. Pressed, it is where the plane starts: on the ramp, or flying.
// The plane, mission and start chosen are outlined `edge` pixels wide in `chosen`; until something is
// pressed they are the ones the seat flies. Buttons are filled `fill`, and `focus` while focused. What
// is chosen is the page's, never sent until FLY.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { airframeOf, stallSpeed, topSpeed, type Flight } from '#plugins/flight3d/flight3d.sim.ts'
import { possessed } from '#plugins/player/player.plugin.ts'

type Chosen = { plane: number; mission: number; start: number; picked: boolean }
// The plane, mission and start chosen on each page, by its ui: two pages in one process share this module.
const chosen = new WeakMap<object, Chosen>()

export function setup(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind)
  // The loader writes a failure to the console once itself.
  for (const p of k.planes) plugins.loader.load(p.picture).catch(() => {})
}

export function tick(row: Row, plugins: Plugins) {
  const { ui, wire, loader } = plugins
  const me = possessed(wire.rows)
  if (!ui || !me) return
  const k = def(wire, row.kind)
  let c = chosen.get(ui)
  if (!c) {
    const place = (list: { type?: string; name?: string }[], v: string) => Math.max(0, list.findIndex(x => (x.type ?? x.name) === v))
    c = { plane: place(k.planes, me.data.type), mission: place(k.missions, me.data.mission), start: place(k.starts, me.data.from), picked: me.data.picked }
    chosen.set(ui, c)
    if (!me.data.picked) ui.open(k.panel)
  }
  // A seat that has just picked, by FLY or by the playtester, has no menu up.
  if (me.data.picked && !c.picked) ui.dismiss(k.panel)
  c.picked = me.data.picked
  if (!ui.opened(k.panel)) return
  const { PIXI } = ui
  const [width, height] = wire.scene.world!.ui.panels[k.panel].size
  ui.show(k.panel, 'background', () => new PIXI.Graphics().rect(0, 0, width, height).fill({ color: k.background }))
  const title = ui.show(k.panel, 'title', () => new PIXI.Text({ style: ui.style(k.big), anchor: { x: 0.5, y: 0 } }))
  title.text = k.title
  title.position.set(k.titleAt[0], k.titleAt[1])
  const fly = ui.show(k.panel, 'fly', () => ui.button({ size: k.flySize, fill: k.fill, focus: k.focus, text: ui.style(k.big), label: 'FLY' })
    .on('pointertap', () => {
      const now = chosen.get(ui)!
      plugins.player.pick(now.plane, now.mission, now.start)
      ui.dismiss(k.panel)
    }))
  fly.position.set(k.flyAt[0], k.flyAt[1])
  const f = wire.scene.world!.flight3d as Flight
  k.planes.forEach((p: { type: string; name: string; picture: string }, i: number) => {
    const card = ui.show(k.panel, `plane ${p.type}`, () => {
      const b = ui.button({ size: k.cardSize, fill: k.fill, focus: k.focus, text: ui.style(k.style), label: '' })
      b.addChild(new PIXI.Sprite())
      b.addChild(new PIXI.Text({ style: ui.style(k.style), anchor: { x: 0.5, y: 0 } }))
      b.addChild(new PIXI.Text({ style: ui.style(k.small), anchor: { x: 0.5, y: 0 } }))
      return b.on('pointertap', () => { chosen.get(ui)!.plane = i })
    })
    card.position.set(k.cardAt[0] + i * (k.cardSize[0] + k.cardGap), k.cardAt[1])
    const [picture, name, stats] = card.children.slice(-3)
    if (loader.ready(p.picture)) picture.texture = loader.get(p.picture)
    picture.width = k.pictureSize[0]
    picture.height = k.pictureSize[1]
    picture.position.set((k.cardSize[0] - k.pictureSize[0]) / 2, 6)
    name.text = p.name
    name.position.set(k.cardSize[0] / 2, k.nameAt)
    const t = airframeOf(f, p.type)
    stats.text = `top ${topSpeed(t, f.air.density).toFixed(0)} m/s · stall ${stallSpeed(t, f.gravity, f.air.density).toFixed(0)} m/s`
    stats.position.set(k.cardSize[0] / 2, k.statsAt)
  })
  k.missions.forEach((m: { name: string; label: string }, i: number) => {
    const b = ui.show(k.panel, `mission ${m.name}`, () => ui.button({ size: k.missionSize, fill: k.fill, focus: k.focus, text: ui.style(k.style), label: m.label })
      .on('pointertap', () => { chosen.get(ui)!.mission = i }))
    b.position.set(k.missionAt[0] + i * (k.missionSize[0] + k.missionGap), k.missionAt[1])
  })
  k.starts.forEach((s: { name: string; label: string }, i: number) => {
    const b = ui.show(k.panel, `start ${s.name}`, () => ui.button({ size: k.startSize, fill: k.fill, focus: k.focus, text: ui.style(k.style), label: s.label })
      .on('pointertap', () => { chosen.get(ui)!.start = i }))
    b.position.set(k.startAt[0] + i * (k.startSize[0] + k.startGap), k.startAt[1])
  })
  // The plane, mission and start chosen, outlined.
  const outline = (key: string, at: number[], size: number[]) => {
    const g = ui.show(k.panel, key, () => new PIXI.Graphics())
    g.clear().rect(at[0] - k.edge, at[1] - k.edge, size[0] + 2 * k.edge, size[1] + 2 * k.edge).stroke({ color: k.chosen, width: k.edge })
  }
  outline('chosen plane', [k.cardAt[0] + c.plane * (k.cardSize[0] + k.cardGap), k.cardAt[1]], k.cardSize)
  outline('chosen mission', [k.missionAt[0] + c.mission * (k.missionSize[0] + k.missionGap), k.missionAt[1]], k.missionSize)
  outline('chosen start', [k.startAt[0] + c.start * (k.startSize[0] + k.startGap), k.startAt[1]], k.startSize)
}

export function remove() {}
