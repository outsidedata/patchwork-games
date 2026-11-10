// classes: demo_world3d's own plugin, what a player starts as, after World of Warcraft's classes as the TrinityCore
// server keeps them: a class's base stats (`player_classlevelstats`), the spells it starts knowing
// (`playercreateinfo_spell`) and the items it starts with (`playercreateinfo_item`), given on the character's making
// (core issue #67). This file is its server half; it has no page half. Its file is a loader `json` entry the scene
// names in `world.classes.file`:
//   classes  `{ <class>: { name, about, attributes, effects, abilities, items, weapons } }`:
//              name, about  what the class is called, and the line that says what it does, shown when one is picked
//              attributes   its gas3d attributes' bases (`plugins/gas3d`)
//              effects      gas3d effects on it from the start (its mana regeneration)
//              abilities    the gas3d abilities it knows, each played by its `press` key
//              items        `[{ item, count }]`: inventory items it starts with (`plugins/inventory`); each that is
//                           equippable is equipped, a weapon on the first slot of the quick bar and held, any other worn
//              weapons      the motion3d stances its draw key draws (`swordshield`, `magic`), the first drawn at once
// A player's class is its row's `class`, null until one is picked; until then it has no `gas` and does nothing.
//   classOf(from, name)        the file's class of that name.
//   classesOf(from)            the file's classes.
//   make(w, me, name)          the class given to the row: its attributes and effects started, its items added and
//                              equipped, its first weapon its `weapon`. Throws on a class the file has not got.
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import { start } from '../gas3d/gas3d.sim.ts'
import { addDefinition, fragment } from '../inventory/inventory.sim.ts'
import { equip } from '../equipment/equipment.sim.ts'
import { addToSlot, setActive } from '../quickbar/quickbar.sim.ts'

export type Class = {
  name: string
  about: string
  attributes: Record<string, number>
  effects: string[]
  abilities: string[]
  items: { item: string; count: number }[]
  weapons: string[]
}

export const classesOf = (from: W | Wire): Record<string, Class> => json(from, ('find' in from ? from.world : from.scene.world!).classes.file).classes

export function classOf(from: W | Wire, name: string): Class {
  const c = classesOf(from)[name]
  if (!c) throw new Error(`classes: the file has no class ${name}`)
  return c
}

export function make(w: W, me: Row, name: string) {
  const c = classOf(w, name)
  me.data.class = name
  start(w, me, c.attributes, c.effects)
  for (const g of c.items) {
    const i = addDefinition(w, me, g.item, g.count)
    const e = fragment(w, g.item, 'equippable')
    if (!e) continue
    if (e.class === 'weapon' && me.data.quickbar.slots[0] === null) {
      addToSlot(w, me, 0, i.id)
      setActive(w, me, 0)
    } else equip(w, me, e.equipment, i.id)
  }
  me.data.weapon = c.weapons[0] ?? ''
}
