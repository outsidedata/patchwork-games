// A foe the seat's X Bot strikes: a walker body (`world.walker.kinds.foe`) played and drawn by anim
// (`world.anim.kinds.foe`: the same X Bot and the same baked clips as the seat's, by the anim rig `assets/xbot.anim.json`),
// standing where its actor puts it. melee3d knows it by anim's word, so the seat's blade meets its limbs; a blow is
// the combat plugin's `wound` (`plugins/combat`): it is frozen and plays its reaction. Every number is its definition
// in `assets/demo_motion3d.json`.
//
// The row: walker's body (`pos`, `yaw`, `vel`, `grounded`, `sliding`, `speed`, `want`, `face`, `jump`, `side`,
// `turned`), anim's fields, melee3d's `edges`, `swing` and `struck`, and its own: `at` [x, z] and `facing`, where it
// stands and the yaw it stands at, from its actor entry; `stood`, once it stands there; `stop`, seconds left of a
// blow's freeze; `hits`, the blows it has taken; `shove`, [x, z] metres a second a blow pushes it, run out at
// its definition's `drag` (the combat plugin's `shoved`), carried through walker so walls stop it.
//
// Its `before`, the first time: it stands at `at` on walker's ground, turned to `facing`. Its `tick`: during a
// reaction it asks walker for nothing; after one, further than its definition's `home` metres from `at`, it walks
// back there (walker's `seek`, at its kind's `seekSpeed`), turned the way it walks, and there it turns to `facing`;
// walker's `walk`; anim's `animate`, its clips at `pace` of the step's time while a blow's `stop` lasts
// (the combat plugin's `freeze`); and the clip's travel through walker's `carry` and its turn, so a reaction that
// staggers it carries it.
//
// `hit(blow)`, melee3d's `Blow` through `w.call` from the rule that swung it (no seat may send it), is the combat
// plugin's `wound`, its reaction played as an act that does not hold.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { carry, groundOf, numbers, seek, stand, walk } from '#plugins/walker/walker.sim.ts'
import { animate, play } from '#plugins/anim/anim.sim.ts'
import type { Blow } from '#plugins/melee3d/melee3d.sim.ts'
import { freeze, shoved, wound } from './plugins/combat/combat.sim.ts'

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
    const k = def(w, me.kind)
    const g = groundOf(w)
    d.jump = false
    // Back to its spot once a reaction that carried it off has played out (walker's `seek`, at its `seekSpeed`),
    // turned the way it walks; there, it stands turned to `facing`. During a reaction it asks for nothing.
    d.want = [0, 0]
    d.face = null
    if (d.state !== 'act' && seek(me, w, d.at, k.home, g)) d.face = d.facing
    walk(me, w, dt, g)
    const played = dt * freeze(me, k, dt)
    const { travel } = animate(me, w, played)
    if (travel.move[0] || travel.move[1]) carry(me, w, travel.move, g)
    // A blow's push, played at the freeze's pace so it lands once the freeze lets go.
    const [sx, sz] = shoved(me, k, played)
    if (sx || sz) carry(me, w, [sx, sz], g)
    if (travel.yaw) d.yaw = wrap(d.yaw + travel.yaw)
  },
  acts: {
    hit(me, w, seat, blow: Blow) {
      if (seat !== -1) return
      me.data.hits += 1
      wound(w, me, blow, clip => play(me, clip, { holds: false }))
    },
  },
}
