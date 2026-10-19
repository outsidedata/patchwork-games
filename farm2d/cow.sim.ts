// A cow: walks its pasture (`plugins/walk`, its definition's `bounds` the inside of the pasture's
// fence) in the look of its row's `sheet`, `cow` or `bull`. A seat plays it through its `player` row
// (`plugins/roles`), whose keys are its acts `move` and `use`; while no seat holds it, its brain plays
// it with the same two.
//
// `use`, the cow's one verb, eats: of the grass grown tall within its definition's `reach`, the nearest
// is eaten bare (the grass's `eat`) with the effect `graze` from it, the `sounds.moo` sound rings from the cow, and it chews for
// `chew` seconds, `chew` on its row counting down, standing and playing its sheet's `eat` clip
// whatever its keys say (they are kept, and walk it on once it has done). Its chewing done, it drops a pile of manure where it stands, with the
// `sounds.plop` sound and the effect `plop`, and means to wander to a point of its pasture
// (`roam`). It eats nothing while it chews.
//
// The brain, while no seat holds it, each step:
//   - Standing a while: `wait` seconds, `rest` [least, most] of its definition, after a wander.
//   - Wandering: walking to `to`, and once there, standing for a rest.
//   - Grazing: of the grass grown tall, the one it went for last (`goal`) while it is still grown
//     and no other cow is going for it, else the nearest no other cow is going for; it walks there
//     and once within `reach` eats. With no grass grown, it wanders.
//   - A step it is meant to move and does not, it stops where it is and stands for a rest.
//
// The acts: `move(x, y)` and `use()`, a seat's keys through its `player` row, and `grip()`, which only
// rules call: taken by a seat, it stands with its keys let go and its brain's plans dropped.
import type { Kind, Row, W } from '#engine/engine.ts'
import { sound } from '#plugins/audio/audio.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { emit } from '#plugins/particle2d/particle2d.sim.ts'
import { holderOf } from '#plugins/player/player.sim.ts'
import { animate, apart, between, head, nearest, roam, steer, stride } from './plugins/walk/walk.sim.ts'

function eat(w: W, me: Row) {
  const d = me.data, k = def(w, me.kind)
  if (d.chew > 0) return
  const grass = nearest(me, w.all('grass').filter(g => g.data.grown && apart(g.data.pos, d.pos) <= k.reach))
  if (!grass) return
  w.call(grass, 'eat', -1)
  emit(w, k.graze, grass.data.pos)
  d.chew = k.chew
  d.goal = 0
  sound(w, k.sounds.moo, undefined, me.id)
}

// The brain: whether it means to move this step.
function think(w: W, me: Row, dt: number): boolean {
  const d = me.data, k = def(w, me.kind)
  d.move = [0, 0]
  if (d.wait > 0) {
    d.wait = Math.max(0, d.wait - dt)
    return false
  }
  if (d.to) {
    if (apart(d.pos, d.to) <= k.speed * dt) {
      d.to = null
      d.wait = between(w, k.rest)
      return false
    }
    head(w, me, d.to, dt)
    return true
  }
  const claimed = new Set(w.all('cow').filter(c => c !== me).map(c => c.data.goal))
  const open = w.all('grass').filter(g => g.data.grown && !claimed.has(g.id))
  const grass = open.find(g => g.id === d.goal) ?? nearest(me, open)
  if (!grass) {
    d.goal = 0
    d.to = roam(w, me)
    return false
  }
  d.goal = grass.id
  if (apart(d.pos, grass.data.pos) <= k.reach) {
    eat(w, me)
    return false
  }
  head(w, me, grass.data.pos, dt)
  return true
}

export const cow: Kind = {
  tick(me, dt, w) {
    const d = me.data, k = def(w, me.kind)
    if (d.chew > 0) {
      d.chew = Math.max(0, d.chew - dt)
      if (d.chew === 0) {
        w.spawn('manure', { pos: [...d.pos] })
        sound(w, k.sounds.plop, undefined, me.id)
        emit(w, k.plop, d.pos)
        d.to = roam(w, me)
      }
      animate(w, me, 'eat', dt)
      return
    }
    const meant = !holderOf(w, me) && think(w, me, dt)
    const moved = stride(w, me, dt)
    if (meant && !moved) {
      d.goal = 0
      d.to = null
      d.wait = between(w, k.rest)
    }
    animate(w, me, moved ? 'walk' : 'stand', dt)
  },
  acts: {
    move(me, _w, _seat, x: unknown, y: unknown) {
      steer(me, x, y)
    },
    use(me, w) {
      eat(w, me)
    },
    grip(me) {
      me.data.move = [0, 0]
      me.data.goal = 0
      me.data.to = null
      me.data.wait = 0
    },
  },
}
