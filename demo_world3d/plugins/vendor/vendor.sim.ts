// vendor: demo_world3d's own plugin, buying and selling, after World of Warcraft's vendors as the TrinityCore server
// keeps them (`npc_vendor`, an item's `BuyPrice` and `SellPrice`, and the buyback slots) (core issue #67). This file
// is its server half; it has no page half. Its file is a loader `json` entry the scene names in `world.vendor.file`:
//   vendors   `{ <kind>: { <record>: [{ item, max, restock }] } }`: what a vendor of that kind with that record (its
//             row's `record`, `plugins/mmo3d`) sells, in order (`npc_vendor`): an inventory item
//             (`plugins/inventory`), `max` the most it has at once (0: never runs out, `maxcount`), and `restock` the
//             seconds after it first sells one that it has `max` again (`incrtime`)
//   buyback   how many of what a player sold are kept to buy back, newest first (`BUYBACK_SLOT_COUNT`, 12)
// Prices are the item's `price` fragment: `buy` the gold a vendor asks for one, `sell` the gold it pays.
// What a vendor has left is on its row, `stock` `{ <item>: { left, since } }` (none: it has `max`), counted on its own
// clock, its row's `clock` seconds. A player's sold items are its row's `buyback` `[{ instance, count, price }]`.
//   stockOf(w, vendor, item)      how many of the item the vendor has now; Infinity when it never runs out.
//   buy(w, me, vendor, i, count)  `count` of the vendor's i-th item bought, when it has that many and the player
//                                 that much gold; whether it was.
//   sell(w, me, vendor, id)       the carried instance of that id sold whole, when it has a `sell` price, to the
//                                 front of the buyback; whether it was. One worn or on the quick bar is refused by the
//                                 act that calls it.
//   buyBack(me, i)            the i-th of the buyback bought back for what it sold for; whether it was.
//   step(w, vendor, dt)           once a step on a vendor's row: its clock on, and each item whose restock is up
//                                 back to its `max`.
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import { addDefinition, consume, countOf, entryOf, fragment, removeInstance, type Instance } from '../inventory/inventory.sim.ts'

export type Sold = { item: string; max: number; restock: number }
export type Stock = Record<string, { left: number; since: number }>
export type Back = { instance: Instance; count: number; price: number }
type File = { vendors: Record<string, Record<string, Sold[]>>; buyback: number }

const fileOf = (from: W | Wire): File => json(from, ('find' in from ? from.world : from.scene.world!).vendor.file)

// What that row sells: its kind's list for its record; nothing for a row that is no vendor.
export const listOf = (w: W | Wire, vendor: Row): Sold[] => fileOf(w).vendors[vendor.kind]?.[vendor.data.record] ?? []

const priceOf = (w: W | Wire, item: string): { buy: number; sell: number } | undefined => fragment(w, item, 'price')

export function stockOf(w: W | Wire, vendor: Row, item: string): number {
  const s = listOf(w, vendor).find(x => x.item === item)
  if (!s) return 0
  if (s.max === 0) return Infinity
  return (vendor.data.stock as Stock)[item]?.left ?? s.max
}

export function buy(w: W, me: Row, vendor: Row, i: number, count: number): boolean {
  const s = listOf(w, vendor)[i]
  const p = s && priceOf(w, s.item)
  if (!s || !p || count < 1 || stockOf(w, vendor, s.item) < count) return false
  if (!consume(me, 'gold', p.buy * count)) return false
  addDefinition(w, me, s.item, count)
  if (s.max > 0) {
    const was = (vendor.data.stock as Stock)[s.item]
    vendor.data.stock = { ...vendor.data.stock, [s.item]: { left: stockOf(w, vendor, s.item) - count, since: was?.since ?? vendor.data.clock } }
  }
  return true
}

export function sell(w: W, me: Row, _vendor: Row, id: number): boolean {
  const e = entryOf(me, id)
  const p = e && priceOf(w, e.instance.definition)
  if (!e || !p) return false
  removeInstance(me, id)
  const price = p.sell * e.count
  if (price > 0) addDefinition(w, me, 'gold', price)
  me.data.buyback = [{ instance: e.instance, count: e.count, price }, ...(me.data.buyback as Back[])].slice(0, fileOf(w).buyback)
  return true
}

export function buyBack(me: Row, i: number): boolean {
  const b = (me.data.buyback as Back[])[i]
  if (!b || !consume(me, 'gold', b.price)) return false
  const l = me.data.inventory
  me.data.inventory = { ...l, entries: [...l.entries, { instance: b.instance, count: b.count }] }
  me.data.buyback = (me.data.buyback as Back[]).filter((_, j) => j !== i)
  return true
}

export function step(w: W, vendor: Row, dt: number) {
  vendor.data.clock += dt
  const stock = vendor.data.stock as Stock
  const sold = listOf(w, vendor)
  let changed = false
  const next: Stock = {}
  for (const [item, s] of Object.entries(stock)) {
    const at = sold.find(x => x.item === item)!
    if (vendor.data.clock >= s.since + at.restock) changed = true
    else next[item] = s
  }
  if (changed) vendor.data.stock = next
}

export const gold = (me: Row) => countOf(me, 'gold')
