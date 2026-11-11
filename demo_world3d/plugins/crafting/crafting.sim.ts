// crafting: demo_world3d's own plugin, making things, after World of Warcraft's professions as the TrinityCore
// server keeps them: a recipe is a spell that takes reagents and creates an item (`Reagent`, `ReagentCount`, its
// effect's `ItemType`), cast within reach of the object it needs (`RequiresSpellFocus`, an anvil), known once a
// trainer has taught it for its cost (`npc_trainer`'s `SpellID` and `MoneyCost`) (core issue #67). This file is its
// server half; it has no page half. Its file is a loader `json` entry the scene names in `world.crafting.file`:
//   recipes   `{ <id>: { name, reagents, creates, focus } }`: `reagents` `[{ item, count }]` and `creates`
//             `{ item, count }`, inventory items (`plugins/inventory`); `focus` `{ at, reach }`, where the object it
//             needs stands (an `at` as mmo3d's place file takes it, [x, y, z] or an identity) and how near,
//             in metres across the ground, the player must be, or null
//   trainers  `{ <kind>: { <record>: [{ recipe, cost }] } }`: what a trainer of that kind with that record (its row's
//             `record`, `plugins/mmo3d`) teaches and the gold it asks
// A recipe a player knows is its fact `recipe.<id>`, 1 (`plugins/factsdb`).
//   learn(w, me, trainer, recipe)   the recipe taught, when the trainer teaches it, the player does not know it
//                                   and has its cost; whether it was.
//   craft(w, me, recipe)            the recipe made, when the player knows it, stands within its focus and carries
//                                   its reagents: they are used up and what it creates added; whether it was.
//   recipesOf(from), trainerOf(w, trainer)   the file's recipes; what that row teaches.
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { fact, set } from '../factsdb/factsdb.sim.ts'
import { addDefinition, consume, countOf } from '../inventory/inventory.sim.ts'
import { where, type At } from '../mmo3d/mmo3d.sim.ts'

export type Counted = { item: string; count: number }
export type Recipe = { name: string; reagents: Counted[]; creates: Counted; focus: { at: At; reach: number } | null }
type File = { recipes: Record<string, Recipe>; trainers: Record<string, Record<string, { recipe: string; cost: number }[]>> }

const fileOf = (from: W | Wire): File => json(from, ('find' in from ? from.world : from.scene.world!).crafting.file)

export const recipesOf = (from: W | Wire) => fileOf(from).recipes
export const trainerOf = (w: W | Wire, trainer: Row) => fileOf(w).trainers[trainer.kind]?.[trainer.data.record] ?? []

export function learn(w: W, me: Row, trainer: Row, recipe: string): boolean {
  const t = trainerOf(w, trainer).find(x => x.recipe === recipe)
  if (!t || fact(me, `recipe.${recipe}`)) return false
  if (!consume(me, 'gold', t.cost)) return false
  set(me, `recipe.${recipe}`, 1)
  return true
}

export function craft(w: W, me: Row, id: string): boolean {
  const r = recipesOf(w)[id]
  if (!r || !fact(me, `recipe.${id}`)) return false
  if (r.focus) {
    const at = where(w, r.focus.at).at
    if (math.hypot(me.data.pos[0] - at[0], me.data.pos[2] - at[2]) > r.focus.reach) return false
  }
  if (!r.reagents.every(g => countOf(me, g.item) >= g.count)) return false
  for (const g of r.reagents) consume(me, g.item, g.count)
  addDefinition(w, me, r.creates.item, r.creates.count)
  return true
}
