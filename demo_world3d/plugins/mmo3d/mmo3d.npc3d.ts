// mmo3d's mod for npc3d (`world.npc3d.mods.behaviors: [..., 'mmo3d']`, with `mmo3d` in `world.shipped.plugins`): the
// behaviour `hunt`, what a mob (`mmo3d.sim.ts`'s `mob`) does with the prey it has noticed, its fights run by gas3d
// (`plugins/gas3d`). Its settings, a key of the mob's definition's `behaviors`:
//   at      the list of the definition naming the kinds it hunts (`"prey": ["player"]`)
//   weight  its score at no distance, falling to 0 at `range`
//   range   metres: how far off a fact of its prey may be for it to hunt
//   near    metres: how far its prey may move from where it is walking before it walks again
//   speed, clip  the walk npc3d's `travel` is handed (a walker walks at its kind's `seekSpeed`, its gears its clips)
// It scores `weight` times how near the nearest fact of its prey is (npc3d's `recall`), 0 at `range`. Started, it walks
// to the nearest living row of its prey's kinds, eyes on it, and walks again whenever that row has moved more than
// `near` from where it was going. Once it stands within the reach of the first of its definition's `abilities`
// (gas3d's `delivery.reach`), it stops, faces the row, and uses the first of its abilities gas3d says it may (no
// cooldown on, enough of what it costs): the cost and cooldown paid, the ability's `clip` played, and the ability the
// one it is `casting`. On the step that clip's blow lands (gas3d's `lands`, the frame its fastest hand or foot moves
// furthest), the row it hunts, while it is still within that reach and in front of it, is struck with the ability
// (hitscan3d's `strike`, a `Struck` naming it). A cast whose clip no longer plays (a hit stopped it) is let go. With no
// fact of its prey left, or no living row of it within `range`, the hunt is over. The row keeps `casting`, and the
// clip and playhead it last read (`blowClip`, `blowT`), so a blow is landed once.
import type { Row, W } from '#engine/engine.ts'
import * as math from '#plugins/math/math.sim.ts'
import { strike } from '#plugins/hitscan3d/hitscan3d.sim.ts'
import { play, rigOf } from '#plugins/anim/anim.sim.ts'
import { listOf, nearness, recall, toward, travel, type Behavior, type Body, type Settings } from '#plugins/npc3d/npc3d.sim.ts'
import { abilityOf, blocked, commit, lands } from '../gas3d/gas3d.sim.ts'

// The living row of the kinds `at` names nearest the mob within `range`, and how far, or undefined.
function preyOf(me: Row, w: W, set: Settings, k: Settings, at: number[]): { row: Row; far: number } | undefined {
  let best: { row: Row; far: number } | undefined
  for (const kind of listOf(me.kind, k, set.at)) {
    for (const row of w.all(kind)) {
      if (row.data.dead) continue
      const far = math.hypot(row.data.pos[0] - at[0], row.data.pos[2] - at[2])
      if (far <= set.range && (!best || far < best.far)) best = { row, far }
    }
  }
  return best
}

// The reach it fights at: its first ability's.
function reachOf(w: W, k: Settings): number {
  const d = abilityOf(w, k.abilities[0]).delivery
  if (!('reach' in d)) throw new Error(`mmo3d: a mob's first ability, ${k.abilities[0]}, is delivered by no reach`)
  return d.reach
}

// Walks it to the row it hunts.
function walkTo(me: Row, w: W, set: Settings, time: number, body: Body, there: number[]) {
  me.data.told = [there[0], there[1], there[2]]
  travel(me, w, time, body, me.data.told, set.speed, set.clip)
}

const hunt: Behavior = {
  score(me, w, set, time, _body, k) {
    const prey = recall(me, w, listOf(me.kind, k, set.at), time)[0]
    return prey ? set.weight * nearness(prey.far, set.range) : 0
  },
  start(me, w, set, time, body, k) {
    me.data.until = 0
    const prey = preyOf(me, w, set, k, body.where(me, time))
    if (prey) walkTo(me, w, set, time, body, prey.row.data.pos)
  },
  tick(me, w, set, time, body, k) {
    const d = me.data
    const at = body.where(me, time)
    const prey = recall(me, w, listOf(me.kind, k, set.at), time)[0] && preyOf(me, w, set, k, at)
    // The blow of the cast it is playing, on the step it lands.
    const was = { clip: d.blowClip, t: d.blowT }
    d.blowClip = d.clip
    d.blowT = d.clipT
    if (d.casting !== null) {
      const ability = abilityOf(w, d.casting)
      if (d.clip !== ability.clip || d.state !== 'act') d.casting = null
      else if (lands(rigOf(w, me.kind), me.kind, ability.clip!, d.clipT, was)) {
        const name: string = d.casting
        d.casting = null
        const ahead = [math.sin(d.yaw), math.cos(d.yaw)]
        const reach = (ability.delivery as { reach: number }).reach
        if (prey && prey.far <= reach) {
          const p = prey.row.data.pos
          if ((p[0] - at[0]) * ahead[0] + (p[2] - at[2]) * ahead[1] > 0) strike(w, prey.row, { damage: 0, by: me.id, ability: name, part: null, point: [...p], dir: [ahead[0], 0, ahead[1]], what: 'body' })
        }
      }
    }
    if (!prey) {
      d.until = time
      return
    }
    const there = prey.row.data.pos
    const yaw = toward(at[0], at[2], there[0], there[2])
    d.gaze = yaw
    if (d.casting !== null) return
    if (prey.far > reachOf(w, k)) {
      if (!body.moving(me) || math.hypot(there[0] - d.told[0], there[2] - d.told[2]) > set.near) walkTo(me, w, set, time, body, there)
      return
    }
    // In reach: stop, face it, and use the first ability gas3d says it may.
    if (body.moving(me)) body.halt(me, time)
    body.face(me, time, yaw)
    const name = (k.abilities as string[]).find(a => blocked(w, me, a) === undefined)
    if (name === undefined) return
    const ability = abilityOf(w, name)
    if (ability.clip === undefined) throw new Error(`mmo3d: ${me.kind} uses ${name}, which names no clip`)
    commit(w, me, name)
    play(me, ability.clip)
    d.casting = name
  },
}

export const behaviors = () => ({ hunt })
