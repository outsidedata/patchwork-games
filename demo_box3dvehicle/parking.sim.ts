// What a bike does while nobody rides it: it is parked. One global actor; every step it lets go of the controls of each
// `box3dvehicle` row no `player` row holds (`holderOf`, `plugins/player`) and holds its brake, so a bike left where it
// stopped, or one the seat has not taken yet, stands on its two tyres (box3dvehicle's balance keeps it upright) and
// rolls nowhere. The bike a seat holds is never touched: its controls are the seat's (`player.sim.ts`).
import type { Kind } from '#engine/engine.ts'
import { holderOf } from '#plugins/player/player.sim.ts'

export const parking: Kind = {
  before(_me, _dt, w) {
    for (const bike of w.all('box3dvehicle')) {
      if (holderOf(w, bike)) continue
      Object.assign(bike.data, { pedal: 0, steer: 0, brake: 1 })
    }
  },
}
