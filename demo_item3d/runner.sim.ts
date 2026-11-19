// The runner: an X Bot (`as: "xbot"`) that stands where its actor puts it, moved by kinematics3d and
// played and drawn by motion3d by the X Bot's motion3d file, its stick let go, so it plays its standing
// motion. motion3d hangs what its kind's `props` name on its bones: a wrench of item3d's in its right
// hand. Its own fields, beside kinematics3d's and motion3d's: `stood`, once it stands on the ground
// under its actor's place; and `fast` and `guard`, the game's states its motion file asks
// (`plugins/stance`), false while it stands.
import type { Kind } from '#engine/engine.ts'
import { drive } from '#plugins/motion3d/motion3d.sim.ts'
import { nearest } from '#plugins/kinematics3d/kinematics3d.sim.ts'

export const runner: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.stood) return
    d.pos = nearest(w, { triangles: {} }, [d.pos[0], 0, d.pos[2]], me)
    d.stood = true
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    d.want = [0, 0]
    d.face = null
    drive(me, w, dt, [0, 0])
  },
}
