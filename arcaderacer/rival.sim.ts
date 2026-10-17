// A CPU racer. It starts on grid place `grid` and each step of the race works out its own controls
// with the drive plugin's `pilot`, by its definition's `ai` (every number of it is in the drive
// plugin's header), then is driven and timed by the drive plugin's `run`, as the seat's car is, by its
// definition's `drive` numbers.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { courseOf, gridAt, trackOf } from './plugins/track/track.sim.ts'
import { CONTROLS, control, pilot, place, run, type Control } from './plugins/drive/drive.sim.ts'

export const rival: Kind = {
  before(me, _dt, w) {
    if (me.data.seg >= 0) return
    place(me, w, gridAt(trackOf(w), courseOf(w).track.grid, me.data.grid))
  },
  tick(me, dt, w) {
    const race = w.find('race')
    if (me.data.seg >= 0 && race.data.phase !== 'grid' && race.data.phase !== 'count') {
      const wants = pilot(w, me, def(w, me.kind).ai, me.data.grid)
      for (const name of Object.keys(CONTROLS) as Control[]) control(me, name, wants[name])
    }
    run(me, dt, w, race)
  },
}
