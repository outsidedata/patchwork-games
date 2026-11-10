// quickbar: demo_world3d's own plugin, the items a body holds ready, one of them in its hands, after Lyra's quick bar
// (Epic's Lyra Starter Game, `ULyraQuickBarComponent`) (core issue #67). This file is its server half; it has no page
// half. A body with one has `quickbar` on its row, `{ slots, active }`: `slots`, as many as its prefab gives,
// each an inventory instance's id (`plugins/inventory`) or null; `active`, the slot in the hands, or -1.
// The slot made active has its item's `equippable` fragment's equipment equipped (`plugins/equipment`'s `equip`),
// and the one it was taken off.
//   addToSlot(w, row, slot, instance)   the instance put in the slot, when that slot is empty (`AddItemToSlot`).
//   removeFromSlot(w, row, slot)        the slot emptied, its item unequipped first while it is the active one; the
//                                       instance that was in it (`RemoveItemFromSlot`).
//   setActive(w, row, slot)             the slot made active, the item in the active slot unequipped and the new
//                                       one's equipped (`SetActiveSlotIndex`); -1 holds nothing.
//   activeInstance(row)                 the id of the instance in the active slot, or null.
import type { Row, W } from '#engine/engine.ts'
import { fragment, instanceOf } from '../inventory/inventory.sim.ts'
import { equip, unequip } from '../equipment/equipment.sim.ts'

export type Quickbar = { slots: (number | null)[]; active: number }

const barOf = (row: Row): Quickbar => {
  const q = row.data.quickbar as Quickbar | undefined
  if (!q) throw new Error(`quickbar: ${row.kind} ${row.id} has no quick bar`)
  return q
}

export const activeInstance = (row: Row): number | null => {
  const q = barOf(row)
  return q.active < 0 ? null : q.slots[q.active]
}

function holdActive(w: W, row: Row) {
  const id = activeInstance(row)
  if (id === null) return
  const i = instanceOf(row, id)
  if (!i) throw new Error(`quickbar: ${row.kind} ${row.id} carries no instance ${id}`)
  const e = fragment(w, i.definition, 'equippable')
  if (e) equip(w, row, e.equipment, id)
}

function dropActive(w: W, row: Row) {
  const id = activeInstance(row)
  if (id === null) return
  const i = instanceOf(row, id)
  if (i && fragment(w, i.definition, 'equippable')) unequip(w, row, id)
}

export function addToSlot(_w: W, row: Row, slot: number, instance: number) {
  const q = barOf(row)
  if (q.slots[slot] !== null) return
  row.data.quickbar = { ...q, slots: q.slots.map((s, i) => (i === slot ? instance : s)) }
}

export function removeFromSlot(w: W, row: Row, slot: number): number | null {
  const q = barOf(row)
  if (q.active === slot) {
    dropActive(w, row)
    row.data.quickbar = { ...barOf(row), active: -1 }
  }
  const was = q.slots[slot]
  row.data.quickbar = { ...barOf(row), slots: barOf(row).slots.map((s, i) => (i === slot ? null : s)) }
  return was
}

export function setActive(w: W, row: Row, slot: number) {
  const q = barOf(row)
  if (q.active === slot) return
  dropActive(w, row)
  row.data.quickbar = { ...q, active: slot }
  holdActive(w, row)
}
