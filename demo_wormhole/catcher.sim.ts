// A catcher: a target a laser is aimed at, a sphere of its definition's `radius` round `pos` that a
// beam ends on (a laser names `catcher` in its `marks`). `on` is whether some laser's beam ends on it,
// as the last step's beams have it; a door naming its `name` opens while it is on.
import type { Kind } from '#engine/engine.ts'

export const catcher: Kind = {
  tick(me, _dt, w) {
    me.data.on = w.all('laser').some(l => l.data.hit === me.id)
  },
}
