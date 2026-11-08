// quest: the game's quests, its people's talk, the things a player carries and gives, and the switches of the place,
// all read off one file a place has beside the files pro-ng's build writes for it, its quests file
// (`assets/<folder>/<place>.quests.json`). The file is written against the names those files already give: a
// resident by the landmark it is planted at and a wanderer by its name (the place's crowd file), a spot by the tag of a
// place of the place's nav graph, a switch by its kit thing's clip (the place's clips file). Nothing in it is a
// number of where anything stands; the place's own files say that.
//
// The state. Everything that changes is a named number, 0 until something sets it: a quest's stage, how many of an
// item someone holds, a switch. Each lives on the row of who owns it, in its `state`, `{ <name>: <number> }`:
//   <name>           the seat's own: its `player` row's.
//   world.<name>     the place's: the `story` row's, one actors entry.
//   <person>.<name>  a person's: the row of that resident or wanderer (`people`, below).
// So an item given is one number down on the giver and the same up on whoever takes it.
//
// The file:
//   crowd    the catalogue name of the place's crowd file (world3d's `<place>.crowd`): the people the file names.
//   graph    the nav3d graph the spots stand on (world3d hands nav3d the place's ways as `place`).
//   clips    the catalogue name of the place's clips file (world3d's `<place>.clips`): the switches.
//   people   `{ <person>: { name, resident } | { name, wanderer } }`: each person the quests talk with, `name` what the
//            page calls them, `resident` the landmark of the crowd file's resident planted there (`smithy/smithy_anvil`),
//            `wanderer` the name of the crowd file's wanderer (`old_woman`). A person is a row of the game's kind
//            `resident` or `wanderer`, which world3d spawns from the crowd file; which row is which is found once, on
//            the row's first step (`person`, below), and kept on it as `who`.
//   spots    `{ <spot>: { name, at, verb } }`: a place the player uses something at, `at` the tag of a place of `graph`
//            (`bakehouse/behind the counter`), `name` and `verb` what the page says (`Pull` `the bell rope`).
//   items    `{ <item>: { name } }`: what can be carried, `name` what the page calls it.
//   quests   `{ <quest>: { title, stages: { <n>: <text> } } }`: each quest's stage is the seat's number `<quest>`; at a
//            stage the file gives text for, the journal shows its title and that text. Stage 0 is not begun.
//   lines    `[{ to, ask, if?, say, set?, add?, replies? }]`, what is said. Talking to a person asks `hello` of them,
//            using a spot asks `use` of it, and each reply asks its own `ask`. Of the lines `to` that person or spot
//            and of that `ask` whose `if` holds, the one with the most names in its `if` is said, the first listed of
//            those tied; so a line for a moment in a quest stands over the line said any time. It writes `set` (each
//            name to its number) and then `add` (each name up by its number), and offers `replies`, `[{ say, ask,
//            if? }]`, each shown while its `if` holds. A reply asks its `ask` of the same one, and a reply whose `ask`
//            no line answers ends the talk, as leaving does. Every person and spot has a line for its opening ask
//            whose `if` is empty, so there is always something to say.
//   marks    `[{ who, if?, show }]`: what is drawn over a person while its `if` holds, the first that holds for each.
//   watch    `[{ if, clip: { thing, clip } }]`: a clip of the clips file played while `if` holds and stopped while it
//            does not (world3d's `clip`); each clip watched starts off.
// An `if` is `{ <name>: <n> | [least, most] }`: equal to `n`, or within least and most, either null for no end.
// Every name a person's or the world's is checked against `people`, every `to` against `people` and `spots`, every
// spot's `at` against the graph, every resident and wanderer against the crowd file, every watched clip against the
// clips file; the file out of shape throws naming what is wrong.
//
// The kinds and the rows:
//   story    the place's own state, one actors entry, `{ "state": {} }`; its definition names the quests file's
//            catalogue entry, `file`, and what the page draws (`quest.plugin.ts`). Its act `mark(name, n)` sets one of
//            its names; a rule calls it with seat -1, and a seat's message is refused.
//   person   the rule of `resident` and `wanderer`: npc3d's NPC, with `who` (null until found, the person's name in
//            `people`, or null for one the file does not name, with `known` true once looked for) and `state` on
//            its row, and the act `mark` as the story's.
//   player   the seat's row carries `state`, `near` (what it could talk to or use now, `{ to, ask, id }`, `id` the
//            person's row or null for a spot, or null) and `talk` (`{ to, line, id }` while it talks: the line said,
//            its number in `lines`, or null). Its acts `use`, `reply` and `leave` call `use`, `reply` and `leave`
//            here, and its tick `look` (below).
//
// A person talked to is ordered to npc3d's `attend` (`quest.npc3d.ts`): it stops where it is and listens, facing the
// player where its definition says so, until the player leaves it.
//
// The player's definition gives `reach`, the metres from its feet within which it talks to a person (where npc3d's
// body says the person stands now) or uses a spot; the nearest, and of a person and a spot as far, the person.
import type { Kind, Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import { bodyOf, now, npc } from '#plugins/npc3d/npc3d.sim.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export type Cond = Record<string, number | [number | null, number | null]>
export type Reply = { say: string; ask: string; if?: Cond }
export type Line = { to: string; ask: string; if?: Cond; say: string; set?: Record<string, number>; add?: Record<string, number>; replies?: Reply[] }
export type Person = { name: string; resident?: string; wanderer?: string }
export type Spot = { name: string; at: string; verb: string }
export type Mark = { who: string; if?: Cond; show: string }
export type Watch = { if: Cond; clip: { thing: string; clip: string } }
export type Quests = {
  about?: string
  crowd: string
  graph: string
  clips: string
  people: Record<string, Person>
  spots: Record<string, Spot>
  items: Record<string, { name: string }>
  quests: Record<string, { title: string; stages: Record<string, string> }>
  lines: Line[]
  marks: Mark[]
  watch: Watch[]
}
type Crowd = { people: { landmark: string; at: number[] }[]; wanderers: { name: string; model: string; landmarks: { at: number[] }[] }[] }
type Clips = { things: { thing: string; clips: Record<string, { start: string }> }[] }

// The kinds a person is a row of, by the word the file names it with.
export const KINDS = { resident: 'resident', wanderer: 'wanderer' } as const
// What each opens with: talking to a person, using a spot.
export const OPEN = { person: 'hello', spot: 'use' } as const

const bad = (why: string): never => { throw new Error(`the quests file: ${why}`) }

// The scene's story row, or undefined in a scene with none.
export const storyOf = (from: { all(kind: string): Row[] }) => from.all('story')[0] as Row | undefined

// A file checked once against the place's files: by the file's own object, which the loader makes anew when it is
// written again.
const checked = new WeakSet<object>()

// The quests file of a scene with a story row, read off the story's definition; checked the first time a rule reads
// it, so a file out of shape stops the truth on its first step, and the page reads only a file the truth has taken.
export function quests(from: W | Wire, story: Row): Quests {
  const q = json(from, def(from, story.kind).file) as Quests
  if ('find' in from && !checked.has(q)) {
    check(from, q)
    checked.add(q)
  }
  return q
}

// Every name an `if`, a `set` or an `add` holds: `world.<name>`, `<person>.<name>` or the seat's own.
function names(q: Quests, where: string, list: Record<string, unknown> | undefined) {
  for (const name of Object.keys(list ?? {})) {
    const dot = name.indexOf('.')
    if (dot < 0) continue
    const owner = name.slice(0, dot)
    if (owner !== 'world' && !q.people[owner]) bad(`${where} names ${name}, and ${owner} is neither world nor a person of people`)
  }
}

function conds(q: Quests, where: string, c: Cond | undefined) {
  names(q, where, c)
  for (const [name, v] of Object.entries(c ?? {})) {
    const ok = typeof v === 'number' || (Array.isArray(v) && v.length === 2 && v.every(e => e === null || typeof e === 'number'))
    if (!ok) bad(`${where}'s if gives ${name} ${JSON.stringify(v)}: a number, or [least, most] with null for no end`)
  }
}

function check(from: W, q: Quests) {
  for (const key of ['crowd', 'graph', 'clips'] as const) if (typeof q[key] !== 'string') bad(`it has no ${key}`)
  for (const key of ['people', 'spots', 'items', 'quests'] as const) if (typeof q[key] !== 'object' || q[key] === null || Array.isArray(q[key])) bad(`its ${key} is not { <name>: ... }`)
  for (const key of ['lines', 'marks', 'watch'] as const) if (!Array.isArray(q[key])) bad(`its ${key} is not a list`)
  const crowd = json(from, q.crowd) as Crowd
  for (const [key, p] of Object.entries(q.people)) {
    if (typeof p.name !== 'string') bad(`the person ${key} has no name`)
    if ((p.resident === undefined) === (p.wanderer === undefined)) bad(`the person ${key} is a resident or a wanderer, one of them`)
    if (p.resident !== undefined && !crowd.people.some(c => c.landmark === p.resident)) bad(`the person ${key} is the resident at ${p.resident}, and the crowd file ${q.crowd} plants none there`)
    if (p.wanderer !== undefined && !crowd.wanderers.some(c => c.name === p.wanderer)) bad(`the person ${key} is the wanderer ${p.wanderer}, and the crowd file ${q.crowd} has none of that name`)
  }
  const places = graph(from, q.graph).places
  for (const [key, s] of Object.entries(q.spots)) {
    if (q.people[key]) bad(`${key} is both a person and a spot`)
    if (typeof s.name !== 'string' || typeof s.verb !== 'string') bad(`the spot ${key} has no name or no verb`)
    if (!places.some(p => p.data?.nav3d?.tags?.includes(s.at))) bad(`the spot ${key} stands at ${s.at}, which no place of the graph ${q.graph} tags`)
  }
  for (const [key, i] of Object.entries(q.items)) if (typeof i.name !== 'string') bad(`the item ${key} has no name`)
  for (const [key, quest] of Object.entries(q.quests)) {
    if (typeof quest.title !== 'string') bad(`the quest ${key} has no title`)
    for (const n of Object.keys(quest.stages ?? bad(`the quest ${key} has no stages`))) if (!(Number(n) > 0 && Number.isInteger(Number(n)))) bad(`the quest ${key} has a stage ${n}: a whole number above 0`)
  }
  q.lines.forEach((l, i) => {
    const where = `line ${i} (${l.to} ${l.ask})`
    if (!q.people[l.to] && !q.spots[l.to]) bad(`${where} is to ${l.to}, who is no person and no spot`)
    if (typeof l.ask !== 'string' || typeof l.say !== 'string') bad(`${where} has no ask or no say`)
    conds(q, where, l.if)
    names(q, where, l.set)
    names(q, where, l.add)
    for (const [name, v] of [...Object.entries(l.set ?? {}), ...Object.entries(l.add ?? {})]) if (typeof v !== 'number') bad(`${where} writes ${name} ${JSON.stringify(v)}: a number`)
    for (const r of l.replies ?? []) {
      if (typeof r.say !== 'string' || typeof r.ask !== 'string') bad(`${where} has a reply with no say or no ask`)
      conds(q, `${where}'s reply ${r.ask}`, r.if)
    }
  })
  for (const [key, p] of [...Object.keys(q.people).map(k => [k, OPEN.person]), ...Object.keys(q.spots).map(k => [k, OPEN.spot])]) {
    if (!q.lines.some(l => l.to === key && l.ask === p && Object.keys(l.if ?? {}).length === 0)) bad(`${key} has no line for ${p} whose if is empty`)
  }
  q.marks.forEach((m, i) => {
    if (!q.people[m.who]) bad(`mark ${i} is over ${m.who}, who is no person`)
    if (typeof m.show !== 'string') bad(`mark ${i} shows nothing`)
    conds(q, `mark ${i}`, m.if)
  })
  const clips = json(from, q.clips) as Clips
  q.watch.forEach((w, i) => {
    conds(q, `watch ${i}`, w.if)
    const clip = clips.things.find(t => t.thing === w.clip?.thing)?.clips[w.clip.clip] ?? bad(`watch ${i} plays ${w.clip?.clip} of ${w.clip?.thing}, which the clips file ${q.clips} has not`)
    if (clip.start !== 'off') bad(`watch ${i} plays ${w.clip.clip} of ${w.clip.thing}, which starts ${clip.start}: a watched clip starts off`)
  })
}

// What reads the state: the seat's row, the story row and each person's row by its name in `people`.
export type Reading = { me: Row; story: Row | undefined; people: Map<string, Row> }

// The people's rows by their names, of the rows given.
export function peopleOf(rows: Row[]): Map<string, Row> {
  const m = new Map<string, Row>()
  for (const r of rows) if (typeof r.data.who === 'string') m.set(r.data.who, r)
  return m
}

export function reading(w: W, me: Row): Reading {
  return { me, story: storyOf(w), people: peopleOf([...w.all(KINDS.resident), ...w.all(KINDS.wanderer)]) }
}

// The row a name lives on, and the name on it.
function owner(r: Reading, name: string): { row: Row | undefined; key: string } {
  const dot = name.indexOf('.')
  if (dot < 0) return { row: r.me, key: name }
  const who = name.slice(0, dot)
  return { row: who === 'world' ? r.story : r.people.get(who), key: name.slice(dot + 1) }
}

// A name's number, 0 where it has none.
export function value(r: Reading, name: string): number {
  const { row, key } = owner(r, name)
  return row?.data.state?.[key] ?? 0
}

// Whether an `if` holds.
export function holds(r: Reading, c: Cond | undefined): boolean {
  for (const [name, want] of Object.entries(c ?? {})) {
    const v = value(r, name)
    if (typeof want === 'number') { if (v !== want) return false; continue }
    const [lo, hi] = want
    if ((lo !== null && v < lo) || (hi !== null && v > hi)) return false
  }
  return true
}

// The line said to `to` for `ask`: its number in `lines`, or -1 for none.
export function pick(q: Quests, r: Reading, to: string, ask: string): number {
  let best = -1, most = -1
  q.lines.forEach((l, i) => {
    if (l.to !== to || l.ask !== ask || !holds(r, l.if)) return
    const n = Object.keys(l.if ?? {}).length
    if (n > most) { best = i; most = n }
  })
  return best
}

// The replies a line offers now.
export const replies = (q: Quests, r: Reading, line: number): Reply[] => (q.lines[line].replies ?? []).filter(p => holds(r, p.if))

// A line's writes: its `set`, then its `add`. The seat's own names are written on its row here; the world's and a
// person's through that row's `mark`.
function write(w: W, r: Reading, l: Line) {
  const writes: [string, number][] = [
    ...Object.entries(l.set ?? {}),
    ...Object.entries(l.add ?? {}).map(([name, by]) => [name, by] as [string, number]),
  ]
  const sets = Object.keys(l.set ?? {}).length
  writes.forEach(([name, n], i) => {
    const to = i < sets ? n : value(r, name) + n
    const { row, key } = owner(r, name)
    if (!row) throw new Error(`the quests file writes ${name}, and the scene has no row for it`)
    if (row === r.me) r.me.data.state = { ...r.me.data.state, [key]: to }
    else w.call(row, 'mark', -1, key, to)
  })
}

// Where a person stands now, as npc3d's body says.
const whereOf = (w: W, row: Row) => bodyOf(row.kind, def(w, row.kind)).where(row, now(w))

const far = (a: number[], b: number[]) => math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// The nearest person or spot within the seat's reach, a person before a spot as far: `{ to, ask, id }`, or null.
export function nearest(w: W, me: Row): { to: string; ask: string; id: number | null } | null {
  const story = storyOf(w)
  if (!story) return null
  const q = quests(w, story)
  const reach: number = def(w, me.kind).reach
  let best: { to: string; ask: string; id: number | null } | null = null
  let close = reach
  for (const [who, row] of reading(w, me).people) {
    if (!q.people[who]) continue
    const d = far(whereOf(w, row), me.data.pos)
    if (d <= close) { close = d; best = { to: who, ask: OPEN.person, id: row.id } }
  }
  const places = graph(w, q.graph).places
  for (const [key, s] of Object.entries(q.spots)) {
    const p = places.find(p => p.data?.nav3d?.tags?.includes(s.at))!
    const d = far(p.point.at, me.data.pos)
    if (d < close || (d === close && !best)) { close = d; best = { to: key, ask: OPEN.spot, id: null } }
  }
  return best
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// The seat's tick: what it could talk to or use now, and the talk over when the one it talks to is gone.
export function look(me: Row, w: W) {
  const talk = me.data.talk
  if (talk && talk.id !== null && !w.all(KINDS.resident).concat(w.all(KINDS.wanderer)).some(r => r.id === talk.id)) me.data.talk = null
  const near = me.data.talk ? null : nearest(w, me)
  if (!same(near, me.data.near)) me.data.near = near
}

// A line said: the talk on it, and its writes.
function say(w: W, me: Row, to: string, id: number | null, line: number) {
  const story = storyOf(w)!
  const q = quests(w, story)
  me.data.talk = { to, line, id }
  write(w, reading(w, me), q.lines[line])
}

// The seat talks to, or uses, what is nearest it: the line for its opening ask, and the person told to attend.
export function use(me: Row, w: W) {
  if (me.data.talk) return
  const near = nearest(w, me)
  if (!near) return
  const story = storyOf(w)!
  const line = pick(quests(w, story), reading(w, me), near.to, near.ask)
  if (line < 0) return
  if (near.id !== null) {
    const [x, y, z] = me.data.pos
    w.call(w.get(near.id), 'order', -1, 'attend', x, y, z)
  }
  me.data.near = null
  say(w, me, near.to, near.id, line)
}

// The seat answers with the reply numbered `n` of those the line offers now: the line its ask is answered with, or
// the talk over where none answers it.
export function reply(me: Row, w: W, n: number) {
  const talk = me.data.talk
  if (!talk) return
  const q = quests(w, storyOf(w)!)
  const r = replies(q, reading(w, me), talk.line)[n]
  if (!r) return
  const line = pick(q, reading(w, me), talk.to, r.ask)
  if (line < 0) { me.data.talk = null; return }
  say(w, me, talk.to, talk.id, line)
}

export function leave(me: Row) {
  if (me.data.talk) me.data.talk = null
}

// The act a story or a person is written through: one name set to `n`, by a rule alone.
const mark = (me: Row, _w: W, seat: number, name: string, n: number) => {
  if (seat >= 0) return
  me.data.state = { ...me.data.state, [name]: n }
}

export const story: Kind = { acts: { mark } }

const eq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

// Which of the file's people a row is: a resident by the crowd file's resident it stands where world3d planted it, a
// wanderer by the crowd file's wanderer whose landmarks and model world3d gave it.
function whoIs(w: W, me: Row): string | null {
  const story = storyOf(w)
  if (!story) return null
  const q = quests(w, story)
  const crowd = json(w, q.crowd) as Crowd
  for (const [key, p] of Object.entries(q.people)) {
    if (p.resident !== undefined && me.kind === KINDS.resident) {
      const c = crowd.people.find(c => c.landmark === p.resident)!
      if (eq(c.at, me.data.to)) return key
    }
    if (p.wanderer !== undefined && me.kind === KINDS.wanderer) {
      const c = crowd.wanderers.find(c => c.name === p.wanderer)!
      if (c.model === me.data.body && eq(c.landmarks.flatMap(l => l.at), (me.data.landmarks as { at: number[] }[]).flatMap(l => l.at))) return key
    }
  }
  return null
}

// A resident's and a wanderer's rule: npc3d's NPC, found among the file's people on its first step.
export const person: Kind = {
  before(me, _dt, w) {
    if (me.data.known) return
    me.data.who = whoIs(w, me)
    me.data.known = true
  },
  tick: npc.tick,
  acts: { ...npc.acts, mark },
}
