// smartai: demo_world3d's own plugin, scripted creatures, after TrinityCore's SmartAI (`smart_scripts`: each row an
// event, a phase mask, a chance, flags, an action and a target, and a link to the row it runs next) (core issue #67).
// This file is its server half; it has no page half. Its file is a loader `json` entry the scene names in
// `world.smartai.file`:
//   scripts  `{ <script>: [row] }`, a kind's definition naming its own in `script`. A row:
//     id       its number in the script, which a `link` names
//     event    `{ <word>: <numbers> }`, when it runs:
//                aggro       `{}`: the fight starts (`SMART_EVENT_AGGRO`): its npc3d row starts doing `hunt`
//                updateIc    `{ min, max, repeatMin, repeatMax }`, seconds: in the fight, first a time between `min`
//                            and `max` after it starts, then again a time between `repeatMin` and `repeatMax` after
//                            each (`SMART_EVENT_UPDATE_IC`)
//                healthPct   `{ min, max }`: its health comes to between `min` and `max` percent of its most
//                            (`SMART_EVENT_HEALTH_PCT`), each time it comes into that span
//                death       `{}`: it dies (`SMART_EVENT_DEATH`)
//                link        `{}`: only when the row that names it as its `link` runs (`SMART_EVENT_LINK`)
//     phases   the phases it runs in; empty: every phase (`event_phase_mask` 0)
//     chance   percent that it runs when its event comes (`event_chance`)
//     once     it runs once a fight (`SMART_EVENT_FLAG_NOT_REPEATABLE`)
//     action   `{ <word>: <numbers> }`, what it does:
//                talk        `{ line, for }`: says the line over its head for `for` seconds (`SMART_ACTION_TALK`)
//                cast        `{ ability }`: the gas3d ability (`plugins/gas3d`), when gas3d says it may (no cooldown
//                            on, enough of its cost), its cost and cooldown paid and its clip played, strikes each
//                            target (hitscan3d's `strike`, a `Struck` naming it) (`SMART_ACTION_CAST`)
//                summon      `{ kind, count, spread }`: `count` rows of the kind, each within `spread` metres of it,
//                            facing a way of their own (`SMART_ACTION_SUMMON_CREATURE`)
//                setPhase    `{ phase }` (`SMART_ACTION_SET_EVENT_PHASE`)
//                setFact     `{ fact, value }`: factsdb's `write` on the place's facts for a name `world.` starts, else
//                            on each target's (`SMART_ACTION_SET_DATA`)
//     target   `{ <word>: <numbers> }`, whom the action is done to:
//                self        `{}`
//                victim      `{}`: the living row of its definition's `prey` kinds nearest it within its `hunt`'s
//                            range, while it fights (`SMART_TARGET_VICTIM`)
//                playersNear `{ range }`: every living `player` row within `range` metres
//                            (`SMART_TARGET_PLAYER_RANGE`)
//     link     the id of the row run straight after it, or null (`link`)
// What a scripted row has done is its row's `script`: `{ phase, time, fighting, timers: { <id>: seconds },
// done: [<id>], health, died }`, its clock, whether it fights, when each `updateIc` row is next due, the `once` rows
// run this fight, the percent of health it last had, and whether its death has been run. A fight that ends puts its
// phase back to 0 and its timers and `once` rows away, as SmartAI's evade does. What it says is its row's `said`,
// `{ line, until }` on that clock, or null.
//   step(w, me, dt)   once a step, after npc3d and gas3d have stepped the row: every row whose event came run.
import type { Row, W } from '#engine/engine.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { strike } from '#plugins/hitscan3d/hitscan3d.sim.ts'
import { play } from '#plugins/anim/anim.sim.ts'
import { abilityOf, blocked, commit, value } from '../gas3d/gas3d.sim.ts'
import { write } from '../factsdb/factsdb.sim.ts'

export type ScriptRow = {
  id: number
  event: Record<string, any>
  phases: number[]
  chance: number
  once: boolean
  action: Record<string, any>
  target: Record<string, any>
  link: number | null
}
export type Script = { phase: number; time: number; fighting: boolean; timers: Record<string, number>; done: number[]; health: number; died: boolean }

const TURN = 2 * Math.PI
const wordOf = (o: Record<string, any>, what: string, id: number) => {
  const ks = Object.keys(o)
  if (ks.length !== 1) throw new Error(`smartai: row ${id} gives ${ks.length} words for its ${what}; it gives one`)
  return ks[0]
}
const between = (w: W, a: number, b: number) => a + w.die() * (b - a)

function rowsOf(w: W, me: Row): ScriptRow[] {
  const name = def(w, me.kind).script
  const rows = (json(w, w.world.smartai.file).scripts as Record<string, ScriptRow[]>)[name]
  if (!rows) throw new Error(`smartai: the file has no script ${name}`)
  return rows
}

const gap = (a: Row, b: Row) => math.hypot(a.data.pos[0] - b.data.pos[0], a.data.pos[2] - b.data.pos[2])

function victimOf(w: W, me: Row): Row | undefined {
  const k = def(w, me.kind)
  let best: Row | undefined
  for (const kind of k.prey as string[]) for (const r of w.all(kind)) {
    if (r.data.dead || gap(me, r) > k.behaviors.hunt.range) continue
    if (!best || gap(me, r) < gap(me, best)) best = r
  }
  return best
}

const TARGETS: Record<string, (w: W, me: Row, n: any) => Row[]> = {
  self: (_w, me) => [me],
  victim: (w, me) => (me.data.script.fighting ? [victimOf(w, me)].filter((r): r is Row => !!r) : []),
  playersNear: (w, me, n) => w.all('player').filter(r => !r.data.dead && gap(me, r) <= n.range),
}

const ACTIONS: Record<string, (w: W, me: Row, n: any, targets: Row[]) => void> = {
  talk: (_w, me, n) => { me.data.said = { line: n.line, until: me.data.script.time + n.for } },
  cast: (w, me, n, targets) => {
    if (!targets.length || blocked(w, me, n.ability) !== undefined) return
    const a = abilityOf(w, n.ability)
    commit(w, me, n.ability)
    if (a.clip) play(me, a.clip)
    const ahead = [math.sin(me.data.yaw), math.cos(me.data.yaw)]
    for (const t of targets) strike(w, t, { damage: 0, by: me.id, ability: n.ability, part: null, point: [...t.data.pos], dir: [ahead[0], 0, ahead[1]], what: 'body' })
  },
  summon: (w, me, n) => {
    const c = me.data.pos as number[]
    for (let i = 0; i < n.count; i++) {
      const r = n.spread * math.pow(w.die(), 0.5)
      const a = TURN * w.die()
      w.spawn(n.kind, { pos: [c[0] + r * math.cos(a), c[1], c[2] + r * math.sin(a)], yaw: TURN * w.die() })
    }
  },
  setPhase: (_w, me, n) => { me.data.script = { ...me.data.script, phase: n.phase } },
  setFact: (w, me, n, targets) => {
    if (n.fact.startsWith('world.')) write(w, me, n.fact, n.value)
    else for (const t of targets) if (t.data.factsdb) write(w, t, n.fact, n.value)
  },
}

function run(w: W, me: Row, rows: ScriptRow[], r: ScriptRow, linked: boolean) {
  const s = me.data.script as Script
  if (!linked && r.phases.length && !r.phases.includes(s.phase)) return
  if (r.once && s.done.includes(r.id)) return
  if (w.die() * 100 >= r.chance) return
  if (r.once) me.data.script = { ...me.data.script, done: [...s.done, r.id] }
  const tw = wordOf(r.target, 'target', r.id)
  const aw = wordOf(r.action, 'action', r.id)
  const target = TARGETS[tw]
  if (!target) throw new Error(`smartai: row ${r.id} targets ${tw}, which smartai has no target for`)
  const act = ACTIONS[aw]
  if (!act) throw new Error(`smartai: row ${r.id} does ${aw}, which smartai has no action for`)
  act(w, me, r.action[aw], target(w, me, r.target[tw]))
  if (r.link !== null) {
    const next = rows.find(x => x.id === r.link)
    if (!next) throw new Error(`smartai: row ${r.id} links to ${r.link}, which its script has no row of`)
    run(w, me, rows, next, true)
  }
}

const eventOf = (r: ScriptRow) => wordOf(r.event, 'event', r.id)

export function step(w: W, me: Row, dt: number) {
  const rows = rowsOf(w, me)
  const d = me.data
  const s0 = d.script as Script
  const time = s0.time + dt
  const fighting = !d.dead && d.doing === 'hunt'
  const health = (value(w, me, 'health') / value(w, me, 'maxHealth')) * 100
  d.script = { ...s0, time, fighting, health }
  if (d.said && d.said.until <= time) d.said = null
  // The fight over: its phase, timers and once-a-fight rows put away.
  if (s0.fighting && !fighting && !d.dead) d.script = { ...d.script, phase: 0, timers: {}, done: [] }
  if (fighting && !s0.fighting) {
    const timers: Record<string, number> = {}
    for (const r of rows) if (eventOf(r) === 'updateIc') timers[r.id] = time + between(w, r.event.updateIc.min, r.event.updateIc.max)
    d.script = { ...d.script, timers }
    for (const r of rows) if (eventOf(r) === 'aggro') run(w, me, rows, r, false)
  }
  if (d.script.fighting) {
    for (const r of rows) {
      if (eventOf(r) !== 'updateIc' || d.script.timers[r.id] > d.script.time) continue
      const e = r.event.updateIc
      d.script = { ...d.script, timers: { ...d.script.timers, [r.id]: d.script.time + between(w, e.repeatMin, e.repeatMax) } }
      run(w, me, rows, r, false)
    }
    for (const r of rows) {
      if (eventOf(r) !== 'healthPct') continue
      const { min, max } = r.event.healthPct
      const inside = (p: number) => p >= min && p <= max
      if (inside(health) && !inside(s0.health)) run(w, me, rows, r, false)
    }
  }
  if (d.dead && !d.script.died) {
    d.script = { ...d.script, died: true }
    for (const r of rows) if (eventOf(r) === 'death') run(w, me, rows, r, false)
  }
}
