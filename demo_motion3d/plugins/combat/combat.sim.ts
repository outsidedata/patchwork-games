// What the demo's fighting bodies share: the seat's X Bot (`player`, played by motion3d) and the foe it strikes (`foe`,
// a walker body played by anim). It has no row and no numbers of its own: each function is handed the row it works on
// and reads every number off that row's kind's definition (`assets/demo_motion3d.json`).
//
// `blows(w, me, dt)`, each step once the body is posed: melee3d's `swing` (`plugins/melee3d`), the body's blade swept
// from where it stood at the last step to where it stands now through every body melee3d knows, while its swing's
// blow is open. A scene that gives no `world.melee3d` has no blades, and nothing is swept. A swing lands once on a
// body: the soonest limb of it the blade meets is that body's `hit` act (no seat may send it), handed melee3d's
// `Blow` with the striker definition's `strikes` for the swing (`{ damage, knock }`, a swing it gives none for
// throws, naming it), and the striker is frozen for the strike's own `stop`, else its definition's (its row's
// `stop`, which motion3d's `drive` honours); every other limb of that body the swing passes through after is
// passed through.
//
// `wound(w, me, blow, play)`, a body's `hit`: it is frozen for its definition's `stop`, pushed (its row's `shove`,
// [x, z] metres a second) the way the blade went across the ground at the blow's `knock`, its definition's `blood`
// (a particle3d effect) is thrown where the blade met it along the way the blade moved, and it plays its reaction
// (`react`): `low`, the clip for a blow on a leg; otherwise by the way the blade came from (back along the way it
// moved, across the ground) about the way the body faces,
// `front` within 45° of it, `back` beyond 135°, `left` or `right` between, from `small` for a blow under the
// definition's `large` damage and from `large` for one at it or over.
//
// `freeze(me, k, dt)`, before an anim body's step: the share of the step its clips run while its `stop` lasts, its
// definition's `pace`, else 1, `stop` counted down. motion3d counts its own (its `drive`, Hitstop).
import type { Arg, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { swing, type Blow } from '#plugins/melee3d/melee3d.sim.ts'
import { emit } from '#plugins/particle3d/particle3d.sim.ts'

const LEGS = ['uplegL', 'legL', 'footL', 'uplegR', 'legR', 'footR']
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const DEG = Math.PI / 180

export function blows(w: W, me: Row, dt: number) {
  if (!w.world.melee3d) return
  const met = swing(w, me, dt)
  if (!met.length) return
  const k = def(w, me.kind)
  const live: string = me.data.swing
  // The bodies this swing landed on before this step: the struck it held before what it met now.
  const struck: string[] = me.data.struck
  const landed = new Set(struck.slice(0, struck.length - met.length).map(key => Number(key.split(':')[0])))
  for (const c of met) {
    if (c.what !== 'limb' || landed.has(c.id)) continue
    const s = k.strikes?.[live]
    if (!s) throw new Error(`${me.kind}: its swing ${live} met ${w.get(c.id).kind}'s ${c.part}, and its definition's strikes give no ${live}`)
    const blow: Blow = { what: 'blade', part: c.part, point: c.point, dir: c.dir, speed: c.speed, damage: s.damage, knock: s.knock, by: me.id }
    w.call(w.get(c.id), 'hit', -1, blow as unknown as Arg)
    me.data.stop = s.stop ?? k.stop
    landed.add(c.id)
  }
}

export function wound(w: W, me: Row, blow: Blow, play: (clip: string) => void) {
  const k = def(w, me.kind)
  me.data.stop = k.stop
  // Pushed the way the blade went, across the ground, at the blow's `knock` metres a second.
  const across = math.hypot(blow.dir[0], blow.dir[2])
  me.data.shove = across > 0 ? [(blow.dir[0] / across) * blow.knock, (blow.dir[2] / across) * blow.knock] : [0, 0]
  // Blood where the blade met the body, thrown on the way the blade went, falling to the ground under the body.
  emit(w, k.blood, blow.point, { dir: blow.dir, floor: me.data.pos[1] })
  if (LEGS.includes(blow.part)) return play(k.react.low)
  // The way the blade came from: back along the way it moved, across the ground.
  const off = wrap(math.atan2(-blow.dir[0], -blow.dir[2]) - me.data.yaw) / DEG
  const side = Math.abs(off) <= 45 ? 'front' : Math.abs(off) > 135 ? 'back' : off > 0 ? 'left' : 'right'
  play(k.react[blow.damage >= k.large ? 'large' : 'small'][side])
}

// `shoved(me, k, dt)`: the metres [x, z] a body's `shove` carries it over `dt` seconds of play, the shove then
// eased toward nothing at its definition's `drag` (1/s), so a blow's push runs out over `knock / drag` metres.
export function shoved(me: Row, k: any, dt: number): number[] {
  const d = me.data
  const by = [d.shove[0] * dt, d.shove[1] * dt]
  const kept = Math.exp(-k.drag * dt)
  d.shove = [d.shove[0] * kept, d.shove[1] * kept]
  return by
}

export function freeze(me: Row, k: any, dt: number): number {
  const d = me.data
  const pace = d.stop > 0 ? k.pace : 1
  d.stop = Math.max(0, d.stop - dt)
  return pace
}
