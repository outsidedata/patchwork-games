// enchanting: demo_world3d's own plugin, enchanting an item, after World of Warcraft's item enchantments as the
// TrinityCore server keeps them: an enchanting spell, taking reagents, puts an enchantment (`SpellItemEnchantment`)
// in the permanent enchantment slot of one item of the classes it allows (`EquippedItemClass`), replacing the one
// there, and the enchantment's stats are the wearer's while that item is equipped (core issue #67). Here an enchanter
// casts it for the player, for a fee in gold beside the reagents. This file is its server half; it has no page half.
// Its file is a loader `json` entry the scene names in `world.enchanting.file`:
//   enchants    `{ <id>: { name, class, abilitySet, reagents, gold } }`: the item class it goes on (an `equippable`
//               fragment's `class`, `plugins/inventory`), the gas3d ability set it grants while the item is equipped
//               (`plugins/gas3d`'s `abilitySets`), `reagents` `[{ item, count }]`, and the gold the enchanter asks
//   enchanters  `{ <kind>: [<enchant id>] }`: what a kind enchants with
// The enchant is on the item instance (inventory's `enchant`), so it goes where the item goes.
//   enchant(w, me, enchanter, id, instance)   the enchant put on the carried instance, when the enchanter's kind
//                                             has it, the item is of its class, and the player carries its reagents
//                                             and gold: they are used up, and the item, if equipped, is equipped
//                                             again with it (`plugins/equipment`); whether it was.
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import { consume, countOf, enchantInstance, fragment, instanceOf } from '../inventory/inventory.sim.ts'
import { equip, equippedFrom, unequip } from '../equipment/equipment.sim.ts'

export type Enchantment = { name: string; class: string; abilitySet: string; reagents: { item: string; count: number }[]; gold: number }
type File = { enchants: Record<string, Enchantment>; enchanters: Record<string, string[]> }

const fileOf = (from: W | Wire): File => json(from, ('find' in from ? from.world : from.scene.world!).enchanting.file)

export const enchantsOf = (from: W | Wire) => fileOf(from).enchants
export const enchanterOf = (w: W | Wire, kind: string) => fileOf(w).enchanters[kind] ?? []

export function enchant(w: W, me: Row, enchanter: Row, id: string, instance: number): boolean {
  const e = enchantsOf(w)[id]
  const i = instanceOf(me, instance)
  if (!e || !i || !enchanterOf(w, enchanter.kind).includes(id)) return false
  if (fragment(w, i.definition, 'equippable')?.class !== e.class) return false
  if (!e.reagents.every(g => countOf(me, g.item) >= g.count) || countOf(me, 'gold') < e.gold) return false
  for (const g of e.reagents) consume(me, g.item, g.count)
  consume(me, 'gold', e.gold)
  const worn = equippedFrom(me, instance)
  if (worn) unequip(w, me, instance)
  enchantInstance(me, instance, { name: id, abilitySet: e.abilitySet })
  if (worn) equip(w, me, worn.definition, instance)
  return true
}
