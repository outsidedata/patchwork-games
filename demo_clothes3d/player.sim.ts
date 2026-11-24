// The row one seat possesses, and the body it plays: the robed person (`as: "robed"`), walked by walker
// (`plugins/walker`, its numbers `world.walker.kinds.robed`) over terrain3d's land, drawn and played by
// anim (its `world.anim.kinds.robed`, the bare body), and wearing what its `clothing` lists, each a loader
// model clothing3d puts on the body anim draws (`plugins/clothing3d`). Its own fields, beside walker's and
// anim's: `stick` [x, z], the keys' way, right and forward; `look`, chasecamera3d's orbit about it, `lift`
// metres over its feet; `stood`, once it stands on its slot's start; and `clothing`, the models it wears.
//
// `before` stands it once on the ground at its slot's `start`, facing the start's `yaw`. Each step walker
// walks it the way the stick points from the camera's yaw at the definition's `walk` m/s, anim plays it
// from how it moved, and the travel of a clip that carries one is carried.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), and `dress`, which takes the
// clothes off when it wears any and puts the definition's `clothing` on when it wears none.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { carry, groundOf, relative, walk } from '#plugins/walker/walker.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1

// The body stood once on the ground at its slot's start, facing the start's yaw, its look along it.
function stood(me: Row, w: W) {
  const d = me.data
  const start = w.find('start', s => s.data.slot === d.seat).data
  const [x, z] = start.pos
  d.pos = [x, groundOf(w).height(x, z), z]
  d.yaw = start.yaw
  d.look = { ...d.look, yaw: start.yaw }
  d.grounded = true
  d.stood = true
}

export const player: Kind = {
  before(me, _dt, w) {
    if (!me.data.stood) stood(me, w)
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    const [wx, wz] = relative(d.stick, d.look.yaw)
    d.face = null
    d.want = [wx * k.walk, wz * k.walk]
    const ground = groundOf(w)
    walk(me, w, dt, ground)
    const { travel } = animate(me, w, dt)
    if (travel.move[0] !== 0 || travel.move[1] !== 0) carry(me, w, travel.move, ground)
    if (travel.yaw !== 0) d.yaw = wrap(d.yaw + travel.yaw)
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.stick = [x, 0 - (y as number)]
    },
    dress(me, w) {
      me.data.clothing = me.data.clothing.length ? [] : [...def(w, me.kind).clothing]
    },
  },
}
