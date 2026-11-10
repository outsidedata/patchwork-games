// hud: demo_world3d's own plugin, everything the hills draw over the game for the seat to read or press (core issue
// #67), the screens of the "Hills UI" design. It has no server half and no row: it draws the seat's own `player` row
// (`possessed`) and the rows round it, on core's ui plugin (`plugins.ui`), every frame it wants a thing shown. It has
// no numbers of its own: every place, size, colour and word is the `player` definition's `hud` entry, and the panels,
// keys and text styles are `world.ui`'s. Its pieces, each on the panel of its name:
//   classes    a screen while its row has no `class`: each class of the classes file (`plugins/classes`), what it
//              does and its stats, pressed to play as it (the hero's `pickClass`); nothing else is drawn till then
//   you        its class's name, the seat's health and mana, as bars with their numbers
//   target     the row the seat targets: its name, health, and each tag on it with the seconds it has left
//   gold       the gold it carries
//   tracker    each quest it has taken, with each objective's count, and "done" once it may be handed in
//   loot       what it has just been given (gold, items), for `loot.life` seconds after it was given
//   bars       its abilities, each with its key, a cooldown's seconds over it and its cost; and its quick bar, each
//              slot pressed to hold it, the one in its hands lit
//   world      over each talker and each living mob: its name (a mob's in `plates.hostile`), a talker's title, a
//              mob's health bar once it is hurt or targeted, a "!" over one that has a quest for the seat and a "?"
//              over one it may hand one in to; the target's ring is hero's. And each fall of a row's health, and each
//              rise of the seat's own, as a number rising from it for `float.life` seconds.
//   boss       the name and health of a boss (a definition saying `boss`) while its fight is on (smartai's
//              `script.fighting`); and over any scripted row's head, on `world`, what it says (smartai's `said`)
//   talk       what it is told and the choices, each pressed to choose it (talk's `talking`)
//   bag        a menu the seat opens: every instance it carries, by quality, marked on the bar, worn or enchanted;
//              the one selected's card, with what it does and what may be done with it
//   character  a menu: what it has equipped, and each attribute's base, what its gear adds and the total
//   quests     a menu: each quest it has taken, and the selected one's text, objectives and reward
//   forge      a menu: every recipe it knows, its reagents against what it carries, and whether it is at the
//              recipe's focus; pressed to forge
//   shop, trainer, enchanter   screens the game puts up while its row's `serving` says so: a vendor's stock, the
//              bag's items to sell and the buyback; a trainer's recipes; an enchanter's enchants and the weapons
//              each may go on. `back` leaves them, the hero's `leave`
//   death      a screen while it is dead, its button the hero's `release`
// Whatever it does, it does through the hero's acts (`plugins/hero/hero.sim.ts`), sent with the player plugin.
// It shows things in its `tick`, so `shipped` is listed after `ui`.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { possessed } from '#plugins/player/player.plugin.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import { fileOf as gasFile, granted, value } from '../gas3d/gas3d.sim.ts'
import { definitionOf, fragment, type Entry } from '../inventory/inventory.sim.ts'
import { COMPLETE, INCOMPLETE, NONE, REWARDED, progress, questsOf, status } from '../quests/quests.sim.ts'
import { listOf, stockOf, type Back } from '../vendor/vendor.sim.ts'
import { recipesOf, trainerOf } from '../crafting/crafting.sim.ts'
import { enchanterOf, enchantsOf } from '../enchanting/enchanting.sim.ts'
import { where } from '../mmo3d/mmo3d.sim.ts'
import { fact } from '../factsdb/factsdb.sim.ts'
import { classOf, classesOf } from '../classes/classes.sim.ts'

type At = [number, number]
type Floater = { id: number; at: number[]; text: string; style: string; born: number }

// A line with each `{name}` filled in from `by`.
const fill = (line: string, by: Record<string, string | number>) => line.replace(/\{(\w+)\}/g, (_, k) => String(by[k]))
const num = (n: number) => String(Math.round(n * 10) / 10)

export function hud() {
  const taps = new Map<string, () => void>()
  const healthOf = new Map<number, number>()
  let floaters: Floater[] = []
  let made = 0
  let seen: { gold: number; ids: Set<number> } | undefined
  let loot: { text: string; born: number } | undefined
  let picked: number | null = null
  let quest: string | null = null
  let weapon: number | null = null

  return {
    tick(plugins: Plugins) {
      const { ui, wire } = plugins
      const me = possessed(wire.rows)
      if (!me || !me.data.inventory) return
      const P = ui.PIXI as typeof PIXI
      const h = def(wire, me.kind).hud
      const now = performance.now() / 1000
      const send = plugins.player as Record<string, (...a: any[]) => void>

      const place = <T extends PIXI.Container>(c: T, p: At): T => { c.position.set(p[0], p[1]); return c }
      const text = (panel: string, key: string, style: string, p: At, words: string, colour?: string) => {
        const t = place(ui.show(panel, key, () => new P.Text({ text: '', style: ui.style(style) })), p)
        t.text = words
        if (colour) t.style.fill = colour
        return t
      }
      const box = (panel: string, key: string, p: At, size: At, look: { fill: string; alpha?: number; line?: string; radius?: number }) => {
        const g = place(ui.show(panel, key, () => new P.Graphics()), p)
        g.clear().roundRect(0, 0, size[0], size[1], look.radius ?? 0).fill({ color: look.fill, alpha: look.alpha ?? 1 })
        if (look.line) g.stroke({ color: look.line, width: 1 })
        return g
      }
      const bar = (panel: string, key: string, style: string, p: At, k: number, colour: string) => {
        place(ui.show(panel, key, () => ui.bar(ui.style(style))), p).set(Math.max(0, Math.min(1, k)), { color: colour })
      }
      const button = (panel: string, key: string, style: string, label: string, p: At, tap: () => void) => {
        const id = `${panel}/${key}`
        taps.set(id, tap)
        const b = place(ui.show(panel, key, () => ui.button({ ...ui.style(style), label }).on('pointertap', () => taps.get(id)?.())), p)
        return b
      }
      // A thing pressed: a box drawn each frame that the pointer hits.
      const hit = (panel: string, key: string, p: At, size: At, look: { fill: string; alpha?: number; line?: string; radius?: number }, tap: () => void) => {
        const id = `${panel}/${key}`
        taps.set(id, tap)
        const g = place(ui.show(panel, key, () => {
          const n = new P.Graphics()
          n.eventMode = 'static'
          n.cursor = 'pointer'
          n.on('pointertap', () => taps.get(id)?.())
          return n
        }), p)
        g.clear().roundRect(0, 0, size[0], size[1], look.radius ?? 0).fill({ color: look.fill, alpha: look.alpha ?? 1 })
        if (look.line) g.stroke({ color: look.line, width: 2 })
        return g
      }

      // No class yet: the screen to pick one, and nothing else.
      if (me.data.class === null) {
        const c = h.classes
        text('classes', 'title', 'death', c.title, h.words.pickClass).anchor.set(0.5, 0)
        Object.entries(classesOf(wire)).forEach(([id, k], i) => {
          const x = c.first[0] + i * c.step
          box('classes', `${id}.back`, [x, c.first[1]], c.size, { ...h.window, line: h.colours.edge })
          text('classes', `${id}.name`, 'title', [x + c.pad, c.first[1] + c.pad], k.name)
          const about = text('classes', `${id}.about`, 'body', [x + c.pad, c.first[1] + c.about], k.about)
          about.style.wordWrap = true
          about.style.wordWrapWidth = c.size[0] - 2 * c.pad
          text('classes', `${id}.stats`, 'small', [x + c.pad, c.first[1] + c.stats], Object.entries(k.attributes).filter(([a]) => c.shown.includes(a)).map(([a, n]) => `${h.attributes[a]} ${n}`).join(h.words.join))
          button('classes', `${id}.pick`, 'wide', fill(h.words.playAs, { name: k.name }), [x + c.pad, c.first[1] + c.button], () => send.pickClass(id))
        })
        return
      }
      if (!me.data.gas) return
      const gas = gasFile(wire)
      const items = (id: string) => definitionOf(wire, id)
      const quality = (id: string) => h.quality[fragment(wire, id, 'quality')?.grade ?? 'common']
      const entries = me.data.inventory.entries as Entry[]
      const equipped = me.data.equipment as { definition: string; instance: number }[]
      const bar1 = me.data.quickbar as { slots: (number | null)[]; active: number }
      const goldOf = entries.filter(e => e.instance.definition === 'gold').reduce((n, e) => n + e.count, 0)
      const carried = entries.filter(e => e.instance.definition !== 'gold')
      const isWorn = (id: number) => equipped.some(e => e.instance === id) && !bar1.slots.includes(id)
      const said = (m: { attribute: string; add?: number; multiply?: number }) =>
        fill(m.add !== undefined ? h.words.add : h.words.multiply, { sign: (m.add ?? 0) < 0 ? '' : '+', n: num(m.add ?? m.multiply ?? 0), attribute: h.attributes[m.attribute] ?? m.attribute })
      const equipFile = json(wire, wire.scene.world!.equipment.file).equipment as Record<string, { abilitySets: string[] }>
      const setSays = (set: string) => (gas.abilitySets[set].effects ?? []).flatMap(e => (gas.effects[e].modifiers ?? []).map(said))
      const wornSays = (id: string) => {
        const e = fragment(wire, id, 'equippable')
        return e ? equipFile[e.equipment].abilitySets.flatMap(setSays) : []
      }

      // you
      const hp = value(wire, me, 'health'), hpMax = value(wire, me, 'maxHealth')
      const mp = value(wire, me, 'mana'), mpMax = value(wire, me, 'maxMana')
      box('you', 'back', [0, 0], h.you.size, h.panel)
      text('you', 'name', 'name', h.you.name, classOf(wire, me.data.class).name)
      bar('you', 'health', 'health', h.you.health, hp / hpMax, h.colours.health)
      text('you', 'healthN', 'barnumber', h.you.healthN, fill(h.words.of, { n: num(hp), most: num(hpMax) })).anchor.set(0.5)
      bar('you', 'mana', 'mana', h.you.mana, mp / mpMax, h.colours.mana)
      text('you', 'manaN', 'barnumber', h.you.manaN, fill(h.words.of, { n: num(mp), most: num(mpMax) })).anchor.set(0.5)

      // the target
      const target = me.data.target === null ? undefined : wire.rows.find(r => r.id === me.data.target)
      if (target?.data.gas) {
        const t = h.target
        const th = value(wire, target, 'health'), tm = value(wire, target, 'maxHealth')
        box('target', 'back', [0, 0], t.size, { ...h.panel, line: h.colours.hostile })
        text('target', 'name', 'name', t.name, h.plates[target.kind]?.name ?? target.kind, h.colours.hostileName)
        text('target', 'health', 'small', t.healthN, fill(h.words.of, { n: num(th), most: num(tm) }))
        bar('target', 'bar', 'targetHealth', t.health, th / tm, h.colours.health)
        const on = (target.data.gas.active as { effect: string; left: number | null }[]).filter(a => !a.effect.startsWith('#') && gas.effects[a.effect].tags?.length)
        on.forEach((a, i) => text('target', `tag.${i}`, 'tag', [t.tags[0] + i * t.tagStep, t.tags[1]], fill(a.left === null ? h.words.tag : h.words.tagLeft, { tag: h.tags[gas.effects[a.effect].tags![0]] ?? gas.effects[a.effect].tags![0], left: num(a.left ?? 0) })))
      }

      // gold
      box('gold', 'back', [0, 0], h.gold.size, h.panel)
      text('gold', 'n', 'gold', h.gold.n, fill(h.words.gold, { n: goldOf }))

      // the quest tracker
      const taken = Object.entries(questsOf(wire)).filter(([id]) => [INCOMPLETE, COMPLETE].includes(status(me, id)))
      taken.forEach(([id, q], i) => {
        const y = i * h.tracker.step
        text('tracker', `${id}.title`, 'trackTitle', [0, y], q.title)
        const line = status(me, id) === COMPLETE ? h.words.handIn : progress(wire, me, id).map(p => fill(h.words.objective, { what: h.plates[p.what]?.name ?? items(p.what).name, has: p.has, count: p.count })).join(h.words.join)
        text('tracker', `${id}.line`, 'small', [0, y + h.tracker.line], line)
      })

      // what was just given
      const ids = new Set(carried.map(e => e.instance.id))
      if (seen) {
        const got = carried.filter(e => !seen!.ids.has(e.instance.id)).map(e => fill(h.words.lootItem, { name: items(e.instance.definition).name, count: e.count }))
        const coins = goldOf - seen.gold
        if (coins > 0) got.unshift(fill(h.words.lootGold, { n: coins }))
        if (got.length) loot = { text: got.join(h.words.join), born: now }
      }
      seen = { gold: goldOf, ids }
      if (loot && now - loot.born < h.loot.life) text('loot', 'line', 'loot', h.loot.at, loot.text).anchor.set(0.5, 0)

      // abilities and the quick bar
      const abilities = [...classOf(wire, me.data.class).abilities, ...granted(me)]
      const keyOf = (press: string) => (def(wire, me.kind).keys.motions[press] ?? []).find((k: string) => !k.startsWith('Pad') && !k.startsWith('Mouse'))?.toUpperCase() ?? ''
      abilities.forEach((name, i) => {
        const a = gas.abilities[name]
        const x = i * h.bars.step
        box('bars', `${name}.back`, [x, 0], h.bars.size, h.slot)
        text('bars', `${name}.name`, 'small', [x + h.bars.name[0], h.bars.name[1]], h.abilities[name] ?? name).anchor.set(0.5, 0)
        text('bars', `${name}.key`, 'key', [x + h.bars.key[0], h.bars.key[1]], a.press ? keyOf(a.press) : '')
        const cost = Object.values(a.cost ?? {})[0]
        if (cost !== undefined) text('bars', `${name}.cost`, 'cost', [x + h.bars.cost[0], h.bars.cost[1]], String(cost))
        const cd = (me.data.gas.active as { effect: string; left: number | null }[]).find(e => e.effect === `#cooldown.${name}`)
        if (cd?.left) {
          box('bars', `${name}.cd`, [x, 0], h.bars.size, h.cooling)
          text('bars', `${name}.cdN`, 'cooldown', [x + h.bars.size[0] / 2, h.bars.size[1] / 2], num(cd.left)).anchor.set(0.5)
        }
      })
      bar1.slots.forEach((id, i) => {
        const x = h.bars.quick[0] + i * h.bars.quickStep
        const e = id === null ? undefined : entries.find(n => n.instance.id === id)
        hit('bars', `quick.${i}`, [x, h.bars.quick[1]], h.bars.quickSize, { ...h.slot, line: i === bar1.active ? h.colours.lit : h.colours.edge }, () => send.hold(i === bar1.active ? -1 : i))
        text('bars', `quick.${i}.n`, 'key', [x + h.bars.key[0], h.bars.quick[1] + h.bars.key[1]], String(i + 1))
        if (e) text('bars', `quick.${i}.item`, 'tiny', [x + h.bars.quickSize[0] / 2, h.bars.quick[1] + h.bars.quickSize[1] / 2], items(e.instance.definition).name, quality(e.instance.definition)).anchor.set(0.5)
      })

      // over the world
      const kinds = Object.keys(h.plates)
      for (const r of wire.rows) {
        if (!kinds.includes(r.kind) || r.data.dead) continue
        const p = h.plates[r.kind]
        const at = [r.data.pos[0], r.data.pos[1] + p.up, r.data.pos[2]]
        const hostile = !!r.data.gas
        const name = ui.show('world', `${r.id}.name`, () => new P.Text({ text: '', style: ui.style('plate') }))
        name.text = p.name
        name.style.fill = hostile ? h.colours.hostileName : h.colours.friendlyName
        name.anchor.set(0.5, 1)
        ui.pin(name, at)
        if (p.title) {
          const t = ui.show('world', `${r.id}.title`, () => new P.Text({ text: '', style: ui.style('plateTitle') }))
          t.text = p.title
          t.anchor.set(0.5, 0)
          ui.pin(t, at)
        }
        if (hostile) {
          const k = value(wire, r, 'health') / value(wire, r, 'maxHealth')
          if (k < 1 || r.id === me.data.target) {
            const b = ui.show('world', `${r.id}.bar`, () => ui.bar(ui.style('plateHealth')))
            b.set(k, { color: h.colours.health })
            b.pivot.set(h.plateBar[0], h.plateBar[1])
            ui.pin(b, at)
          }
        } else {
          const mark = markOf(r)
          if (mark) {
            const m = ui.show('world', `${r.id}.mark`, () => new P.Text({ text: '', style: ui.style('mark') }))
            m.text = mark
            m.anchor.set(0.5, 1)
            m.pivot.set(0, h.markUp)
            ui.pin(m, at)
          }
        }
      }
      function markOf(r: Row): string | undefined {
        for (const [id, q] of Object.entries(questsOf(wire))) {
          if (q.enders.includes(r.kind) && status(me!, id) === COMPLETE) return h.words.handInMark
          if (q.starters.includes(r.kind) && status(me!, id) === NONE && (q.prev === null || status(me!, q.prev) === REWARDED)) return h.words.questMark
        }
        return undefined
      }

      // what a scripted row says, over its head (smartai's `said`), and the bar of a boss in its fight
      for (const r of wire.rows) {
        if (!r.data.script) continue
        if (r.data.said) {
          const s = ui.show('world', `${r.id}.said`, () => new P.Text({ text: '', style: ui.style('say') }))
          s.text = r.data.said.line
          s.anchor.set(0.5, 1)
          s.pivot.set(0, h.sayUp)
          ui.pin(s, [r.data.pos[0], r.data.pos[1] + (h.plates[r.kind]?.up ?? 0), r.data.pos[2]])
        }
        if (def(wire, r.kind).boss && r.data.script.fighting && !r.data.dead) {
          const b = h.boss
          box('boss', 'back', [0, 0], b.size, { ...h.panel, line: h.colours.hostile })
          text('boss', 'name', 'title', b.name, h.plates[r.kind]?.name ?? r.kind, h.colours.hostileName).anchor.set(0.5, 0)
          bar('boss', 'bar', 'bossHealth', b.bar, value(wire, r, 'health') / value(wire, r, 'maxHealth'), h.colours.health)
        }
      }

      // health falling and rising, as numbers
      for (const r of wire.rows) {
        if (!r.data.gas) continue
        const now1 = value(wire, r, 'health')
        const was = healthOf.get(r.id)
        healthOf.set(r.id, now1)
        if (was === undefined || was === now1) continue
        const at = [r.data.pos[0], r.data.pos[1] + h.float.up, r.data.pos[2]]
        if (now1 < was) floaters.push({ id: made++, at, text: num(was - now1), style: r.id === me.id ? 'hurtSelf' : 'hurt', born: now })
        else if (r.id === me.id) floaters.push({ id: made++, at, text: fill(h.words.heal, { n: num(now1 - was) }), style: 'heal', born: now })
      }
      floaters = floaters.filter(f => now - f.born < h.float.life)
      for (const f of floaters) {
        const t = ui.show('world', `float.${f.id}`, () => new P.Text({ text: '', style: ui.style(f.style) }))
        t.text = f.text
        t.anchor.set(0.5, 1)
        t.pivot.set(0, (now - f.born) * h.float.rise)
        ui.pin(t, f.at)
      }

      // the talk box
      const talking = me.data.talking as { with: number; line: string; choices: { say: string }[] } | null
      if (talking) {
        const tk = h.talk
        const speaker = wire.rows.find(r => r.id === talking.with)
        box('talk', 'back', [0, 0], tk.size, { ...h.window, line: h.colours.edge })
        text('talk', 'who', 'title', tk.who, speaker ? h.plates[speaker.kind]?.name ?? speaker.kind : '')
        text('talk', 'leave', 'small', tk.leave, h.words.talkLeave).anchor.set(1, 0)
        const line = text('talk', 'line', 'line', tk.line, talking.line)
        line.style.wordWrap = true
        line.style.wordWrapWidth = tk.wrap
        talking.choices.forEach((c, i) => {
          hit('talk', `choice.${i}`, [tk.choices[0], tk.choices[1] + i * tk.choiceStep], tk.choiceSize, { ...h.slot, line: h.colours.edge }, () => send.choose(i))
          text('talk', `choice.${i}.n`, 'key', [tk.choices[0] + tk.choiceN[0], tk.choices[1] + i * tk.choiceStep + tk.choiceN[1]], String(i + 1))
          text('talk', `choice.${i}.say`, 'body', [tk.choices[0] + tk.choiceSay[0], tk.choices[1] + i * tk.choiceStep + tk.choiceSay[1]], c.say)
        })
      }

      // a window's frame and title
      const frame = (panel: string, size: At, title: string, hint: string) => {
        box(panel, 'back', [0, 0], size, { ...h.window, line: h.colours.edge })
        text(panel, 'title', 'title', h.frame.title, title)
        text(panel, 'hint', 'small', [size[0] - h.frame.hint[0], h.frame.hint[1]], hint).anchor.set(1, 0)
      }
      const sells = me.data.serving?.what === 'vendor'

      // the bag
      if (ui.opened('bag')) {
        const b = h.bag
        frame('bag', b.size, h.words.bag, fill(h.words.gold, { n: goldOf }))
        carried.forEach((e, i) => {
          const id = e.instance.id
          const p: At = [b.grid[0] + (i % b.columns) * b.step, b.grid[1] + Math.floor(i / b.columns) * b.step]
          const d = e.instance.definition
          hit('bag', `${id}.slot`, p, b.cell, { ...h.slot, line: id === picked ? h.colours.picked : quality(d) }, () => { picked = id })
          text('bag', `${id}.name`, 'tiny', [p[0] + b.cell[0] / 2, p[1] + b.cell[1] / 2], items(d).name, quality(d)).anchor.set(0.5)
          if (e.count > 1) text('bag', `${id}.count`, 'key', [p[0] + b.countAt[0], p[1] + b.countAt[1]], String(e.count)).anchor.set(1, 1)
          const onBar = bar1.slots.indexOf(id)
          if (onBar >= 0) text('bag', `${id}.bar`, 'key', [p[0] + b.markAt[0], p[1] + b.markAt[1]], String(onBar + 1))
          else if (isWorn(id)) text('bag', `${id}.worn`, 'key', [p[0] + b.markAt[0], p[1] + b.markAt[1]], h.words.wornMark, h.colours.worn)
          if (e.instance.enchant) text('bag', `${id}.enchant`, 'key', [p[0] + b.enchantAt[0], p[1] + b.enchantAt[1]], h.words.enchantMark, h.colours.enchant)
        })
        const e = carried.find(n => n.instance.id === picked)
        if (e) {
          const c = b.card
          const d = e.instance.definition
          const id = e.instance.id
          box('bag', 'card', c.at, c.size, { ...h.window, line: quality(d) })
          text('bag', 'card.name', 'title', [c.at[0] + c.pad, c.at[1] + c.pad], items(d).name, quality(d))
          const grade = fragment(wire, d, 'quality')?.grade
          const cls = fragment(wire, d, 'equippable')?.class
          text('bag', 'card.kind', 'small', [c.at[0] + c.pad, c.at[1] + c.lines[0]], [grade && h.grades[grade], cls && h.classes[cls]].filter(Boolean).join(h.words.join))
          const lines = [...wornSays(d).map(s => fill(h.words.equipped, { what: s })), ...(e.instance.enchant ? setSays(e.instance.enchant.abilitySet).map(s => fill(h.words.enchanted, { name: enchantsOf(wire)[e.instance.enchant!.name].name, what: s })) : [])]
          lines.forEach((l, i) => text('bag', `card.line.${i}`, 'body', [c.at[0] + c.pad, c.at[1] + c.lines[1] + i * c.lineStep], l))
          const price = fragment(wire, d, 'price')
          if (price) text('bag', 'card.price', 'gold', [c.at[0] + c.pad, c.at[1] + c.lines[2]], fill(h.words.sellsFor, { n: price.sell * e.count }))
          const acts: [string, () => void][] = []
          const onBar = bar1.slots.indexOf(id)
          if (fragment(wire, d, 'equippable')) {
            if (onBar >= 0) acts.push([h.words.offBar, () => send.unslot(onBar)])
            else if (!equipped.some(q => q.instance === id) && bar1.slots.includes(null)) acts.push([h.words.onBar, () => send.slot(bar1.slots.indexOf(null), id)])
            if (isWorn(id)) acts.push([h.words.takeOff, () => send.takeOff(id)])
            else if (onBar < 0) acts.push([h.words.wear, () => send.wear(id)])
          }
          if (sells && price && onBar < 0 && !equipped.some(q => q.instance === id)) acts.push([h.words.sell, () => { send.sell(id); picked = null }])
          acts.push([h.words.drop, () => { send.drop(id); picked = null }])
          acts.forEach(([label, tap], i) => button('bag', `card.act.${label}`, 'button', label, [c.at[0] + c.pad + (i % 2) * c.actStep[0], c.at[1] + c.acts + Math.floor(i / 2) * c.actStep[1]], tap))
        }
      }

      // the character sheet
      if (ui.opened('character')) {
        const c = h.character
        frame('character', c.size, h.words.character, h.words.characterKey)
        text('character', 'equippedH', 'heading', c.equipped, h.words.equippedHeading)
        equipped.forEach((q, i) => {
          const e = entries.find(n => n.instance.id === q.instance)
          if (!e) return
          const y = c.equipped[1] + c.firstRow + i * c.rowStep
          const d = e.instance.definition
          box('character', `${q.instance}.back`, [c.equipped[0], y], c.rowSize, h.slot)
          text('character', `${q.instance}.name`, 'body', [c.equipped[0] + c.pad, y + c.pad], items(d).name, quality(d))
          const onBar = bar1.slots.indexOf(q.instance)
          text('character', `${q.instance}.where`, 'small', [c.equipped[0] + c.pad, y + c.whereY], onBar >= 0 ? fill(h.words.inHands, { slot: onBar + 1 }) : fill(h.words.wornIn, { class: h.classes[fragment(wire, d, 'equippable').class] }))
          if (onBar < 0) button('character', `${q.instance}.off`, 'button', h.words.takeOff, [c.equipped[0] + c.offX, y + c.pad], () => send.takeOff(q.instance))
        })
        text('character', 'attrH', 'heading', c.attributes, h.words.attributesHeading)
        h.columns.forEach((col: string, i: number) => text('character', `col.${i}`, 'small', [c.attributes[0] + c.cols[i], c.attributes[1] + c.firstRow], col))
        Object.keys(h.attributes).forEach((a, i) => {
          const y = c.attributes[1] + c.firstRow + (i + 1) * c.attrStep
          const base = me.data.gas.base[a] ?? 0
          const total = value(wire, me, a)
          text('character', `${a}.name`, 'body', [c.attributes[0] + c.cols[0], y], h.attributes[a])
          text('character', `${a}.base`, 'body', [c.attributes[0] + c.cols[1], y], num(base))
          text('character', `${a}.gear`, 'body', [c.attributes[0] + c.cols[2], y], total === base ? '' : fill(h.words.gear, { n: num(total - base) }), h.colours.worn)
          text('character', `${a}.total`, 'body', [c.attributes[0] + c.cols[3], y], num(total))
        })
      }

      // the quest log
      if (ui.opened('quests')) {
        const q = h.quests
        frame('quests', q.size, h.words.quests, h.words.questsKey)
        if (quest === null || !taken.some(([id]) => id === quest)) quest = taken[0]?.[0] ?? null
        taken.forEach(([id], i) => hit('quests', `${id}.pick`, [q.list[0], q.list[1] + i * q.listStep], q.listSize, { ...h.slot, line: id === quest ? h.colours.picked : h.colours.edge }, () => { quest = id }))
        taken.forEach(([id, t], i) => text('quests', `${id}.name`, 'body', [q.list[0] + q.pad, q.list[1] + i * q.listStep + q.pad], t.title, h.colours.lit))
        if (!taken.length) text('quests', 'none', 'body', q.list, h.words.noQuests)
        const t = quest === null ? undefined : questsOf(wire)[quest]
        if (t && quest !== null) {
          text('quests', 'q.title', 'title', q.title, t.title)
          const d = text('quests', 'q.details', 'line', q.details, t.details)
          d.style.wordWrap = true
          d.style.wordWrapWidth = q.wrap
          text('quests', 'q.todoH', 'heading', q.todo, h.words.todoHeading)
          const o = text('quests', 'q.objectives', 'body', [q.todo[0], q.todo[1] + q.lineStep], t.objectives)
          o.style.wordWrap = true
          o.style.wordWrapWidth = q.wrap
          progress(wire, me, quest).forEach((p, i) => {
            const y = q.todo[1] + q.progressY + i * q.lineStep
            bar('quests', `p.${i}`, 'progress', [q.todo[0], y], p.has / p.count, h.colours.lit)
            text('quests', `p.${i}.n`, 'body', [q.todo[0] + q.countX, y - q.countUp], fill(h.words.objective, { what: h.plates[p.what]?.name ?? items(p.what).name, has: p.has, count: p.count }))
          })
          text('quests', 'q.rewardH', 'heading', q.reward, h.words.rewardHeading)
          const rewards = [...(t.gold ? [fill(h.words.lootGold, { n: t.gold })] : []), ...t.rewards.map(r => fill(h.words.lootItem, { name: items(r.item).name, count: r.count }))]
          text('quests', 'q.reward', 'gold', [q.reward[0], q.reward[1] + q.lineStep], rewards.join(h.words.join))
          if (status(me, quest) === COMPLETE) text('quests', 'q.handIn', 'small', [q.reward[0], q.reward[1] + 2 * q.lineStep], fill(h.words.handInTo, { who: t.enders.map(k => h.plates[k]?.name ?? k).join(h.words.join) }))
        }
      }

      // the forge
      if (ui.opened('forge')) {
        const f = h.forge
        frame('forge', f.size, h.words.forge, h.words.forgeKey)
        const known = Object.entries(recipesOf(wire)).filter(([id]) => fact(me, `recipe.${id}`))
        if (!known.length) text('forge', 'none', 'body', f.first, h.words.noRecipes)
        known.forEach(([id, r], i) => {
          const y = f.first[1] + i * f.step
          box('forge', `${id}.back`, [f.first[0], y], f.rowSize, { ...h.slot, line: quality(r.creates.item) })
          text('forge', `${id}.name`, 'body', [f.first[0] + f.pad, y + f.pad], r.name, quality(r.creates.item))
          r.reagents.forEach((g, j) => {
            const has = entries.filter(e => e.instance.definition === g.item).reduce((n, e) => n + e.count, 0)
            text('forge', `${id}.${g.item}`, 'small', [f.first[0] + f.pad, y + f.reagents + j * f.reagentStep], fill(h.words.reagent, { name: items(g.item).name, has, count: g.count }), has >= g.count ? h.colours.enough : h.colours.short)
          })
          const at = r.focus ? where(wire, r.focus.at).at : undefined
          const near = !at || Math.hypot(me.data.pos[0] - at[0], me.data.pos[2] - at[2]) <= r.focus!.reach
          text('forge', `${id}.focus`, 'small', [f.first[0] + f.pad, y + f.focusY], near ? h.words.atFocus : h.words.notAtFocus, near ? h.colours.enough : h.colours.short)
          button('forge', `${id}.make`, 'button', h.words.forgeIt, [f.first[0] + f.makeX, y + f.pad], () => send.craft(id))
        })
      }

      // the service open: shop, trainer or enchanter
      const serving = me.data.serving as { what: string; with: number } | null
      const server = serving ? wire.rows.find(r => r.id === serving.with) : undefined
      if (serving && server) {
        const who = h.plates[server.kind]?.name ?? server.kind
        if (serving.what === 'vendor') {
          const s = h.shop
          frame('shop', s.size, who, fill(h.words.gold, { n: goldOf }))
          text('shop', 'saleH', 'heading', s.sale, h.words.forSale)
          listOf(wire, server.kind).forEach((sold, i) => {
            const y = s.sale[1] + s.firstRow + i * s.rowStep
            const left = stockOf(wire, server, sold.item)
            const price = fragment(wire, sold.item, 'price')
            box('shop', `sale.${i}.back`, [s.sale[0], y], s.rowSize, h.slot)
            text('shop', `sale.${i}.name`, 'body', [s.sale[0] + s.pad, y + s.pad], items(sold.item).name, quality(sold.item))
            text('shop', `sale.${i}.left`, 'small', [s.sale[0] + s.pad, y + s.leftY], left === Infinity ? h.words.always : left === 0 ? h.words.soldOut : fill(h.words.left, { n: left }))
            text('shop', `sale.${i}.price`, 'gold', [s.sale[0] + s.priceX, y + s.pad], String(price.buy))
            if (left > 0 && goldOf >= price.buy) button('shop', `sale.${i}.buy`, 'button', h.words.buy, [s.sale[0] + s.buyX, y + s.pad], () => send.buy(i, 1))
          })
          text('shop', 'sellH', 'heading', s.sell, h.words.sellHeading)
          const selling = carried.filter(e => fragment(wire, e.instance.definition, 'price') && !equipped.some(q => q.instance === e.instance.id) && !bar1.slots.includes(e.instance.id))
          selling.forEach((e, i) => {
            const y = s.sell[1] + s.firstRow + i * s.smallStep
            text('shop', `sell.${e.instance.id}.name`, 'body', [s.sell[0], y], fill(h.words.lootItem, { name: items(e.instance.definition).name, count: e.count }), quality(e.instance.definition))
            text('shop', `sell.${e.instance.id}.price`, 'gold', [s.sell[0] + s.sellPriceX, y], String(fragment(wire, e.instance.definition, 'price').sell * e.count))
            button('shop', `sell.${e.instance.id}.go`, 'button', h.words.sell, [s.sell[0] + s.sellX, y], () => send.sell(e.instance.id))
          })
          const back = me.data.buyback as Back[]
          const by = s.sell[1] + s.firstRow + selling.length * s.smallStep + s.backGap
          if (back.length) text('shop', 'backH', 'heading', [s.sell[0], by], h.words.buyBackHeading)
          back.forEach((b, i) => {
            const y = by + s.firstRow + i * s.smallStep
            text('shop', `back.${i}.name`, 'body', [s.sell[0], y], fill(h.words.lootItem, { name: items(b.instance.definition).name, count: b.count }), quality(b.instance.definition))
            text('shop', `back.${i}.price`, 'gold', [s.sell[0] + s.sellPriceX, y], String(b.price))
            if (goldOf >= b.price) button('shop', `back.${i}.go`, 'button', h.words.buyBack, [s.sell[0] + s.sellX, y], () => send.buyBack(i))
          })
        }
        if (serving.what === 'trainer') {
          const t = h.trainer
          frame('trainer', t.size, fill(h.words.teaches, { who }), fill(h.words.gold, { n: goldOf }))
          trainerOf(wire, server.kind).forEach((o, i) => {
            const y = t.first[1] + i * t.step
            const r = recipesOf(wire)[o.recipe]
            box('trainer', `${o.recipe}.back`, [t.first[0], y], t.rowSize, h.slot)
            text('trainer', `${o.recipe}.name`, 'body', [t.first[0] + t.pad, y + t.pad], r.name, quality(r.creates.item))
            text('trainer', `${o.recipe}.needs`, 'small', [t.first[0] + t.pad, y + t.needsY], r.reagents.map(g => fill(h.words.lootItem, { name: items(g.item).name, count: g.count })).join(h.words.join))
            if (fact(me, `recipe.${o.recipe}`)) text('trainer', `${o.recipe}.known`, 'body', [t.first[0] + t.costX, y + t.pad], h.words.known, h.colours.enough)
            else {
              text('trainer', `${o.recipe}.cost`, 'gold', [t.first[0] + t.costX, y + t.pad], String(o.cost))
              if (goldOf >= o.cost) button('trainer', `${o.recipe}.learn`, 'button', h.words.learn, [t.first[0] + t.learnX, y + t.pad], () => send.learn(o.recipe))
            }
          })
        }
        if (serving.what === 'enchanter') {
          const n = h.enchanter
          frame('enchanter', n.size, who, fill(h.words.gold, { n: goldOf }))
          const offered = enchanterOf(wire, server.kind)
          text('enchanter', 'enchantH', 'heading', n.enchants, h.words.enchantHeading)
          offered.forEach((id, i) => {
            const e = enchantsOf(wire)[id]
            const y = n.enchants[1] + n.firstRow + i * n.enchantStep
            box('enchanter', `${id}.back`, [n.enchants[0], y], n.enchantSize, { ...h.slot, line: h.colours.enchant })
            text('enchanter', `${id}.name`, 'title', [n.enchants[0] + n.pad, y + n.pad], e.name, h.colours.enchant)
            text('enchanter', `${id}.does`, 'small', [n.enchants[0] + n.pad, y + n.doesY], [h.classes[e.class], ...setSays(e.abilitySet)].join(h.words.join))
            e.reagents.forEach((g, j) => {
              const has = entries.filter(x => x.instance.definition === g.item).reduce((s, x) => s + x.count, 0)
              text('enchanter', `${id}.${g.item}`, 'small', [n.enchants[0] + n.pad, y + n.reagents + j * n.reagentStep], fill(h.words.reagent, { name: items(g.item).name, has, count: g.count }), has >= g.count ? h.colours.enough : h.colours.short)
            })
            text('enchanter', `${id}.fee`, 'small', [n.enchants[0] + n.pad, y + n.reagents + e.reagents.length * n.reagentStep], fill(h.words.fee, { n: e.gold }), goldOf >= e.gold ? h.colours.enough : h.colours.short)
          })
          const id = offered[0]
          if (id !== undefined) {
            const e = enchantsOf(wire)[id]
            const fits = carried.filter(x => fragment(wire, x.instance.definition, 'equippable')?.class === e.class)
            text('enchanter', 'onH', 'heading', n.weapons, fill(h.words.onWhich, { class: h.classes[e.class] }))
            if (weapon === null || !fits.some(x => x.instance.id === weapon)) weapon = fits[0]?.instance.id ?? null
            fits.forEach((x, i) => {
              const y = n.weapons[1] + n.firstRow + i * n.weaponStep
              hit('enchanter', `w.${x.instance.id}`, [n.weapons[0], y], n.weaponSize, { ...h.slot, line: x.instance.id === weapon ? h.colours.picked : h.colours.edge }, () => { weapon = x.instance.id })
              text('enchanter', `w.${x.instance.id}.name`, 'body', [n.weapons[0] + n.pad, y + n.pad], items(x.instance.definition).name, quality(x.instance.definition))
              text('enchanter', `w.${x.instance.id}.where`, 'small', [n.weapons[0] + n.whereX, y + n.pad], bar1.slots.includes(x.instance.id) ? h.words.inYourHands : isWorn(x.instance.id) ? h.words.worn : h.words.inBag)
            })
            const w = fits.find(x => x.instance.id === weapon)
            const y = n.weapons[1] + n.firstRow + fits.length * n.weaponStep + n.gap
            if (w?.instance.enchant) text('enchanter', 'replace', 'small', [n.weapons[0], y], fill(h.words.replaces, { name: enchantsOf(wire)[w.instance.enchant.name].name }), h.colours.short)
            if (w) button('enchanter', 'go', 'wide', fill(h.words.enchantFor, { n: e.gold }), [n.weapons[0], y + n.lineStep], () => send.enchant(id, w.instance.id))
          }
        }
      }

      // death
      if (me.data.dead) {
        const d = h.death
        text('death', 'title', 'death', d.title, h.words.died).anchor.set(0.5, 0)
        button('death', 'rise', 'wide', h.words.release, d.button, () => send.release())
      }
    },
  }
}
