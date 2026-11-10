// equipment: demo_world3d's own plugin, what a body has equipped, after Lyra's equipment (Epic's Lyra Starter Game,
// `ULyraEquipmentManagerComponent`, `ULyraEquipmentDefinition`, `ULyraEquipmentInstance`) (core issue #67). This file
// is its server half; it has no page half. Its file is a loader `json` entry the scene names in
// `world.equipment.file`:
//   equipment  `{ <definition>: { abilitySets } }`, Lyra's equipment definitions: the gas3d ability sets
//              (`plugins/gas3d`'s file, `abilitySets`) equipping it grants. Lyra's `ActorsToSpawn`, the meshes hung on
//              the body, are motion3d's props here, drawn by the stance the body plays.
// A body that equips things has `equipment` on its row, Lyra's equipment list: `[{ definition, instance, handles }]`,
// each the equipment definition, the inventory item instance it came from (its `Instigator`, `plugins/inventory`),
// and the gas3d handles its ability sets handed out.
//   equip(w, row, definition, instance)  the equipment put on: an entry added, its ability sets given, and the
//                                        ability set of the enchant in the instance's permanent enchantment slot
//                                        with them (`plugins/enchanting`) (Lyra's `EquipItem`, `OnEquipped`); the
//                                        entry.
//   unequip(w, row, instance)            the entry that came from that inventory instance taken off, what its sets
//                                        gave taken back (`UnequipItem`, `OnUnequipped`).
//   equippedFrom(row, instance)          the entry that came from that inventory instance, or undefined.
// Which instance is equipped is decided by whoever calls these: the quickbar's active slot for what is held
// (`plugins/quickbar`), the `player` row's acts for what is worn.
import type { Row, W } from '#engine/engine.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import { giveSet, takeSet, type Handles } from '../gas3d/gas3d.sim.ts'
import { instanceOf } from '../inventory/inventory.sim.ts'

export type Definition = { abilitySets: string[] }
export type Equipped = { definition: string; instance: number; handles: Handles[] }

function definitionOf(w: W, name: string): Definition {
  const d = (json(w, w.world.equipment.file).equipment as Record<string, Definition>)[name]
  if (!d) throw new Error(`equipment: the file has no equipment ${name}`)
  return d
}

const listOf = (row: Row): Equipped[] => {
  const l = row.data.equipment as Equipped[] | undefined
  if (!l) throw new Error(`equipment: ${row.kind} ${row.id} equips nothing`)
  return l
}

export const equippedFrom = (row: Row, instance: number): Equipped | undefined => listOf(row).find(e => e.instance === instance)

export function equip(w: W, row: Row, definition: string, instance: number): Equipped {
  if (equippedFrom(row, instance)) throw new Error(`equipment: ${row.kind} ${row.id} has instance ${instance} equipped already`)
  const enchant = instanceOf(row, instance)?.enchant
  const sets = [...definitionOf(w, definition).abilitySets, ...(enchant ? [enchant.abilitySet] : [])]
  const handles = sets.map(s => giveSet(w, row, s))
  const e: Equipped = { definition, instance, handles }
  row.data.equipment = [...listOf(row), e]
  return e
}

export function unequip(w: W, row: Row, instance: number) {
  const e = equippedFrom(row, instance)
  if (!e) throw new Error(`equipment: ${row.kind} ${row.id} has no instance ${instance} equipped`)
  for (const h of e.handles) takeSet(w, row, h)
  row.data.equipment = listOf(row).filter(x => x !== e)
}
