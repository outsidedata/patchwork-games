// range: the steel plates demo_guns3d's player shoots at, the server's half. A plate is a round plate on a post,
// standing where its row's `pos` [x, y, z] puts its post's foot, facing the firing line (−z). Its numbers are its
// definition (`assets/demo_guns3d.json`'s `plate`): `radius` and `thick`, the plate's, metres; `post`, the height of
// the plate's middle over the foot; `pole`, the post's radius; `down`, the seconds it lies knocked back once struck;
// `fall`, the seconds it takes to go over (the browser half's); and its colours (the browser half's).
//
// `plate` is its rule: its `hit` act, which hitscan3d's shot calls through guns3d's `hitscan` (a rule's, seat −1),
// knocks a standing plate down for `down` seconds and counts the hit on `hits`; a seat's own message is refused. Each
// step a plate that is down comes `dt` nearer standing. While it is down, hitscan3d passes it by
// (`world.hitscan3d.kinds.plate.off`).
//
// `plates(w)` is every plate a shot can meet now, for `range.hitscan3d.ts`.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export const plate: Kind = {
  tick(me, dt) {
    if (me.data.down > 0) me.data.down = Math.max(0, me.data.down - dt)
  },
  acts: {
    hit(me, w, seat) {
      if (seat >= 0 || me.data.down > 0) return
      me.data.down = def(w, me.kind).down
      me.data.hits += 1
    },
  },
}

// A standing plate as a shot meets it: an upright cylinder as wide as the plate and as tall, about its middle, so it
// is met where the plate is seen from the firing line.
export function plates(w: W): { id: number; kind: string; pos: number[]; shapes: { part: string; cylinder: { pos: number[]; radius: number; height: number } }[] }[] {
  return w.all('plate').filter((r: Row) => !(r.data.down > 0)).map((r: Row) => {
    const k = def(w, r.kind)
    const [x, y, z] = r.data.pos
    return { id: r.id, kind: r.kind, pos: r.data.pos, shapes: [{ part: 'plate', cylinder: { pos: [x, y + k.post - k.radius, z], radius: k.radius, height: 2 * k.radius } }] }
  })
}
