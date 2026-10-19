// The browser half of roles, loaded by `shipped`: a mark over the head of every farmer, cow and
// chicken a seat plays, so everyone sees which are people's and each seat sees its own. Every
// `player` row the page is sent that holds a thing (`held`) marks it: a little triangle pointing down
// at it, `mark.size` [across, down] stage pixels, edged in `mark.edge`, in `mark.mine` over the thing
// this page's own seat plays and `mark.other` over the rest, all of those the `player` definition's;
// it stands `mark.lift` stage pixels over the thing's feet, a number of the held thing's own
// definition, and bobs `mark.bob` pixels up and down `mark.rate` times a second, on the `air` layer.
// A mark whose seat lets go, or leaves, is taken off the frame it is gone.
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

export function roles() {
  const marks = new Map<number, any>()
  let t = 0
  return {
    tick(p: Plugins) {
      const { render2d, wire } = p
      t += wire.scene.prefabs.engine.dt
      const here = new Set<number>()
      for (const seat of wire.rows) {
        if (seat.kind !== 'player' || !seat.data.held) continue
        const thing = wire.rows.find(r => r.id === seat.data.held.id && r.kind === seat.data.held.kind)
        if (!thing) continue
        const m = def(wire, seat.kind).mark, mine = seat.data.mine === true
        here.add(seat.id)
        let g = marks.get(seat.id)
        if (!g || g.mine !== mine) {
          g?.destroy()
          const [w, h] = m.size
          g = new render2d.PIXI.Graphics().poly([-w / 2, -h, w / 2, -h, 0, 0]).fill(mine ? m.mine : m.other).stroke({ color: m.edge, width: 1 })
          g.mine = mine
          render2d.layer('air').addChild(g)
          marks.set(seat.id, g)
        }
        const [x, y] = render2d.place(thing.data.pos)
        const bob = Math.round(Math.sin(t * m.rate * 2 * Math.PI) * m.bob)
        g.position.set(Math.round(x), Math.round(y - def(wire, thing.kind).mark.lift + bob))
      }
      for (const [id, g] of marks) {
        if (here.has(id)) continue
        g.destroy()
        marks.delete(id)
      }
    },
    close() {
      for (const g of marks.values()) g.destroy()
      marks.clear()
    },
  }
}
