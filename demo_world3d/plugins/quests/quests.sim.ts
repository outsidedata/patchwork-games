// quests: demo_world3d's own plugin, a player's quests, after World of Warcraft's as the TrinityCore server keeps
// them (`quest_template`, `creature_queststarter`, `creature_questender`, `character_queststatus`, and a quest's end
// script, `quest_end_scripts`) (core issue #67). This file is its server half; it has no page half. Its file is a
// loader `json` entry the scene names in `world.quests.file`:
//   quests  `{ <id>: quest }`:
//             title       the quest's name in the log (`LogTitle`)
//             details     what the giver says it is (`QuestDescription`)
//             objectives  what the log says to do (`LogDescription`)
//             starters, enders  the kinds that give it and take it back (`creature_queststarter`,
//                         `creature_questender`)
//             prev        a quest that must be rewarded before this one is given (`PrevQuestID`), or null
//             kills       `[{ kind, count }]`: rows of the kind to kill once it is taken (`RequiredNpcOrGo`,
//                         `RequiredNpcOrGoCount`)
//             items       `[{ item, count }]`: inventory items to carry (`plugins/inventory`), taken on turn-in
//                         (`RequiredItemId`, `RequiredItemCount`)
//             gold        gold given on turn-in (`RewardMoney`)
//             rewards     `[{ item, count }]`: items given on turn-in (`RewardItem`, `RewardAmount`)
//             endScript   `{ <fact>: number }` written on turn-in (factsdb's `write`; `world.` names the place's), its
//                         `quest_end_scripts`
// A quest's status on a player is its fact `quest.<id>` (`plugins/factsdb`), TrinityCore's numbers: 0 none, 3 taken
// and not yet done (`QUEST_STATUS_INCOMPLETE`), 1 done and not yet turned in (`QUEST_STATUS_COMPLETE`), 6 turned in
// (`QUEST_STATUS_REWARDED`). The kills of a taken quest are its facts `quest.<id>.kill.<kind>` (`mobcount`), counted
// from when it is taken; what it carries is counted off the inventory as it stands.
//   accept(w, me, speaker, id)   the quest taken from the speaker, when its kind starts it, the quest's status is 0 and
//                                its `prev` is turned in; whether it was.
//   reward(w, me, speaker, id)   the quest turned in to the speaker, when its kind ends it and it is done: its items
//                                taken, its gold and rewards given, its end script run, its status 6; whether it was.
//   credit(w, me, kind)          a kill of the kind counted for every quest the player has taken (`KilledMonsterCredit`).
//   step(w, me)                  once a step: each taken quest whose objectives are all met is done, and each done
//                                one whose are no longer met (an item given away) is taken again.
//   progress(from, me, id)       each objective with how far along it is, `[{ what, has, count }]`.
// Talk reaches these through its `accept` and `reward` actions (`plugins/talk`).
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import { add, fact, set, write } from '../factsdb/factsdb.sim.ts'
import { addDefinition, consume, countOf } from '../inventory/inventory.sim.ts'

export type Count = { count: number }
export type Quest = {
  title: string
  details: string
  objectives: string
  starters: string[]
  enders: string[]
  prev: string | null
  kills: ({ kind: string } & Count)[]
  items: ({ item: string } & Count)[]
  gold: number
  rewards: ({ item: string } & Count)[]
  endScript: Record<string, number>
}

export const NONE = 0, COMPLETE = 1, INCOMPLETE = 3, REWARDED = 6

export const questsOf = (from: W | Wire): Record<string, Quest> => json(from, ('find' in from ? from.world : from.scene.world!).quests.file).quests

function questOf(from: W | Wire, id: string): Quest {
  const q = questsOf(from)[id]
  if (!q) throw new Error(`quests: the file has no quest ${id}`)
  return q
}

export const status = (me: Row, id: string) => fact(me, `quest.${id}`)

export function progress(from: W | Wire, me: Row, id: string): { what: string; has: number; count: number }[] {
  const q = questOf(from, id)
  return [
    ...q.kills.map(k => ({ what: k.kind, has: Math.min(k.count, fact(me, `quest.${id}.kill.${k.kind}`)), count: k.count })),
    ...q.items.map(i => ({ what: i.item, has: Math.min(i.count, countOf(me, i.item)), count: i.count })),
  ]
}

const met = (w: W, me: Row, id: string) => progress(w, me, id).every(p => p.has >= p.count)

export function accept(w: W, me: Row, speaker: Row, id: string): boolean {
  const q = questOf(w, id)
  if (!q.starters.includes(speaker.kind) || status(me, id) !== NONE) return false
  if (q.prev !== null && status(me, q.prev) !== REWARDED) return false
  for (const k of q.kills) set(me, `quest.${id}.kill.${k.kind}`, 0)
  set(me, `quest.${id}`, INCOMPLETE)
  return true
}

export function reward(w: W, me: Row, speaker: Row, id: string): boolean {
  const q = questOf(w, id)
  if (!q.enders.includes(speaker.kind) || status(me, id) !== COMPLETE || !met(w, me, id)) return false
  for (const i of q.items) consume(me, i.item, i.count)
  if (q.gold > 0) addDefinition(w, me, 'gold', q.gold)
  for (const r of q.rewards) addDefinition(w, me, r.item, r.count)
  for (const [name, n] of Object.entries(q.endScript)) write(w, me, name, n)
  set(me, `quest.${id}`, REWARDED)
  return true
}

export function credit(w: W, me: Row, kind: string) {
  for (const [id, q] of Object.entries(questsOf(w))) {
    if (status(me, id) !== INCOMPLETE || !q.kills.some(k => k.kind === kind)) continue
    add(me, `quest.${id}.kill.${kind}`, 1)
  }
}

export function step(w: W, me: Row) {
  for (const id of Object.keys(questsOf(w))) {
    const s = status(me, id)
    if (s === INCOMPLETE && met(w, me, id)) set(me, `quest.${id}`, COMPLETE)
    else if (s === COMPLETE && !met(w, me, id)) set(me, `quest.${id}`, INCOMPLETE)
  }
}
