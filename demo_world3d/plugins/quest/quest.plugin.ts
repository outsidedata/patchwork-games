// The browser half of quest (`quest.sim.ts` says what quest is and every part of a quests file), loaded by `shipped`
// (`world.shipped.plugins`). In a scene with a story row it draws, on the ui's panels, from the seat's own `player`
// row, the story row and the people's rows:
//   prompt   while the seat could talk to someone or use something (its row's `near`) and is not talking: the story's
//            definition's `hud.prompt.text`, its `{verb}` the definition's `hud.prompt.talk` for a person or the
//            spot's own `verb`, its `{name}` the person's or the spot's name, at `hud.prompt.at`, its `anchor`.
//   talk     while it talks (its row's `talk`), a modal: a box of `hud.talk.size` in `hud.talk.fill`, the name of who
//            it talks to at `hud.talk.who` and the line said at `hud.talk.say`, and a button for each reply the line
//            offers now, from `hud.talk.replies` down `hud.talk.gap` a button, which sends `reply` with its number; a
//            line that offers none has the one button `hud.talk.leave`, which sends `leave`. The ui's `back` is the
//            game's on it, which the player's look binds to `leave`.
//   journal  each quest at a stage its file gives text for, its title and that text, from `hud.journal.at` down
//            `hud.journal.entry` a quest under the heading `hud.journal.heading`; under them the heading
//            `hud.journal.carrying` and each item the seat holds, `hud.journal.count` with its `{name}` and `{n}`, down
//            `hud.journal.gap` an item.
//   marks    over each person, the first of the file's `marks` for it that holds, pinned `hud.mark.lift` metres over
//            where npc3d's body says it stands now (on the clock of the frame's `npc3d` row).
// And it plays the file's `watch`: each clip played through world3d's `clip` the frame its `if` comes to hold, and
// stopped the frame it stops holding (every watched clip starts off).
// Its panels and styles are `world.ui`'s: `quest.prompt`, `quest.talk` (a modal), `quest.journal` and `quest.marks`
// (at the canvas's top left, so a pinned thing stands on its canvas point); the styles `quest.prompt`, `quest.who`,
// `quest.say`, `quest.reply`, `quest.title`, `quest.text`, `quest.heading` and `quest.mark`. It shows in its `tick`, so
// `shipped` is listed after `ui`.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { possessed } from '#plugins/player/player.plugin.ts'
import { bodyOf } from '#plugins/npc3d/npc3d.sim.ts'
import { holds, peopleOf, quests, replies, storyOf, type Reading } from './quest.sim.ts'

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k) => String(values[k]))

export function quest() {
  // each watched clip's state as last played, by its number in the file's `watch`
  const played = new Map<number, boolean>()
  return {
    tick(plugins: Plugins) {
      const wire = plugins.wire
      const rows = wire.rows as Row[]
      const story = storyOf({ all: kind => rows.filter(r => r.kind === kind) })
      const me = possessed(rows)
      if (!story || !me) return
      const q = quests(wire, story)
      const d = def(wire, story.kind).hud
      const r: Reading = { me, story, people: peopleOf(rows) }
      const { ui } = plugins
      const { Text, Graphics } = ui.PIXI as typeof PIXI
      const at = <T extends PIXI.Container>(c: T, [x, y]: number[]): T => { c.position.set(x, y); return c }

      const near = me.data.near as { to: string; ask: string } | null
      const talk = me.data.talk as { to: string; line: number } | null
      const nameOf = (to: string) => q.people[to]?.name ?? q.spots[to].name

      if (near && !talk) {
        const verb = q.people[near.to] ? d.prompt.talk : q.spots[near.to].verb
        const t = at(ui.show('quest.prompt', 'prompt', () => new Text({ text: '', style: ui.style('quest.prompt'), anchor: d.prompt.anchor })), d.prompt.at)
        t.text = fill(d.prompt.text, { verb, name: nameOf(near.to) })
      }

      if (talk) {
        // the box first, so it lies under what is shown on it
        ui.show('quest.talk', 'back', () => new Graphics().rect(0, 0, d.talk.size[0], d.talk.size[1]).fill(d.talk.fill))
        const offered = replies(q, r, talk.line)
        offered.forEach((p, i) => {
          at(ui.show('quest.talk', `reply.${talk.line}.${i}.${p.ask}`, () => ui.button({ ...ui.style('quest.reply'), label: p.say }).on('pointertap', () => plugins.player.reply(i))), [d.talk.replies[0], d.talk.replies[1] + i * d.talk.gap])
        })
        if (!offered.length) at(ui.show('quest.talk', `leave.${talk.line}`, () => ui.button({ ...ui.style('quest.reply'), label: d.talk.leave }).on('pointertap', () => plugins.player.leave())), d.talk.replies)
        at(ui.show('quest.talk', 'who', () => new Text({ text: '', style: ui.style('quest.who') })), d.talk.who).text = nameOf(talk.to)
        at(ui.show('quest.talk', 'say', () => new Text({ text: '', style: ui.style('quest.say') })), d.talk.say).text = q.lines[talk.line].say
      }

      const j = d.journal
      let y = j.at[1]
      const line = (key: string, style: string, text: string, step: number) => {
        at(ui.show('quest.journal', key, () => new Text({ text: '', style: ui.style(style) })), [j.at[0], y]).text = text
        y += step
      }
      const begun = Object.entries(q.quests).filter(([key, quest]) => quest.stages[String(me.data.state[key] ?? 0)] !== undefined)
      if (begun.length) line('heading', 'quest.heading', j.heading, j.gap)
      for (const [key, quest] of begun) {
        line(`${key}.title`, 'quest.title', quest.title, j.gap)
        line(`${key}.text`, 'quest.text', quest.stages[String(me.data.state[key])], j.entry - j.gap)
      }
      const held = Object.entries(q.items).filter(([key]) => (me.data.state[key] ?? 0) > 0)
      if (held.length) line('carrying', 'quest.heading', j.carrying, j.gap)
      for (const [key, item] of held) line(`item.${key}`, 'quest.text', fill(j.count, { name: item.name, n: me.data.state[key] }), j.gap)

      const clock = rows.find(row => row.kind === 'npc3d')?.data.time ?? 0
      for (const [who, row] of r.people) {
        const mark = q.marks.find(m => m.who === who && holds(r, m.if))
        if (!mark) continue
        const [x, fy, z] = bodyOf(row.kind, def(wire, row.kind)).where(row, clock)
        const t = ui.show('quest.marks', `mark.${who}`, () => new Text({ text: '', style: ui.style('quest.mark'), anchor: 0.5 }))
        t.text = mark.show
        ui.pin(t, [x, fy + d.mark.lift, z])
      }

      q.watch.forEach((w, i) => {
        const on = holds(r, w.if)
        if ((played.get(i) ?? false) === on) return
        played.set(i, on)
        plugins.world3d.clip(w.clip.thing, w.clip.clip, on)
      })
    },
  }
}
