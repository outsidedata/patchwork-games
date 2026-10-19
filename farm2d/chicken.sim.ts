// A chicken: walks its yard (`plugins/walk`, its definition's `bounds` the inside of the yard's
// fence) in the look of its row's `sheet`, `chicken` or `hen`, facing right or left. A seat plays it
// through its `player` row (`plugins/roles`), whose keys are its acts `move` and `use`; while no seat
// holds it, its brain plays it with the same two. Now and then, with odds of `cluck` a step whatever
// it is doing, it clucks (`sounds.cluck`), heard from where it stands.
//
// `use`, the chicken's one verb, pecks: for `peck` seconds, `peck` on its row counting down, it stands
// and plays its sheet's `peck` clip whatever its keys say (they are kept, and walk it on once it has
// done), and the `sounds.peck` sound rings from it.
// The nearest bug within its definition's `reach`, if there is one, is eaten: it turns to face it,
// the bug is gone, and the effect `burst` bursts where it was. It pecks again only once it has done.
//
// The brain, while no seat holds it, each step:
//   - Hunting, before anything else: of the bugs in its yard (inside `bounds`, or within `reach` of
//     them) that it sees, within `sees` cells of it, the one it went for last (`goal`) while no other
//     chicken is going for it, else the nearest no other chicken is going for; it runs there and once
//     within `reach` pecks. A bug none of the chickens sees creeps on to the pile.
//   - With no bug to go for, standing a while (`wait`, `rest` [least, most] of its definition), then
//     wandering to a point of its yard (`to`, `roam`), and standing again.
//   - A step it is meant to move and does not, it stops where it is and stands for a rest.
//
// The acts: `move(x, y)` and `use()`, a seat's keys through its `player` row, and `grip()`, which only
// rules call: taken by a seat, it stands with its keys let go and its brain's plans dropped.
import type { Kind, Row, W } from '#engine/engine.ts'
import { chance, sound } from '#plugins/audio/audio.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { emit } from '#plugins/particle2d/particle2d.sim.ts'
import { holderOf } from '#plugins/player/player.sim.ts'
import { inYard, prey } from './plugins/chores/chores.sim.ts'
import { animate, apart, between, head, nearest, roam, steer, stride } from './plugins/walk/walk.sim.ts'

function peck(w: W, me: Row) {
  const d = me.data, k = def(w, me.kind)
  if (d.peck > 0) return
  d.peck = k.peck
  sound(w, k.sounds.peck, undefined, me.id)
  const bug = prey(kind => w.all(kind), d.pos, k.reach)
  if (!bug) return
  if (bug.data.pos[0] !== d.pos[0]) d.facing = bug.data.pos[0] > d.pos[0] ? 0 : 0.5
  emit(w, k.burst, bug.data.pos)
  w.end(bug)
  d.goal = 0
}

// The brain: whether it means to move this step.
function think(w: W, me: Row, dt: number): boolean {
  const d = me.data, k = def(w, me.kind)
  d.move = [0, 0]
  const claimed = new Set(w.all('chicken').filter(c => c !== me).map(c => c.data.goal))
  const open = w.all('bug').filter(b => inYard(k.bounds, k.reach, b.data.pos) && apart(d.pos, b.data.pos) <= k.sees && !claimed.has(b.id))
  const bug = open.find(b => b.id === d.goal) ?? nearest(me, open)
  if (bug) {
    d.goal = bug.id
    d.to = null
    d.wait = 0
    if (apart(d.pos, bug.data.pos) <= k.reach) {
      peck(w, me)
      return false
    }
    head(w, me, bug.data.pos, dt)
    return true
  }
  d.goal = 0
  if (d.wait > 0) {
    d.wait = Math.max(0, d.wait - dt)
    return false
  }
  if (!d.to) {
    d.to = roam(w, me)
    return false
  }
  if (apart(d.pos, d.to) <= k.speed * dt) {
    d.to = null
    d.wait = between(w, k.rest)
    return false
  }
  head(w, me, d.to, dt)
  return true
}

export const chicken: Kind = {
  tick(me, dt, w) {
    const d = me.data, k = def(w, me.kind)
    if (chance(w, me.id, k.cluck)) sound(w, k.sounds.cluck, undefined, me.id)
    if (d.peck > 0) {
      d.peck = Math.max(0, d.peck - dt)
      animate(w, me, 'peck', dt)
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
      peck(w, me)
    },
    grip(me) {
      me.data.move = [0, 0]
      me.data.goal = 0
      me.data.to = null
      me.data.wait = 0
    },
  },
}
