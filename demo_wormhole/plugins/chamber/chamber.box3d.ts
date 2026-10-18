// chamber's pieces for box3d. `ground(w, key)` hands back the whole level as one fixed body, whatever
// chunk is asked for: each box a box shape (a box's `bounce` its restitution), each ramp the hull of
// its wedge's six corners; the `box3d`
// row lists the one chunk, [0, 0]. `kinds(w)` makes the bodies of the game's kinds out of their
// definitions: a `crate` or a `prism` a box `size` metres a side, a `ball` a sphere of `radius` rolling
// against its `rolling` (Box3D's rollingResistance), each of `density`, `friction` and `restitution`;
// a `door` or a `lift` a kinematic box of its `size`. Named by
// `world.box3d.mods: { ground: 'chamber', kinds: 'chamber' }`.
import type { Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import type { Body, Kinds, Shape, Static } from '#plugins/box3d/box3d.sim.ts'
import { corners, piecesOf } from './chamber.sim.ts'

type V3 = [number, number, number]
type Piece = { min: V3; max: V3; toward?: [number, number]; bounce?: number }

export function ground(w: W, _key: number[]): Static {
  const { boxes, ramps } = piecesOf(w) as unknown as { boxes: Piece[]; ramps: Piece[] }
  const shapes: Shape[] = boxes.map(b => ({
    box: [0, 1, 2].map(i => (b.max[i] - b.min[i]) / 2) as V3,
    pos: [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2) as V3,
    ...(b.bounce === undefined ? {} : { baseMaterial: { restitution: b.bounce } }),
  }))
  for (const r of ramps) shapes.push({ hull: { points: corners(r as Parameters<typeof corners>[0]) } })
  return { pos: [0, 0, 0], rot: [0, 0, 0, 1], shapes }
}

export function kinds(w: W): Kinds {
  return {
    bodies: {
      crate: (row: Row): Body => {
        const { size, density, friction, restitution } = def(w, row.kind)
        return { type: 'dynamic', shapes: [{ box: [size / 2, size / 2, size / 2], density, baseMaterial: { friction, restitution } }] }
      },
      prism: (row: Row): Body => {
        const { size, density, friction, restitution } = def(w, row.kind)
        return { type: 'dynamic', shapes: [{ box: [size / 2, size / 2, size / 2], density, baseMaterial: { friction, restitution } }] }
      },
      door: (row: Row): Body => {
        const { size } = def(w, row.kind)
        return { type: 'kinematic', shapes: [{ box: [size[0] / 2, size[1] / 2, size[2] / 2] }] }
      },
      lift: (row: Row): Body => {
        const { size } = def(w, row.kind)
        return { type: 'kinematic', shapes: [{ box: [size[0] / 2, size[1] / 2, size[2] / 2] }] }
      },
      ball: (row: Row): Body => {
        const { radius, density, friction, restitution, rolling } = def(w, row.kind)
        return { type: 'dynamic', shapes: [{ sphere: { center: [0, 0, 0], radius }, density, baseMaterial: { friction, restitution, rollingResistance: rolling } }] }
      },
    },
  }
}
