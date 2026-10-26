// checked, demo_npc3d's own plugin: its mod for npc3d (`addons/scenemanager`'s mods), going to see a
// fact and running from one, each once. npc3d keeps what has reached an NPC, its row's `facts`, `{ type,
// position, time }`; whether the NPC has dealt with one is this game's, kept on the NPC's own row:
// `checked`, `{ <type>: <time> }`, the time of the fact of each type it last dealt with. A fact is
// unchecked while the time under its type is not its own, so a newer fact of a type, which takes the
// place of the old one in `facts`, is unchecked.
//
// A scene names it in `world.npc3d.mods.behaviors: 'checked'`, with `checked` in `world.shipped.plugins`
// so the mod is found in this folder. It hands npc3d two behaviours:
//   investigate  goes to see the newest unchecked fact of its `types`. Its score is its `weight` while
//                there is one. It walks on `clip` at `speed` to the fact's position, its eyes on it,
//                unless it stands within `near` of it already; there, the fact is checked, and it
//                stands on `stand` for seconds rolled within `for`. Its row's `sound` is the fact it
//                went to see.
//   panic        runs from the newest unchecked fact of its `types`. Its score is its `weight` while
//                there is one. Every fact of its `types` it holds is checked, it runs from that one
//                (npc3d's `away`: on `clip` at `speed`, `away` metres, kept within `bounds`), and it
//                stands there on a clip rolled from `clips` for seconds rolled within `for`.
import type { Row } from '#engine/engine.ts'
import { away, pick, roll, toward, travel, type Behavior, type Fact } from '#plugins/npc3d/npc3d.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

// Whether `me` has dealt with `fact`.
const isChecked = (me: Row, fact: Fact) => me.data.checked[fact.type] === fact.time

// The newest fact of `types` `me` holds and has not checked, or undefined when there is none.
function newest(me: Row, types: string[]): Fact | undefined {
  let best: Fact | undefined
  for (const f of me.data.facts as Fact[]) if (!isChecked(me, f) && types.includes(f.type) && (!best || f.time > best.time)) best = f
  return best
}

// `fact` checked on `me`'s row, when it is not already.
function check(me: Row, fact: Fact) {
  if (isChecked(me, fact)) return
  me.data.checked = { ...me.data.checked, [fact.type]: fact.time }
}

export function behaviors(): Record<string, Behavior> {
  const investigate: Behavior = {
    score: (me, _w, set) => (newest(me, set.types) ? set.weight : 0),
    start(me, w, set, time, body, k) {
      const f = newest(me, set.types)!
      const at = body.where(me, time)
      me.data.gaze = toward(at[0], at[2], f.position[0], f.position[2])
      me.data.sound = { type: f.type, position: f.position, time: f.time }
      if (math.hypot(f.position[0] - at[0], f.position[2] - at[2]) <= set.near) {
        investigate.arrive!(me, w, set, time, body, k)
        return
      }
      me.data.until = travel(me, w, time, body, f.position, set.speed, set.clip)
    },
    arrive(me, w, set, time, body) {
      check(me, me.data.sound)
      body.stand(me, w, time, set.stand)
      me.data.until = time + roll(w, set.for)
    },
  }
  const panic: Behavior = {
    score: (me, _w, set) => (newest(me, set.types) ? set.weight : 0),
    start(me, w, set, time, body) {
      const f = newest(me, set.types)!
      for (const held of me.data.facts as Fact[]) if (set.types.includes(held.type)) check(me, held)
      away(me, w, set, time, body, f.position)
    },
    arrive(me, w, set, time, body) {
      body.stand(me, w, time, pick(w, set.clips))
      me.data.until = time + roll(w, set.for)
    },
  }
  return { investigate, panic }
}
