// The cube's graph, `cube.nav.json` beside this file, which the scene's catalogue names and nav3d reads:
// every way across the inside of the cube of the `cube` definition (`demo_nav3d.json`, its `size` and
// its middle `at`), worked out on the unit cube and scaled by half the size. Written by the game's bake
// (`demo_nav3d.bake.ts`); change the cube's numbers, and bake again.
//
// Each of the six faces is the ground of its own people, its up the face's normal turned in. On each,
// a place in its middle and a square ring of eight about it, halfway out to the face's edges: its four
// corners and the middles of its sides, every one on the face's up. On each of the twelve edges, three
// places in line with the rings, at the edge's middle and level with the rings' corners, each on the up
// halfway between its two faces'. A face's middle is joined to each of its ring, and each of the ring to
// the two beside it; each edge place to the ring place of each face that faces it, so a ring's corner
// reaches both edges it faces. 6 × 9 + 12 × 3 = 90 places, 6 × 16 + 36 × 2 = 168 ways. Each place is a
// shapes3d point on its up, tagged with its place in the list (`data.nav3d.tags`); each way a shapes3d
// line from one place to the other, of the word `ground` (`data.nav3d.word`), costing its length, which
// nav3d takes as a line's cost when its data gives none.
import fs from 'node:fs'
import path from 'node:path'
import type { Graph, Place, Way } from '#plugins/nav3d/nav3d.sim.ts'
import defs from './demo_nav3d.json' with { type: 'json' }

// A face: the axis it lies across and the side of the cube it is on, −1 or +1.
type Face = { axis: number; side: number }

export function graph(size: number, at: number[]): Graph {
  const H = size / 2, R = H / 2
  const places: Place[] = []
  const ways: Way[] = []
  const place = (unit: number[]) => unit.map((v, i) => at[i] + v)
  const put = (p: number[], n: number[]) => {
    places.push({ point: { at: place(p), normal: n }, data: { nav3d: { tags: [`n${places.length}`] } } })
    return places.length - 1
  }
  const join = (a: number, b: number) => {
    ways.push({ line: { from: [...places[a].point.at], to: [...places[b].point.at] }, data: { nav3d: { word: 'ground' } } })
  }

  // The faces, and on each the ring by its place [u, v] on the face's other two axes, in turn round it.
  const faces: Face[] = [0, 1, 2].flatMap(axis => [-1, 1].map(side => ({ axis, side })))
  const others = (axis: number) => [0, 1, 2].filter(i => i !== axis)
  const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]
  const rings = new Map<Face, number[]>()
  for (const f of faces) {
    const up = [0, 0, 0]
    up[f.axis] = -f.side
    const [u, v] = others(f.axis)
    const on = (a: number, b: number) => {
      const p = [0, 0, 0]
      p[f.axis] = f.side * H
      p[u] = a
      p[v] = b
      return p
    }
    const middle = put(on(0, 0), up)
    const ring = RING.map(([a, b]) => put(on(a * R, b * R), up))
    for (const r of ring) join(middle, r)
    ring.forEach((r, i) => join(r, ring[(i + 1) % ring.length]))
    rings.set(f, ring)
  }

  // The ring place of face `f` at [u, v], by the face's own axes.
  const ringAt = (f: Face, coords: Record<number, number>) => {
    const [u, v] = others(f.axis)
    const i = RING.findIndex(([a, b]) => a * R === coords[u] && b * R === coords[v])
    return rings.get(f)![i]
  }

  // The edges: each pair of faces across two axes, its three places along the third.
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const f = faces[i], g = faces[j]
      if (f.axis === g.axis) continue
      const along = [0, 1, 2].find(k => k !== f.axis && k !== g.axis)!
      const up = [0, 0, 0]
      up[f.axis] = -f.side * Math.SQRT1_2
      up[g.axis] = -g.side * Math.SQRT1_2
      for (const k of [-R, 0, R]) {
        const p = [0, 0, 0]
        p[f.axis] = f.side * H
        p[g.axis] = g.side * H
        p[along] = k
        const e = put(p, up)
        // On f the ring place by g's side and level k along the edge; on g, by f's side.
        join(e, ringAt(f, { [g.axis]: g.side * R, [along]: k }))
        join(e, ringAt(g, { [f.axis]: f.side * R, [along]: k }))
      }
    }
  }
  return { places, ways }
}

export function write(): string {
  const file = path.join(import.meta.dirname, 'cube.nav.json')
  fs.writeFileSync(file, JSON.stringify(graph(defs.cube.size, defs.cube.at), null, 1) + '\n')
  return file
}
