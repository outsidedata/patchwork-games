// The hero, the seat's `player` row: a Mixamo body anim draws, the kind its `as` names
// (`world.anim.kinds`, `world.walker.kinds`), so any body of the hero's rig plays it. Its numbers are
// its definition in `assets/giantslayer.json`.
//
// On the ground it walks on walker, the stick turned by where the camera looks (`relative`), at
// `walk` m/s, or `run` while run is held, facing the way it goes; anim plays its gears and moments.
// `before` stands it on the `start` of its slot, facing that start's `yaw`, once and again after it
// is beaten. `look` is the camera chasecamera3d sits on, `{ yaw, pitch, dist }`, turned by the mouse
// at `look.turn` radians a pixel, its pitch kept within `look.pitch`; while it holds on to a limb the
// camera's yaw eases round behind its back and its distance out to `look.climb` metres, at
// `look.follow` a second, and on the ground back to `look.dist`.
//
// While grip is held it takes hold of the colossus's nearest limb within reach of its hands (the
// game's `climb` plugin), and holds on until grip is let go or its `grip`, 1 full, runs out: holding,
// it drains at `grip.drain` a second, `grip.shaken` while the colossus it holds roars, and on the
// ground it fills at `grip.refill`; it takes hold only with `grip.least` or more. On the limb, the stick climbs it (w up, s down, a and d round it)
// and the body goes where the limb goes. Let go, it falls.
//
// Attack held charges a stab, full after `stab.charge` seconds; let go, the stab is played on the
// upper body (`gesture`), and at its `hit` marker it strikes, with `stab.least` of its power uncharged
// and all of it charged: the weak point on the limb it holds within `stab.reach` metres of its hold is
// stabbed (its `stab`).
//
// Struck (`hit`, the colossus's), it loses `hurt` of its `hp`, lets go of what it holds, and is thrown
// away from the blow (`thrown`, its travel carried); at no `hp` it lies flat (`flat`) for `down`
// seconds and stands again on its start, whole.
//
// Acts: `move(x, y)` the stick, x right and y down, each −1 to 1; `run(v)`, `grip(v)` and `attack(v)`
// 1 held, 0 let go; `jump()`; `look(dx, dy)` the mouse moved, in page pixels; `hit(x, z)` and `drop()`,
// the colossus's (seat −1): struck along (x, z), and shaken off.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animate, committed, gesture, play, rest, stop } from '#plugins/anim/anim.sim.ts'
import { carry, groundOf, numbers, relative, stand, walk } from '#plugins/walker/walker.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { apart, grab, hang, release } from './plugins/climb/climb.sim.ts'

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const held = (v: unknown) => v === 0 || v === 1

// The colossus the hero holds, roaring.
const shaking = (w: W, me: Row) => {
  const giant = me.data.hold && w.get(me.data.hold.on)
  return !!giant && giant.data.clip === 'roar' && giant.data.state === 'act'
}

// The camera eased toward a yaw (or none) and a distance.
function ease(me: Row, k: any, dt: number, yaw: number | null, dist: number) {
  const l = me.data.look, e = 1 - math.exp(-k.look.follow * dt)
  me.data.look = { ...l, yaw: yaw === null ? l.yaw : wrap(l.yaw + wrap(yaw - l.yaw) * e), dist: l.dist + (dist - l.dist) * e }
}

// The stab struck: the weak point on the hold's limb within reach of the hold, stabbed.
function strike(me: Row, w: W, k: any) {
  const h = me.data.hold
  if (!h) return
  const point = w.all('weakpoint').find(p => !p.data.broken && p.data.on === h.on && p.data.segment === h.segment && apart(w, h, p.data) <= k.stab.reach)
  if (point) w.call(point, 'stab', -1, me.data.power)
}

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
    if (d.charging) d.charge = Math.min(1, d.charge + dt / k.stab.charge)
    if (d.hp <= 0) {
      d.downFor += dt
      if (d.downFor >= k.down) {
        rest(me)
        Object.assign(d, { hp: k.hp, grip: 1, downFor: 0, placed: false, vel: [0, 0, 0] })
        return
      }
    }
    if (d.hold && (!d.gripping || d.grip <= 0)) release(me, w)
    if (!d.hold && d.gripping && d.hp > 0 && d.grip >= k.grip.least) grab(me, w, ['colossus'])
    if (d.hold) {
      d.grip = Math.max(0, d.grip - dt * (shaking(w, me) ? k.grip.shaken : k.grip.drain))
      hang(me, w, dt, d.stick)
      const { markers } = animate(me, w, dt)
      if (markers.some(m => m.name === 'hit')) strike(me, w, k)
      ease(me, k, dt, d.yaw, k.look.climb)
      return
    }
    if (d.grounded) d.grip = Math.min(1, d.grip + dt * k.grip.refill)
    const [x, y] = d.stick as number[]
    const way = d.hp > 0 && !committed(me) ? relative([x, -y], d.look.yaw) : [0, 0]
    const pace = d.run ? k.run : k.walk
    d.want = [way[0] * pace, way[1] * pace]
    d.face = math.hypot(way[0], way[1]) > 0.01 ? math.atan2(way[0], way[1]) : null
    walk(me, w, dt, g)
    const { travel, markers } = animate(me, w, dt)
    if (travel.move[0] || travel.move[1]) carry(me, w, travel.move, g)
    if (travel.yaw) d.yaw = wrap(d.yaw + travel.yaw)
    if (markers.some(m => m.name === 'hit')) strike(me, w, k)
    ease(me, k, dt, null, k.look.dist)
  },
  acts: {
    move(me, _w, _seat, x: unknown, y: unknown) {
      if (!finite(x) || !finite(y)) return
      me.data.stick = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]
    },
    run(me, _w, _seat, v: unknown) {
      if (held(v)) me.data.run = v === 1
    },
    jump(me) {
      if (me.data.grounded && !me.data.hold && me.data.hp > 0) me.data.jump = true
    },
    grip(me, _w, _seat, v: unknown) {
      if (held(v)) me.data.gripping = v === 1
    },
    attack(me, w, _seat, v: unknown) {
      const d = me.data
      if (!held(v) || d.hp <= 0) return
      if (v === 1) return void Object.assign(d, { charging: true, charge: 0 })
      if (!d.charging) return
      const k = def(w, me.kind).stab
      d.power = k.least + (1 - k.least) * d.charge
      Object.assign(d, { charging: false, charge: 0 })
      gesture(me, 'stab')
    },
    look(me, w, _seat, dx: unknown, dy: unknown) {
      if (!finite(dx) || !finite(dy)) return
      const k = def(w, me.kind).look
      const l = me.data.look
      me.data.look = { ...l, yaw: wrap(l.yaw - dx * k.turn), pitch: Math.max(k.pitch[0], Math.min(k.pitch[1], l.pitch + dy * k.turn)) }
    },
    hit(me, w, seat, x: unknown, z: unknown) {
      const d = me.data
      if (seat !== -1 || !finite(x) || !finite(z) || d.hp <= 0) return
      const k = def(w, me.kind)
      if (d.hold) release(me, w)
      d.hp = Math.max(0, d.hp - k.hurt)
      d.yaw = math.atan2(x, z)
      if (d.hp > 0) play(me, 'thrown')
      else play(me, 'flat', { holds: true })
      d.downFor = 0
    },
    drop(me, w, seat) {
      if (seat !== -1 || !me.data.hold) return
      release(me, w)
      stop(me, w)
    },
  },
}
