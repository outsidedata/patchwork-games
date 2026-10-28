// The web's graph, `web.nav.json` beside this file, which the scene's catalogue names and nav3d reads, and
// the ribbons it lies on, `ribbons.json`, which the `ribbons` look draws: both from the `ribbons`
// definition (`web.json`). Written by the game's bake (`demo_nav3d.bake.ts`); change the web's numbers,
// and bake again. `dev.html` makes both in the page from its panel's `points`.
//
// Each hub is a disc of the definition's `thickness` at its place about the web's middle `at`, its up the
// way out from the middle. Each link of the definition is a ribbon from hub `a` to hub `b`: a line of
// `points` points evenly apart along its middle, each with its own up. The middle runs from a to b and
// bows out along a sideways push `bow` times sin(πt), the one push that leaves each hub flat along it, so
// the ribbon leaves and meets each hub lying in the hub's plane. Its up starts as a's up and is carried
// along the middle with the least turn (the double reflection of Wang et al.), then turned about the
// middle, eased in from the rim of a's disc (`hub` metres out) and out to the rim of b's, by the angle that brings it onto b's up, plus `half` half turns:
// an even `half` meets b on b's top, an odd one meets it on b's underside, as a Möbius band does.
//
// The graph walks both faces of every ribbon. Each hub is two nodes, its top and its underside, half the
// thickness out along its up and its down; each ribbon two lanes, one on its up face and one on the face
// under it, every point a node half the thickness out from the middle, on the up of that face. A lane is
// joined point to point from the hub face it starts on to the one it meets: the top lane of a ribbon with
// an odd `half` leaves a's top and comes out on b's underside. Every link costs its length, of the word
// `ground`, every node tagged with its place in the list.
type V = number[]
type Node = { at: V; normal: V; tags: string[] }
type Link = { a: number; b: number; cost: number; ground: Record<string, never> }
type Web = { at: V; points: number; thickness: number; hub: number; hubs: V[]; links: { a: number; b: number; half: number }[] }
export type Ribbon = { points: V[]; ups: V[] }
export type Shape = { ribbons: Ribbon[]; hubs: { at: V; normal: V }[] }

const add = (a: V, b: V) => a.map((v, i) => v + b[i])
const sub = (a: V, b: V) => a.map((v, i) => v - b[i])
const scale = (a: V, s: number) => a.map(v => v * s)
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: V) => scale(a, 1 / Math.hypot(a[0], a[1], a[2]))
// `v` turned by `angle` about the unit `axis` (Rodrigues).
const turn = (v: V, axis: V, angle: number) => {
  const c = Math.cos(angle), s = Math.sin(angle)
  return add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)))
}

// One ribbon's middle and ups, from hub place `A` with up `nA` to `B` with up `nB`.
export function ribbon(A: V, nA: V, B: V, nB: V, half: number, many: number, hub: number): Ribbon {
  const d = sub(B, A)
  // The push `bow`, in the plane of the two ups, with (d + π bow)·nA = 0 and (d − π bow)·nB = 0: the
  // middle's way at each end, d ± π bow, lies in that hub's plane.
  const c = dot(nA, nB)
  const p = -dot(d, nA) / Math.PI, q = dot(d, nB) / Math.PI
  const det = 1 - c * c
  const bow = add(scale(nA, (p - c * q) / det), scale(nB, (q - c * p) / det))
  const at = (t: number) => add(add(A, scale(d, t)), scale(bow, Math.sin(Math.PI * t)))
  const way = (t: number) => unit(add(d, scale(bow, Math.PI * Math.cos(Math.PI * t))))

  // Even metres along the middle: its length over a fine walk of t, then `many` points evenly along it.
  const FINE = 4000
  const run = [0]
  for (let i = 1; i <= FINE; i++) {
    const a = at((i - 1) / FINE), b = at(i / FINE)
    run.push(run[i - 1] + Math.hypot(...sub(b, a)))
  }
  const length = run[FINE]
  const count = many - 1
  const ts: number[] = []
  for (let k = 0, j = 0; k <= count; k++) {
    const s = (length * k) / count
    while (j < FINE - 1 && run[j + 1] < s) j++
    ts.push((j + (s - run[j]) / (run[j + 1] - run[j])) / FINE)
  }
  ts[count] = 1
  const points = ts.map(at)
  points[0] = [...A]
  points[count] = [...B]
  const ways = ts.map(way)

  // The up carried with the least turn, then the twist that meets b.
  const carried: V[] = [unit(sub(nA, scale(ways[0], dot(nA, ways[0]))))]
  for (let k = 1; k <= count; k++) {
    const v1 = sub(points[k], points[k - 1])
    const r = carried[k - 1], t = ways[k - 1]
    const c1 = dot(v1, v1)
    const rL = sub(r, scale(v1, (2 / c1) * dot(v1, r)))
    const tL = sub(t, scale(v1, (2 / c1) * dot(v1, t)))
    const v2 = sub(ways[k], tL)
    const c2 = dot(v2, v2)
    carried.push(unit(c2 < 1e-24 ? rL : sub(rL, scale(v2, (2 / c2) * dot(v2, rL)))))
  }
  const end = carried[count], wayB = ways[count]
  const meet = Math.atan2(dot(cross(end, nB), wayB), dot(end, nB))
  const twist = meet + half * Math.PI
  // None of the twist on either disc: it eases in from a's rim and out to b's, so the ribbon lies flat on
  // both discs and meets each rim along it.
  const ease = (k: number) => {
    const x = Math.min(1, Math.max(0, ((length * k) / count - hub) / (length - 2 * hub)))
    return x * x * (3 - 2 * x)
  }
  const ups = carried.map((u, k) => unit(turn(u, ways[k], twist * ease(k))))
  ups[0] = [...nA]
  ups[count] = half % 2 ? scale(nB, -1) : [...nB]
  return { points, ups }
}

export function shape(web: Web): Shape {
  const hubs = web.hubs.map(h => ({ at: add(web.at, h), normal: unit(h) }))
  const ribbons = web.links.map(l => ribbon(hubs[l.a].at, hubs[l.a].normal, hubs[l.b].at, hubs[l.b].normal, l.half, web.points, web.hub))
  return { ribbons, hubs }
}

export function graph(web: Web): { nodes: Node[]; links: Link[] } {
  const { ribbons, hubs } = shape(web)
  const T = web.thickness / 2
  const nodes: Node[] = []
  const links: Link[] = []
  const node = (p: V, n: V) => {
    nodes.push({ at: p, normal: n, tags: [`n${nodes.length}`] })
    return nodes.length - 1
  }
  const join = (a: number, b: number) => links.push({ a, b, cost: Math.hypot(...sub(nodes[b].at, nodes[a].at)), ground: {} })

  // Hub h's top is node 2h, its underside 2h + 1.
  for (const h of hubs) {
    node(add(h.at, scale(h.normal, T)), h.normal)
    node(sub(h.at, scale(h.normal, T)), scale(h.normal, -1))
  }
  web.links.forEach((l, r) => {
    const { points, ups } = ribbons[r]
    const last = points.length - 1
    for (const side of [1, -1]) {
      let from = 2 * l.a + (side === 1 ? 0 : 1)
      for (let k = 1; k < last; k++) {
        const up = scale(ups[k], side)
        const n = node(add(points[k], scale(up, T)), up)
        join(from, n)
        from = n
      }
      const top = (side === 1) === (l.half % 2 === 0)
      join(from, 2 * l.b + (top ? 0 : 1))
    }
  })
  return { nodes, links }
}
