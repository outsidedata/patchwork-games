// The seat's walker, its `player` row: a point on the floor at `pos` (y 0), facing `yaw` about up
// (0 looks down −z), looking `pitch` up or down. `before` stands it once on its slot's `start`, at that
// start's `pos` and `yaw`. `move` is the way the seat's keys point, x to its right and y back, kept to a
// unit's length; each step `vel` eases toward `accel` along that way under `friction`, the law solved
// over the step (dv/dt = accel·move − friction·v), so it tops out at accel / friction metres a second.
// `look` turns it by the mouse's pixels times its definition's `sens`, its pitch kept within `pitch`
// radians of level. It keeps inside the floor.
//
// Placing a door. `place` with an index into its definition's `portals`, the two doors' names, puts that
// door `reach` metres ahead of it on the floor, its front facing it, so walking on goes in at its
// front; the first time it spawns the door, naming the other in `to`, and after that it moves it.
//
// A door. The step its path crosses a door's plane from the front, inside the door's width, it is put
// where it would be had it gone through the front of the door that door names: its place relative to
// the one, turned by the angle between the two and half a turn, about the other; its facing and its
// way turned alike. So it walks out of the other door's front still walking, and comes out facing the
// way it went in. `jumps` counts each one, so a look raises render3d's `userData.teleport` on the
// frame it changes (`guide-to-smooth-gameplay`). From behind, past a post, or while the other door
// has not been placed, a door does nothing.
import type { Kind, Row } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

// `v` turned `a` radians about up, as three turns it: −z by a goes to (−sin a, −cos a).
const turn = (x: number, z: number, a: number): [number, number] => {
  const s = math.sin(a), c = math.cos(a)
  return [x * c + z * s, -x * s + z * c]
}

// Where a door's front looks (−forward of a player at its yaw), and its width's way.
const facing = (yaw: number): [number, number] => [math.sin(yaw), math.cos(yaw)]
const across = (yaw: number): [number, number] => [math.cos(yaw), -math.sin(yaw)]

export const player: Kind = {
  before(me, _dt, w) {
    if (me.data.placed) return
    const start = w.find('start', s => s.data.slot === me.data.seat)
    me.data.pos = [...start.data.pos]
    me.data.yaw = start.data.yaw
    me.data.placed = true
  },
  tick(me, dt, w) {
    const { accel, friction } = def(w, me.kind)
    const [mx, my] = me.data.move
    const [vx, vz] = me.data.vel
    if (!mx && !my && !vx && !vz) return
    const [wx, wz] = turn(mx, my, me.data.yaw)
    const keep = math.exp(-friction * dt)
    const gain = friction > 0 ? (1 - keep) / friction : dt
    const vel: [number, number] = [vx * keep + accel * wx * gain, vz * keep + accel * wz * gain]
    const [px, , pz] = me.data.pos
    let to: [number, number] = [px + vel[0] * dt, pz + vel[1] * dt]
    let yaw = me.data.yaw
    const doors = w.all('door')
    for (const a of doors) {
      const b = doors.find(d => d.data.name === a.data.to)
      if (!b || !cross(w, a, [px, pz], to)) continue
      const by = b.data.yaw - a.data.yaw + Math.PI
      const [rx, rz] = turn(to[0] - a.data.pos[0], to[1] - a.data.pos[2], by)
      to = [b.data.pos[0] + rx, b.data.pos[2] + rz]
      const [ux, uz] = turn(vel[0], vel[1], by)
      vel[0] = ux
      vel[1] = uz
      yaw += by
      me.data.jumps += 1
      break
    }
    me.data.pos = inside(w, to)
    me.data.vel = vel
    me.data.yaw = math.atan2(math.sin(yaw), math.cos(yaw))
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
      const yaw = me.data.yaw - dx * sens
      me.data.yaw = math.atan2(math.sin(yaw), math.cos(yaw))
      me.data.pitch = Math.min(pitch, Math.max(-pitch, me.data.pitch - dy * sens))
    },
    // Which door to put down ahead of it: 0 or 1, an index into its definition's `portals`.
    place(me, w, _seat, which: unknown) {
      const { portals, reach } = def(w, me.kind)
      if (which !== 0 && which !== 1) return
      const [fx, fz] = turn(0, -1, me.data.yaw)
      const pos = inside(w, [me.data.pos[0] + fx * reach, me.data.pos[2] + fz * reach])
      const door = w.all('door').find(d => d.data.name === portals[which])
      if (!door) {
        w.spawn('door', { name: portals[which], to: portals[1 - which], pos, yaw: me.data.yaw })
        return
      }
      door.data.pos = pos
      door.data.yaw = me.data.yaw
    },
  },
}

// A point on the floor, [x, z], kept inside it, as [x, 0, z].
function inside(w: Parameters<NonNullable<Kind['tick']>>[2], [x, z]: [number, number]) {
  const half = def(w, 'floor').size / 2
  return [Math.min(half, Math.max(-half, x)), 0, Math.min(half, Math.max(-half, z))]
}

// Whether the path from `from` to `to` goes in at door `d`'s front, inside its width.
function cross(w: Parameters<NonNullable<Kind['tick']>>[2], d: Row, from: [number, number], to: [number, number]) {
  const { width } = def(w, d.kind)
  const [nx, nz] = facing(d.data.yaw), [ax, az] = across(d.data.yaw)
  const [dx, , dz] = d.data.pos
  const t0 = (from[0] - dx) * nx + (from[1] - dz) * nz
  const t1 = (to[0] - dx) * nx + (to[1] - dz) * nz
  if (!(t0 > 0 && t1 <= 0)) return false
  const f = t0 / (t0 - t1)
  const s = (from[0] + (to[0] - from[0]) * f - dx) * ax + (from[1] + (to[1] - from[1]) * f - dz) * az
  return Math.abs(s) < width / 2
}
