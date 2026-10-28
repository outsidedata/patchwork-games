// The cube's graph, `cube.nav.json` beside this file, which the scene's catalogue names and nav3d reads:
// every way across the inside of the cube of the `cube` definition (`demo_nav3d.json`, its `size` and
// its middle `at`), worked out on the unit cube and scaled by half the size. Written by the game's bake
// (`demo_nav3d.bake.ts`); change the cube's numbers, and bake again.
//
// Each of the six faces is the ground of its own people, its up the face's normal turned in. On each,
// a node in its middle and a square ring of eight about it, halfway out to the face's edges: its four
// corners and the middles of its sides, every one on the face's up. On each of the twelve edges, three
// nodes in line with the rings, at the edge's middle and level with the rings' corners, each on the up
// halfway between its two faces'. A face's middle is joined to each of its ring, and each of the ring to
// the two beside it; each edge node to the ring node of each face that faces it, so a ring's corner
// reaches both edges it faces. 6 × 9 + 12 × 3 = 90 nodes, 6 × 16 + 36 × 2 = 168 links, each costing its
// length, every link of the word `ground` and every node tagged with its place in the list.
import fs from 'node:fs'
import path from 'node:path'
import defs from './demo_nav3d.json' with { type: 'json' }

type Node = { at: number[]; normal: number[]; tags: string[] }
type Link = { a: number; b: number; cost: number; ground: Record<string, never> }

// A face: the axis it lies across and the side of the cube it is on, −1 or +1.
type Face = { axis: number; side: number }

export function graph(size: number, at: number[]): { nodes: Node[]; links: Link[] } {
  const H = size / 2, R = H / 2
  const nodes: Node[] = []
  const links: Link[] = []
  const place = (unit: number[]) => unit.map((v, i) => at[i] + v)
  const node = (p: number[], n: number[]) => {
    nodes.push({ at: place(p), normal: n, tags: [`n${nodes.length}`] })
    return nodes.length - 1
  }
  const join = (a: number, b: number) => {
    const p = nodes[a].at, q = nodes[b].at
    links.push({ a, b, cost: Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), ground: {} })
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
    const middle = node(on(0, 0), up)
    const ring = RING.map(([a, b]) => node(on(a * R, b * R), up))
    for (const r of ring) join(middle, r)
    ring.forEach((r, i) => join(r, ring[(i + 1) % ring.length]))
    rings.set(f, ring)
  }

  // The ring node of face `f` at [u, v], by the face's own axes.
  const ringAt = (f: Face, coords: Record<number, number>) => {
    const [u, v] = others(f.axis)
    const i = RING.findIndex(([a, b]) => a * R === coords[u] && b * R === coords[v])
    return rings.get(f)![i]
  }

  // The edges: each pair of faces across two axes, its three nodes along the third.
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
        const e = node(p, up)
        // On f the ring node by g's side and level k along the edge; on g, by f's side.
        join(e, ringAt(f, { [g.axis]: g.side * R, [along]: k }))
        join(e, ringAt(g, { [f.axis]: f.side * R, [along]: k }))
      }
    }
  }
  return { nodes, links }
}

export function write(): string {
  const file = path.join(import.meta.dirname, 'cube.nav.json')
  fs.writeFileSync(file, JSON.stringify(graph(defs.cube.size, defs.cube.at), null, 1) + '\n')
  return file
}
