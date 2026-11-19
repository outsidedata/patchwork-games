// The villager: a person drawn by crowd3d (`world.crowd3d.kinds`), standing on the course its actor
// writes: `pos` and `to` the same place, `speed` 0, `yaw` the way it faces, `body` and `clip` one of
// crowd3d's, and `holding`, `{ <place>: <item> }`, what it holds where, each an item of
// `world.crowd3d.items`: a skullcap of item3d's on its head and a plain glb sword in its right hand, and
// in its left hand the wrench of item3d's once the seat's `use` hands it over (`player.sim.ts`). It has
// no rule: its row changes only when what it holds does.
import type { Kind } from '#engine/engine.ts'

export const villager: Kind = {}
