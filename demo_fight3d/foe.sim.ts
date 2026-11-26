// A foe the seat's X Bot strikes: a walker body (`world.walker.kinds.foe`) played and drawn by anim
// (`world.anim.kinds.foe`: the same X Bot and the same baked clips as the seat's, by the anim rig `assets/xbot.anim.json`),
// standing where its actor puts it. melee3d knows it by anim's word, so the seat's fist and shin meet its limbs; a
// blow is fight3d's `wound` (`world.fight3d.kinds.foe`): it is frozen, shoved, bleeds, plays a reaction clip and is
// jolted, the joints about where the blow met it, and the whole body about its feet, turned at once and springing back
// onto the clip it plays; a big enough blow (`knockdown`) throws it across the ground, lays it down in a clip that
// holds, and gets it up again before it walks home (anim draws the jolt through
// fight3d's `bends`).
//
// The row: walker's body (`pos`, `yaw`, `vel`, `grounded`, `sliding`, `speed`, `want`, `face`, `jump`, `side`,
// `turned`), anim's fields, melee3d's `edges`, `swing` and `struck`, fight3d's `stop`, `shove`, `hits`, `since`,
// `down`, `fell` and `jolt`, and its own: `at` [x, z] and `facing`, where it stands and the yaw it stands at, from
// its actor entry, which fight3d walks it back to; `stood`, once it stands there.
//
// Its `before`, the first time: it stands at `at` on walker's ground, turned to `facing`. Its `tick`: fight3d's
// `home`, which walks it back to `at` once it has recovered from a blow, and there it turns to `facing`; walker's
// `walk`; anim's `animate`, its clips at fight3d's `freeze` share of the step's time; the clip's travel through
// walker's `carry` and its turn; fight3d's `shoved`, the blow's push, and `settle`, the jolt's springs, both played
// at the freeze's pace so they go on once the freeze lets go.
//
// `hit(blow)`, melee3d's `Blow` handed by fight3d's `strike` through `w.call` (no seat may send it), is fight3d's
// `wound`.
import type { Kind } from '#engine/engine.ts'
import { carry, groundOf, numbers, stand, walk } from '#plugins/walker/walker.sim.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import type { Blow } from '#plugins/melee3d/melee3d.sim.ts'
import { freeze, home, settle, shoved, wound } from '#plugins/fight3d/fight3d.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))

export const foe: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.stood) return
    const [x, z] = d.at
    d.pos = [x, stand(numbers(me, w), groundOf(w), x, z), z]
    d.yaw = d.facing
    d.stood = true
  },
  tick(me, dt, w) {
    const d = me.data
    const g = groundOf(w)
    d.jump = false
    d.want = [0, 0]
    d.face = null
    if (home(w, me)) d.face = d.facing
    walk(me, w, dt, g)
    const played = dt * freeze(w, me, dt)
    const { travel } = animate(me, w, played)
    if (travel.move[0] || travel.move[1]) carry(me, w, travel.move, g)
    shoved(w, me, played)
    settle(w, me, played)
    if (travel.yaw) d.yaw = wrap(d.yaw + travel.yaw)
  },
  acts: {
    hit(me, w, seat, blow: Blow) {
      if (seat !== -1) return
      wound(w, me, blow)
    },
  },
}
