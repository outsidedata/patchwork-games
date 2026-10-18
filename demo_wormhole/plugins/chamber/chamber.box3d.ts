// chamber's pieces for box3d. `ground(w, key)` hands back the whole level as one fixed body, whatever
// chunk is asked for: each box a box shape, each ramp the hull of its wedge's six corners; the `box3d`
// row lists the one chunk, [0, 0]. `kinds(w)` makes the `crate` and `ball` kinds' bodies out of their
// definitions: a box `size` metres a side, a sphere of `radius` rolling against its `rolling`
// (Box3D's rollingResistance), each of `density`, `friction` and `restitution`. Named by
// `world.box3d.mods: { ground: 'chamber', kinds: 'chamber' }`.
import type { Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import type { Body, Kinds, Shape, Static } from '#plugins/box3d/box3d.sim.ts'
import { piecesOf } from './chamber.sim.ts'

type V3 = [number, number, number]
type Piece = { min: V3; max: V3; toward?: [number, number] }

export function ground(w: W, _key: number[]): Static {
  const { boxes, ramps } = piecesOf(w) as unknown as { boxes: Piece[]; ramps: Piece[] }
  const shapes: Shape[] = boxes.map(b => ({
    box: [0, 1, 2].map(i => (b.max[i] - b.min[i]) / 2) as V3,
    pos: [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2) as V3,
  }))
  for (const r of ramps) {
    const [tx, tz] = r.toward!
    const [x0, y0, z0] = r.min, [x1, y1, z1] = r.max
    // The corners on the high side, the side `toward` points at, rise to the top.
    const high = (x: number, z: number) => (x - (tx + tz > 0 ? x0 : x1)) * tx + (z - (tx + tz > 0 ? z0 : z1)) * tz > 0
    const points: number[] = []
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
      points.push(x, y0, z)
      if (high(x, z)) points.push(x, y1, z)
    }
    shapes.push({ hull: { points } })
  }
  return { pos: [0, 0, 0], rot: [0, 0, 0, 1], shapes }
}

export function kinds(w: W): Kinds {
  return {
    bodies: {
      crate: (row: Row): Body => {
        const { size, density, friction, restitution } = def(w, row.kind)
        return { type: 'dynamic', shapes: [{ box: [size / 2, size / 2, size / 2], density, baseMaterial: { friction, restitution } }] }
      },
      ball: (row: Row): Body => {
        const { radius, density, friction, restitution, rolling } = def(w, row.kind)
        return { type: 'dynamic', shapes: [{ sphere: { center: [0, 0, 0], radius }, density, baseMaterial: { friction, restitution, rollingResistance: rolling } }] }
      },
    },
  }
}
