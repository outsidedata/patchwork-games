// loot: demo_world3d's own plugin, what a death drops, after World of Warcraft's loot tables as the TrinityCore server
// keeps them (`creature_loot_template`, and a creature's `mingold` and `maxgold`) (core issue #67). This file is its
// server half; it has no page half. Its file is a loader `json` entry the scene names in `world.loot.file`:
//   loot  `{ <table>: { gold: [min, max], entries: [{ item, chance, group, min, max }] } }`:
//           gold     the gold dropped, a whole number from `min` to `max`
//           item     an inventory item definition (`plugins/inventory`)
//           chance   percent, 0 to 100
//           group    0: the entry is rolled on its own, against its chance. Any other number: the entries of that
//                    group are rolled together and at most one of them drops. One roll from 0 to 100 walks the
//                    group's entries with a chance in their order, the first whose chances so far pass the roll
//                    dropping; when none does, one of the group's entries with a chance of 0 drops, each as likely,
//                    with the share of 100 the others leave.
//           min, max the count dropped, a whole number from `min` to `max`
// A mob's definition names its table in `loot`.
//   roll(w, table)   the table rolled with the truth's die: `{ gold, items: [{ item, count }] }`.
import type { W } from '#engine/engine.ts'
import { json } from '#plugins/loader/loader.sim.ts'

export type Entry = { item: string; chance: number; group: number; min: number; max: number }
export type Table = { gold: [number, number]; entries: Entry[] }
export type Drop = { gold: number; items: { item: string; count: number }[] }

const between = (w: W, min: number, max: number) => min + Math.floor(w.die() * (max - min + 1))

function group(w: W, entries: Entry[]): Entry | undefined {
  const r = w.die() * 100
  let sum = 0
  for (const e of entries.filter(e => e.chance > 0)) {
    sum += e.chance
    if (r < sum) return e
  }
  const equal = entries.filter(e => e.chance === 0)
  if (!equal.length) return undefined
  return equal[Math.floor(w.die() * equal.length)]
}

export function roll(w: W, name: string): Drop {
  const t = (json(w, w.world.loot.file).loot as Record<string, Table>)[name]
  if (!t) throw new Error(`loot: the file has no table ${name}`)
  const dropped: Entry[] = t.entries.filter(e => e.group === 0 && w.die() * 100 < e.chance)
  const groups = [...new Set(t.entries.filter(e => e.group !== 0).map(e => e.group))].sort((a, b) => a - b)
  for (const g of groups) {
    const e = group(w, t.entries.filter(x => x.group === g))
    if (e) dropped.push(e)
  }
  return { gold: between(w, t.gold[0], t.gold[1]), items: dropped.map(e => ({ item: e.item, count: between(w, e.min, e.max) })) }
}
