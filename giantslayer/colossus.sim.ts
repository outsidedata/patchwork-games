// The colossus: a Mixamo body baked at its rig's `size` (`assets/colossus/colossus.rig.json`), drawn by
// anim, walking on walker. Its numbers are its definition in `assets/giantslayer.json`.
//
// It stands breathing until a hero comes within `notice` metres. A hero on the ground it turns to and
// walks toward at `pace` m/s, stopping `near` metres off, and once that hero is within `attack.reach`
// metres and `attack.cool` seconds have passed since its last attack, it attacks: it plays
// `attack.clip` (a stomp), and on each step of it the segments `attack.limbs` names (anim's `ends`,
// where its foot is on that frame) are measured against the hero; one passing within `attack.hit`
// metres of the hero's middle, `attack.at` above its feet, strikes it once an attack (the hero's `hit`,
// the way out from the colossus). A hero
// holding on to it it does not walk toward: every `shake` seconds it roars (`roar`), which the hero's
// grip feels. When every weak point on it is broken it plays `die` and holds it, does nothing more,
// and every hero holding on lets go (`drop`). `hurt()`, a weak point's (seat −1), makes it roar.
//
// The row: walker's and anim's fields; `placed`, stood on the ground once; `cool`, seconds until it
// may attack again; `shook`, seconds since it last roared; `struck`, whether this attack has hit;
// `dead`.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animate, committed, ends, play } from '#plugins/anim/anim.sim.ts'
import { groundOf, numbers, stand, walk } from '#plugins/walker/walker.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

// A point of the colossus's own frame (x its left, y up, z ahead) in the world.
const world = (me: Row, p: number[]) => {
  const s = math.sin(me.data.yaw), c = math.cos(me.data.yaw), [x, y, z] = me.data.pos
  return [x + p[0] * c + p[2] * s, y + p[1], z - p[0] * s + p[2] * c]
}

// How far point p is from the segment a–b.
function apart(p: number[], a: number[], b: number[]) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2))
  return math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t)
}

const holding = (w: W, me: Row) => w.all('player').filter(p => p.data.hold?.on === me.id)

export const colossus: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.placed) return
    const [x, , z] = d.pos
    d.pos = [x, stand(numbers(me, w), groundOf(w), x, z), z]
    d.placed = true
  },
  tick(me, dt, w) {
    const d = me.data
    const k = def(w, me.kind)
    d.want = [0, 0]
    d.face = null
    if (d.dead) {
      walk(me, w, dt, groundOf(w))
      animate(me, w, dt)
      return
    }
    const points = w.all('weakpoint').filter(p => p.data.on === me.id)
    if (points.length > 0 && points.every(p => p.data.broken)) {
      d.dead = true
      play(me, 'die', { holds: true })
      for (const h of holding(w, me)) w.call(h, 'drop', -1)
      animate(me, w, dt)
      return
    }
    d.cool = Math.max(0, d.cool - dt)
    d.shook += dt
    const riders = holding(w, me)
    const hero = w.all('player').find(p => !p.data.hold)
    if (riders.length > 0) {
      if (d.shook >= k.shake && !committed(me)) {
        play(me, 'roar')
        d.shook = 0
      }
    } else if (hero && !committed(me)) {
      const dx = hero.data.pos[0] - d.pos[0], dz = hero.data.pos[2] - d.pos[2]
      const far = math.hypot(dx, dz)
      if (far < k.notice) {
        d.face = math.atan2(dx, dz)
        if (far > k.near) d.want = [(dx / far) * k.pace, (dz / far) * k.pace]
        if (far < k.attack.reach && d.cool <= 0) {
          play(me, k.attack.clip)
          d.cool = k.attack.cool
          d.struck = false
        }
      }
    }
    // Committed to a clip (an attack, a roar), it stands where it is: its feet are the clip's.
    if (committed(me)) d.vel = [0, d.vel[1], 0]
    walk(me, w, dt, groundOf(w))
    animate(me, w, dt)
    if (d.clip === k.attack.clip && d.state === 'act' && !d.struck && hero) {
      const mid = [hero.data.pos[0], hero.data.pos[1] + k.attack.at, hero.data.pos[2]]
      for (const limb of k.attack.limbs as string[]) {
        const e = ends(w, me, limb)
        if (apart(mid, world(me, e.slice(0, 3)), world(me, e.slice(3))) > k.attack.hit) continue
        const dx = hero.data.pos[0] - d.pos[0], dz = hero.data.pos[2] - d.pos[2], l = math.hypot(dx, dz) || 1
        w.call(hero, 'hit', -1, dx / l, dz / l)
        d.struck = true
        break
      }
    }
  },
  acts: {
    // A weak point on it stabbed (seat −1): it roars, shaking whoever holds on.
    hurt(me, _w, seat) {
      if (seat !== -1 || me.data.dead) return
      play(me, 'roar')
      me.data.shook = 0
    },
  },
}
