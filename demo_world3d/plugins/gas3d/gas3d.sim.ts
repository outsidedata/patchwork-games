// gas3d: demo_world3d's own plugin, the game's abilities system, after Unreal's Gameplay Ability System (core issue
// #67): attributes, the effects that change them, tags, abilities, and cues. This file is its server half; its page
// half, `gas3d.plugin.ts`, draws the cues. Every number is in its file, a loader `json` entry the scene names in
// `world.gas3d.file`:
//   effects    `{ <name>: effect }`, each the only thing that changes an attribute:
//                duration   `instant` (changes the attribute's base for good), `timed` (on for `for` seconds) or
//                           `until` (on until taken off)
//                for        a timed effect's seconds
//                every      seconds: a timed or until effect with one applies its modifiers to the base once each
//                           `every` seconds it is on (a burn, a regeneration), and modifies nothing while on
//                modifiers  `[{ attribute, add?, multiply? }]`: an instant one, or each period of one with `every`,
//                           adds `add` to the base, or multiplies it by `multiply`; a timed or until one without
//                           `every` adds and multiplies the attribute's value while it is on; an instant one's `plus`
//                           `{ attribute, times }` grows its `add` by `times` the value of that attribute on the row
//                           the effect came `by` (a blow's damage by its striker's `power`)
//                tags       the tags it grants while on
//   abilities  `{ <name>: ability }`, what a body can do:
//                press      the motion3d key the ability plays, for a body motion3d plays (its clip is the move that
//                           key plays)
//                clip       the anim clip the ability plays, for a body anim plays (a mob's)
//                cost       `{ <attribute>: amount }`, taken from the base when it starts; it does not start
//                           without that much
//                cooldown   seconds: it grants the tag `cooldown.<name>` that long, and does not start while it is on
//                blocked    tags that stop it starting while any is on
//                delivery   `{ reach }`, metres: the nearest body in front of the user within that reach, at the
//                           clip's blow; `{ bolt, range }`: a volley3d round of the pattern `bolt` fired at the
//                           user's target, or the nearest body in front within `range`, at the clip's blow;
//                           `{ radius }`, metres: every body within that many metres of the user, at the clip's
//                           blow; `{ self: true }`: the user itself, at the clip's blow
//                effects    the effects applied to what it lands on
//   cues       `{ <tag>: <particle3d effect> }`, what a body looks like while it has a tag (the page half's)
//   cap        `{ <attribute>: <attribute> }`: an attribute's base is kept between 0 and the one named here
//              (health by maxHealth); one not named is kept at 0 or over
//   abilitySets  `{ <name>: { abilities?, effects? } }`, Lyra's ability sets (`ULyraAbilitySet`): abilities granted
//              and effects put on together, and taken back together by the handles giving them handed out (what
//              equipment grants, `plugins/equipment`). Lyra's third list, attribute sets, is a body's `attributes`
//              here, so a set grants none.
//
// A body's state is its row's `gas`: `{ base: { <attribute>: number }, active: [{ id, effect, left, next, by }],
// granted: [{ id, ability }], next }`, every attribute's base, the effects on it (each with the seconds `left` of a
// timed one, the seconds to its `next` period, and the row it came `by`), the abilities ability sets have granted
// it beside its definition's, and the id the next one gets. Every seat is sent it. A cooldown is an entry of `active`
// whose `effect` is `#cooldown.<ability>`, granting that tag and modifying nothing.
//   giveSet(w, row, set)        the ability set given: its abilities granted, its effects put on; its handles
//                               `{ abilities, effects }`, the ids each was given.
//   takeSet(w, row, handles)      what giving a set handed out taken back.
//   granted(row)                the abilities ability sets have granted the row.
//   dispel(w, row, tag)         every effect on the row that grants the tag taken off.
// `value`, `tags` and `fileOf` read from the truth or from a page's rows alike.
//   start(attributes, effects)  a body's first `gas`: the attributes' bases, the effects named on.
//   value(row, attribute)       the attribute's value: its base, plus every add of the effects on it that modify
//                               while on, times every multiply of them.
//   tags(w, row)                every tag the effects on it grant, and its cooldowns' tags.
//   apply(w, row, effect, by)   the effect put on: an instant one's modifiers laid on the base, any other added to
//                               `active`; the id it was given there, its handle, or undefined for an instant one.
//   step(w, row, dt)            once a step: every effect on it a step older, each period of one with `every` laid
//                               on the base, a timed one taken off once its seconds are up, and every base kept
//                               within its cap.
//   blocked(w, row, ability)    why the ability may not start, or undefined when it may: a tag of its `blocked`,
//                               its cooldown, or too little of an attribute its cost names.
//   commit(w, row, ability)     the ability started: its cost taken and its cooldown put on.
//   receive(w, row, ability, by)  every effect of the ability put on the row.
//   abilityOf(w, name), fileOf(w)  the file's ability of that name, and the file.
//   blowAt(rig, body, clip)     when the clip's blow lands, seconds in: the frame on which the fastest of its hands
//                               and feet moves furthest, read off the rig's measured `ends` (a punch's fist, a
//                               kick's foot, a bite's lunge).
//   lands(rig, body, clip, t, was)  whether the clip's blow lands on the step its playhead went from `was` to `t`.
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export type Modifier = { attribute: string; add?: number; multiply?: number; plus?: { attribute: string; times: number } }
export type Effect = { duration: 'instant' | 'timed' | 'until'; for?: number; every?: number; modifiers?: Modifier[]; tags?: string[] }
export type Delivery = { reach: number } | { bolt: string; range: number } | { radius: number } | { self: true }
export type Ability = { press?: string; clip?: string; cost?: Record<string, number>; cooldown?: number; blocked?: string[]; delivery: Delivery; effects: string[] }
export type AbilitySet = { abilities?: string[]; effects?: string[] }
export type File = { effects: Record<string, Effect>; abilities: Record<string, Ability>; cues: Record<string, string>; cap: Record<string, string>; abilitySets: Record<string, AbilitySet> }
export type Active = { id: number; effect: string; left: number | null; next: number | null; by: number }
export type Gas = { base: Record<string, number>; active: Active[]; granted: { id: number; ability: string }[]; next: number }
export type Handles = { abilities: number[]; effects: number[] }

export const fileOf = (from: W | Wire): File => json(from, ('find' in from ? from.world : from.scene.world!).gas3d.file)

const effectOf = (from: W | Wire, name: string): Effect => {
  const e = fileOf(from).effects[name]
  if (!e) throw new Error(`gas3d: the file has no effect ${name}`)
  return e
}

export function abilityOf(w: W, name: string): Ability {
  const a = fileOf(w).abilities[name]
  if (!a) throw new Error(`gas3d: the file has no ability ${name}`)
  return a
}

const gasOf = (row: Row): Gas => {
  const g = row.data.gas as Gas | undefined
  if (!g) throw new Error(`gas3d: ${row.kind} ${row.id} has no gas`)
  return g
}

// A modifier laid on the base, its `plus` read off `from`, the row the effect came by.
function lay(w: W, g: Gas, m: Modifier, from?: Row) {
  const was = g.base[m.attribute] ?? 0
  const plus = m.plus && from ? m.plus.times * value(w, from, m.plus.attribute) : 0
  g.base[m.attribute] = (was + (m.add ?? 0) + plus) * (m.multiply ?? 1)
}

// Every base kept within 0 and its cap, the cap's value with the effects on it (a jerkin's maxHealth).
function capped(w: W, row: Row) {
  const g = gasOf(row)
  const cap = fileOf(w).cap
  for (const a of Object.keys(g.base)) {
    const top = cap[a] === undefined || g.base[cap[a]] === undefined ? Infinity : value(w, row, cap[a])
    g.base[a] = Math.min(top, Math.max(0, g.base[a]))
  }
}

// A body's first `gas`, its attributes' bases and its effects on.
export function start(w: W, row: Row, attributes: Record<string, number>, effects: string[] = []) {
  row.data.gas = { base: { ...attributes }, active: [], granted: [], next: 1 } satisfies Gas
  for (const e of effects) apply(w, row, e, row.id)
}

export function value(from: W | Wire, row: Row, attribute: string): number {
  const g = gasOf(row)
  let add = 0, multiply = 1
  for (const a of g.active) {
    if (a.effect.startsWith('#')) continue
    const e = effectOf(from, a.effect)
    if (e.every !== undefined) continue
    for (const m of e.modifiers ?? []) if (m.attribute === attribute) {
      add += m.add ?? 0
      multiply *= m.multiply ?? 1
    }
  }
  return ((g.base[attribute] ?? 0) + add) * multiply
}

export function tags(from: W | Wire, row: Row): string[] {
  return [...new Set(gasOf(row).active.flatMap(a => (a.effect.startsWith('#') ? [a.effect.slice(1)] : effectOf(from, a.effect).tags ?? [])))]
}

export function apply(w: W, row: Row, name: string, by: number): number | undefined {
  const g = gasOf(row)
  const e = effectOf(w, name)
  if (e.duration === 'instant') {
    const from = e.modifiers?.some(m => m.plus) ? w.get(by) : undefined
    for (const m of e.modifiers ?? []) lay(w, g, m, from)
    capped(w, row)
    return undefined
  }
  if (e.duration === 'timed' && e.for === undefined) throw new Error(`gas3d: the timed effect ${name} gives no for`)
  const id = g.next++
  g.active.push({ id, effect: name, left: e.duration === 'timed' ? e.for! : null, next: e.every ?? null, by })
  return id
}

// An effect on for a while, granting its tags: a cooldown, put on by name with no effect of the file.
function timedTag(g: Gas, tag: string, seconds: number, by: number) {
  g.active.push({ id: g.next++, effect: `#${tag}`, left: seconds, next: null, by })
}

export function step(w: W, row: Row, dt: number) {
  const g = gasOf(row)
  for (const a of g.active) {
    if (a.effect.startsWith('#')) { a.left! -= dt; continue }
    const e = effectOf(w, a.effect)
    if (a.next !== null) {
      a.next -= dt
      while (a.next <= 0 && (a.left === null || a.left > 0)) {
        for (const m of e.modifiers ?? []) lay(w, g, m)
        a.next += e.every!
      }
    }
    if (a.left !== null) a.left -= dt
  }
  g.active = g.active.filter(a => a.left === null || a.left > 0)
  capped(w, row)
}

export function blocked(w: W, row: Row, name: string): string | undefined {
  const a = abilityOf(w, name)
  const on = tags(w, row)
  const tag = (a.blocked ?? []).find(t => on.includes(t))
  if (tag) return `blocked by ${tag}`
  if (on.includes(`cooldown.${name}`)) return 'cooling down'
  const g = gasOf(row)
  for (const [attribute, amount] of Object.entries(a.cost ?? {})) if ((g.base[attribute] ?? 0) < amount) return `too little ${attribute}`
  return undefined
}

export function commit(w: W, row: Row, name: string) {
  const a = abilityOf(w, name)
  const g = gasOf(row)
  for (const [attribute, amount] of Object.entries(a.cost ?? {})) g.base[attribute] = (g.base[attribute] ?? 0) - amount
  if (a.cooldown) timedTag(g, `cooldown.${name}`, a.cooldown, row.id)
  capped(w, row)
}

export function receive(w: W, row: Row, name: string, by: number) {
  for (const e of abilityOf(w, name).effects) apply(w, row, e, by)
}

export function giveSet(w: W, row: Row, name: string): Handles {
  const s = fileOf(w).abilitySets[name]
  if (!s) throw new Error(`gas3d: the file has no ability set ${name}`)
  const g = gasOf(row)
  const abilities = (s.abilities ?? []).map(ability => {
    abilityOf(w, ability)
    const id = g.next++
    g.granted = [...g.granted, { id, ability }]
    return id
  })
  const effects = (s.effects ?? []).map(e => {
    if (effectOf(w, e).duration === 'instant') throw new Error(`gas3d: the ability set ${name} puts on ${e}, an instant effect, which nothing could take back`)
    return apply(w, row, e, row.id)!
  })
  capped(w, row)
  return { abilities, effects }
}

export function takeSet(w: W, row: Row, h: Handles) {
  const g = gasOf(row)
  g.granted = g.granted.filter(a => !h.abilities.includes(a.id))
  g.active = g.active.filter(a => !h.effects.includes(a.id))
  capped(w, row)
}

// Every effect on the row that grants the tag taken off (a ward spent).
export function dispel(w: W, row: Row, tag: string) {
  const g = gasOf(row)
  g.active = g.active.filter(a => a.effect.startsWith('#') || !(effectOf(w, a.effect).tags ?? []).includes(tag))
}

export const granted = (row: Row): string[] => gasOf(row).granted.map(a => a.ability)

// The limbs a blow lands with: each hand's and foot's segment of a rig's measured `ends`.
const LIMBS = ['handL', 'handR', 'footL', 'footR']
const blows = new WeakMap<object, Map<string, number>>()

// When a clip's blow lands: the time of the frame whose step the fastest of its hands and feet moves its far end
// furthest on, read off the rig's measured `ends` for `body` (anim's or motion3d's rig, `ends[body][clip]`).
export function blowAt(rig: { ends?: Record<string, Record<string, any>> }, body: string, clip: string): number {
  let times = blows.get(rig)
  if (!times) blows.set(rig, (times = new Map()))
  const had = times.get(clip)
  if (had !== undefined) return had
  const e = rig.ends?.[body]?.[clip]
  if (!e) throw new Error(`gas3d: the rig measures no ends of ${clip} for ${body}; bake it`)
  let best = 0, at = 0
  for (const limb of LIMBS) {
    const f: number[][] = e[limb]
    for (let i = 1; i < f.length; i++) {
      const step = math.hypot(f[i][3] - f[i - 1][3], f[i][4] - f[i - 1][4], f[i][5] - f[i - 1][5])
      if (step > best) { best = step; at = i / e.fps }
    }
  }
  times.set(clip, at)
  return at
}

// Whether a clip's blow lands this step: its playhead went from before `blowAt` to it or past, `was` being the clip
// and playhead the step before.
export function lands(rig: { ends?: Record<string, Record<string, any>> }, body: string, clip: string, t: number, was: { clip: unknown; t: number }): boolean {
  const at = blowAt(rig, body, clip)
  const from = was.clip === clip ? was.t : 0
  return from < at && t >= at
}
