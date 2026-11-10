// factsdb: demo_world3d's own plugin, what has happened, after The Witcher 3's FactsDB (core issue #67): named numbers
// that quests, talk and spawns are conditions on. This file is its server half; it has no page half.
//
// A fact is a name and a number, 0 when it has never been written. Facts are kept on rows, each row's in its field
// `factsdb`, `{ <name>: number }`:
//   - a seat's own on its `player` row: what that player has done (`killed.zombie`), which only it has;
//   - the place's on the one `factsdb` row, one `actors` entry: what has happened in the world, whoever did it.
// A fact name is any string; a dotted name (`killed.zombie`) is only a name.
//
//   fact(row, name)            the fact's number on the row, 0 when it has none
//   set(row, name, value)      the fact written
//   add(row, name, by)         the fact moved by `by`
//   world(w)                   the `factsdb` row, the place's facts
//   holds(w, row, condition)   whether a condition holds on the row's facts, the place's for a name `world.` starts:
//                              `name` (its fact is not 0), `!name` (it is 0), or `name <op> number` with `op` one of
//                              `==`, `!=`, `>`, `>=`, `<`, `<=`; spaces round the op are its own. A condition of no
//                              such shape throws, naming it.
//   write(w, row, name, value) the fact written on the row's facts, or the place's for a name `world.` starts, as
//                              `holds` reads them
//   kill(w, killer, kind)      what a death writes: `killed.<kind>` up by 1 on the killer's facts when it keeps any
//                              (a seat's `player` row), and on the place's.
import type { Kind, Row, W } from '#engine/engine.ts'

export type Facts = Record<string, number>

const factsOf = (row: Row): Facts => {
  const f = row.data.factsdb as Facts | undefined
  if (!f) throw new Error(`factsdb: ${row.kind} ${row.id} keeps no facts`)
  return f
}

export const fact = (row: Row, name: string): number => factsOf(row)[name] ?? 0

export function set(row: Row, name: string, value: number) {
  row.data.factsdb = { ...factsOf(row), [name]: value }
}

export const add = (row: Row, name: string, by: number) => set(row, name, fact(row, name) + by)

export const world = (w: W): Row => w.find('factsdb')

const SHAPE = /^\s*(!)?\s*([A-Za-z_][\w.]*)\s*(?:(==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?))?\s*$/

export function holds(w: W, row: Row, condition: string): boolean {
  const m = SHAPE.exec(condition)
  if (!m || (m[1] && m[3])) throw new Error(`factsdb: ${condition} is no condition: name, !name, or name <op> number`)
  const [, not, name, op, n] = m
  const value = name.startsWith('world.') ? fact(world(w), name.slice(6)) : fact(row, name)
  if (!op) return not ? value === 0 : value !== 0
  const to = Number(n)
  switch (op) {
    case '==': return value === to
    case '!=': return value !== to
    case '>': return value > to
    case '>=': return value >= to
    case '<': return value < to
    default: return value <= to
  }
}

export function write(w: W, row: Row, name: string, value: number) {
  if (name.startsWith('world.')) set(world(w), name.slice(6), value)
  else set(row, name, value)
}

export function kill(w: W, killer: Row | undefined, kind: string) {
  if (killer?.data.factsdb) add(killer, `killed.${kind}`, 1)
  add(world(w), `killed.${kind}`, 1)
}

// The place's facts: a row of its own, its `factsdb` the only field it has.
export const factsdb: Kind = {}
