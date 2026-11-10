// mmo3d: demo_world3d's own plugin, a place's population and the rules it plays by (core issue #67). This file is its
// server half. The place's mmo3d file is a loader `json` entry the scene names in `world.mmo3d.file`:
//   landmarks   the loader `json` entry of the place's crowd file, whose `landmarks` `{ <name>: { at, yaw } }` an `at`
//               may name.
//   facts       `{ <name>: number }`: the place's facts as the place starts, written on the `factsdb` row
//               (`plugins/factsdb`) on the first step.
//   placements  `[{ kind, at, yaw?, when? }]`: one row of the kind, standing at `at` and facing `yaw` (radians; a
//               landmark's own yaw when `at` names one and `yaw` is left out, else 0). With `when`, a factsdb
//               condition (`holds`, read on the place's facts), the row stands only while it holds: it is spawned the
//               step it comes to hold and ended the step it stops.
//   spawns      `[{ kind, at, count, spread, respawn?, when? }]`: a pack of `count` rows of the kind, each spawned at a
//               point within `spread` metres of `at` across the ground (`at`'s own height; the body stands itself on
//               the ground), facing a way of its own. A row of a pack that is gone is spawned again `respawn` seconds
//               after it went, never without `respawn`. With `when`, nothing of the pack is spawned, first or again,
//               while it does not hold; the rows standing stay.
//   zones       `[{ name, at, radius, set }]`: a circle across the ground of `radius` metres round `at`. Each time a
//               `player` row comes into it, each fact of `set` `{ <name>: number }` is written (factsdb's `write`: on
//               that player's facts, or the place's for a name `world.` starts).
// An `at` is [x, y, z] or a landmark's name. Every kind a placement or a spawn names is a kind of the game's own, its
// rule a one-line file handing out one of this file's rules (`zombie.sim.ts`: `export const zombie = mob`), with its
// own definition and its own prefab. The `mmo3d` row, one `actors` entry, does all of it, writing `pos` and `yaw` over
// each kind's prefab. What it keeps from step to step is on its row:
//   started     whether the starting facts are written;
//   time        seconds since the place started;
//   present     `{ <placement index>: row id }`, each placement's row while it stands;
//   packs       one per spawn, `{ ids, due }`: the ids of its rows standing, and the times its rows gone are due back;
//   inside      `{ <zone name>: player row ids }`, the players in each zone as the last step left them.
//
// `mob` is the rule of every kind that fights: npc3d's `npc` (`plugins/npc3d`), on the body its definition names,
// seeing, noticing and choosing by its definition, with gas3d's (`plugins/gas3d`) laid over it:
//   - its row's `gas` started on its first step from its definition's `attributes`, and stepped every step;
//   - its `hit` act gas3d's: handed a hitscan3d `Struck` naming the `ability` that struck it and the row it was `by`,
//     gas3d puts that ability's effects on it, and while its health is over 0 it plays its definition's `hit.clip`
//     once through from `hit.from` seconds in, past the clip's still start; only rules strike, so a seat's `hit`
//     changes nothing;
//   - it keeps who struck it last, `struckBy` `{ id, kind }`, or null;
//   - the step its health reaches 0, by a strike or by an effect on it (a burn), it is `dead`, the kill is written to
//     the facts of the row that struck it last and the place's (`plugins/factsdb`'s `kill`: `killed.<kind>` up by
//     1), the kill counted for that row's quests (`plugins/quests`'s `credit`), its definition's `loot` table is rolled (`plugins/loot`) and what drops added to that row's inventory when
//     it carries one (`plugins/inventory`), its gold as the item `gold`, and it starts its definition's `dies` key (npc3d's `die`: its death clip held, and the row ended after the
//     key's `for`).
// What it does when it has noticed its prey is mmo3d's npc3d behaviour `hunt` (`mmo3d.npc3d.ts`).
//
// Its mod for hitscan3d, `mmo3d.hitscan3d.ts`, hands hitscan3d every placed kind's rows as bodies; its mod for npc3d,
// `mmo3d.npc3d.ts`, delivers `hunt`; its page half, `mmo3d.plugin.ts`, is what shipped loads so they are found.
import type { Kind, Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import type { Struck } from '#plugins/hitscan3d/hitscan3d.sim.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import { npc } from '#plugins/npc3d/npc3d.sim.ts'
import { play } from '#plugins/anim/anim.sim.ts'
import { receive, start, step, value } from '../gas3d/gas3d.sim.ts'
import { holds, kill, set, world, write } from '../factsdb/factsdb.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { roll } from '../loot/loot.sim.ts'
import { addDefinition } from '../inventory/inventory.sim.ts'
import { credit } from '../quests/quests.sim.ts'

const TURN = 2 * Math.PI

export type At = number[] | string
export type Placement = { kind: string; at: At; yaw?: number; when?: string }
export type Spawn = { kind: string; at: At; count: number; spread: number; respawn?: number; when?: string }
export type Zone = { name: string; at: At; radius: number; set: Record<string, number> }
export type File = {
  landmarks: string
  facts: Record<string, number>
  placements: Placement[]
  spawns: Spawn[]
  zones: Zone[]
}
type Landmark = { at: number[]; yaw: number }
type Pack = { ids: number[]; due: number[] }

export const fileOf = (from: W | Wire): File => json(from, ('find' in from ? from.world : from.scene.world!).mmo3d.file)

// The kinds the place's placements and spawns name.
export const kindsOf = (w: W): string[] => {
  const f = fileOf(w)
  return [...new Set([...f.placements.map(p => p.kind), ...f.spawns.map(s => s.kind)])]
}

// Where an `at` stands and the way it faces: [x, y, z] as it is, a landmark's name as the crowd file places it.
export function where(w: W | Wire, at: At): Landmark {
  if (typeof at !== 'string') return { at: [...at], yaw: 0 }
  const l = (json(w, fileOf(w).landmarks).landmarks as Record<string, Landmark>)[at]
  if (!l) throw new Error(`mmo3d: no landmark ${at} in ${fileOf(w).landmarks}`)
  return { at: [...l.at], yaw: l.yaw }
}

const when = (w: W, c: string | undefined) => c === undefined || holds(w, world(w), c)
const standing = (w: W, kind: string, id: number) => w.all(kind).some(r => r.id === id)

function place(me: Row, w: W) {
  const present: Record<string, number> = { ...me.data.present }
  fileOf(w).placements.forEach((p, i) => {
    const id = present[i]
    const up = id !== undefined && standing(w, p.kind, id)
    if (id !== undefined && !up) delete present[i]
    const ok = when(w, p.when)
    if (ok && !up) {
      const l = where(w, p.at)
      present[i] = w.spawn(p.kind, { pos: l.at, yaw: p.yaw ?? l.yaw }).id
    } else if (!ok && up) {
      w.end(w.get(id))
      delete present[i]
    }
  })
  me.data.present = present
}

function spawn(me: Row, w: W) {
  const now = me.data.time as number
  me.data.packs = fileOf(w).spawns.map((s, i) => {
    const was: Pack = me.data.packs[i] ?? { ids: [], due: Array.from({ length: s.count }, () => now) }
    const ids = was.ids.filter(id => standing(w, s.kind, id))
    const gone = was.ids.length - ids.length
    const due = s.respawn === undefined ? was.due : [...was.due, ...Array.from({ length: gone }, () => now + s.respawn!)]
    if (!when(w, s.when)) return { ids, due }
    const c = where(w, s.at).at
    for (const _ of due.filter(t => t <= now)) {
      const r = s.spread * math.pow(w.die(), 0.5)
      const a = TURN * w.die()
      const pos = [c[0] + r * math.cos(a), c[1], c[2] + r * math.sin(a)]
      ids.push(w.spawn(s.kind, { pos, yaw: TURN * w.die() }).id)
    }
    return { ids, due: due.filter(t => t > now) }
  })
}

function zones(me: Row, w: W) {
  const players = w.all('player')
  const inside: Record<string, number[]> = {}
  for (const z of fileOf(w).zones) {
    const c = where(w, z.at).at
    const was: number[] = me.data.inside[z.name] ?? []
    inside[z.name] = []
    for (const p of players) {
      const [x, , zz] = p.data.pos as number[]
      if (math.hypot(x - c[0], zz - c[2]) > z.radius) continue
      inside[z.name].push(p.id)
      if (was.includes(p.id)) continue
      for (const [name, value] of Object.entries(z.set)) write(w, p, name, value)
    }
  }
  me.data.inside = inside
}

export const mmo3d: Kind = {
  tick(me, dt, w) {
    if (!me.data.started) {
      me.data.started = true
      for (const [name, value] of Object.entries(fileOf(w).facts)) set(world(w), name, value)
    }
    me.data.time += dt
    zones(me, w)
    place(me, w)
    spawn(me, w)
  },
}

// The step its health reaches 0: `dead`, the kill written (factsdb's `kill`, to the facts of the row that struck it
// last while that row is there, and the place's), and its definition's `dies` key started.
function dies(me: Row, w: W) {
  const d = me.data
  if (d.dead || value(w, me, 'health') > 0) return
  d.dead = true
  d.casting = null
  const killer = d.struckBy === null ? undefined : w.all(d.struckBy.kind).find(r => r.id === d.struckBy.id)
  kill(w, killer, me.kind)
  if (killer?.data.factsdb) credit(w, killer, me.kind)
  const k = def(w, me.kind)
  if (k.loot !== undefined && killer?.data.inventory) {
    const drop = roll(w, k.loot)
    if (drop.gold > 0) addDefinition(w, killer, 'gold', drop.gold)
    for (const i of drop.items) addDefinition(w, killer, i.item, i.count)
  }
  w.call(me, 'force', -1, k.dies)
}

export const mob: Kind = {
  tick(me, dt, w) {
    const d = me.data
    if (!d.gas) start(w, me, def(w, me.kind).attributes)
    step(w, me, dt)
    dies(me, w)
    npc.tick!(me, dt, w)
  },
  acts: {
    ...npc.acts,
    hit(me, w, seat, struck: unknown) {
      const d = me.data
      const s = struck as Struck
      if (seat >= 0 || d.dead || !d.gas || typeof s.ability !== 'string') return
      d.struckBy = { id: s.by, kind: w.get(s.by).kind }
      receive(w, me, s.ability, s.by)
      if (value(w, me, 'health') <= 0) return dies(me, w)
      const k = def(w, me.kind)
      play(me, k.hit.clip)
      d.clipT = k.hit.from
    },
  },
}
