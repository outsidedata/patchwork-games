// mmo3d: demo_world3d's own plugin, a place's population and the rules it plays by, read from the place's mmo3d file
// (core issue #67). Its server half is this file. The file is a loader `json` entry the scene names in
// `world.mmo3d.file`:
//   templates   `{ <name>: template }`, what each thing is. A template of `type: "mob"` is a row of the game's
//               `mob` kind (`mob.sim.ts`):
//                 as          the walker and anim kind its body is (`world.walker.kinds.<as>`, `world.anim.kinds.<as>`)
//                 attributes  `{ <attribute>: number }`, its gas3d attributes' first bases (`plugins/gas3d`): its
//                             `health` and `maxHealth`
//                 hit         `{ clip, from }`: the clip it plays when struck, from `from` seconds in
//                 death       the clip it plays when its health reaches 0, held there
//   placements  `[{ template, at, yaw }]`: one row of each template, standing at `at` [x, y, z], facing `yaw`.
// The `mmo3d` row, one `actors` entry, spawns a row for every placement on its first step, over the prefab of its
// template's kind, writing `template`, `as`, `pos` and `yaw`, and marks itself `placed` so it spawns them once.
// A placement whose template is missing, or a template of a type it does not know, throws naming it.
//
// `templateOf(w, row)` is the template a spawned row was made from.
//
// Its mod for hitscan3d, `mmo3d.hitscan3d.ts`, hands hitscan3d every mob as a body; its page half, `mmo3d.plugin.ts`,
// is what shipped loads so that mod is found.
import type { Kind, Row, W } from '#engine/engine.ts'
import { json } from '#plugins/loader/loader.sim.ts'

export type Template = { type: 'mob'; as: string; attributes: Record<string, number>; hit: { clip: string; from: number }; death: string }
export type Placement = { template: string; at: number[]; yaw: number }
export type File = { templates: Record<string, Template>; placements: Placement[] }

// The kind each type of template is a row of.
const KINDS: Record<string, string> = { mob: 'mob' }

export const fileOf = (w: W): File => json(w, w.world.mmo3d.file)

export function templateOf(w: W, row: Row): Template {
  const t = fileOf(w).templates[row.data.template]
  if (!t) throw new Error(`mmo3d: ${row.kind} ${row.id} was made from the template ${row.data.template}, which the file has none of`)
  return t
}

export const mmo3d: Kind = {
  tick(me, _dt, w) {
    if (me.data.placed) return
    me.data.placed = true
    const file = fileOf(w)
    for (const p of file.placements) {
      const t = file.templates[p.template]
      if (!t) throw new Error(`mmo3d: a placement names the template ${p.template}, which the file has none of`)
      const kind = KINDS[t.type]
      if (!kind) throw new Error(`mmo3d: the template ${p.template} is of the type ${t.type}, which mmo3d spawns no kind for`)
      w.spawn(kind, { template: p.template, as: t.as, pos: [...p.at], yaw: p.yaw })
    }
  },
}
