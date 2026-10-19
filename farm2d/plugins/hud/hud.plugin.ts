// The browser half of hud, farm2d's own plugin for what is drawn over the field for the seat this page
// plays: loaded by `shipped`, listed after `ui`, whose panel `hud` it shows its things on in its
// `tick`. It reads the seat's own `player` row (`possessed`), the thing that row holds, and the rows of
// the field, and every place, size, colour and word is the `player` definition's `hud`, its `roles`,
// or the definition of the kind it is drawing (`plugins/chores` says what the role's verb would do):
//
// - The card (`card`), at the panel's top left: a plate `card.size` in `card.fill`, edged in
//   `card.edge`, `card.edgeWidth` wide and rounded `card.radius`, at `card.at`; on it the thing the
//   seat plays, its clip `roles.<role>.portrait` playing from the UI's own copy of its sheet
//   (`sheets`, by the thing's sheet) with its feet on `card.portrait`; the role's `name` at
//   `card.name` in the `roleName` style; and under it, at `card.task` in the `task` style, its task
//   now, the one of `roles.<role>.tasks` its state names (below).
// - The tray (`tray`), at the panel's top right: a plate drawn as the card's, at `tray.at`, with
//   `tray.counts`, each an icon (its `sheet`'s `clip`, from the UI's sheets, its anchor on `icon`)
//   and a count at `text` in the `count` style, of `harvest` the produce on the pile, `bugs` the bugs
//   in the field, or `manure` the manure lying in it; and two buttons in the `chip` style, the
//   speaker at `tray.sound.at`, which opens the menu `tray.sound.opens` names (`settings.client.ts`),
//   as Escape does, and the house at `tray.leave.at`, which takes the seat to the scene
//   `tray.leave.to` names, whatever it played staying in the field and its brain playing it on.
// - The prompt (`prompt`), over the thing the seat plays while its verb would do something there:
//   a plate `prompt.height` tall and the verb's own `width` across (`verbs.<verb>`), drawn as the
//   card's, standing `prompt.lift` pixels over the thing's mark (its definition's `mark.lift`), or
//   `prompt.below` under its feet where it would reach up into the card or the tray; on it the key, `key.text`
//   in the `key` style on a cap `key.size` at `key.at` in `key.fill`, and the verb's `text` at
//   `prompt.verbAt` in the `verb` style.
// - The marker (`marker`), on where the task points until the verb would do the task's own work where
//   the thing stands (a farmer carrying manure off the soil still sees the soil marked, its prompt
//   saying Drop): an arrow `marker.arrow` [across, down] pixels pointing down at it, its tip
//   `marker.lift.<kind>` pixels over the target's feet and bobbing `marker.bob` pixels up and down
//   `marker.rate` times a second, in `marker.fill` edged in `marker.edge`.
// While the seat has no role yet, only the tray.
//
// The task, the verb and the target, by the role:
//   farmer   carrying produce: `stash`, the pile, the verb `stash` within reach of it and `drop`
//            short of it. Carrying manure: `plant`, the free soil nearest, the verb `plant` on free
//            soil and `drop` off it. Carrying nothing: of what it can pick up, the nearest, `pick` a
//            ripe crop, `gather` produce lying loose, `fetch` manure, the verb `pick` with any within
//            reach; with none, `wait`.
//   cow      chewing: `chew`. Else of the grass grown tall, the nearest, `graze`, the verb `eat`
//            within reach of one; with none grown, `rest`.
//   chicken  of the bugs in its yard, the nearest, `hunt`, the verb `peck` within reach of one while
//            it is not pecking; with none, `guard`.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { def, play, tiled } from '#plugins/loader/loader.sim.ts'
import { cellOf, closest, free, grazing, inYard, middle, pileWithin, prey, things, within, type All, type Cell } from '../chores/chores.sim.ts'

type Plate = { size: number[]; radius: number; fill: string; edge: string; edgeWidth: number }
// What the role's work is now: its task, what Space would do, whether that is the task's own work done
// where it stands (`there`), and where the work is.
type Work = { task: string; verb?: string; there?: boolean; target?: { pos: number[]; kind: string } }

export function hud() {
  let t = 0
  let frame: [number, number] = [0, 0]
  let clip = ''

  // A rounded plate drawn as the card is.
  const plate = (P: any, p: Plate, size = p.size) =>
    new P.Graphics().roundRect(0, 0, size[0], size[1], p.radius).fill(p.fill).stroke({ color: p.edge, width: p.edgeWidth })

  function work(p: Plugins, seat: Row, thing: Row): Work {
    const rows = p.wire.rows, all: All = kind => rows.filter(r => r.kind === kind)
    const k = def(p.wire, thing.kind), d = thing.data, pos: number[] = d.pos
    if (seat.data.role === 'farmer') {
      if (d.carry !== null && d.carry !== 'manure') {
        const pile = all('pile')[0], there = !!pileWithin(all, pos, k.reach)
        return { task: 'stash', verb: there ? 'stash' : 'drop', there, target: pile && { pos: pile.data.pos, kind: 'pile' } }
      }
      const map = tiled(p.wire, p.wire.scene.world!.tilemap.file)
      if (d.carry === 'manure') {
        let best: Cell | undefined, gap = Infinity
        for (let r = 0; r < map.height; r++) {
          for (let c = 0; c < map.width; c++) {
            const cell: Cell = [c, r], m = middle(cell), g = Math.hypot(m[0] - pos[0], m[1] - pos[1])
            if (g < gap && free(map, k.soil, all, cell)) { gap = g; best = cell }
          }
        }
        const there = free(map, k.soil, all, cellOf(pos))
        return { task: 'plant', verb: there ? 'plant' : 'drop', there, target: best && { pos: middle(best), kind: 'soil' } }
      }
      const it = closest(pos, things(all))
      if (!it) return { task: 'wait' }
      const task = it.kind === 'crop' ? 'pick' : it.kind === 'produce' ? 'gather' : 'fetch'
      const there = within(pos, things(all), k.reach).length > 0
      return { task, verb: there ? 'pick' : undefined, there, target: { pos: it.data.pos, kind: it.kind } }
    }
    if (seat.data.role === 'cow') {
      if (d.chew > 0) return { task: 'chew' }
      const grass = closest(pos, all('grass').filter(g => g.data.grown))
      if (!grass) return { task: 'rest' }
      const there = !!grazing(all, pos, k.reach)
      return { task: 'graze', verb: there ? 'eat' : undefined, there, target: { pos: grass.data.pos, kind: 'grass' } }
    }
    const bug = closest(pos, all('bug').filter(b => inYard(k.bounds, k.reach, b.data.pos)))
    if (!bug) return { task: 'guard' }
    const there = d.peck <= 0 && !!prey(all, pos, k.reach)
    return { task: 'hunt', verb: there ? 'peck' : undefined, there, target: { pos: bug.data.pos, kind: 'bug' } }
  }

  function tray(p: Plugins, h: any) {
    const { ui, wire, loader } = p, P = ui.PIXI as any, tr = h.tray
    ui.show('hud', 'tray', () => plate(P, h.plate, tr.size)).position.set(tr.at[0], tr.at[1])
    const rows = wire.rows, pile = rows.find(r => r.kind === 'pile')
    const counts: Record<string, number> = {
      harvest: pile ? pile.data.items.length : 0,
      bugs: rows.filter(r => r.kind === 'bug').length,
      manure: rows.filter(r => r.kind === 'manure').length,
    }
    for (const c of tr.counts) {
      const s = loader.get(c.sheet)
      if (!s) void loader.load(c.sheet)
      else {
        const f = s.frameOf(c.clip, 0, 0)
        const icon = ui.show('hud', `${c.of}-icon`, () => new P.Sprite())
        icon.texture = s.texture(f.id)
        icon.anchor.set(f.anchor[0] / f.size[0], f.anchor[1] / f.size[1])
        icon.roundPixels = true
        icon.position.set(tr.at[0] + c.icon[0], tr.at[1] + c.icon[1])
      }
      const n = ui.show('hud', c.of, () => new P.Text({ style: ui.style('count') }))
      n.text = String(counts[c.of])
      n.position.set(tr.at[0] + c.text[0], tr.at[1] + c.text[1])
    }
    ui.show('hud', 'sound', () => ui.button({ ...ui.style('chip'), label: tr.sound.label }).on('pointertap', () => ui.open(tr.sound.opens)))
      .position.set(tr.at[0] + tr.sound.at[0], tr.at[1] + tr.sound.at[1])
    ui.show('hud', 'leave', () => ui.button({ ...ui.style('chip'), label: tr.leave.label }).on('pointertap', () => p.scenemanager.go(tr.leave.to)))
      .position.set(tr.at[0] + tr.leave.at[0], tr.at[1] + tr.leave.at[1])
  }

  function card(p: Plugins, h: any, role: any, thing: Row, now: Work) {
    const { ui, loader, wire } = p, P = ui.PIXI as any, c = h.card
    ui.show('hud', 'card', () => plate(P, h.plate, c.size)).position.set(c.at[0], c.at[1])
    const name = h.sheets[wire.scene.world!.sprite2d.kinds[thing.kind].sheet ?? thing.data.sheet]
    const s = loader.get(name)
    if (!s) void loader.load(name)
    else {
      if (clip !== role.portrait) { clip = role.portrait; frame = [0, 0] }
      frame = play(s.data, clip, frame[0], frame[1], wire.scene.prefabs.engine.dt)
      const f = s.frameOf(clip, 0, frame[0])
      const portrait = ui.show('hud', 'portrait', () => new P.Sprite())
      portrait.texture = s.texture(f.id)
      portrait.anchor.set(f.anchor[0] / f.size[0], f.anchor[1] / f.size[1])
      portrait.roundPixels = true
      portrait.position.set(c.at[0] + c.portrait[0], c.at[1] + c.portrait[1])
    }
    const title = ui.show('hud', 'role', () => new P.Text({ style: ui.style('roleName') }))
    title.text = role.name
    title.position.set(c.at[0] + c.name[0], c.at[1] + c.name[1])
    const task = ui.show('hud', 'task', () => new P.Text({ style: ui.style('task') }))
    task.text = role.tasks[now.task]
    task.position.set(c.at[0] + c.task[0], c.at[1] + c.task[1])
  }

  function prompt(p: Plugins, h: any, thing: Row, verb: string) {
    const { ui, wire } = p, P = ui.PIXI as any, q = h.prompt, v = h.verbs[verb]
    const shown = ui.show('hud', 'prompt', () => {
      const box = new P.Container()
      box.addChild(new P.Graphics(), new P.Graphics(), new P.Text({ style: ui.style('key') }), new P.Text({ style: ui.style('verb') }))
      return box
    })
    const [back, cap, key, word] = shown.children
    const up = def(wire, thing.kind).mark.lift + q.lift + q.height
    const clear = Math.max(h.card.at[1] + h.card.size[1], h.tray.at[1] + h.tray.size[1])
    const over = ui.project(thing.data.pos).y - up >= clear
    const y0 = over ? -up : q.below
    back.clear().roundRect(-v.width / 2, y0, v.width, q.height, h.plate.radius).fill(h.plate.fill).stroke({ color: h.plate.edge, width: h.plate.edgeWidth })
    cap.clear().roundRect(-v.width / 2 + q.key.at[0], y0 + q.key.at[1], q.key.size[0], q.key.size[1], q.key.radius).fill(q.key.fill)
    key.text = q.key.text
    key.anchor.set(0.5, 0.5)
    key.position.set(-v.width / 2 + q.key.at[0] + q.key.size[0] / 2, y0 + q.key.at[1] + q.key.size[1] / 2)
    word.text = v.text
    word.position.set(-v.width / 2 + q.verbAt[0], y0 + q.verbAt[1])
    ui.pin(shown, thing.data.pos)
  }

  function marker(p: Plugins, h: any, target: { pos: number[]; kind: string }) {
    const { ui } = p, P = ui.PIXI as any, m = h.marker
    const shown = ui.show('hud', 'marker', () => {
      const box = new P.Container()
      const [w, d] = m.arrow
      box.addChild(new P.Graphics().poly([-w / 2, -d, w / 2, -d, 0, 0]).fill(m.fill).stroke({ color: m.edge, width: 1 }))
      return box
    })
    shown.children[0].position.set(0, -m.lift[target.kind] + Math.round(Math.sin(t * m.rate * 2 * Math.PI) * m.bob))
    ui.pin(shown, target.pos)
  }

  return {
    tick(p: Plugins) {
      const { wire } = p
      t += wire.scene.prefabs.engine.dt
      const seat = possessed(wire.rows)
      if (!seat) return
      const k = def(wire, seat.kind), h = k.hud
      tray(p, h)
      const role = seat.data.role === null ? undefined : k.roles[seat.data.role]
      const thing = seat.data.held && wire.rows.find(r => r.id === seat.data.held.id && r.kind === seat.data.held.kind)
      if (!role || !thing) return
      const now = work(p, seat, thing)
      card(p, h, role, thing, now)
      if (now.verb) prompt(p, h, thing, now.verb)
      if (now.target && !now.there) marker(p, h, now.target)
    },
  }
}
