// The hero, the seat's `player` row: a Mixamo body anim draws, the kind its `as` names
// (`world.anim.kinds`, `world.walker.kinds`), so any body of the hero's rig plays it. On the ground
// it walks on walker, the stick turned by where the camera looks (`relative`), at its definition's
// `walk`, or `run` while run is held, facing the way it goes; anim plays its gears and moments.
//
// `before` stands it once on the `start` of its slot, facing that start's `yaw`. `look` is the camera
// chasecamera3d sits on, `{ yaw, pitch, dist }`, turned by the mouse at the definition's
// `look.turn` radians a pixel, its pitch kept within `look.pitch`; while it holds on to a limb the
// camera's yaw eases round behind its back and its distance out to `look.climb` metres, at
// `look.follow` a second, and on the ground back to `look.dist`.
//
// While grip is held it takes hold of the colossus's nearest limb within reach of its hands (the
// game's `climb` plugin), and holds on until grip is let go: on the limb, the stick climbs it (w up,
// s down, a and d round it) and the body goes where the limb goes. Let go, it falls.
//
// Acts: `move(x, y)` the stick, x right and y down, each −1 to 1; `run(v)` 1 held, 0 let go;
// `jump()`; `grip(v)` 1 held, 0 let go; `look(dx, dy)` the mouse moved, in page pixels.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { carry, groundOf, numbers, relative, stand, walk } from '#plugins/walker/walker.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { grab, hang, release } from './plugins/climb/climb.sim.ts'

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))

export const player: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.placed) return
    const s = w.find('start', r => r.data.slot === d.seat)
    const [x, , z] = s.data.pos
    d.pos = [x, stand(numbers(me, w), groundOf(w), x, z), z]
    d.yaw = s.data.yaw
    d.look = { ...d.look, yaw: s.data.yaw }
    d.placed = true
  },
  tick(me, dt, w) {
    const d = me.data
    const k = def(w, me.kind)
    const g = groundOf(w)
    if (d.hold && !d.gripping) release(me, w)
    if (!d.hold && d.gripping) grab(me, w, ['colossus'])
    if (d.hold) {
      hang(me, w, dt, d.stick)
      animate(me, w, dt)
      // The camera swings round behind the hero's back, as it faces the limb, and draws back.
      const ease = 1 - math.exp(-k.look.follow * dt)
      d.look = { ...d.look, yaw: wrap(d.look.yaw + wrap(d.yaw - d.look.yaw) * ease), dist: d.look.dist + (k.look.climb - d.look.dist) * ease }
      return
    }
    d.look = { ...d.look, dist: d.look.dist + (k.look.dist - d.look.dist) * (1 - math.exp(-k.look.follow * dt)) }
    const [x, y] = d.stick as number[]
    const way = relative([x, -y], d.look.yaw)
    const pace = d.run ? k.run : k.walk
    d.want = [way[0] * pace, way[1] * pace]
    d.face = math.hypot(way[0], way[1]) > 0.01 ? math.atan2(way[0], way[1]) : null
    walk(me, w, dt, g)
    const { travel } = animate(me, w, dt)
    if (travel.move[0] || travel.move[1]) carry(me, w, travel.move, g)
    if (travel.yaw) d.yaw = wrap(d.yaw + travel.yaw)
  },
  acts: {
    move(me, _w, _seat, x: unknown, y: unknown) {
      if (!finite(x) || !finite(y)) return
      me.data.stick = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]
    },
    run(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.run = v === 1
    },
    jump(me) {
      if (me.data.grounded && !me.data.hold) me.data.jump = true
    },
    grip(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.gripping = v === 1
    },
    look(me, w, _seat, dx: unknown, dy: unknown) {
      if (!finite(dx) || !finite(dy)) return
      const k = def(w, me.kind).look
      const l = me.data.look
      me.data.look = { ...l, yaw: wrap(l.yaw - dx * k.turn), pitch: Math.max(k.pitch[0], Math.min(k.pitch[1], l.pitch + dy * k.turn)) }
    },
  },
}
