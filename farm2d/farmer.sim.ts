// The farmer: walks the field (`plugins/walk`), and carries one thing at a time, `carry`: `manure`,
// a crop's produce by its clip (`strawberry`, `leek`, `potato`, `onion`), or null. A seat plays it
// through its `player` row (`plugins/roles`), whose keys are its acts `move` and `use`; while no seat
// holds it, its brain plays it with the same two.
//
// `use`, the farmer's one verb, by what it carries:
//   nothing    of the ripe crops, the produce lying loose and the manure within its definition's
//              `reach`, it picks up the nearest: a crop is picked (the crop's `pick`), the rest are
//              lifted off the ground with the effect `effects.lift`; the `sounds.pick` sound rings
//              from it.
//   manure     put down where it stands. On a cell of tilled soil (its tile on the `soil.layer` layer
//              of the field's map is of the Tiled type `soil.type`) where no crop grows, a crop is
//              sown in the cell's middle (the crop's `sow`), with the effect `sow`; anywhere else the
//              manure lies on the ground where the farmer stands, with the effect `effects.drop`.
//   produce    put on the harvest pile when the pile is within `reach` (the pile's `add`), with the
//              effect `effects.stash` from the pile, else laid on the ground where it stands, with
//              the effect `effects.drop`.
// Putting down rings `sounds.put` from it.
//
// The brain, while no seat holds it, each step:
//   - Standing a while: `wait` seconds, once it has found nothing to do, `rest` [least, most] of
//     its definition.
//   - Its job, kept from the last step while it still holds (`goal`, a row's id, and `to`, the point
//     it heads for): carrying manure, the nearest empty soil cell's middle, not one another farmer is
//     taking manure to; carrying produce, the pile; carrying nothing, the nearest ripe crop, loose
//     produce or manure that no other farmer is going for.
//   - It walks there round the fences (`route`), and once there, manure in the cell itself and the
//     rest within `reach`, it uses. Nothing to do, it stands for a rest. A step it is meant to move
//     and does not, it gives up the job and stands for a rest, and looks again.
//
// The rows: `goal` and `to` as above; `wait`, the seconds it stands still; and walk's `pos`, `move`,
// `facing`, `clip` (`walk` while it moves, `idle` while it stands), `frame` and `ft`.
//
// The acts: `move(x, y)` and `use()`, a seat's keys through its `player` row, and `grip()`, which only
// rules call: taken by a seat, it stands with its keys let go and its brain's job dropped.
import type { Kind, Row, W } from '#engine/engine.ts'
import { sound } from '#plugins/audio/audio.sim.ts'
import { def, tiled } from '#plugins/loader/loader.sim.ts'
import { emit } from '#plugins/particle2d/particle2d.sim.ts'
import { holderOf } from '#plugins/player/player.sim.ts'
import { tileAt } from '#plugins/tilemap/tilemap.sim.ts'
import { animate, apart, between, head, nearest, route, steer, stride } from './plugins/walk/walk.sim.ts'

type Cell = [number, number]

const cellOf = (pos: readonly number[]): Cell => [Math.floor(pos[0]), Math.floor(pos[1])]
const middle = ([c, r]: Cell) => [c + 0.5, r + 0.5]
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1]

// Whether a cell is tilled soil with no crop growing in it.
function free(w: W, k: any, cell: Cell): boolean {
  const map = tiled(w, w.world.tilemap.file)
  const gid = tileAt(map, undefined, k.soil.layer, cell[0], cell[1])
  return map.tiles[gid]?.type === k.soil.type && !w.all('crop').some(c => same(cellOf(c.data.pos), cell))
}

// What the farmer can pick up: ripe crops, loose produce and manure.
const things = (w: W) => [...w.all('crop').filter(c => c.data.ripe), ...w.all('produce'), ...w.all('manure')]

function use(w: W, me: Row) {
  const d = me.data, k = def(w, me.kind)
  if (d.carry === null) {
    const it = nearest(me, things(w).filter(r => apart(r.data.pos, d.pos) <= k.reach))
    if (!it) return
    d.carry = it.kind === 'manure' ? 'manure' : it.data.clip
    if (it.kind === 'crop') w.call(it, 'pick', -1)
    else {
      emit(w, k.effects.lift, it.data.pos)
      w.end(it)
    }
    sound(w, k.sounds.pick, undefined, me.id)
  } else if (d.carry === 'manure') {
    const cell = cellOf(d.pos)
    if (free(w, k, cell)) {
      const crop = w.spawn('crop', { pos: middle(cell) })
      w.call(crop, 'sow', -1)
      emit(w, k.sow, crop.data.pos)
    } else {
      w.spawn('manure', { pos: [...d.pos] })
      emit(w, k.effects.drop, d.pos)
    }
    d.carry = null
    sound(w, k.sounds.put, undefined, me.id)
  } else {
    const pile = w.all('pile').find(p => apart(p.data.pos, d.pos) <= k.reach)
    if (pile) {
      w.call(pile, 'add', -1, d.carry)
      emit(w, k.effects.stash, pile.data.pos)
    } else {
      w.spawn('produce', { pos: [...d.pos], clip: d.carry })
      emit(w, k.effects.drop, d.pos)
    }
    d.carry = null
    sound(w, k.sounds.put, undefined, me.id)
  }
  d.goal = 0
  d.to = null
}

// The point the brain heads for, kept from the last step while it still holds, or undefined.
function job(w: W, me: Row): number[] | undefined {
  const d = me.data, k = def(w, me.kind)
  const others = w.all('farmer').filter(f => f !== me)
  if (d.carry === 'manure') {
    d.goal = 0
    const taken = others.filter(f => f.data.carry === 'manure' && f.data.to).map(f => cellOf(f.data.to))
    const open = (cell: Cell) => free(w, k, cell) && !taken.some(t => same(t, cell))
    if (d.to && open(cellOf(d.to))) return d.to
    const map = tiled(w, w.world.tilemap.file)
    let best: Cell | undefined, gap = Infinity
    for (let r = 0; r < map.height; r++) {
      for (let c = 0; c < map.width; c++) {
        const cell: Cell = [c, r], g = apart(d.pos, middle(cell))
        if (g < gap && open(cell)) { gap = g; best = cell }
      }
    }
    d.to = best ? middle(best) : null
    return d.to ?? undefined
  }
  if (d.carry !== null) {
    const pile = w.all('pile')[0]
    d.goal = pile ? pile.id : 0
    d.to = pile ? [...pile.data.pos] : null
    return d.to ?? undefined
  }
  const claimed = new Set(others.map(f => f.data.goal))
  const open = things(w).filter(r => !claimed.has(r.id))
  const it = open.find(r => r.id === d.goal) ?? nearest(me, open)
  d.goal = it ? it.id : 0
  d.to = it ? [...it.data.pos] : null
  return d.to ?? undefined
}

// The brain: whether it means to move this step.
function think(w: W, me: Row, dt: number): boolean {
  const d = me.data, k = def(w, me.kind)
  d.move = [0, 0]
  if (d.wait > 0) {
    d.wait = Math.max(0, d.wait - dt)
    return false
  }
  const to = job(w, me)
  if (!to) {
    d.wait = between(w, k.rest)
    return false
  }
  const there = d.carry === 'manure' ? same(cellOf(d.pos), cellOf(to)) : apart(d.pos, to) <= k.reach
  if (there) {
    use(w, me)
    return false
  }
  head(w, me, route(w, me, to), dt)
  return true
}

export const farmer: Kind = {
  tick(me, dt, w) {
    const d = me.data
    const meant = !holderOf(w, me) && think(w, me, dt)
    const moved = stride(w, me, dt)
    if (meant && !moved) {
      d.goal = 0
      d.to = null
      d.wait = between(w, def(w, me.kind).rest)
    }
    animate(w, me, moved ? 'walk' : 'idle', dt)
  },
  acts: {
    move(me, _w, _seat, x: unknown, y: unknown) {
      steer(me, x, y)
    },
    use(me, w) {
      use(w, me)
    },
    grip(me) {
      me.data.move = [0, 0]
      me.data.goal = 0
      me.data.to = null
      me.data.wait = 0
    },
  },
}
