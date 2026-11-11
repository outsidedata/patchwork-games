// talk: demo_world3d's own plugin, what people say, after Valve's rule-based dialogue (Elan Ruskin, "AI-driven Dynamic
// Dialog through Fuzzy Pattern Matching", GDC 2012, the response rules of Left 4 Dead 2) (core issue #67). This file
// is its server half; it has no page half. Its file is a loader `json` entry the scene names in `world.talk.file`:
//   rules  `[{ name, who, record, concept, criteria, say, remember, choices, actions }]`, Ruskin's rules:
//            who        the kind of the one speaking
//            record     the speaker's record within that kind (its row's `record`, `plugins/mmo3d`)
//            concept    what is being answered: `hello` when a player starts talking, else the concept of the
//                       choice the player picked
//            criteria   conditions every one of which must hold for the rule to match, each on the query:
//                         a factsdb condition (`plugins/factsdb`'s `holds`) on the player's facts, or the place's
//                         for a name `world.` starts: `graves.quest`, `!graves.cleared`, `killed.zombie >= 5`
//                         `gas.<attribute> <op> <number>`: the player's gas3d attribute (`plugins/gas3d`'s
//                         `value`), `gas.health < 3`
//                         `tag.<tag>` or `!tag.<tag>`: whether the player has that gas3d tag, `tag.burning`
//            say        the response's lines; one is said, picked with the truth's die
//            remember   `{ <fact>: number }` written once the rule is said (factsdb's `write`), Ruskin's facts a
//                       response applies
//            choices    `[{ say, concept }]`: what the player may answer, each answering with its concept
//            actions    `[{ <word>: <numbers> }]` done once the rule is said, each by its word:
//                         `effect`: `{ effect }`, a gas3d effect put on the player by the speaker
//                         `accept`: `{ quest }`, the quest taken from the speaker (`plugins/quests`'s `accept`)
//                         `reward`: `{ quest }`, the quest turned in to the speaker (`plugins/quests`'s `reward`)
//                         `vendor`, `trainer`, `enchanter`: `{}`, the speaker's shop (`plugins/vendor`), the
//                         recipes it teaches (`plugins/crafting`) or its enchants (`plugins/enchanting`) open to the
//                         player: its row's `serving` `{ what, with }`, until it is closed or the player is out of
//                         reach of the speaker
// A query is a concept asked of one speaker. Of the rules of the speaker's kind and record and that concept whose criteria all
// hold, the one with the most criteria answers, Ruskin's best match; of several with as many, one is picked with the
// truth's die. No rule matching, the talk ends.
//
// A `player` row's `talking` is null, or `{ with, rule, line, choices }`: the row it talks to, the rule that answered,
// the line said, and the choices it may pick. Its acts call these:
//   start(w, me, reach)   the nearest row of a kind the rules name within `reach` metres across the ground asked
//                         `hello`; nothing when none is.
//   choose(w, me, i)      the choice `i` of what was said asked of the same speaker.
//   end(me)               the talk over.
//   step(w, me, reach)    once a step: the talk over once its speaker is gone or further than `reach`.
//   serving(w, me, what, reach)  the speaker serving the player that service, while it does and is within reach.
//   speaker(w, id)        the row of that id of a kind the rules name, while it is there.
// `talker` is the rule of a kind that only stands and is talked to: a crowd3d person (`world.crowd3d.kinds`) its
// prefab stands on its clip. One that is a vendor (`plugins/vendor`) has its stock stepped, its prefab giving
// `clock` 0 and `stock` {}.
import type { Kind, Row, W } from '#engine/engine.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { holds, write } from '../factsdb/factsdb.sim.ts'
import { apply, tags, value } from '../gas3d/gas3d.sim.ts'
import { accept, reward } from '../quests/quests.sim.ts'
import { listOf, step as vendorStep } from '../vendor/vendor.sim.ts'

export type Choice = { say: string; concept: string }
export type Rule = {
  name: string
  who: string
  record: string
  concept: string
  criteria: string[]
  say: string[]
  remember: Record<string, number>
  choices: Choice[]
  actions: Record<string, any>[]
}
export type Talking = { with: number; rule: string; line: string; choices: Choice[] }
export type Serving = { what: 'vendor' | 'trainer' | 'enchanter'; with: number }

const rulesOf = (w: W): Rule[] => json(w, w.world.talk.file).rules

const OPS: Record<string, (a: number, b: number) => boolean> = {
  '==': (a, b) => a === b, '!=': (a, b) => a !== b, '>': (a, b) => a > b, '>=': (a, b) => a >= b, '<': (a, b) => a < b, '<=': (a, b) => a <= b,
}
const GAS = /^\s*gas\.(\w+)\s*(==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/
const TAG = /^\s*(!)?\s*tag\.([\w.]+)\s*$/

// Whether a criterion holds for the player.
function criterion(w: W, me: Row, c: string): boolean {
  const g = GAS.exec(c)
  if (g) return OPS[g[2]](value(w, me, g[1]), Number(g[3]))
  const t = TAG.exec(c)
  if (t) return tags(w, me).includes(t[2]) !== !!t[1]
  return holds(w, me, c)
}

// Ruskin's best match: of the speaker's rules for the concept whose criteria all hold, the one with the most.
function best(w: W, me: Row, speaker: Row, concept: string): Rule | undefined {
  const matched = rulesOf(w).filter(r => r.who === speaker.kind && r.record === speaker.data.record && r.concept === concept && r.criteria.every(c => criterion(w, me, c)))
  if (!matched.length) return undefined
  const most = Math.max(...matched.map(r => r.criteria.length))
  const top = matched.filter(r => r.criteria.length === most)
  return top[Math.floor(w.die() * top.length)]
}

// The actions a rule may take, by word.
const ACTIONS: Record<string, (w: W, me: Row, speaker: Row, n: any) => void> = {
  effect: (w, me, speaker, n) => { apply(w, me, n.effect, speaker.id) },
  accept: (w, me, speaker, n) => { accept(w, me, speaker, n.quest) },
  reward: (w, me, speaker, n) => { reward(w, me, speaker, n.quest) },
  vendor: (_w, me, speaker) => { me.data.serving = { what: 'vendor', with: speaker.id } satisfies Serving },
  trainer: (_w, me, speaker) => { me.data.serving = { what: 'trainer', with: speaker.id } satisfies Serving },
  enchanter: (_w, me, speaker) => { me.data.serving = { what: 'enchanter', with: speaker.id } satisfies Serving },
}

function ask(w: W, me: Row, speaker: Row, concept: string) {
  const r = best(w, me, speaker, concept)
  if (!r) {
    me.data.talking = null
    return
  }
  const line = r.say[Math.floor(w.die() * r.say.length)]
  for (const [fact, n] of Object.entries(r.remember)) write(w, me, fact, n)
  for (const a of r.actions) for (const [word, n] of Object.entries(a)) {
    const act = ACTIONS[word]
    if (!act) throw new Error(`talk: the rule ${r.name} does ${word}, which talk has no action for`)
    act(w, me, speaker, n)
  }
  me.data.talking = { with: speaker.id, rule: r.name, line, choices: r.choices } satisfies Talking
}

const gap = (a: Row, b: Row) => math.hypot(a.data.pos[0] - b.data.pos[0], a.data.pos[2] - b.data.pos[2])
// The row of that id of a kind the rules name, while it is there.
export const speaker = (w: W, id: number): Row | undefined => {
  for (const kind of new Set(rulesOf(w).map(r => r.who))) {
    const r = w.all(kind).find(x => x.id === id)
    if (r) return r
  }
  return undefined
}
const speakerOf = (w: W, me: Row): Row | undefined => {
  const t = me.data.talking as Talking | null
  return t ? speaker(w, t.with) : undefined
}

// The speaker serving the player that service, while it does and is within `reach`.
export function serving(w: W, me: Row, what: Serving['what'], reach: number): Row | undefined {
  const s = me.data.serving as Serving | null
  if (!s || s.what !== what) return undefined
  const r = speaker(w, s.with)
  return r && gap(me, r) <= reach ? r : undefined
}

export function start(w: W, me: Row, reach: number) {
  let near: Row | undefined
  for (const kind of new Set(rulesOf(w).map(r => r.who))) for (const r of w.all(kind)) {
    if (gap(me, r) <= reach && (!near || gap(me, r) < gap(me, near))) near = r
  }
  if (near) ask(w, me, near, 'hello')
}

export function choose(w: W, me: Row, i: number) {
  const t = me.data.talking as Talking | null
  const c = t?.choices[i]
  const speaker = speakerOf(w, me)
  if (!c || !speaker) return
  ask(w, me, speaker, c.concept)
}

export function end(me: Row) {
  me.data.talking = null
}

export function step(w: W, me: Row, reach: number) {
  const sv = me.data.serving as Serving | null
  if (sv && !serving(w, me, sv.what, reach)) me.data.serving = null
  if (me.data.talking === null) return
  const s = speakerOf(w, me)
  if (!s || gap(me, s) > reach) me.data.talking = null
}

export const talker: Kind = {
  tick(me, dt, w) {
    if (listOf(w, me).length) vendorStep(w, me, dt)
  },
}
