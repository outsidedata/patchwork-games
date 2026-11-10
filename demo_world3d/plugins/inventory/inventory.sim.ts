// inventory: demo_world3d's own plugin, what a body carries, after Lyra's inventory (Epic's Lyra Starter Game,
// `ULyraInventoryManagerComponent`, `ULyraInventoryItemDefinition`, `ULyraInventoryItemInstance`) (core issue #67).
// This file is its server half; it has no page half. Its file is a loader `json` entry the scene names in
// `world.inventory.file`:
//   items  `{ <definition>: { name, fragments } }`, Lyra's item definitions: the name shown, and the fragments that
//          make up everything else about it, each `{ <fragment>: <its numbers> }`, as Lyra's are its
//          `ULyraInventoryItemFragment`s. The fragments of the hills:
//            equippable   `{ equipment, class }`: it can be equipped as that equipment definition (`plugins/equipment`'s
//                         file); Lyra's `UInventoryFragment_EquippableItem`, with WoW's item class (`weapon`,
//                         `chest`), which an enchant names the items it goes on by
//            setStats     `{ <stat>: number }`: the stat tags each instance starts with; Lyra's
//                         `UInventoryFragment_SetStats`
//            price        `{ buy, sell }`: the gold a vendor asks for one and pays for one, WoW's `BuyPrice` and
//                         `SellPrice` (`plugins/vendor`); an item with none cannot be sold
//            quality      `{ grade }`: grey, common, fine or rare, how its name is shown; grey is junk
// A body that carries things has `inventory` on its row, Lyra's inventory list:
//   `{ entries: [{ instance, count }], next }`: each entry one item instance, `{ id, definition, stats, enchant }`
//   (its stat tags, Lyra's `FGameplayTagStackContainer`; the enchant in its permanent enchantment slot, WoW's
//   `PERM_ENCHANTMENT_SLOT`, `{ name, abilitySet }` or null, `plugins/enchanting`), and the stack count it stands
//   for; `next` the id the next instance gets.
// As in Lyra, adding a definition makes a new instance in an entry of its own, however many of that definition are
// carried; counting and consuming by definition go across every entry of it.
//   definitionOf(from, name)             the file's item definition of that name.
//   fragment(from, definition, name)     that definition's fragment of the name, or undefined (Lyra's
//                                        `FindFragmentByClass`).
//   addDefinition(w, row, def, count)    a new instance of the definition added, in an entry of `count`; the instance
//                                        (Lyra's `AddItemDefinition`, its fragments' `OnInstanceCreated`: setStats
//                                        lays its stats on it).
//   removeInstance(row, id)              the entry of that instance taken out (`RemoveItemInstance`).
//   entryOf(row, id)                     the entry of that instance, or undefined.
//   enchantInstance(row, id, enchant)    the instance's permanent enchantment slot set, the enchant there before
//                                        replaced.
//   instanceOf(row, id)                  the instance of that id the row carries, or undefined.
//   all(row)                             every instance carried (`GetAllItems`).
//   firstOf(row, def)                    the first instance of the definition, or undefined
//                                        (`FindFirstItemStackByDefinition`).
//   countOf(row, def)                    how many of the definition are carried, every entry's count
//                                        (`GetTotalItemCountByDefinition`).
//   consume(row, def, count)             that many of the definition taken out, entry by entry, an entry emptied taken
//                                        out; whether there were that many, and nothing taken when not
//                                        (`ConsumeItemsByDefinition`).
// Gold is an item definition like any other (`gold`), carried in stacks and counted and consumed by definition.
// Only rules add to an inventory; a seat's own messages reach it through its `player` row's acts.
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'

export type Definition = { name: string; fragments: Record<string, any> }
export type Enchant = { name: string; abilitySet: string }
export type Instance = { id: number; definition: string; stats: Record<string, number>; enchant: Enchant | null }
export type Entry = { instance: Instance; count: number }
export type Inventory = { entries: Entry[]; next: number }
export type File = { items: Record<string, Definition> }

const fileOf = (from: W | Wire): File => json(from, ('find' in from ? from.world : from.scene.world!).inventory.file)

export function definitionOf(from: W | Wire, name: string): Definition {
  const d = fileOf(from).items[name]
  if (!d) throw new Error(`inventory: the file has no item ${name}`)
  return d
}

export const fragment = (from: W | Wire, definition: string, name: string): any => definitionOf(from, definition).fragments[name]

const listOf = (row: Row): Inventory => {
  const l = row.data.inventory as Inventory | undefined
  if (!l) throw new Error(`inventory: ${row.kind} ${row.id} carries nothing`)
  return l
}

export function addDefinition(w: W, row: Row, definition: string, count: number): Instance {
  const l = listOf(row)
  const instance: Instance = { id: l.next, definition, stats: { ...(fragment(w, definition, 'setStats') ?? {}) }, enchant: null }
  row.data.inventory = { entries: [...l.entries, { instance, count }], next: l.next + 1 }
  return instance
}

export function removeInstance(row: Row, id: number) {
  const l = listOf(row)
  if (!l.entries.some(e => e.instance.id === id)) throw new Error(`inventory: ${row.kind} ${row.id} carries no instance ${id}`)
  row.data.inventory = { ...l, entries: l.entries.filter(e => e.instance.id !== id) }
}

export const entryOf = (row: Row, id: number): Entry | undefined => listOf(row).entries.find(e => e.instance.id === id)

export function enchantInstance(row: Row, id: number, enchant: Enchant) {
  const l = listOf(row)
  if (!entryOf(row, id)) throw new Error(`inventory: ${row.kind} ${row.id} carries no instance ${id}`)
  row.data.inventory = { ...l, entries: l.entries.map(e => (e.instance.id === id ? { ...e, instance: { ...e.instance, enchant } } : e)) }
}

export const instanceOf =(row: Row, id: number): Instance | undefined => listOf(row).entries.find(e => e.instance.id === id)?.instance

export const all = (row: Row): Instance[] => listOf(row).entries.map(e => e.instance)

export const firstOf = (row: Row, definition: string): Instance | undefined => all(row).find(i => i.definition === definition)

export const countOf = (row: Row, definition: string): number =>
  listOf(row).entries.filter(e => e.instance.definition === definition).reduce((n, e) => n + e.count, 0)

export function consume(row: Row, definition: string, count: number): boolean {
  if (countOf(row, definition) < count) return false
  const l = listOf(row)
  let left = count
  const entries: Entry[] = []
  for (const e of l.entries) {
    if (e.instance.definition !== definition || left === 0) {
      entries.push(e)
      continue
    }
    const took = Math.min(left, e.count)
    left -= took
    if (e.count > took) entries.push({ ...e, count: e.count - took })
  }
  row.data.inventory = { ...l, entries }
  return true
}
