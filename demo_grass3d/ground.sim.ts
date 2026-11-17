// The land under the cars, as box3d holds it: one `ground` actor. Each step it lists on the box3d row's
// `ground` every chunk of the land (`world.box3d.chunk`, each (count − 1)·cell metres a side, made by
// terrain3d's `ground` mod) within `around` chunks of a chunk a car's chassis stands in, so each car drives
// on the land wherever it goes and box3d holds no more of it than that. Its row carries `around`.
import type { Kind } from '#engine/engine.ts'

export const ground: Kind = {
  before(me, _dt, w) {
    const { count, cell } = w.world.box3d.chunk as { count: number; cell: number }
    const span = (count - 1) * cell, n = me.data.around as number
    const keys = new Map<string, [number, number]>()
    for (const car of w.all('box3dvehicle')) {
      const chassis = w.all('car').find(c => c.id === car.data.chassis)
      if (!chassis) continue
      const ci = Math.floor(chassis.data.pos[0] / span), cj = Math.floor(chassis.data.pos[2] / span)
      for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) keys.set(`${i} ${j}`, [i, j])
    }
    w.find('box3d').data.ground = [...keys.values()]
  },
}
