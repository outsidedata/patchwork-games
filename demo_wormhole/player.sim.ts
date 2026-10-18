// The seat's body, its `player` row: a walker (`plugins/walker`, `world.walker.kinds.player`) on the
// chamber's ground (`plugins/chamber`), its eyes `view` [yaw, pitch], yaw 0 looking down +z (walker's
// law: yaw θ faces (sin θ, cos θ)), pitch up. `before` stands it once on its slot's `start`, at that
// start's `pos` facing its `yaw`. Each step it asks walker for its definition's `speed` along `move`,
// the way the keys point (x to the right, y back) turned to the view, faces the view, and walks:
// gravity, `jump`, the ramp, and in the air the speed it left the ground with (its walker entry's
// `airAccel`). `look` turns the view by the mouse's pixels times `sens`, its pitch kept within `pitch`
// radians of level. It is kept inside the chamber's floor plan.
//
// Placing a portal. `place` with an index into its definition's `portals`, the two portals' names,
// casts the line from its eye (`eye` metres over `pos`) along the view, and where the line first
// meets one of the chamber's boxes puts that portal: centred where it hit, its front the face's
// normal, its top straight up on a wall and, on a floor, the way the view looks, flattened. The first
// time it spawns the portal, naming the other in `to`; after that it moves it. A line that meets a
// ramp first, or nothing, puts nothing down.
//
// Throwing. A start may name a kind in `throws`, which the row takes when it stands there; `throw`
// then spawns a row of that kind its definition's `throw.ahead` metres along the view from its eye,
// turned to the view's yaw, moving along the view at `throw.speed` on top of the body's own `vel`. A
// row that throws nothing does nothing.
//
// Going through. The step the line its body's centre (`pos` raised half the walker's `height`)
// travelled goes in at a portal's front, inside its opening, while the other portal stands, the body
// is put where it would be had it gone through: its centre, its `vel` (all three axes) and its view,
// each taken from this portal's frame (right, up, normal) to the other's turned half a turn about up,
// so it comes out of the other's front at the speed it went in, a fall coming out of a wall as a
// throw. The view is read back as a yaw and a pitch; it leaves the ground, and `jumps` counts each
// one, so a look raises render3d's `userData.teleport` on the frame it changes
// (`guide-to-smooth-gameplay`).
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf, numbers, relative, walk } from '#plugins/walker/walker.sim.ts'
import { bounds, ray } from './plugins/chamber/chamber.sim.ts'
import { ahead, crossed, other, point, vector } from './plugins/portal/portal.sim.ts'

const unit = (v: number[]) => {
  const m = math.hypot(v[0], v[1], v[2])
  return [v[0] / m, v[1] / m, v[2] / m]
}
// Where a view [yaw, pitch] looks.
const looking = ([yaw, pitch]: number[]) => [math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)]

export const player: Kind = {
  before(me, _dt, w) {
    if (me.data.placed) return
    const start = w.find('start', s => s.data.slot === me.data.seat)
    me.data.pos = [...start.data.pos]
    me.data.yaw = start.data.yaw
    me.data.view = [start.data.yaw, 0]
    me.data.throws = start.data.throws
    me.data.placed = true
  },
  tick(me, dt, w) {
    const { speed } = def(w, me.kind)
    const [mx, my] = me.data.move
    const ahead = relative([mx, -my], me.data.view[0])
    me.data.want = [ahead[0] * speed, ahead[1] * speed]
    me.data.face = me.data.view[0]
    const from = me.data.pos
    walk(me, w, dt, groundOf(w))
    through(me, w, from)
    const [[x0, z0], [x1, z1]] = bounds(w)
    const [x, y, z] = me.data.pos
    me.data.pos = [Math.min(x1, Math.max(x0, x)), y, Math.min(z1, Math.max(z0, z))]
  },
  acts: {
    // The way the keys point, from the page: x to the right, y back, kept to a unit's length at most.
    move(me, _w, _seat, x: unknown, y: unknown) {
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return
      const len = math.hypot(x, y)
      me.data.move = len > 1 ? [x / len, y / len] : [x, y]
    },
    // The mouse's pixels across and down since the last, from the page.
    look(me, w, _seat, dx: unknown, dy: unknown) {
      if (typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy)) return
      const { sens, pitch } = def(w, me.kind)
      const yaw = me.data.view[0] - dx * sens
      me.data.view = [math.atan2(math.sin(yaw), math.cos(yaw)), Math.min(pitch, Math.max(-pitch, me.data.view[1] - dy * sens))]
    },
    jump(me) {
      me.data.jump = true
    },
    throw(me, w) {
      if (!me.data.throws) return
      const { eye, throw: { ahead, speed } } = def(w, me.kind)
      const dir = looking(me.data.view)
      const half = me.data.view[0] / 2
      w.spawn(me.data.throws, {
        pos: [0, 1, 2].map(i => me.data.pos[i] + (i === 1 ? eye : 0) + dir[i] * ahead),
        rot: [0, math.sin(half), 0, math.cos(half)],
        vel: [0, 1, 2].map(i => me.data.vel[i] + dir[i] * speed),
        spin: [0, 0, 0],
        awake: true,
      })
    },
    // Which portal to put where the reticle points: 0 or 1, an index into its definition's `portals`.
    place(me, w, _seat, which: unknown) {
      if (which !== 0 && which !== 1) return
      const { eye, portals } = def(w, me.kind)
      const dir = looking(me.data.view)
      const hit = ray(w, [me.data.pos[0], me.data.pos[1] + eye, me.data.pos[2]], dir)
      if (!hit || hit.box < 0) return
      const normal = hit.normal
      const up = Math.abs(normal[1]) > 0.5 ? unit([dir[0], 0, dir[2]]) : unit([-normal[1] * normal[0], 1 - normal[1] * normal[1], -normal[1] * normal[2]])
      const at = { pos: hit.point, normal, up, on: hit.box }
      const portal = w.all('portal').find(p => p.data.name === portals[which])
      if (!portal) {
        w.spawn('portal', { name: portals[which], to: portals[1 - which], ...at })
        return
      }
      Object.assign(portal.data, at)
    },
  },
}

// The step's crossing, if the body's centre went in at a portal's front: the body put through.
function through(me: Row, w: W, from: number[]) {
  const half = numbers(me, w).height / 2
  const c0 = [from[0], from[1] + half, from[2]]
  const c1 = [me.data.pos[0], me.data.pos[1] + half, me.data.pos[2]]
  for (const a of w.all('portal')) {
    const b = other(w, a)
    if (!b || !crossed(w, a, c0, c1, 0, 0)) continue
    const centre = point(a, b, c1)
    // Out of a portal in a wall, the footprint's corners clear of the wall's face, so no foot stands
    // on the wall the opening is cut through.
    const nb: number[] = b.data.normal
    if (Math.abs(nb[1]) <= 0.5) {
      const clear = numbers(me, w).span * Math.SQRT1_2 - ahead(b, centre)
      if (clear > 0) for (const i of [0, 1, 2]) centre[i] += nb[i] * clear
    }
    me.data.pos = [centre[0], centre[1] - half, centre[2]]
    me.data.vel = vector(a, b, me.data.vel)
    const look = vector(a, b, looking(me.data.view))
    const { pitch } = def(w, me.kind)
    const yaw = math.atan2(look[0], look[2])
    me.data.view = [yaw, Math.min(pitch, Math.max(-pitch, math.asin(Math.max(-1, Math.min(1, look[1])))))]
    me.data.yaw = yaw
    me.data.face = yaw
    me.data.grounded = false
    me.data.jumps += 1
    return
  }
}
