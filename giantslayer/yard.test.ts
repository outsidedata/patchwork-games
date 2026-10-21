// The yard, booted as the server boots it and drawn by a page as `index.html` makes it, on node with no
// renderer: what its wall is on the rows and as the page draws it.
import { expect, test, vi } from 'vitest'
import type * as THREE from 'three'
import { boot, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { prepared } from '#plugins/loader/loader.sim.ts'
import { ends } from '#plugins/anim/anim.sim.ts'
import { keyCode } from '#plugins/player/player.plugin.ts'
import { bent, box, bumps, corner, cylinder, dish, fromNet, fromRest, heldPoint, heldWay, linked, meshOf, netOf, netOn, posedNet, restOf, sphere, spotOn, unbent } from './plugins/climb/climb.sim.ts'
import { sim } from './giantslayer.sim.ts'
import file from './giantslayer.scene.json'
import defs from './assets/giantslayer.json'

vi.setConfig({ testTimeout: 300_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href

// The page's window: every listener kept by type and phase, the UI's capture listeners first, as a
// browser hands them a key. No pad is plugged in.
type On = { type: string; f: (e: unknown) => void; capture: boolean }
const listening: On[] = []
vi.stubGlobal('addEventListener', (type: string, f: (e: unknown) => void, o?: unknown) => { listening.push({ type, f, capture: o === true }) })
vi.stubGlobal('removeEventListener', (type: string, f: (e: unknown) => void, o?: unknown) => {
  const i = listening.findIndex(x => x.type === type && x.f === f && x.capture === (o === true))
  if (i >= 0) listening.splice(i, 1)
})
vi.stubGlobal('navigator', { getGamepads: () => [] })
// A key pressed or let go, as a browser hands it to the page's listeners.
const key = (type: 'keydown' | 'keyup', k: string) => {
  const e = { code: keyCode(k), key: k, repeat: false, target: null, preventDefault() {} }
  for (const capture of [true, false]) for (const o of listening.filter(o => o.type === type && o.capture === capture)) o.f(e)
}

// What render3d draws on and the UI listens through: no renderer is made in node.
const surface = (s: Scene) => ({ addEventListener: () => {}, removeEventListener: () => {}, style: {} as any, width: s.prefabs.engine.width, height: s.prefabs.engine.height, remove() {} })

async function start() {
  const top = structuredClone(file) as Scene
  top.prefabs.scenemanager.entry = 'yard'
  const truth = boot(top, sim)
  const yard = (await load(truth, here)).get('yard')!
  const p = view(link(loopback(accept(manager(truth)))), top, here, (me, s) => {
    me.plugins.render3d.canvas = surface(s)
    me.plugins.ui.canvas = surface(s)
  })
  const frames = async (k: number) => { for (let i = 0; i < k; i++) { truth.step(DT); await p.frame() } }
  // The one copy of the definitions every rule and look reads.
  const shared = await prepared(top.world!, top.world!.defs)
  // Frames until the hero's model has loaded and anim draws it, the loader decoding it meanwhile.
  await frames(2)
  for (let i = 0; i < 600; i++) {
    const hero = yard.rows.find(r => r.kind === 'player')
    if (hero && p.client!.plugins.anim.model(hero.id)) break
    await new Promise(r => setTimeout(r, 10))
    await frames(1)
  }
  return { truth, yard, p, frames, shared }
}

// A place in the world in a wall's own frame: back from where it stands, back by its yaw, then forward
// by its pitch (the reverse of climb's `heldPoint`).
function localTo(wall: { data: any }, v: number[]) {
  const [x, y, z] = wall.data.pos, c = Math.cos(wall.data.yaw), s = Math.sin(wall.data.yaw)
  const dx = v[0] - x, dy = v[1] - y, dz = v[2] - z
  const u = [dx * c - dz * s, dy, dx * s + dz * c]
  const p = wall.data.pitch, cp = Math.cos(p), sp = Math.sin(p)
  return [u[0], u[1] * cp - u[2] * sp, u[1] * sp + u[2] * cp]
}

// How far a point of the wall's own frame is from the box's surface: 0 on it, negative inside it.
function fromSurface(p: ArrayLike<number>) {
  const [w, h, d] = defs.wall.size
  const q = [Math.abs(p[0]) - w / 2, Math.abs(p[1] - h / 2) - h / 2, Math.abs(p[2]) - d / 2]
  const outside = Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0))
  return outside > 0 ? outside : Math.max(q[0], q[1], q[2])
}

type V3 = number[]
const vsub = (a: V3, b: V3) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const vcross = (a: V3, b: V3) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const vlen = (a: V3) => Math.hypot(a[0], a[1], a[2])

// How far a point of a mesh's own frame is from the mesh's surface, any closed mesh: 0 on it, negative
// inside it. It is the distance to the nearest point of the nearest triangle, inside when the point lies
// behind the way out there: the triangle's own where that nearest point is inside it, and where it is on
// an edge or a corner, the faces round that edge or corner summed (a corner's each by its angle there),
// so a point just off a fold is never taken for inside. Triangles are found by a grid of `h`-metre
// boxes, each holding every triangle that comes within `h` of it; a point with none that near is at
// least `h` from the surface, and in or out as its box's middle is (a ray from there crossing the
// surface an odd number of times is inside): ±h is returned for it.
function signedTo(mesh: { position: number[]; index: number[] }, h: number) {
  // Corners at one place are one.
  const ids = new Map<string, number>(), at: V3[] = [], of: number[] = []
  for (let i = 0; i < mesh.position.length / 3; i++) {
    const p = mesh.position.slice(i * 3, i * 3 + 3)
    const key = p.map(v => Math.round(v / 1e-4)).join(',')
    if (!ids.has(key)) { ids.set(key, at.length); at.push(p) }
    of.push(ids.get(key)!)
  }
  const tris: number[][] = []
  for (let t = 0; t < mesh.index.length; t += 3) tris.push([of[mesh.index[t]], of[mesh.index[t + 1]], of[mesh.index[t + 2]]])
  const normal = tris.map(([a, b, c]) => { const n = vcross(vsub(at[b], at[a]), vsub(at[c], at[a])); return n.map(v => v / vlen(n)) })
  const corner: V3[] = at.map(() => [0, 0, 0])
  const edge = new Map<string, V3>()
  const edgeKey = (a: number, b: number) => (a < b ? `${a} ${b}` : `${b} ${a}`)
  tris.forEach((tri, f) => {
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3], c = tri[(k + 2) % 3]
      const u = vsub(at[b], at[a]), v = vsub(at[c], at[a])
      const angle = Math.acos(Math.max(-1, Math.min(1, vdot(u, v) / (vlen(u) * vlen(v)))))
      corner[a] = corner[a].map((x, i) => x + normal[f][i] * angle)
      const e = edge.get(edgeKey(a, b)) ?? [0, 0, 0]
      edge.set(edgeKey(a, b), e.map((x, i) => x + normal[f][i]))
    }
  })
  // The grid.
  const lo = [0, 1, 2].map(k => Math.min(...at.map(p => p[k])) - 2 * h)
  const hi = [0, 1, 2].map(k => Math.max(...at.map(p => p[k])) + 2 * h)
  const n = [0, 1, 2].map(k => Math.ceil((hi[k] - lo[k]) / h))
  const cellOf = (p: V3) => p.map((v, k) => Math.floor((v - lo[k]) / h))
  const indexOf = (c: number[]) => (c[2] * n[1] + c[1]) * n[0] + c[0]
  const boxes = new Map<number, number[]>()
  tris.forEach((tri, f) => {
    const from = cellOf([0, 1, 2].map(k => Math.min(...tri.map(i => at[i][k])) - h))
    const to = cellOf([0, 1, 2].map(k => Math.max(...tri.map(i => at[i][k])) + h))
    for (let z = from[2]; z <= to[2]; z++) for (let y = from[1]; y <= to[1]; y++) for (let x = from[0]; x <= to[0]; x++) {
      const i = indexOf([x, y, z])
      if (!boxes.has(i)) boxes.set(i, [])
      boxes.get(i)!.push(f)
    }
  })
  // Whether a point is inside: a ray from it, on a way no face lies along, crosses the surface an odd
  // number of times.
  const ray = [0.5772, 0.3123, 0.7547].map(v => v / Math.hypot(0.5772, 0.3123, 0.7547))
  const inside = (p: V3) => {
    let crossed = 0
    for (const [a, b, c] of tris) {
      const e1 = vsub(at[b], at[a]), e2 = vsub(at[c], at[a]), q = vcross(ray, e2), det = vdot(e1, q)
      if (Math.abs(det) < 1e-12) continue
      const s = vsub(p, at[a]), u = vdot(s, q) / det
      if (u < 0 || u > 1) continue
      const r = vcross(s, e1), v = vdot(ray, r) / det
      if (v < 0 || u + v > 1) continue
      if (vdot(e2, r) / det > 0) crossed++
    }
    return crossed % 2 === 1
  }
  const middles = new Map<number, boolean>()
  // The nearest point of triangle f to p, and the way out there.
  const nearest = (p: V3, f: number): { q: V3; out: V3 } => {
    const [ia, ib, ic] = tris[f], a = at[ia], b = at[ib], c = at[ic]
    const ab = vsub(b, a), ac = vsub(c, a), ap = vsub(p, a)
    const d1 = vdot(ab, ap), d2 = vdot(ac, ap)
    if (d1 <= 0 && d2 <= 0) return { q: a, out: corner[ia] }
    const bp = vsub(p, b), d3 = vdot(ab, bp), d4 = vdot(ac, bp)
    if (d3 >= 0 && d4 <= d3) return { q: b, out: corner[ib] }
    const vc = d1 * d4 - d3 * d2
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return { q: a.map((x, k) => x + ab[k] * v), out: edge.get(edgeKey(ia, ib))! } }
    const cp = vsub(p, c), d5 = vdot(ab, cp), d6 = vdot(ac, cp)
    if (d6 >= 0 && d5 <= d6) return { q: c, out: corner[ic] }
    const vb = d5 * d2 - d1 * d6
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return { q: a.map((x, k) => x + ac[k] * w), out: edge.get(edgeKey(ia, ic))! } }
    const va = d3 * d6 - d5 * d4
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return { q: b.map((x, k) => x + (c[k] - b[k]) * w), out: edge.get(edgeKey(ib, ic))! } }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den
    return { q: a.map((x, k) => x + ab[k] * v + ac[k] * w), out: normal[f] }
  }
  return (p: ArrayLike<number>) => {
    const pt = [p[0], p[1], p[2]]
    const c = cellOf(pt)
    if (c.some((v, k) => v < 0 || v >= n[k])) return h
    const i = indexOf(c)
    let best = Infinity, sign = 1
    for (const f of boxes.get(i) ?? []) {
      const { q, out } = nearest(pt, f)
      const d = vlen(vsub(pt, q))
      if (d < best) { best = d; sign = vdot(vsub(pt, q), out) < 0 ? -1 : 1 }
    }
    if (best <= h) return sign * best
    if (!middles.has(i)) middles.set(i, inside(c.map((v, k) => lo[k] + (v + 0.5) * h)))
    return middles.get(i)! ? -h : h
  }
}

// How far a place in the world is from a held row's surface, 0 on it, negative inside it: the wall's
// box by its own measure, any other shape by its mesh's (`signedTo`, its grid in boxes of 10 cm: a place
// further than that is only known to be that far, in or out); one that bends, by its mesh with every
// corner where its row's bend puts it (climb's `bent`), made again for each bend (the last few kept).
const measures = new Map<string, (p: ArrayLike<number>) => number>()
const bentMeasures: { kind: string; bend: number; measure: (p: ArrayLike<number>) => number }[] = []
function fromHeld(held: { kind: string; data: any }, p: number[]) {
  if (held.kind === 'wall') return fromSurface(localTo(held, p))
  const k = (defs as any)[held.kind]
  const bend = held.data.bend ?? 0
  if (k.bends && bend) {
    let found = bentMeasures.find(m => m.kind === held.kind && m.bend === bend)
    if (!found) {
      const mesh = meshOf(k), position: number[] = []
      for (let i = 0; i < mesh.position.length; i += 3) position.push(...bent(k.bends, bend, mesh.position.slice(i, i + 3)))
      bentMeasures.unshift((found = { kind: held.kind, bend, measure: signedTo({ position, index: mesh.index }, 0.1) }))
      bentMeasures.length = Math.min(bentMeasures.length, 3)
    }
    return found.measure(localTo(held, p))
  }
  if (!measures.has(held.kind)) measures.set(held.kind, signedTo(meshOf(k), 0.1))
  return measures.get(held.kind)!(localTo(held, p))
}

test('1b: the wall\'s net is a point on its surface for every corner of its mesh and a link for every edge, drawn over it while shown', async () => {
  const shape = box(defs.wall.size, defs.wall.cell)
  const net = netOn(shape)
  // A point for each place a vertex of the mesh stands, and no other.
  const places = new Set<string>()
  for (let i = 0; i < shape.position.length; i += 3) places.add(shape.position.slice(i, i + 3).map(v => v.toFixed(4)).join(','))
  expect(net.points).toBe(places.size)
  for (let i = 0; i < net.points; i++) expect(places.has([...net.at.subarray(i * 3, i * 3 + 3)].map(v => v.toFixed(4)).join(','))).toBe(true)
  // ON the surface: every point, and the middle of every link, is 0 from it; so none is inside it or off it.
  let most = 0
  for (let i = 0; i < net.points; i++) most = Math.max(most, Math.abs(fromSurface(net.at.subarray(i * 3, i * 3 + 3))))
  expect(most).toBeLessThan(1e-6)
  // Each point's way out leaves the box: a little out along it is outside, a little in is inside.
  for (let i = 0; i < net.points; i++) {
    const p = [...net.at.subarray(i * 3, i * 3 + 3)], o = [...net.out.subarray(i * 3, i * 3 + 3)]
    expect(Math.hypot(o[0], o[1], o[2])).toBeCloseTo(1, 6)
    expect(fromSurface(p.map((v, k) => v + o[k] * 0.01))).toBeGreaterThan(0)
    expect(fromSurface(p.map((v, k) => v - o[k] * 0.01))).toBeLessThan(0)
  }
  // Every link is an edge of a triangle, both ways, a side or a diagonal of one cell, along the surface.
  const edges = new Set<string>()
  const key = (i: number) => [...net.at.subarray(i * 3, i * 3 + 3)].map(v => v.toFixed(4)).join(',')
  for (let t = 0; t < shape.index.length; t += 3) {
    const c = [0, 1, 2].map(k => shape.position.slice(shape.index[t + k] * 3, shape.index[t + k] * 3 + 3).map(v => v.toFixed(4)).join(','))
    for (const [a, b] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[0]]]) edges.add([a, b].sort().join(' '))
  }
  let links = 0, longest = 0, midway = 0
  for (let i = 0; i < net.points; i++) {
    for (const o of linked(net, i)) {
      expect([...linked(net, o)]).toContain(i)
      if (o < i) continue
      links++
      expect(edges.has([key(i), key(o)].sort().join(' '))).toBe(true)
      const a = net.at.subarray(i * 3, i * 3 + 3), b = net.at.subarray(o * 3, o * 3 + 3)
      longest = Math.max(longest, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
      midway = Math.max(midway, Math.abs(fromSurface([0, 1, 2].map(k => (a[k] + b[k]) / 2))))
    }
  }
  expect(links).toBe(edges.size)
  expect(longest).toBeLessThanOrEqual(defs.wall.cell * Math.SQRT2 + 1e-6)
  expect(midway).toBeLessThan(1e-6)

  // Drawn: hidden, then shown, a line for each link, each end at its point where the wall stands.
  const { yard, p, frames, shared } = await start()
  await frames(30)
  const T = p.client!.plugins.render3d.THREE as typeof THREE
  const drawn = () => {
    let found: THREE.LineSegments | undefined
    p.client!.plugins.render3d.scene.traverse((o: THREE.Object3D) => { if (o.name === 'wall net') found = o as THREE.LineSegments })
    return found!
  }
  expect(drawn().visible).toBe(false)
  shared.wall.shown = true
  await frames(1)
  const lines = drawn()
  expect(lines.visible).toBe(true)
  const at = lines.geometry.getAttribute('position')
  expect(at.count).toBe(links * 2)
  lines.updateMatrixWorld(true)
  const [x, y, z] = yard.rows.find(r => r.kind === 'wall')!.data.pos
  const ours = new Set<string>()
  for (let i = 0; i < net.points; i++) ours.add([net.at[i * 3] + x, net.at[i * 3 + 1] + y, net.at[i * 3 + 2] + z].map(v => v.toFixed(3)).join(','))
  for (let i = 0; i < at.count; i++) expect(ours.has(new T.Vector3().fromBufferAttribute(at, i).applyMatrix4(lines.matrixWorld).toArray().map(v => v.toFixed(3)).join(','))).toBe(true)
  shared.wall.shown = false
})

test('1a: the yard holds one wall, standing on the ground the hero stands on, drawn as a box of its definition\'s size from the ground up', async () => {
  const { yard, p, frames } = await start()
  await frames(30)
  expect([...new Set(yard.rows.map(r => r.kind))].sort()).toEqual(['bowl', 'bumpy', 'corner', 'loader', 'pillar', 'player', 'pole', 'scenemanager', 'skydome3d', 'slider', 'sphere', 'start', 'swinger', 'tipper', 'tube', 'wall'])
  const wall = yard.rows.filter(r => r.kind === 'wall')
  expect(wall).toHaveLength(1)
  const hero = yard.rows.find(r => r.kind === 'player')!
  expect(hero.data.grounded).toBe(true)
  expect(wall[0].data.placed).toBe(true)
  // On the ground: its base at the height the hero's feet stand at.
  expect(wall[0].data.pos[1]).toBeCloseTo(hero.data.pos[1], 6)
  // Drawn: one mesh, its box exactly the definition's size, its bottom on the ground, centred on its row.
  const meshes: THREE.Mesh[] = []
  p.client!.plugins.render3d.scene.traverse((o: THREE.Object3D) => { if (o.name === 'wall') meshes.push(o as THREE.Mesh) })
  expect(meshes).toHaveLength(1)
  const T = p.client!.plugins.render3d.THREE as typeof THREE
  meshes[0].updateMatrixWorld(true)
  const b = new T.Box3().setFromObject(meshes[0])
  const [w, h, d] = defs.wall.size
  const [x, y, z] = wall[0].data.pos
  expect(b.min.toArray()).toEqual([expect.closeTo(x - w / 2, 6), expect.closeTo(y, 6), expect.closeTo(z - d / 2, 6)])
  expect(b.max.toArray()).toEqual([expect.closeTo(x + w / 2, 6), expect.closeTo(y + h, 6), expect.closeTo(z + d / 2, 6)])
})

type Game = Awaited<ReturnType<typeof start>>

// The hero put on the point of the net of the `kind` (the wall unless named) nearest `want` (in its own
// frame), holding grip, as a hold its rule keeps: from that point toward its first link, at 0.
function putOn(g: Game, want: number[], kind = 'wall') {
  const wall = g.yard.rows.find(r => r.kind === kind)!
  const hero = g.yard.rows.find(r => r.kind === 'player')!
  // `want` in its own frame at rest, for one that bends.
  const net = netOn(meshOf((defs as any)[kind]))
  let a = 0, far = Infinity
  for (let i = 0; i < net.points; i++) {
    const d = Math.hypot(net.at[i * 3] - want[0], net.at[i * 3 + 1] - want[1], net.at[i * 3 + 2] - want[2])
    if (d < far) { far = d; a = i }
  }
  Object.assign(hero.data, { hold: { on: wall.id, a, b: linked(net, a)[0], t: 0 }, gripping: true, grip: 1 })
  return { wall, hero, a }
}

// The hero's skin as the page draws it, against the shape of the `kind` (the wall unless named): each
// vertex's distance from its surface (negative inside), each hand's nearest to it, and the deepest any
// vertex is inside and the bone it is bound to most; and the deepest of the vertices bound most to a
// shin, a foot or a toe, and of all the others but the hands, whose touch is their own; and the height of
// his lowest vertex. Only the hands and feet unless `full` (every vertex): the rest are then not measured
// (`deepest`, `feet` and `rest` 0, `lowest` Infinity).
// Each skinned mesh's vertices by the bone each is bound to most, worked out once: its name, and its class
// (HAND_L, HAND_R, SOLE_L, SOLE_R; LEG for a shin, foot or toe; REST for all others but the hands).
const HAND_L = 1, HAND_R = 2, SOLE_L = 4, SOLE_R = 8, LEG = 16, REST = 32
const classed = new WeakMap<object, { bone: string[]; cls: Uint8Array; limbs: number[] }>()
function classesOf(mesh: THREE.SkinnedMesh) {
  let c = classed.get(mesh)
  if (c) return c
  const si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight')
  const n = mesh.geometry.getAttribute('position').count
  const bone: string[] = [], cls = new Uint8Array(n), limbs: number[] = []
  for (let i = 0; i < n; i++) {
    let most = 0
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, most)) most = k
    const b = mesh.skeleton.bones[si.getComponent(i, most)].name
    bone.push(b)
    let f = 0
    if (b.includes('LeftHand')) f |= HAND_L
    if (b.includes('RightHand')) f |= HAND_R
    if (/Left(Foot|Toe)/.test(b)) f |= SOLE_L
    if (/Right(Foot|Toe)/.test(b)) f |= SOLE_R
    if (/(Left|Right)(Leg|Foot|Toe)/.test(b)) f |= LEG
    else if (!/(Left|Right)Hand/.test(b)) f |= REST
    cls[i] = f
    if (f & (HAND_L | HAND_R | SOLE_L | SOLE_R)) limbs.push(i)
  }
  classed.set(mesh, (c = { bone, cls, limbs }))
  return c
}
function against(g: Game, kind = 'wall', full = true) {
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const wall = g.yard.rows.find(r => r.kind === kind)!
  const hero = g.yard.rows.find(r => r.kind === 'player')!
  const root: THREE.Object3D = plugins.anim.model(hero.id)
  root.updateMatrixWorld(true)
  const hands: Record<'L' | 'R', number> = { L: Infinity, R: Infinity }
  // Each foot's nearest skin to the wall, its toes and the rest of it.
  const soles: Record<'L' | 'R', number> = { L: Infinity, R: Infinity }
  // Each hand's extent in the wall's frame: its least and most x and y.
  const extent: Record<'L' | 'R', number[]> = { L: [Infinity, -Infinity, Infinity, -Infinity], R: [Infinity, -Infinity, Infinity, -Infinity] }
  let deepest = { depth: 0, bone: '' }, feet = { depth: 0, bone: '' }, rest = { depth: 0, bone: '' }
  let lowest = Infinity
  const v = new T.Vector3()
  root.traverse(o => {
    const mesh = o as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    const { bone, cls, limbs } = classesOf(mesh)
    const each = (i: number) => {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
      lowest = Math.min(lowest, v.y)
      const d = fromHeld(wall, [v.x, v.y, v.z])
      const f = cls[i]
      if (f & SOLE_L) soles.L = Math.min(soles.L, d)
      if (f & SOLE_R) soles.R = Math.min(soles.R, d)
      for (const [side, bit] of [['L', HAND_L], ['R', HAND_R]] as const) {
        if (!(f & bit)) continue
        hands[side] = Math.min(hands[side], d)
        // Into the shape's own frame.
        const local = localTo(wall, [v.x, v.y, v.z])
        const e = extent[side]
        extent[side] = [Math.min(e[0], local[0]), Math.max(e[1], local[0]), Math.min(e[2], local[1]), Math.max(e[3], local[1])]
      }
      if (-d > deepest.depth) deepest = { depth: -d, bone: bone[i] }
      if (f & LEG) { if (-d > feet.depth) feet = { depth: -d, bone: bone[i] } }
      else if (f & REST && -d > rest.depth) rest = { depth: -d, bone: bone[i] }
    }
    if (full) for (let i = 0; i < cls.length; i++) each(i)
    else for (const i of limbs) each(i)
  })
  if (!full) { deepest = { depth: 0, bone: '' }; feet = { depth: 0, bone: '' }; rest = { depth: 0, bone: '' }; lowest = Infinity }
  return { hands, soles, extent, deepest, feet, rest, lowest, full }
}

test('1c: the hero put on a spot of the wall stays on it, still, not falling, upright and facing straight into the wall', async () => {
  const g = await start()
  await g.frames(30)
  const { wall, hero } = putOn(g, [0, 4, defs.wall.size[2] / 2])
  await g.frames(2)
  const at = [...hero.data.pos], yaw = hero.data.yaw
  const { out } = spotOn(g.p.client!.plugins.wire, wall, hero.data.hold)
  await g.frames(120)
  expect(hero.data.hold).not.toBeNull()
  expect(hero.data.grounded).toBe(true)
  expect(hero.data.vel).toEqual([0, 0, 0])
  expect(Math.hypot(hero.data.pos[0] - at[0], hero.data.pos[1] - at[1], hero.data.pos[2] - at[2])).toBeLessThan(1e-9)
  expect(hero.data.yaw).toBe(yaw)
  // Facing straight into the wall: his front, (sin yaw, cos yaw), is the way into the surface.
  expect(Math.sin(yaw) * -out[0] + Math.cos(yaw) * -out[2]).toBeCloseTo(1, 9)
  // Upright as drawn: his model's up is the world's up.
  const T = g.p.client!.plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = g.p.client!.plugins.anim.model(hero.id)
  expect(new T.Vector3(0, 1, 0).applyQuaternion(root.quaternion).y).toBeCloseTo(1, 9)
  // Off the ground: his feet are in the air.
  expect(hero.data.pos[1]).toBeGreaterThan(wall.data.pos[1] + 0.5)
})

// The hero held on the middle of the face 4 m up, settled past his clip's fade, then measured each
// frame for a second: each hand's nearest skin to the face, both ways, and the deepest of the rest.
async function heldStill(g: Game) {
  await g.frames(30)
  const { hero } = putOn(g, [0, 4, defs.wall.size[2] / 2])
  await g.frames(60)
  const seen = { L: [Infinity, -Infinity], R: [Infinity, -Infinity], feet: { depth: 0, bone: '' }, rest: { depth: 0, bone: '' } }
  for (let i = 0; i < 60; i++) {
    await g.frames(1)
    expect(hero.data.clip).toBe(defs.player.climb.clips.still)
    expect(hero.data.clipT).toBe(0)
    const m = against(g)
    for (const side of ['L', 'R'] as const) seen[side] = [Math.min(seen[side][0], m.hands[side]), Math.max(seen[side][1], m.hands[side])]
    if (m.feet.depth > seen.feet.depth) seen.feet = m.feet
    if (m.rest.depth > seen.rest.depth) seen.rest = m.rest
  }
  return seen
}

test('1d: holding still in his still clip\'s first frame, both his palms touch the wall\'s face, each hand\'s nearest skin within 1 cm of it, in or out', async () => {
  const seen = await heldStill(await start())
  for (const side of ['L', 'R'] as const) {
    expect(Math.abs(seen[side][0])).toBeLessThanOrEqual(0.01)
    expect(Math.abs(seen[side][1])).toBeLessThanOrEqual(0.01)
  }
})

test('1e: held still, nothing of him above the knees but his touching hands is inside the wall at all, and his shins and feet only as far as a touching foot, 1 mm (their toes were 4.6 cm in before his feet reached the face by IK, 3d)', async () => {
  const seen = await heldStill(await start())
  console.log('1e', JSON.stringify(seen))
  expect(seen.rest.depth).toBe(0)
  expect(seen.feet.depth).toBeLessThanOrEqual(0.001)
})

// The middle of the hero's palms in the world, standing at `pos` facing `yaw`, as they are in his still
// clip's first frame.
function palmsAt(g: Game, hero: { kind: string; data: any }, pos: number[], yaw: number) {
  const wire = g.p.client!.plugins.wire
  const clip = defs.player.climb.clips.still
  const l = ends(wire, hero as any, 'handL', { clip, clipT: 0 }), r = ends(wire, hero as any, 'handR', { clip, clipT: 0 })
  const p = [0, 1, 2].map(k => (l[k] + l[k + 3] + r[k] + r[k + 3]) / 4)
  return [pos[0] + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), pos[1] + p[1], pos[2] - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)]
}

test('1f: walking at the wall holding grip, he takes hold the first step a point of its net is within his reach, of the point nearest his palms, and his palms are then on its face', async () => {
  const g = await start()
  await g.frames(30)
  const wall = g.yard.rows.find(r => r.kind === 'wall')!
  const hero = g.yard.rows.find(r => r.kind === 'player')!
  const net = netOf(g.p.client!.plugins.wire, wall)
  const point = (i: number) => [0, 1, 2].map(k => net.at[i * 3 + k] + wall.data.pos[k])
  // The net's points by how far they are from a place, nearest first.
  const nearest = (to: number[]) => {
    let best = 0, far = Infinity
    for (let i = 0; i < net.points; i++) {
      const p = point(i), d = Math.hypot(p[0] - to[0], p[1] - to[1], p[2] - to[2])
      if (d < far) { far = d; best = i }
    }
    return { best, far }
  }
  key('keydown', 'e')
  key('keydown', 'w')
  let before = { pos: [...hero.data.pos], yaw: hero.data.yaw }
  let steps = 0
  while (!hero.data.hold && steps < 600) {
    before = { pos: [...hero.data.pos], yaw: hero.data.yaw }
    await g.frames(1)
    steps++
    // Not yet holding: no point was within reach of his palms where he stood.
    if (!hero.data.hold) expect(nearest(palmsAt(g, hero, before.pos, before.yaw)).far).toBeGreaterThan(defs.player.climb.reach)
  }
  key('keyup', 'w')
  expect(hero.data.hold).not.toBeNull()
  expect(hero.data.hold.on).toBe(wall.id)
  // The point he took is the one nearest his palms where he stood the step he took hold, within reach.
  const took = nearest(palmsAt(g, hero, before.pos, before.yaw))
  expect(hero.data.hold.a).toBe(took.best)
  expect(took.far).toBeLessThanOrEqual(defs.player.climb.reach)
  // `w` still held, he climbs on from it that same step, a step's climb at most.
  const along = Math.hypot(...[0, 1, 2].map(k => point(hero.data.hold.b)[k] - point(hero.data.hold.a)[k])) * hero.data.hold.t
  expect(along).toBeLessThanOrEqual(defs.player.climb.speed * DT + 1e-9)
  // On the face: settled, each hand's nearest skin within 1 cm of it.
  await g.frames(60)
  const m = against(g)
  expect(Math.abs(m.hands.L)).toBeLessThanOrEqual(0.01)
  expect(Math.abs(m.hands.R)).toBeLessThanOrEqual(0.01)
  // Not under the ground: his root, and the lowest of his skin, at or over the ground the wall stands on.
  expect(hero.data.pos[1]).toBeGreaterThanOrEqual(wall.data.pos[1])
  expect(m.lowest).toBeGreaterThanOrEqual(wall.data.pos[1])
  key('keyup', 'e')
})

test('1g: holding the wall 4 m up, he lets go of grip, drops off it, and lands on his feet on the ground beside it, upright, nothing of him in it', async () => {
  const g = await start()
  await g.frames(30)
  const { wall, hero } = putOn(g, [0, 4, defs.wall.size[2] / 2])
  await g.frames(60)
  const high = hero.data.pos[1]
  // Grip let go: the hold is dropped on the next step, and he falls.
  hero.data.gripping = false
  await g.frames(1)
  expect(hero.data.hold).toBeNull()
  let fell = false
  for (let i = 0; i < 600 && !(fell && hero.data.grounded); i++) {
    await g.frames(1)
    if (!hero.data.grounded) fell = true
  }
  expect(fell).toBe(true)
  expect(hero.data.grounded).toBe(true)
  // Let the landing play out.
  await g.frames(120)
  expect(hero.data.pos[1]).toBeLessThan(high)
  expect(hero.data.pos[1]).toBeCloseTo(wall.data.pos[1], 6)
  expect(hero.data.clip).not.toBe(defs.player.climb.clips.still)
  const T = g.p.client!.plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = g.p.client!.plugins.anim.model(hero.id)
  expect(new T.Vector3(0, 1, 0).applyQuaternion(root.quaternion).y).toBeCloseTo(1, 9)
  const m = against(g)
  console.log('1g', JSON.stringify({ pos: hero.data.pos, clip: hero.data.clip, m }))
  // On his feet: the lowest of his skin is on the ground, within 2 cm.
  expect(Math.abs(m.lowest - wall.data.pos[1])).toBeLessThanOrEqual(0.02)
  // Nothing of him in the wall.
  expect(m.deepest.depth).toBe(0)
})

// The hero held on the `kind` (the wall unless named) at `want`, settled, then `keys` held down for
// `frames` frames, or till `until` holds of where his hold is (in its own frame), at most `frames`: each
// frame where his hold is, where his root is, his skin against it, his frame on it, and his limbs'
// touches.
// A climb measures his hands' and feet's skin every frame and all of him every `WHOLE` frames.
const WHOLE = 6
async function climbing(g: Game, want: number[], keys: string[], frames: number, kind = 'wall', until?: (at: number[]) => boolean) {
  await g.frames(30)
  const { wall, hero } = putOn(g, want, kind)
  await g.frames(60)
  const wire = g.p.client!.plugins.wire
  // Where his hold is, in the wall's own frame (at rest, for one that bends).
  const spot = () => restOf((defs as any)[kind], wall, spotOn(wire, wall, hero.data.hold).at)
  const from = spot()
  for (const k of keys) key('keydown', k)
  const limbs = defs.player.climb.limbs as Record<string, { touch: string[] }>
  type Seen = {
    at: number[]; pos: number[]; m: ReturnType<typeof against>
    touches: Record<string, { point: number; step?: { from: number; to: number; s: number }; room?: number }>
    middles: Record<string, THREE.Vector3>; short: number[]
    out: number[]; lean: { up: number[]; ahead: number[] }; model: { up: number[]; ahead: number[] }
    // Where the held row stood that frame (one that moves stands somewhere new each).
    placed: { kind: string; data: { pos: number[]; yaw: number; pitch: number; bend?: number } }
  }
  const T = g.p.client!.plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = g.p.client!.plugins.anim.model(hero.id)
  const seen: Seen[] = []
  for (let i = 0; i < frames; i++) {
    if (until?.(spot())) break
    await g.frames(1)
    expect(hero.data.hold).not.toBeNull()
    const touches = Object.fromEntries([...(g.p.client!.plugins.climb.touches(hero) ?? [])].map(([n, t]) => [n, { point: t.point, step: t.step && { ...t.step }, room: t.room }]))
    const middles = Object.fromEntries(Object.entries(limbs).map(([n, l]) => [n, middleOf(g, l)]))
    root.updateMatrixWorld(true)
    const turn = root.getWorldQuaternion(new T.Quaternion())
    const model = { up: new T.Vector3(0, 1, 0).applyQuaternion(turn).toArray(), ahead: new T.Vector3(0, 0, 1).applyQuaternion(turn).toArray() }
    seen.push({
      at: spot(), pos: [...hero.data.pos], m: against(g, kind, i % WHOLE === 0), touches, middles, short: g.p.client!.plugins.ik3d.short(hero.id) ?? [],
      out: spotOn(wire, wall, hero.data.hold).out, lean: structuredClone(hero.data.lean), model,
      placed: { kind: wall.kind, data: { pos: [...wall.data.pos], yaw: wall.data.yaw, pitch: wall.data.pitch, bend: wall.data.bend } },
    })
  }
  for (const k of keys) key('keyup', k)
  return { from, seen, hero, wall }
}

// Every frame on the face: the hold on the front face; each palm touching it within 1 cm, or a hand in a
// step lifted off it no more than the lift and 1 cm and never into it; nothing of him in the wall deeper
// than touching skin, 1 mm (his forearms lie along it as he climbs); his root and skin over the ground;
// and his root where his hold puts it, the same offset from it every frame (his body following it).
function onTheFace(r: Awaited<ReturnType<typeof climbing>>) {
  const offset = r.seen[0].pos.map((v, k) => v - r.seen[0].at[k])
  for (const s of r.seen) {
    expect(s.at[2]).toBeCloseTo(defs.wall.size[2] / 2, 9)
    for (const side of ['L', 'R'] as const) {
      const d = s.m.hands[side]
      if (s.touches[`hand${side}`]?.step) {
        expect(d).toBeGreaterThanOrEqual(-0.001)
        expect(d).toBeLessThanOrEqual(defs.player.climb.step.lift + 0.01)
      } else expect(Math.abs(d)).toBeLessThanOrEqual(0.01)
    }
    expect(s.m.rest.depth).toBeLessThanOrEqual(0.001)
    expect(s.m.feet.depth).toBeLessThanOrEqual(0.001)
    expect(s.pos[1]).toBeGreaterThanOrEqual(r.wall.data.pos[1])
    expect(s.m.lowest).toBeGreaterThanOrEqual(r.wall.data.pos[1])
    s.pos.forEach((v, k) => expect(v - s.at[k]).toBeCloseTo(offset[k], 9))
  }
}

const moved = (r: Awaited<ReturnType<typeof climbing>>) => r.seen[r.seen.length - 1].at.map((v, k) => v - r.from[k])
// How far he goes in `frames` frames at his speed, pushed all the way.
const going = (frames: number) => defs.player.climb.speed * frames * DT

test('2a: pushed up, his hold goes straight up the face, his body following, on the face the whole way', async () => {
  const r = await climbing(await start(), [0, 3, defs.wall.size[2] / 2], ['w'], 60)
  onTheFace(r)
  const [x, y] = moved(r)
  expect(Math.abs(x)).toBeLessThan(1e-9)
  // He moves from the step the push reaches the rules, a step or two after the key.
  expect(y).toBeGreaterThan(going(57))
  expect(y).toBeLessThanOrEqual(going(60) + 1e-9)
})

test('2b: pushed down, left and right, his hold goes straight that way over the face, on it the whole way', async () => {
  // Facing the wall (toward −z), his left is −x and his right +x.
  for (const [keyName, way] of [['s', [0, -1]], ['a', [-1, 0]], ['d', [1, 0]]] as const) {
    const r = await climbing(await start(), [0, 4, defs.wall.size[2] / 2], [keyName], 60)
    onTheFace(r)
    const [x, y] = moved(r)
    const along = x * way[0] + y * way[1], across = x * way[1] - y * way[0]
    expect(Math.abs(across)).toBeLessThan(1e-9)
    expect(along).toBeGreaterThan(going(57))
    expect(along).toBeLessThanOrEqual(going(60) + 1e-9)
  }
})

test('2c: pushed on a slant, his hold goes that way over the face, within 10° of it, on it the whole way', async () => {
  for (const [keys, way] of [[['w', 'd'], [1, 1]], [['w', 'a'], [-1, 1]], [['s', 'd'], [1, -1]], [['s', 'a'], [-1, -1]]] as const) {
    const r = await climbing(await start(), [0, 4, defs.wall.size[2] / 2], [...keys], 90)
    onTheFace(r)
    const [x, y] = moved(r)
    const angle = Math.acos((x * way[0] + y * way[1]) / (Math.hypot(x, y) * Math.SQRT2))
    expect(angle).toBeLessThan((10 * Math.PI) / 180)
    // He gets on: a zigzag over the net's links covers at least 70% of the way it goes (cos 45°).
    expect(Math.hypot(x, y)).toBeGreaterThan(going(87) * 0.7)
  }
})

test('2d: pushed at the top and the sides he stops with his hands on the face, as near its edge as a cell and half his hands\' spread, and stays there however long he is pushed, never off it; pushed down he stops before his feet would go under the ground', async () => {
  const [w, h, d] = defs.wall.size
  const cell = defs.wall.cell
  // Half the spread of his hands in his still pose, as the rules place them (his own `ends`).
  const spread = (g: Game) => {
    const hero = g.yard.rows.find(r => r.kind === 'player')!
    const wire = g.p.client!.plugins.wire
    const clip = defs.player.climb.clips.still
    const mid = (side: string) => { const e = ends(wire, hero, `hand${side}`, { clip, clipT: 0 }); return [0, 1, 2].map(k => (e[k] + e[k + 3]) / 2) }
    const l = mid('L'), r = mid('R')
    return Math.hypot(l[0] - r[0], l[1] - r[1], l[2] - r[2]) / 2
  }
  // Each push starts a metre from its edge and goes on for as long as a metre takes at his speed and a
  // second and a half more, held there the last second.
  const frames = Math.ceil(1 / defs.player.climb.speed / DT) + 90
  // Up: from a metre under the top.
  const g = await start()
  const up = await climbing(g, [0, h - 1, d / 2], ['w'], frames)
  onTheFace(up)
  const top = up.seen[up.seen.length - 1]
  expect(up.seen.slice(-60).every(s => Math.abs(s.at[1] - top.at[1]) < 1e-9)).toBe(true)
  expect(h - top.at[1]).toBeLessThanOrEqual(cell + 1e-9)
  // Right and left: from a metre in from each side.
  for (const [keyName, sign] of [['d', 1], ['a', -1]] as const) {
    const gs = await start()
    const r = await climbing(gs, [sign * (w / 2 - 1), 4, d / 2], [keyName], frames)
    onTheFace(r)
    const last = r.seen[r.seen.length - 1]
    expect(r.seen.slice(-60).every(s => Math.abs(s.at[0] - last.at[0]) < 1e-9)).toBe(true)
    expect(w / 2 - sign * last.at[0]).toBeLessThanOrEqual(cell + spread(gs) + 1e-9)
  }
  // Down: from 3 m; he stops with his root and skin still over the ground (onTheFace).
  const down = await climbing(await start(), [0, 3, d / 2], ['s'], frames)
  onTheFace(down)
  const low = down.seen[down.seen.length - 1].at[1]
  expect(down.seen.slice(-60).every(s => Math.abs(s.at[1] - low) < 1e-9)).toBe(true)
  expect(low).toBeLessThan(3)
})

test('2e: going up the face his hold moves his speed every step, and every frame of every way he goes he is on the face and nothing of him is in the wall', async () => {
  const r = await climbing(await start(), [0, 3, defs.wall.size[2] / 2], ['w'], 60)
  onTheFace(r)
  // Once he is going: each step's move is his speed times the step.
  const steps = r.seen.slice(10).map((s, i) => s.at[1] - r.seen[9 + i].at[1])
  for (const step of steps) expect(step).toBeCloseTo(defs.player.climb.speed * DT, 9)
})

// Where a limb touches as the page draws him: midway between its two `touch` bones.
function middleOf(g: Game, limb: { touch: string[] }) {
  const T = g.p.client!.plugins.render3d.THREE as typeof THREE
  const hero = g.yard.rows.find(r => r.kind === 'player')!
  const root: THREE.Object3D = g.p.client!.plugins.anim.model(hero.id)
  root.updateMatrixWorld(true)
  const find = (suffix: string) => {
    let found: THREE.Object3D | undefined
    root.traverse(o => { if (!found && (o as THREE.Bone).isBone && o.name.endsWith(suffix)) found = o })
    return new T.Vector3().setFromMatrixPosition(found!.matrixWorld)
  }
  return find(limb.touch[0]).add(find(limb.touch[1])).multiplyScalar(0.5)
}

// Held still on the middle of the face 4 m up, settled, then every frame for a second: each limb `names`
// names has where it touches on the net point nearest it, its skin out from the face, within 1 mm, ik3d
// reports it reached (short under 0.1 mm), and it does not move; and his skin against the wall, measured.
async function reachingStill(names: string[]) {
  const g = await start()
  await g.frames(30)
  const { wall, hero } = putOn(g, [0, 4, defs.wall.size[2] / 2])
  await g.frames(60)
  const net = netOf(g.p.client!.plugins.wire, wall)
  const limbs = names.map(n => (defs.player.climb.limbs as Record<string, { touch: string[]; skin: number }>)[n])
  const order = defs.player.climb.ik as string[]
  const first = limbs.map(l => middleOf(g, l))
  const seen: ReturnType<typeof against>[] = []
  for (let i = 0; i < 60; i++) {
    await g.frames(1)
    limbs.forEach((limb, j) => {
      const mid = middleOf(g, limb)
      // The point nearest it, and where it should touch: that point, its skin out from the face.
      let best = 0, far = Infinity
      for (let p = 0; p < net.points; p++) {
        const d = Math.hypot(net.at[p * 3] + wall.data.pos[0] - mid.x, net.at[p * 3 + 1] + wall.data.pos[1] - mid.y, net.at[p * 3 + 2] + wall.data.pos[2] - mid.z)
        if (d < far) { far = d; best = p }
      }
      const want = [0, 1, 2].map(k => net.at[best * 3 + k] + wall.data.pos[k] + net.out[best * 3 + k] * limb.skin)
      expect(Math.hypot(mid.x - want[0], mid.y - want[1], mid.z - want[2])).toBeLessThanOrEqual(0.001)
      expect(g.p.client!.plugins.ik3d.short(hero.id)[order.indexOf(names[j])]).toBeLessThan(1e-4)
      expect(mid.distanceTo(first[j])).toBeLessThan(1e-6)
    })
    seen.push(against(g))
  }
  return seen
}

test('3a: held still, his left hand reaches by IK the net point nearest its middle, its middle on that point a palm out from the face, to a millimetre, and stays; its skin touches the face within 1 mm', async () => {
  const seen = await reachingStill(['handL'])
  for (const m of seen) {
    expect(Math.abs(m.hands.L)).toBeLessThanOrEqual(0.001)
    expect(m.rest.depth).toBe(0)
    expect(m.feet.depth).toBeLessThanOrEqual(0.05)
  }
  console.log('3a', JSON.stringify(seen[seen.length - 1].hands))
})

test('3b: held still, both his hands reach by IK the net points nearest their middles, each middle a palm out from the face, to a millimetre, and stay; both skins touch the face within 1 mm', async () => {
  const seen = await reachingStill(['handL', 'handR'])
  for (const m of seen) {
    expect(Math.abs(m.hands.L)).toBeLessThanOrEqual(0.001)
    expect(Math.abs(m.hands.R)).toBeLessThanOrEqual(0.001)
    expect(m.rest.depth).toBe(0)
    expect(m.feet.depth).toBeLessThanOrEqual(0.05)
  }
  console.log('3b', JSON.stringify(seen[seen.length - 1].hands))
})

// The way a hand's palm faces, from four of its bones' places: `side` times the cross of the line across
// its knuckles and the line through its touch, from its wrist to its middle fingertip.
function palmFacing(at: (suffix: string) => THREE.Vector3, limb: { touch: string[]; across: string[]; side: number }) {
  const knuckles = at(limb.across[1]).sub(at(limb.across[0]))
  return knuckles.cross(at(limb.touch[1]).sub(at(limb.touch[0]))).normalize().multiplyScalar(limb.side)
}

test('3c: each hand\'s palm, as its bones place it, faces down in his bind pose (the T-pose), and held still faces straight into the wall\'s face, within a degree, its skin still touching it', async () => {
  const g = await start()
  await g.frames(30)
  const { hero } = putOn(g, [0, 4, defs.wall.size[2] / 2])
  await g.frames(60)
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = plugins.anim.model(hero.id)
  // His bind pose: each bone where its skin's inverse puts it.
  let skinned: THREE.SkinnedMesh | undefined
  root.traverse(o => { if (!skinned && (o as THREE.SkinnedMesh).isSkinnedMesh) skinned = o as THREE.SkinnedMesh })
  const bound = (suffix: string) => {
    const i = skinned!.skeleton.bones.findIndex(b => b.name.endsWith(suffix))
    return new T.Vector3().setFromMatrixPosition(skinned!.skeleton.boneInverses[i].clone().invert())
  }
  const limbs = { handL: defs.player.climb.limbs.handL, handR: defs.player.climb.limbs.handR }
  for (const name of ['handL', 'handR'] as const) expect(palmFacing(bound, limbs[name]).y).toBeLessThan(-0.9)
  // Held still: each drawn palm faces into the face, (0, 0, −1) on the wall's front.
  const drawn = (suffix: string) => {
    let found: THREE.Object3D | undefined
    root.traverse(o => { if (!found && (o as THREE.Bone).isBone && o.name.endsWith(suffix)) found = o })
    return new T.Vector3().setFromMatrixPosition(found!.matrixWorld)
  }
  for (let i = 0; i < 60; i++) {
    await g.frames(1)
    root.updateMatrixWorld(true)
    for (const name of ['handL', 'handR'] as const) expect(palmFacing(drawn, limbs[name]).angleTo(new T.Vector3(0, 0, -1))).toBeLessThan(Math.PI / 180)
    const m = against(g)
    expect(Math.abs(m.hands.L)).toBeLessThanOrEqual(0.001)
    expect(Math.abs(m.hands.R)).toBeLessThanOrEqual(0.001)
    expect(m.rest.depth).toBe(0)
  }
  console.log('3c', JSON.stringify(against(g).hands))
})

test('3d: held still, his feet reach by IK the net points nearest the balls of their toes, each on its point its skin out, to a millimetre; each foot\'s skin touches the face within 1 mm', async () => {
  const seen = await reachingStill(['footL', 'footR'])
  for (const m of seen) {
    expect(Math.abs(m.soles.L)).toBeLessThanOrEqual(0.001)
    expect(Math.abs(m.soles.R)).toBeLessThanOrEqual(0.001)
  }
  console.log('3d', JSON.stringify({ soles: seen[seen.length - 1].soles, feet: seen[seen.length - 1].feet, rest: seen[seen.length - 1].rest }))
})

test('3e: held still with both hands and both feet reaching, each elbow and knee is outside the wall and bends with nothing of it toward the face; nothing of him is in the wall but touching skin, 1 mm', async () => {
  const g = await start()
  await g.frames(30)
  const { wall, hero } = putOn(g, [0, 4, defs.wall.size[2] / 2])
  await g.frames(60)
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = plugins.anim.model(hero.id)
  const drawn = (suffix: string) => {
    let found: THREE.Object3D | undefined
    root.traverse(o => { if (!found && (o as THREE.Bone).isBone && o.name.endsWith(suffix)) found = o })
    return new T.Vector3().setFromMatrixPosition(found!.matrixWorld)
  }
  const out = new T.Vector3(0, 0, 1)
  const limbs = defs.player.climb.limbs as Record<string, { bones: string[] }>
  for (let i = 0; i < 60; i++) {
    await g.frames(1)
    root.updateMatrixWorld(true)
    for (const name of ['handL', 'handR', 'footL', 'footR']) {
      const [a, b, c] = limbs[name].bones.map(drawn)
      // Outside the wall: the joint's distance from its surface.
      const local = b.clone().sub(new T.Vector3(...wall.data.pos))
      expect(fromSurface(local.toArray())).toBeGreaterThan(0)
      // Bent with nothing toward the face: off the line from the first bone to the end, not into it, to
      // a hundredth of a millimetre (a joint bent along the wall is 0 to the arithmetic's grain).
      const line = c.clone().sub(a).normalize()
      const off = b.clone().sub(a)
      off.sub(line.multiplyScalar(off.dot(line)))
      expect(off.dot(out)).toBeGreaterThanOrEqual(-1e-5)
    }
    expect(plugins.ik3d.short(hero.id).every((v: number) => v < 1e-4)).toBe(true)
    const m = against(g)
    expect(m.rest.depth).toBe(0)
    expect(m.feet.depth).toBeLessThanOrEqual(0.001)
    expect(Math.abs(m.hands.L)).toBeLessThanOrEqual(0.001)
    expect(Math.abs(m.hands.R)).toBeLessThanOrEqual(0.001)
    expect(Math.abs(m.soles.L)).toBeLessThanOrEqual(0.001)
    expect(Math.abs(m.soles.R)).toBeLessThanOrEqual(0.001)
  }
})

test('3f: held still with all four reaching, each elbow and knee is within its limits and bends to the side its clip bends it', async () => {
  const g = await start()
  await g.frames(30)
  const { hero } = putOn(g, [0, 4, defs.wall.size[2] / 2])
  await g.frames(60)
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = plugins.anim.model(hero.id)
  const boneOf = (suffix: string) => {
    let found: THREE.Object3D | undefined
    root.traverse(o => { if (!found && (o as THREE.Bone).isBone && o.name.endsWith(suffix)) found = o })
    return found!
  }
  const place = (o: THREE.Object3D) => new T.Vector3().setFromMatrixPosition(o.matrixWorld)
  const limbs = defs.player.climb.limbs as Record<string, { bones: string[]; bend: number[] }>
  // Each limb: its middle joint's angle, and the way it bends off its line.
  const read = () => {
    root.updateMatrixWorld(true)
    return Object.fromEntries(Object.entries(limbs).map(([name, l]) => {
      const [pa, pb, pc] = l.bones.map(boneOf).map(place)
      const angle = pa.clone().sub(pb).angleTo(pc.clone().sub(pb)) * 180 / Math.PI
      const line = pc.clone().sub(pa).normalize()
      const off = pb.clone().sub(pa)
      off.sub(line.multiplyScalar(off.dot(line)))
      return [name, { angle, off: off.normalize() }]
    }))
  }
  for (let i = 0; i < 30; i++) {
    await g.frames(1)
    const solved = read()
    // The clip's own: the reach taken off; the next frame reaches from there again.
    plugins.ik3d.unbend(hero.id)
    const clip = read()
    for (const [name, l] of Object.entries(limbs)) {
      expect(solved[name].angle).toBeGreaterThanOrEqual(l.bend[0] - 0.01)
      expect(solved[name].angle).toBeLessThanOrEqual(l.bend[1] + 0.01)
      expect(solved[name].off.dot(clip[name].off)).toBeGreaterThan(0)
    }
    if (i === 0) console.log('3f', JSON.stringify(Object.fromEntries(Object.entries(limbs).map(([n]) => [n, { angle: +solved[n].angle.toFixed(1), clipAngle: +clip[n].angle.toFixed(1), side: +solved[n].off.dot(clip[n].off).toFixed(3) }]))))
  }
  // The limit bites: the left elbow's least angle raised halfway from the angle it bends to toward the
  // angle its clip has, the point it holds is out of reach, so the hand goes to another it reaches
  // within the limit (reached, ik3d short under 1 mm, with room to spare); its elbow never goes under it.
  const shared = g.shared.player.climb.limbs.handL
  const was = shared.bend
  await g.frames(1)
  const held = plugins.climb.touches(hero).get('handL').point
  const bent = read().handL.angle
  plugins.ik3d.unbend(hero.id)
  const clipped = read().handL.angle
  const least = (bent + clipped) / 2
  shared.bend = [least, 178]
  try {
    // Through its step (`step.time`) and on a while.
    for (let i = 0; i < 30; i++) {
      await g.frames(1)
      expect(read().handL.angle).toBeGreaterThanOrEqual(least - 0.01)
    }
    const now = plugins.climb.touches(hero).get('handL')
    expect(now.step).toBeUndefined()
    expect(now.point).not.toBe(held)
    expect(now.room).toBeGreaterThanOrEqual(0)
    expect(plugins.ik3d.short(hero.id)[0]).toBeLessThan(0.001)
    console.log('3f bitten', JSON.stringify({ bent, clipped, least, angle: read().handL.angle, held, now: now.point, room: now.room }))
  } finally {
    shared.bend = was
  }
})

// Every way he climbs: up, down, left, right and the four slants, 3 s each from the middle of the face.
const WAYS = [['w'], ['s'], ['a'], ['d'], ['w', 'd'], ['w', 'a'], ['s', 'd'], ['s', 'a']]
const climbs = async () => {
  const runs: { keys: string[]; r: Awaited<ReturnType<typeof climbing>> }[] = []
  for (const keys of WAYS) runs.push({ keys, r: await climbing(await start(), [0, 4, defs.wall.size[2] / 2], keys, 180) })
  return runs
}
const LIMBS = ['handL', 'handR', 'footL', 'footR']
const limbOf = (name: string) => (defs.player.climb.limbs as Record<string, { skin: number; group: number }>)[name]

// Every frame of a climb, step 4's, on any shape: none gives up its point; never two groups stepping at
// once; a planted hand or foot on its point (where it touches on the line out of the surface through
// that point, within 1 mm) with its own skin on the surface within 1 mm, reached (ik3d short under 1 mm),
// and not moved since the last frame (1 mm); one in a step with its skin off the surface by no more than
// the lift and 1 cm past how far the straight way between its two points stands off it, never into it,
// reached (1 mm), landing on the point it stepped to. And every limb steps, its skin lifting
// off the surface by at least half the lift; or, held still (`still`), none ever steps. All of it on the
// held row where it stood that frame, and "not moved" on it: one that moves carries a planted limb with
// it. How many steps each took, and how high each lifted.
function climbedWell(r: Awaited<ReturnType<typeof climbing>>, net: ReturnType<typeof netOf>, what: string, still = false) {
  type Placed = (typeof r.seen)[number]['placed']
  // The net as the held row stood: for one that bends, posed as it was bent (climb's `posedNet`).
  const k = (defs as any)[r.wall.kind]
  const posed = new Map<number, ReturnType<typeof netOf>>()
  const netAt = (at: Placed) => {
    const bend = at.data.bend ?? 0
    if (!k.bends || !bend) return net
    if (!posed.has(bend)) posed.set(bend, posedNet(net, k.bends, bend))
    return posed.get(bend)!
  }
  // The line out of the surface through a point, in the world, the held row where it stood: where it
  // starts and its way.
  const place = (at: Placed, point: number) => heldPoint(at, [...netAt(at).at.subarray(point * 3, point * 3 + 3)])
  const way = (at: Placed, point: number) => heldWay(at, [...netAt(at).out.subarray(point * 3, point * 3 + 3)])
  // How far a place is from that line.
  const offLine = (at: Placed, point: number, p: number[]) => {
    const a = place(at, point), o = way(at, point), v = vsub(p, a)
    return vlen(vsub(v, o.map(x => x * vdot(v, o))))
  }
  // A limb's own nearest skin to the surface.
  const skinOf = (s: (typeof r.seen)[number], name: string) => (name.startsWith('hand') ? s.m.hands : s.m.soles)[name.endsWith('L') ? 'L' : 'R']
  const steps: Record<string, number> = Object.fromEntries(LIMBS.map(n => [n, 0]))
  const lifted: Record<string, number> = Object.fromEntries(LIMBS.map(n => [n, 0]))
  r.seen.forEach((s, i) => {
    for (const name of LIMBS) expect(s.touches[name]).toBeDefined()
    const groups = new Set(LIMBS.filter(n => s.touches[n].step).map(n => limbOf(n).group))
    if (groups.size > 1) console.log('turns', what, i, JSON.stringify(r.seen.slice(Math.max(0, i - 12), i + 1).map(f => Object.fromEntries(LIMBS.map(n => [n, `${f.touches[n].point}${f.touches[n].step ? `>${f.touches[n].step!.to}@${f.touches[n].step!.s.toFixed(2)}` : ''} ${f.touches[n].room?.toFixed(3)}`])))))
    expect(groups.size).toBeLessThanOrEqual(1)
    LIMBS.forEach((name, j) => {
      const t = s.touches[name], mid = s.middles[name]
      if (!t.step) {
        expect(offLine(s.placed, t.point, mid.toArray())).toBeLessThanOrEqual(0.001)
        expect(Math.abs(skinOf(s, name))).toBeLessThanOrEqual(0.001)
        expect(s.short[j]).toBeLessThan(0.001)
        const was = r.seen[i - 1]?.touches[name]
        if (was && !was.step && was.point === t.point) expect(vlen(vsub(restOf(k, s.placed, mid.toArray()), restOf(k, r.seen[i - 1].placed, r.seen[i - 1].middles[name].toArray())))).toBeLessThanOrEqual(0.001)
      } else {
        expect(still).toBe(false)
        // Its own skin off by no more than the lift and a centimetre past how far the straight way between
        // its two points stands off the surface (across an inside corner, the way cuts across it). Its
        // skin and not its middle: a hand turned as it goes holds its middle further out than its skin.
        const off = skinOf(s, name)
        const a = place(s.placed, t.step.from), b = place(s.placed, t.step.to)
        let across = 0
        for (let n = 1; n < 16; n++) across = Math.max(across, fromHeld(s.placed, a.map((v, k) => v + (b[k] - v) * (n / 16))))
        expect(off).toBeLessThanOrEqual(defs.player.climb.step.lift + across + 0.01)
        expect(off).toBeGreaterThanOrEqual(-0.001)
        // Reached the whole way: it goes where its step takes it.
        expect(s.short[j]).toBeLessThan(0.001)
        lifted[name] = Math.max(lifted[name], off)
        const next = r.seen[i + 1]?.touches[name]
        if (next && !next.step) {
          expect(next.point).toBe(t.step.to)
          steps[name]++
        }
      }
    })
  })
  if (!still) for (const name of LIMBS) {
    expect(steps[name]).toBeGreaterThan(0)
    expect(lifted[name]).toBeGreaterThan(defs.player.climb.step.lift / 2)
  }
  return { steps, lifted: Object.fromEntries(Object.entries(lifted).map(([n, v]) => [n, +v.toFixed(3)])) }
}

test('4: every way he climbs, each hand and foot holds its point planted, steps to a new one lifted off the face and lands on it, in diagonal pairs, never sliding, keeping up with him', async () => {
  const g0 = await start()
  const net = netOf(g0.p.client!.plugins.wire, g0.yard.rows.find(r => r.kind === 'wall')!)
  for (const { keys, r } of await climbs()) {
    onTheFace(r)
    console.log('4', keys.join(''), JSON.stringify(climbedWell(r, net, keys.join(''))))
  }
})

// A tilted wall: the yard's wall leaned back by `pitch` (radians; under 0 it leans out), and its base's
// middle raised to `high` metres, once it stands.
async function tilted(pitch: number, high: number) {
  const g = await start()
  await g.frames(30)
  const wall = g.yard.rows.find(r => r.kind === 'wall')!
  wall.data.pitch = pitch
  wall.data.pos = [wall.data.pos[0], wall.data.pos[1] + high, wall.data.pos[2]]
  return g
}
// The slab, the overhang and the ceiling, each with where on its face he is put: the slab and the overhang
// lean 20° back and out; the ceiling is the wall laid flat on its back, its face down, 4 m up.
const TILTS: { name: string; pitch: number; high: number; at: number[] }[] = [
  { name: 'slab', pitch: (20 * Math.PI) / 180, high: 0, at: [0, 4, defs.wall.size[2] / 2] },
  { name: 'overhang', pitch: (-20 * Math.PI) / 180, high: 0, at: [0, 4, defs.wall.size[2] / 2] },
  { name: 'ceiling', pitch: -Math.PI / 2, high: 4 + defs.wall.size[2] / 2, at: [0, 4, defs.wall.size[2] / 2] },
]

// Held still on a tilted face for a second: his body framed on it (his front into it within a degree, his
// up along it within a degree), each hand and foot on its point with its skin on the face within 1 mm, and
// nothing of him in the wall deeper than touching skin, 1 mm.
async function heldOnTilt(t: (typeof TILTS)[number]) {
  return heldOn(await tilted(t.pitch, t.high), t.at)
}

// The hero put on the point of the `kind`'s net nearest `want` (its own frame) and held still there for
// a second: his body framed on the surface where he holds (his front into it within a degree, his up
// along it within a degree), each hand and foot with its skin on the surface within 1 mm, and nothing of
// him in it deeper than touching skin, 1 mm. The nearest each hand and foot came, and the deepest, are
// returned with the rows.
async function heldOn(g: Game, want: number[], kind = 'wall') {
  const { wall, hero } = putOn(g, want, kind)
  await g.frames(60)
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = plugins.anim.model(hero.id)
  // Each hand's and foot's nearest skin, least and most over the second, and the deepest of the rest.
  const span = () => [Infinity, -Infinity]
  const seen = { hands: { L: span(), R: span() }, soles: { L: span(), R: span() }, rest: { depth: 0, bone: '' }, feet: { depth: 0, bone: '' } }
  for (let i = 0; i < 60; i++) {
    await g.frames(1)
    const out = new T.Vector3(...spotOn(plugins.wire, wall, hero.data.hold).out)
    root.updateMatrixWorld(true)
    const turn = root.getWorldQuaternion(new T.Quaternion())
    expect(new T.Vector3(0, 0, 1).applyQuaternion(turn).angleTo(out.clone().negate())).toBeLessThan(Math.PI / 180)
    expect(Math.abs(new T.Vector3(0, 1, 0).applyQuaternion(turn).dot(out))).toBeLessThan(Math.sin(Math.PI / 180))
    const m = against(g, kind)
    for (const side of ['L', 'R'] as const) {
      for (const [into, d] of [[seen.hands, m.hands[side]], [seen.soles, m.soles[side]]] as const) into[side] = [Math.min(into[side][0], d), Math.max(into[side][1], d)]
    }
    if (m.rest.depth > seen.rest.depth) seen.rest = m.rest
    if (m.feet.depth > seen.feet.depth) seen.feet = m.feet
  }
  console.log('held', kind, JSON.stringify(want), JSON.stringify(seen))
  for (const side of ['L', 'R'] as const) for (const d of [...seen.hands[side], ...seen.soles[side]]) expect(Math.abs(d)).toBeLessThanOrEqual(0.001)
  expect(seen.rest.depth).toBeLessThanOrEqual(0.001)
  expect(seen.feet.depth).toBeLessThanOrEqual(0.001)
  return { g, hero, wall, seen }
}

test('5a: on a wall leaning back 20°, his body leans with it, hands and feet on its face, nothing of him in it', async () => {
  await heldOnTilt(TILTS[0])
})

test('5b: under a wall leaning out 20°, his body leans with it, hands and feet on its face, nothing of him in it', async () => {
  await heldOnTilt(TILTS[1])
})

test('5c: under a ceiling he hangs face up, hands and feet on it, his up the way he faced when he took hold, nothing of him in it', async () => {
  const { g, hero } = await heldOnTilt(TILTS[2])
  // Facing straight up, his up is the way he faced (the start's, toward −z), laid flat.
  const lean = hero.data.lean
  expect(lean.ahead[1]).toBeCloseTo(1, 9)
  expect(Math.hypot(lean.up[0] - Math.sin(hero.data.yaw), lean.up[2] - Math.cos(hero.data.yaw))).toBeLessThan(1e-9)
  void g
})

test('5d: on the slab, under the overhang and under the ceiling, he climbs every way as he does on the wall: on the face, stepping in pairs, never sliding, nothing of him in it', async () => {
  for (const t of TILTS) {
    for (const keys of [['w'], ['s'], ['a'], ['d']]) {
      const g = await tilted(t.pitch, t.high)
      const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === 'wall')!)
      const r = await climbing(g, t.at, keys, 180)
      // On the face (its front, in its frame) all the way, and moved the way pushed.
      for (const s of r.seen) expect(s.at[2]).toBeCloseTo(defs.wall.size[2] / 2, 9)
      expect(Math.hypot(...moved(r))).toBeGreaterThan(going(170))
      console.log('5d', t.name, keys.join(''), JSON.stringify(climbedWell(r, net, `${t.name} ${keys.join('')}`)))
      for (const s of r.seen) {
        expect(s.m.rest.depth).toBeLessThanOrEqual(0.001)
        expect(s.m.feet.depth).toBeLessThanOrEqual(0.001)
      }
    }
  }
})

test('6a: the sphere\'s net is a point on its surface for every corner of its mesh and a link for every edge, closed all round, drawn over it while shown; the measure of any mesh agrees with the box\'s own', async () => {
  const k = defs.sphere
  const shape = sphere(k.radius, k.cell)
  const net = netOn(shape)
  const measure = signedTo(shape, k.cell)
  // A point for each place a vertex of the mesh stands (to a tenth of a millimetre), and no other: an
  // icosahedron's faces cut n to an edge make 10n² + 2.
  const key = (p: ArrayLike<number>) => [p[0], p[1], p[2]].map(v => String(Math.round(v * 1e4))).join(',')
  const places = new Set<string>()
  for (let i = 0; i < shape.position.length; i += 3) places.add(key(shape.position.slice(i, i + 3)))
  expect(net.points).toBe(places.size)
  const cut = Math.round((4 / Math.sqrt(10 + 2 * Math.sqrt(5)) * k.radius) / k.cell)
  expect(net.points).toBe(10 * cut * cut + 2)
  for (let i = 0; i < net.points; i++) expect(places.has(key(net.at.subarray(i * 3, i * 3 + 3)))).toBe(true)
  // ON it: every point is the sphere's radius from its middle, and 0 from its mesh.
  let off = 0, onMesh = 0, turned = 0
  for (let i = 0; i < net.points; i++) {
    const p = [...net.at.subarray(i * 3, i * 3 + 3)], o = [...net.out.subarray(i * 3, i * 3 + 3)]
    off = Math.max(off, Math.abs(vlen(p) - k.radius))
    onMesh = Math.max(onMesh, Math.abs(measure(p)))
    // Each point's way out leaves it: a centimetre out along it is outside, a centimetre in is inside.
    expect(vlen(o)).toBeCloseTo(1, 6)
    expect(measure(p.map((v, j) => v + o[j] * 0.01))).toBeGreaterThan(0)
    expect(measure(p.map((v, j) => v - o[j] * 0.01))).toBeLessThan(0)
    turned = Math.max(turned, Math.acos(Math.min(1, vdot(o, p) / vlen(p))))
  }
  expect(off).toBeLessThan(1e-5)
  expect(onMesh).toBeLessThan(1e-5)
  // Every link is an edge of a triangle, both ways, no longer than a cell's diagonal.
  const edges = new Set<string>()
  for (let t = 0; t < shape.index.length; t += 3) {
    const c = [0, 1, 2].map(j => key(shape.position.slice(shape.index[t + j] * 3, shape.index[t + j] * 3 + 3)))
    for (const [a, b] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[0]]]) edges.add([a, b].sort().join(' '))
  }
  let links = 0, longest = 0, shortest = Infinity
  for (let i = 0; i < net.points; i++) {
    for (const o of linked(net, i)) {
      expect([...linked(net, o)]).toContain(i)
      if (o < i) continue
      links++
      expect(edges.has([key(net.at.subarray(i * 3, i * 3 + 3)), key(net.at.subarray(o * 3, o * 3 + 3))].sort().join(' '))).toBe(true)
      const d = vlen(vsub([...net.at.subarray(i * 3, i * 3 + 3)], [...net.at.subarray(o * 3, o * 3 + 3)]))
      longest = Math.max(longest, d)
      shortest = Math.min(shortest, d)
    }
  }
  expect(links).toBe(edges.size)
  expect(longest).toBeLessThanOrEqual(k.cell * Math.SQRT2)
  // Closed all round, no seam: points less links plus triangles is 2, a sphere's.
  expect(net.points - links + shape.index.length / 3).toBe(2)
  console.log('6a', JSON.stringify({ points: net.points, links, triangles: shape.index.length / 3, off, onMesh, turned: (turned * 180) / Math.PI, longest, shortest }))

  // The measure of any mesh, on the wall's box, is the box's own at every one of 4000 places in and
  // round it, to a micrometre.
  const boxed = signedTo(box(defs.wall.size, defs.wall.cell), defs.wall.cell)
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let most = 0
  for (let i = 0; i < 4000; i++) {
    const p = [(random() - 0.5) * (defs.wall.size[0] + 2), random() * (defs.wall.size[1] + 2) - 1, (random() - 0.5) * (defs.wall.size[2] + 2)]
    const want = fromSurface(p), got = boxed(p)
    // Past a box of the grid the measure says only that it is that far, in or out.
    if (Math.abs(want) > defs.wall.cell) expect(Math.sign(got) * Math.min(Math.abs(got), defs.wall.cell)).toBeCloseTo(Math.sign(want) * defs.wall.cell, 9)
    else most = Math.max(most, Math.abs(got - want))
  }
  expect(most).toBeLessThan(1e-6)

  // Drawn: a mesh named `sphere`, as far each way round its row as its mesh's corners go, and its net
  // hidden, then shown, a line for each link, each end at its point where the sphere stands.
  const { yard, p, frames, shared } = await start()
  await frames(30)
  const T = p.client!.plugins.render3d.THREE as typeof THREE
  const ball = yard.rows.find(r => r.kind === 'sphere')!
  expect(ball.data.placed).toBe(true)
  const found = (name: string) => {
    let o: THREE.Object3D | undefined
    p.client!.plugins.render3d.scene.traverse((x: THREE.Object3D) => { if (x.name === name) o = x })
    return o!
  }
  const mesh = found('sphere') as THREE.Mesh
  mesh.updateMatrixWorld(true)
  const b = new T.Box3().setFromObject(mesh)
  const [x, y, z] = ball.data.pos
  const corners = [0, 1, 2].map(j => shape.position.filter((_, i) => i % 3 === j))
  expect(b.min.toArray()).toEqual([0, 1, 2].map(j => expect.closeTo([x, y, z][j] + Math.min(...corners[j]), 5)))
  expect(b.max.toArray()).toEqual([0, 1, 2].map(j => expect.closeTo([x, y, z][j] + Math.max(...corners[j]), 5)))
  // Within a centimetre of the sphere's own size: its corners are on it.
  for (const j of [0, 1, 2]) expect(Math.max(...corners[j])).toBeGreaterThan(k.radius - 0.01)
  const lines = found('sphere net') as THREE.LineSegments
  expect(lines.visible).toBe(false)
  shared.sphere.shown = true
  await frames(1)
  expect(lines.visible).toBe(true)
  const at = lines.geometry.getAttribute('position')
  expect(at.count).toBe(links * 2)
  lines.updateMatrixWorld(true)
  const ours = new Set<string>()
  for (let i = 0; i < net.points; i++) ours.add([net.at[i * 3] + x, net.at[i * 3 + 1] + y, net.at[i * 3 + 2] + z].map(v => v.toFixed(3)).join(','))
  for (let i = 0; i < at.count; i++) expect(ours.has(new T.Vector3().fromBufferAttribute(at, i).applyMatrix4(lines.matrixWorld).toArray().map(v => v.toFixed(3)).join(','))).toBe(true)
  shared.sphere.shown = false
})

// Places on the sphere, in its own frame: its side facing the hero's start, its upper and lower half 45°
// up and down from there, and underneath.
const r45 = defs.sphere.radius * Math.SQRT1_2
const ROUND = {
  side: [0, 0, defs.sphere.radius],
  upper: [0, r45, r45],
  lower: [0, -r45, r45],
  under: [0, -defs.sphere.radius, 0],
}

test('6b, 6e: on the sphere\'s side he hangs still, framed on it, hands and feet on it within 1 mm, nothing of him in it', async () => {
  const { seen } = await heldOn(await start(), ROUND.side, 'sphere')
  console.log('6b', JSON.stringify(seen))
})

test('6c, 6e: on the sphere\'s upper half and on its lower half he hangs still, framed on it, hands and feet on it within 1 mm, nothing of him in it', async () => {
  for (const half of ['upper', 'lower'] as const) {
    const { seen } = await heldOn(await start(), ROUND[half], 'sphere')
    console.log('6c', half, JSON.stringify(seen))
  }
})

test('6d, 6e: under the sphere he hangs still, framed on it, hands and feet on it within 1 mm, nothing of him in it', async () => {
  const { seen } = await heldOn(await start(), ROUND.under, 'sphere')
  console.log('6d', JSON.stringify(seen))
})

// Every frame of a climb on a curved shape: his hold on its surface; his body, as drawn, framed on it
// there (his front into it within a degree, his up along it within a degree, and the up his row holds,
// within a degree); his up turning from one frame to the next by no more than the surface turned under
// him and `climb.upright` for a step (no flip); his root over the ground; and nothing of him in it deeper
// than touching skin, 1 mm. How far round his up turned in all.
function onTheShape(r: Awaited<ReturnType<typeof climbing>>) {
  const deg = Math.PI / 180
  const angle = (a: number[], b: number[]) => Math.acos(Math.max(-1, Math.min(1, vdot(a, b) / (vlen(a) * vlen(b)))))
  let turned = 0
  r.seen.forEach((s, i) => {
    expect(Math.abs(fromHeld(s.placed, fromRest((defs as any)[r.wall.kind], s.placed, s.at)))).toBeLessThan(1e-5)
    expect(angle(s.model.ahead, s.out.map(v => -v))).toBeLessThan(deg)
    expect(Math.abs(vdot(s.model.up, s.out))).toBeLessThan(Math.sin(deg))
    expect(angle(s.model.up, s.lean.up)).toBeLessThan(deg)
    if (i > 0) {
      const step = angle(s.model.up, r.seen[i - 1].model.up)
      expect(step).toBeLessThan(angle(s.out, r.seen[i - 1].out) + defs.player.climb.upright * DT + 1e-6)
      turned += step
    }
    expect(s.pos[1]).toBeGreaterThanOrEqual(0)
    expect(s.m.rest.depth).toBeLessThanOrEqual(0.001)
    expect(s.m.feet.depth).toBeLessThanOrEqual(0.001)
  })
  return turned / deg
}

test('7a: pushed right from the sphere\'s side, he climbs round its middle, along it, his hands and feet stepping in pairs, never sliding, nothing of him in it', async () => {
  const g = await start()
  const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === 'sphere')!)
  const r = await climbing(g, ROUND.side, ['d'], 360, 'sphere')
  const turned = onTheShape(r)
  const well = climbedWell(r, net, 'round')
  // Round the middle: his hold's angle round the upright through the sphere's middle, and how far off
  // the middle it strays.
  const round = (at: number[]) => Math.atan2(at[0], at[2])
  const swept = Math.abs(round(r.seen[r.seen.length - 1].at) - round(r.from)) * defs.sphere.radius
  const strayed = Math.max(...r.seen.map(s => Math.abs(s.at[1])))
  console.log('7a', JSON.stringify({ swept, strayed, turned, ...well }))
  // Each link he takes lies within `fan` of the way pushed, so he goes round at least that share of his
  // speed; and round, not up or down it, by no more than one link's length.
  expect(swept).toBeGreaterThan(going(357) * defs.player.climb.fan)
  expect(strayed).toBeLessThan(defs.sphere.cell * Math.SQRT2)
})

test('7b: pushed up from the sphere\'s side, he climbs up it, over the top and down its far side to its middle, his up carried over the top and never flipping, his hands and feet stepping in pairs, nothing of him in it', async () => {
  const g = await start()
  const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === 'sphere')!)
  // Held until his hold is past the far side's middle, at most 40 s.
  const r = await climbing(g, ROUND.side, ['w'], 2400, 'sphere', at => at[2] < 0 && at[1] <= 0)
  const last = r.seen[r.seen.length - 1].at
  console.log('7b', JSON.stringify({ frames: r.seen.length, last }))
  // Over the top and down the far side to its middle.
  expect(last[2]).toBeLessThan(0)
  expect(last[1]).toBeLessThanOrEqual(0)
  expect(Math.max(...r.seen.map(s => s.at[1]))).toBeGreaterThan(defs.sphere.radius - 0.05)
  const turned = onTheShape(r)
  const well = climbedWell(r, net, 'over')
  console.log('7b', JSON.stringify({ turned, ...well }))
})

test('7c: pushed right under the sphere, he climbs across under it, his hands and feet stepping in pairs, never sliding, nothing of him in it', async () => {
  const g = await start()
  const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === 'sphere')!)
  const r = await climbing(g, ROUND.under, ['d'], 360, 'sphere')
  const turned = onTheShape(r)
  const well = climbedWell(r, net, 'under')
  const across = vlen(vsub(heldPoint(r.wall, r.seen[r.seen.length - 1].at), heldPoint(r.wall, r.from)))
  const highest = Math.max(...r.seen.map(s => s.out[1]))
  console.log('7c', JSON.stringify({ across, highest, turned, ...well }))
  // At least `fan` of his speed over the surface, and straight across, a chord, no shorter than 2/π of
  // the arc it spans.
  expect(across).toBeGreaterThan(going(357) * defs.player.climb.fan * (2 / Math.PI))
  // Under it all the way: the surface where he holds faces down.
  expect(highest).toBeLessThan(0)
})

// The cylinders: the pillar, thick, and the pole, thin.
const CYLINDERS = ['pillar', 'pole'] as const

test('8a, 8c: each cylinder\'s net, the pillar\'s and the pole\'s, is a point on its surface for every corner of its mesh and a link for every edge, closed all round, drawn over it while shown', async () => {
  const { yard, p, frames, shared } = await start()
  await frames(30)
  for (const kind of CYLINDERS) {
    const k = defs[kind]
    const shape = cylinder(k.radius, k.length, k.cell)
    const net = netOn(shape)
    const measure = signedTo(shape, k.cell)
    const key = (q: ArrayLike<number>) => [q[0], q[1], q[2]].map(v => String(Math.round(v * 1e4))).join(',')
    const places = new Set<string>()
    for (let i = 0; i < shape.position.length; i += 3) places.add(key(shape.position.slice(i, i + 3)))
    expect(net.points).toBe(places.size)
    // ON it: every point on its round side (its radius from the axis, between its ends) or on an end (at
    // 0 or its length, within its radius), and 0 from its mesh; each point's way out leaves it.
    let off = 0, onMesh = 0
    for (let i = 0; i < net.points; i++) {
      const q = [...net.at.subarray(i * 3, i * 3 + 3)], o = [...net.out.subarray(i * 3, i * 3 + 3)]
      const fromAxis = Math.hypot(q[0], q[2])
      const onSide = Math.abs(fromAxis - k.radius) < 1e-5 && q[1] > -1e-5 && q[1] < k.length + 1e-5
      const onEnd = (Math.abs(q[1]) < 1e-5 || Math.abs(q[1] - k.length) < 1e-5) && fromAxis < k.radius + 1e-5
      expect(onSide || onEnd).toBe(true)
      off = Math.max(off, onSide ? Math.abs(fromAxis - k.radius) : 0)
      onMesh = Math.max(onMesh, Math.abs(measure(q)))
      expect(vlen(o)).toBeCloseTo(1, 6)
      expect(measure(q.map((v, j) => v + o[j] * 0.01))).toBeGreaterThan(0)
      expect(measure(q.map((v, j) => v - o[j] * 0.01))).toBeLessThan(0)
    }
    expect(onMesh).toBeLessThan(1e-5)
    // Every link is a triangle's edge, both ways; closed all round, points less links plus triangles 2.
    const edges = new Set<string>()
    for (let t = 0; t < shape.index.length; t += 3) {
      const c = [0, 1, 2].map(j => key(shape.position.slice(shape.index[t + j] * 3, shape.index[t + j] * 3 + 3)))
      for (const [a, b] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[0]]]) edges.add([a, b].sort().join(' '))
    }
    let links = 0
    for (let i = 0; i < net.points; i++) {
      for (const o of linked(net, i)) {
        expect([...linked(net, o)]).toContain(i)
        if (o < i) continue
        links++
        expect(edges.has([key(net.at.subarray(i * 3, i * 3 + 3)), key(net.at.subarray(o * 3, o * 3 + 3))].sort().join(' '))).toBe(true)
      }
    }
    expect(links).toBe(edges.size)
    expect(net.points - links + shape.index.length / 3).toBe(2)
    console.log('8a net', kind, JSON.stringify({ points: net.points, links, triangles: shape.index.length / 3, off, onMesh }))

    // Drawn standing on the ground: as far each way round its row as its corners go, and its net
    // hidden, then shown, a line for each link, each end at its point.
    const row = yard.rows.find(r => r.kind === kind)!
    expect(row.data.placed).toBe(true)
    let mesh: THREE.Mesh | undefined, lines: THREE.LineSegments | undefined
    p.client!.plugins.render3d.scene.traverse((x: THREE.Object3D) => {
      if (x.name === kind) mesh = x as THREE.Mesh
      if (x.name === `${kind} net`) lines = x as THREE.LineSegments
    })
    const T = p.client!.plugins.render3d.THREE as typeof THREE
    mesh!.updateMatrixWorld(true)
    const b = new T.Box3().setFromObject(mesh!)
    const corners = [0, 1, 2].map(j => shape.position.filter((_, i) => i % 3 === j))
    expect(b.min.toArray()).toEqual([0, 1, 2].map(j => expect.closeTo(row.data.pos[j] + Math.min(...corners[j]), 5)))
    expect(b.max.toArray()).toEqual([0, 1, 2].map(j => expect.closeTo(row.data.pos[j] + Math.max(...corners[j]), 5)))
    expect(row.data.pos[1]).toBeCloseTo(yard.rows.find(r => r.kind === 'wall')!.data.pos[1], 6)
    expect(lines!.visible).toBe(false)
    ;(shared as any)[kind].shown = true
    await frames(1)
    expect(lines!.visible).toBe(true)
    expect(lines!.geometry.getAttribute('position').count).toBe(links * 2)
    ;(shared as any)[kind].shown = false
  }
})

// A cylinder laid on its back along the ground, its axis `high` metres over its base's old place (its
// pitch a quarter turn: its own front, +z, faces up, and its length runs away along −z).
async function laid(kind: string, high: number) {
  const g = await start()
  await g.frames(30)
  const row = g.yard.rows.find(r => r.kind === kind)!
  row.data.pitch = Math.PI / 2
  row.data.pos = [row.data.pos[0], row.data.pos[1] + high, row.data.pos[2]]
  return g
}
// How far round the axis of a cylinder a place in its own frame is, and how far along it.
const roundOf = (at: number[]) => Math.atan2(at[0], at[2])

test('8a, 8c: standing, on the pillar and on the pole he hangs still on its side; pushed up he climbs up it and pushed right he climbs round it, stepping in pairs, never sliding, nothing of him in it', async () => {
  for (const kind of CYLINDERS) {
    const k = defs[kind]
    const side = [0, 4, k.radius]
    const { seen } = await heldOn(await start(), side, kind)
    console.log('8a held', kind, JSON.stringify(seen))
    for (const keys of [['w'], ['d']]) {
      const g = await start()
      const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === kind)!)
      const r = await climbing(g, side, keys, 180, kind)
      const turned = onTheShape(r)
      const well = climbedWell(r, net, `${kind} ${keys}`)
      const last = r.seen[r.seen.length - 1].at
      const up = last[1] - r.from[1], round = Math.abs(roundOf(last) - roundOf(r.from)) * k.radius
      console.log('8a', kind, keys.join(''), JSON.stringify({ up, round, turned, ...well }))
      // At least `fan` of his speed the way pushed.
      if (keys[0] === 'w') expect(up).toBeGreaterThan(going(177) * defs.player.climb.fan)
      else expect(round).toBeGreaterThan(going(177) * defs.player.climb.fan * (2 / Math.PI))
    }
  }
})

test('8b, 8c: lying, on the pillar and on the pole he hangs still on its top, its side and underneath; on its top pushed up he climbs along it and pushed right he climbs round it, stepping in pairs, never sliding, nothing of him in it', async () => {
  for (const kind of CYLINDERS) {
    const k = defs[kind]
    const high = k.radius + 3
    const middle = k.length / 2
    for (const [where, at] of [['top', [0, middle, k.radius]], ['side', [k.radius, middle, 0]], ['under', [0, middle, -k.radius]]] as const) {
      const { seen } = await heldOn(await laid(kind, high), [...at], kind)
      console.log('8b held', kind, where, JSON.stringify(seen))
    }
    for (const keys of [['w'], ['d']]) {
      const g = await laid(kind, high)
      const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === kind)!)
      const r = await climbing(g, [0, middle, k.radius], keys, 180, kind)
      const turned = onTheShape(r)
      const well = climbedWell(r, net, `${kind} laid ${keys}`)
      const last = r.seen[r.seen.length - 1].at
      const along = Math.abs(last[1] - r.from[1]), round = Math.abs(roundOf(last) - roundOf(r.from)) * k.radius
      console.log('8b', kind, keys.join(''), JSON.stringify({ along, round, turned, ...well }))
      if (keys[0] === 'w') expect(along).toBeGreaterThan(going(177) * defs.player.climb.fan)
      else expect(round).toBeGreaterThan(going(177) * defs.player.climb.fan * (2 / Math.PI))
    }
  }
})

test('9a: the corner\'s net is a point on its surface for every corner of its mesh and a link for every edge, closed all round, its inside faces looking in at each other', () => {
  const k = defs.corner
  const shape = corner(k.size, k.thick, k.cell)
  const net = netOn(shape)
  const measure = signedTo(shape, k.cell)
  const key = (q: ArrayLike<number>) => [q[0], q[1], q[2]].map(v => String(Math.round(v * 1e4))).join(',')
  const places = new Set<string>()
  for (let i = 0; i < shape.position.length; i += 3) places.add(key(shape.position.slice(i, i + 3)))
  expect(net.points).toBe(places.size)
  const [w, h, d] = k.size, t = k.thick
  let insideFaces = 0
  for (let i = 0; i < net.points; i++) {
    const q = [...net.at.subarray(i * 3, i * 3 + 3)], o = [...net.out.subarray(i * 3, i * 3 + 3)]
    // ON it, 0 from its mesh, and within its two arms.
    expect(Math.abs(measure(q))).toBeLessThan(1e-5)
    expect(q[1] > -1e-6 && q[1] < h + 1e-6 && q[0] > -1e-6 && q[0] < w + 1e-6 && q[2] > -1e-6 && q[2] < d + 1e-6 && (q[0] < t + 1e-6 || q[2] < t + 1e-6)).toBe(true)
    expect(measure(q.map((v, j) => v + o[j] * 0.01))).toBeGreaterThan(0)
    expect(measure(q.map((v, j) => v - o[j] * 0.01))).toBeLessThan(0)
    // The inside faces: the face at z `thick` beyond x `thick` looks along +z, the one at x `thick` beyond
    // z `thick` along +x.
    if (Math.abs(q[2] - t) < 1e-6 && q[0] > t + 1e-6 && q[0] < w - 1e-6 && q[1] > 1e-6 && q[1] < h - 1e-6) { expect(o[2]).toBeCloseTo(1, 6); insideFaces++ }
    if (Math.abs(q[0] - t) < 1e-6 && q[2] > t + 1e-6 && q[2] < d - 1e-6 && q[1] > 1e-6 && q[1] < h - 1e-6) { expect(o[0]).toBeCloseTo(1, 6); insideFaces++ }
  }
  expect(insideFaces).toBeGreaterThan(0)
  const edges = new Set<string>()
  for (let tri = 0; tri < shape.index.length; tri += 3) {
    const c = [0, 1, 2].map(j => key(shape.position.slice(shape.index[tri + j] * 3, shape.index[tri + j] * 3 + 3)))
    for (const [a, b] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[0]]]) edges.add([a, b].sort().join(' '))
  }
  let links = 0
  for (let i = 0; i < net.points; i++) for (const o of linked(net, i)) if (o > i) links++
  expect(links).toBe(edges.size)
  // Closed all round: a footprint of whole cells meets its neighbours along whole edges, so every
  // triangle's edge is shared by two.
  expect(net.points - links + net.tri.length / 3).toBe(2)
  console.log('9a net', JSON.stringify({ points: net.points, links, triangles: net.tri.length / 3, insideFaces }))
})

test('9a, 9c: near the inside corner, a quarter of a metre from it on either face, he hangs still, hands and feet on the face he holds, no two on one point, and nothing of him through either wall', async () => {
  const t = defs.corner.thick
  for (const at of [[t + 0.25, 4, t], [t, 4, t + 0.25]]) {
    const { g, hero, seen } = await heldOn(await start(), at, 'corner')
    const points = [...g.p.client!.plugins.climb.touches(hero)!.values()].map((x: { point: number }) => x.point)
    expect(new Set(points).size).toBe(4)
    console.log('9a held', JSON.stringify(at), JSON.stringify(seen))
  }
})

// The bowl's hollow: the middle of the ball pressed into it, in its own frame, and its rim's radius.
const HOLLOW = (() => {
  const k = defs.bowl
  return { middle: [0, k.size[1] / 2, k.size[2] / 2 + k.radius - k.depth], rim: Math.sqrt(2 * k.radius * k.depth - k.depth * k.depth) }
})()
// A place on the bowl's hollow `deg` degrees above (under 0, below) its deepest.
const inHollow = (deg: number) => {
  const a = (deg * Math.PI) / 180, R = defs.bowl.radius, c = HOLLOW.middle
  return [c[0], c[1] + R * Math.sin(a), c[2] - R * Math.cos(a)]
}

test('9b: the bowl\'s net is a point on its surface for every corner of its mesh and a link for every edge, closed all round, its hollow looking in at the middle of the ball pressed into it', () => {
  const k = defs.bowl
  const shape = dish(k.size, k.cell, k.radius, k.depth)
  const net = netOn(shape)
  const measure = signedTo(shape, k.cell)
  const [w, h, d] = k.size
  let hollow = 0, worst = 0
  for (let i = 0; i < net.points; i++) {
    const q = [...net.at.subarray(i * 3, i * 3 + 3)], o = [...net.out.subarray(i * 3, i * 3 + 3)]
    // ON it: on the ball of the hollow (in front of the slab's middle, within the rim), or on the box's
    // faces, and 0 from its mesh; its way out leaves it.
    const fromMiddle = vlen(vsub(q, HOLLOW.middle)), r = Math.hypot(q[0], q[1] - h / 2)
    const inBall = Math.abs(fromMiddle - k.radius) < 1e-5 && r < HOLLOW.rim + 1e-5
    const onBox = Math.abs(Math.abs(q[0]) - w / 2) < 1e-5 || Math.abs(q[1]) < 1e-5 || Math.abs(q[1] - h) < 1e-5 || Math.abs(q[2] + d / 2) < 1e-5 || (Math.abs(q[2] - d / 2) < 1e-5 && r > HOLLOW.rim - k.cell * 2)
    expect(inBall || onBox).toBe(true)
    expect(Math.abs(measure(q))).toBeLessThan(1e-5)
    expect(measure(q.map((v, j) => v + o[j] * 0.01))).toBeGreaterThan(0)
    expect(measure(q.map((v, j) => v - o[j] * 0.01))).toBeLessThan(0)
    // Two cells or more inside the rim (nearer, a point's way out shares the triangles that cross the
    // rim), a point of the hollow looks in at the ball's middle, within a degree.
    if (inBall && r < HOLLOW.rim - 2 * k.cell) {
      hollow++
      worst = Math.max(worst, Math.acos(Math.min(1, vdot(o, vsub(HOLLOW.middle, q).map(v => v / fromMiddle)))))
    }
  }
  expect(hollow).toBeGreaterThan(0)
  expect(worst).toBeLessThan(Math.PI / 180)
  let links = 0
  for (let i = 0; i < net.points; i++) for (const o of linked(net, i)) if (o > i) links++
  expect(net.points - links + net.tri.length / 3).toBe(2)
  console.log('9b net', JSON.stringify({ points: net.points, links, triangles: net.tri.length / 3, hollow, worstDeg: (worst * 180) / Math.PI }))
})

test('9b, 9c: in the bowl\'s hollow, at its deepest and 30° above and below it, he hangs still, framed on it, hands and feet on it within 1 mm, no two on one point, nothing of him in it', async () => {
  for (const at of [inHollow(0), inHollow(30), inHollow(-30)]) {
    const { g, hero, seen } = await heldOn(await start(), at, 'bowl')
    const points = [...g.p.client!.plugins.climb.touches(hero)!.values()].map((x: { point: number }) => x.point)
    expect(new Set(points).size).toBe(4)
    console.log('9b held', JSON.stringify(at), JSON.stringify(seen))
  }
})

test('10a: from one face of the inside corner, pushed toward it, he climbs into it and onto the other face, framed on the surface all the way, stepping in pairs, never sliding, nothing of him through either wall', async () => {
  const t = defs.corner.thick
  const g = await start()
  const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === 'corner')!)
  // On the face looking along +z, his left is toward the corner.
  const r = await climbing(g, [t + 0.75, 4, t], ['a'], 360, 'corner')
  const turned = onTheShape(r)
  const well = climbedWell(r, net, 'corner')
  const last = r.seen[r.seen.length - 1]
  console.log('10a', JSON.stringify({ last: last.at, out: last.out, turned, ...well }))
  // On the other face, looking along +x, gone along it: the way he faces turned a right angle, his up
  // kept upright.
  expect(last.at[0]).toBeCloseTo(t, 6)
  expect(last.at[2]).toBeGreaterThan(t + 0.5)
  expect(vdot(last.out, [1, 0, 0])).toBeCloseTo(1, 6)
  expect(vdot(r.seen[0].out, [0, 0, 1])).toBeCloseTo(1, 6)
  expect(turned).toBeLessThan(1)
})

test('10b: from the bottom of the bowl\'s hollow, pushed up, he climbs up out of it, over its rim and on up the flat face above, framed on the surface all the way, stepping in pairs, never sliding, nothing of him in it', async () => {
  const k = defs.bowl
  const g = await start()
  const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === 'bowl')!)
  // Held till his hold is on the flat face two cells past the rim (where every triangle round a point is
  // flat), at most 20 s.
  const past = k.size[1] / 2 + HOLLOW.rim + 2 * k.cell
  const r = await climbing(g, inHollow(0), ['w'], 1200, 'bowl', at => Math.abs(at[2] - k.size[2] / 2) < 1e-6 && at[1] > past)
  const turned = onTheShape(r)
  const well = climbedWell(r, net, 'bowl')
  const last = r.seen[r.seen.length - 1]
  console.log('10b', JSON.stringify({ frames: r.seen.length, last: last.at, out: last.out, turned, ...well }))
  expect(Math.abs(last.at[2] - k.size[2] / 2)).toBeLessThan(1e-6)
  expect(last.at[1]).toBeGreaterThan(past)
  expect(vdot(last.out, [0, 0, 1])).toBeCloseTo(1, 6)
})

test('11: held on the wall, still and climbing every way, every frame the skin of his body (all but his limbs\') goes no further below his hips than his climb.past of the line down his middle, from the top of his head to his hips in his still clip\'s first frame, and in each band of his climb.across to either side of that line, carried on so far past them, stands no further ahead of it than his climb.front has for that band, and within a centimetre of it at its most; on a flat wall that line stands further off the face than all of them', async () => {
  const g = await start()
  const { hero } = putOn(g, [0, 4, 0.5])
  await g.frames(90)
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = plugins.anim.model(hero.id)
  const wire = plugins.wire, clip = defs.player.climb.clips.still
  const head = ends(wire, hero as any, 'head', { clip, clipT: 0 }), torso = ends(wire, hero as any, 'torso', { clip, clipT: 0 })
  const wall = g.yard.rows.find(r => r.kind === 'wall')!
  const v = new T.Vector3()
  // As he is drawn this frame: how far his skin goes past his hips, and stands ahead of his middle line
  // (in the world, from the top of his head to his hips, carried on past them by his past), the most, and
  // the most of each band of his climb.across out from the line to either side (kept over every frame in
  // `bands`); and how far off the face that line stands, the least.
  const measure = () => {
    root.updateMatrixWorld(true)
    const lean = hero.data.lean, up = new T.Vector3(...lean.up), ahead = new T.Vector3(...lean.ahead), left = new T.Vector3().crossVectors(up, ahead)
    const toWorld = (p: number[]) => new T.Vector3(...hero.data.pos).addScaledVector(left, p[0]).addScaledVector(up, p[1]).addScaledVector(ahead, p[2])
    const top = toWorld(head.slice(3)), hips = toWorld(torso.slice(0, 3))
    const line = hips.clone().sub(top)
    let front = 0, past = 0
    const left0 = left.clone().normalize()
    root.traverse(o => {
      const mesh = o as THREE.SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      const si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight')
      for (let i = 0; i < si.count; i++) {
        let most = 0
        for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, most)) most = j
        const bone = mesh.skeleton.bones[si.getComponent(i, most)].name
        if (/(Arm|Hand|Leg|Foot|Toe|Shoulder)/.test(bone)) continue
        mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
        const s = v.clone().sub(top).dot(line) / line.lengthSq()
        past = Math.max(past, s - 1)
        const rel = v.clone().sub(top.clone().addScaledVector(line, Math.max(0, Math.min(1 + defs.player.climb.past, s))))
        front = Math.max(front, rel.dot(ahead))
        const band = Math.floor(Math.abs(rel.dot(left0)) / defs.player.climb.across)
        bands[band] = Math.max(bands[band] ?? -1, rel.dot(ahead))
      }
    })
    const off = Math.min(...Array.from({ length: 9 }, (_, n) => fromSurface(localTo(wall, top.clone().addScaledVector(line, (1 + defs.player.climb.past) * n / 8).toArray()))))
    return { front, past, off }
  }
  const bands: number[] = []
  const most: Record<string, { front: number; past: number; off: number }> = {}
  const keep = (as: string) => {
    const m = measure(), was = most[as] ?? { front: 0, past: 0, off: Infinity }
    most[as] = { front: Math.max(was.front, m.front), past: Math.max(was.past, m.past), off: Math.min(was.off, m.off) }
  }
  keep('still')
  // Each way for a second and a half, and the half second after letting go: how far he went each way.
  const went: Record<string, number> = {}
  for (const k of ['w', 's', 'a', 'd']) {
    const from = [...hero.data.pos]
    key('keydown', k)
    for (let i = 0; i < 90; i++) { await g.frames(1); keep(k) }
    key('keyup', k)
    for (let i = 0; i < 30; i++) { await g.frames(1); keep(k) }
    went[k] = vlen(vsub(hero.data.pos, from))
  }
  const all = Object.values(most), front: number[] = defs.player.climb.front
  const past = Math.max(...all.map(m => m.past))
  console.log('11 front', JSON.stringify({ most, went, bands: [...bands].map(b => +(b ?? -1).toFixed(4)) }))
  for (const k in went) expect(went[k]).toBeGreaterThan(0.3)
  expect(past).toBeLessThanOrEqual(defs.player.climb.past)
  // Every band his skin reaches is one of his, its skin no further ahead than its number, and within a
  // centimetre of it.
  expect(bands.length).toBe(front.length)
  bands.forEach((b, i) => {
    expect(b).toBeLessThanOrEqual(front[i])
    expect(b).toBeGreaterThan(front[i] - 0.01)
  })
  for (const m of all) expect(m.off).toBeGreaterThan(Math.max(...front))
})

// The bumpy slab's front: how far out it stands at a place across and up it (0 at its edges).
const bumpAt = (x: number, y: number) => {
  const k = defs.bumpy, [w, h] = k.size
  return k.height * Math.sin((2 * Math.PI * k.waves[0] * (x + w / 2)) / w) * Math.sin((2 * Math.PI * k.waves[1] * y) / h)
}

test('11a: the bumpy slab\'s net is a point on its surface for every corner of its mesh and a link for every edge, closed all round; its front rises and falls as its bumps do, every link over it turning within the bend he goes over', () => {
  const k = defs.bumpy
  const shape = bumps(k.size, k.cell, k.waves, k.height)
  const net = netOn(shape)
  const measure = signedTo(shape, k.cell)
  const [w, h, d] = k.size
  let front = 0, highest = -Infinity, lowest = Infinity
  for (let i = 0; i < net.points; i++) {
    const q = [...net.at.subarray(i * 3, i * 3 + 3)], o = [...net.out.subarray(i * 3, i * 3 + 3)]
    expect(Math.abs(measure(q))).toBeLessThan(1e-5)
    expect(measure(q.map((v, j) => v + o[j] * 0.01))).toBeGreaterThan(0)
    expect(measure(q.map((v, j) => v - o[j] * 0.01))).toBeLessThan(0)
    // On the front, where it stands out as far as its bumps put it there.
    if (q[2] > d / 2 - k.height - 1e-6 && Math.abs(q[0]) < w / 2 - 1e-6 && q[1] > 1e-6 && q[1] < h - 1e-6) {
      expect(q[2] - d / 2).toBeCloseTo(bumpAt(q[0], q[1]), 6)
      front++
      highest = Math.max(highest, q[2] - d / 2)
      lowest = Math.min(lowest, q[2] - d / 2)
    }
  }
  expect(highest).toBeCloseTo(k.height, 6)
  expect(lowest).toBeCloseTo(-k.height, 6)
  // Every link between two points of the front turns by no more than the bend he goes over.
  const onFront = (i: number) => net.at[i * 3 + 2] > d / 2 - k.height - 1e-6 && Math.abs(net.at[i * 3]) < w / 2 - 1e-6 && net.at[i * 3 + 1] > 1e-6 && net.at[i * 3 + 1] < h - 1e-6
  let turn = 0, links = 0
  for (let i = 0; i < net.points; i++) {
    for (const o of linked(net, i)) {
      if (o > i) links++
      if (!onFront(i) || !onFront(o)) continue
      turn = Math.max(turn, Math.acos(Math.min(1, vdot([...net.out.subarray(i * 3, i * 3 + 3)], [...net.out.subarray(o * 3, o * 3 + 3)]))))
    }
  }
  expect(Math.cos(turn)).toBeGreaterThan(defs.player.climb.bend)
  expect(net.points - links + net.tri.length / 3).toBe(2)
  console.log('11a', JSON.stringify({ points: net.points, links, front, turnDeg: (turn * 180) / Math.PI }))
})

// The top of a bump and the bottom of a dip, in the bumpy slab's own frame.
const BUMP = [-0.5, 4.5], DIP = [-0.5, 3.5]
const onBumps = (at: number[]) => [at[0], at[1], defs.bumpy.size[2] / 2 + bumpAt(at[0], at[1])]

test('11b: on the top of a bump and in the bottom of a dip he hangs still, framed on the surface, hands and feet on it within 1 mm, no two on one point, nothing of him in it', async () => {
  for (const at of [BUMP, DIP]) {
    const { g, hero, seen } = await heldOn(await start(), onBumps(at), 'bumpy')
    const points = [...g.p.client!.plugins.climb.touches(hero)!.values()].map((x: { point: number }) => x.point)
    expect(new Set(points).size).toBe(4)
    console.log('11b held', JSON.stringify(at), JSON.stringify(seen))
  }
})

test('11c: pushed right across the bumps and dips, he climbs over them, framed on the surface all the way, stepping in pairs, never sliding, nothing of him in it', async () => {
  const g = await start()
  const net = netOf(g.p.client!.plugins.wire, g.yard.rows.find(r => r.kind === 'bumpy')!)
  // From near the slab's left edge (his left, the start facing it), on the row of a bump's top: pushed
  // right he goes along +x, over bumps and dips (halfway up, the bumps neither rise nor fall across it).
  const r = await climbing(g, onBumps([-2, BUMP[1]]), ['d'], 360, 'bumpy')
  const turned = onTheShape(r)
  const well = climbedWell(r, net, 'bumps')
  const last = r.seen[r.seen.length - 1]
  const across = last.at[0] - r.from[0], rose = Math.max(...r.seen.map(s => s.at[2])) - Math.min(...r.seen.map(s => s.at[2]))
  console.log('11c', JSON.stringify({ across, rose, turned, ...well }))
  // At least `fan` of his speed along the surface, and across, the straight way, no less than 2/π of it;
  // and over the bumps, out and in.
  expect(Math.abs(across)).toBeGreaterThan(going(357) * defs.player.climb.fan * (2 / Math.PI))
  expect(rose).toBeGreaterThan(defs.bumpy.height)
})

// Held still on a moving shape (`kind`: a sliding or a tipping wall, on the middle of its face; a
// swinging ball, on its side) for a whole period: every frame framed on it, nothing of him in it, his
// hands and feet planted on their points, none stepping and none moving on it; and the shape carrying
// him: on it neither his hold nor his body moved (1 mm), and in the world his body went as far as the
// shape took the place he was on, at least as far as a whole period takes it from wherever it was in it
// (a sliding wall's reach; a tipping wall's tip, swung at his distance from its base; a ball's swing, at
// his distance from its pivot; a tube's bend, at his distance from its joint, held above it where all of
// the bend turns it). On it is where it is at rest, for a tube that bends. Or pushed the whole time
// (`keys`), climbing on it as it moves: every frame as above but stepping, as on a shape standing still
// (climb's step 4), and his hold going over it as fast (on a tube, up from below its joint to above it).
// Its `period` its definition's, or `period` seconds.
type Moving = 'slider' | 'tipper' | 'swinger' | 'tube'
async function carried(kind: Moving, period?: number, keys: string[] = []) {
  const g = await start()
  const k = g.shared[kind], was = k.period
  if (period !== undefined) k.period = period
  try {
    await carriedOn(g, kind, Math.round(k.period / DT), keys)
  } finally {
    k.period = was
  }
}
async function carriedOn(g: Game, kind: Moving, frames: number, keys: string[]) {
  const k = g.shared[kind] as any, still = !keys.length
  // Its net at rest (a tube's posed for each frame as it was bent then).
  const net = netOn(meshOf(k))
  // On a wall climbing, from low on it, so a period's climb stays on its face; on a tube held high, where
  // all of its bend turns him, or climbing from low across its joint.
  const want =
    kind === 'swinger' ? [0, 0, k.radius]
    : kind === 'tube' ? [0, still ? 7.2 : 2.5, k.radius]
    : [0, still ? 4 : 2.5, k.size[2] / 2]
  const r = await climbing(g, want, keys, frames, kind)
  const turned = onTheShape(r)
  const well = climbedWell(r, net, kind, still)
  const first = r.seen[0], last = r.seen[r.seen.length - 1]
  const on = (s: (typeof r.seen)[number]) => restOf(k, s.placed, s.pos)
  const there = (at: (typeof r.seen)[number]['placed'], p: number[]) => fromRest(k, at, p)
  // On a tube held still, above all of its joint's mixing.
  if (kind === 'tube' && still) expect(on(first)[1]).toBeGreaterThan(k.bends.at + k.bends.over)
  if (still) for (const s of r.seen) {
    expect(vlen(vsub(s.at, first.at))).toBeLessThanOrEqual(0.001)
    expect(vlen(vsub(on(s), on(first)))).toBeLessThanOrEqual(0.001)
  }
  // How far his body went in the world, less how far it went on the wall: what the wall took him; and
  // how far the wall took the place he was on at first, the most.
  const went = Math.max(...r.seen.map(s => vlen(vsub(vsub(s.pos, first.pos), vsub(there(s.placed, on(s)), there(s.placed, on(first)))))))
  const took = Math.max(...r.seen.map(s => vlen(vsub(there(s.placed, on(first)), first.pos))))
  const least =
    kind === 'slider' ? k.reach
    : kind === 'tipper' ? 2 * vlen(on(first)) * Math.sin(k.tip / 2)
    : kind === 'swinger' ? 2 * vlen(vsub(on(first), [0, k.length, 0])) * Math.sin(k.swing / 2)
    : 2 * vlen(vsub(on(first), [0, k.bends.at, 0])) * Math.sin(k.most / 2)
  // How far his hold went over it: each frame from where it was to where it is, both on it as it stands
  // that frame (bent as it is then).
  let path = 0
  r.seen.forEach((s, i) => { path += vlen(vsub(there(s.placed, s.at), there(s.placed, i ? r.seen[i - 1].at : r.from))) })
  console.log('12 carried', JSON.stringify({ kind, frames, period: k.period, keys, went, took, least, path, last: last.at, turned, ...well }))
  expect(Math.abs(went - took)).toBeLessThanOrEqual(0.001)
  // Climbing a tube from below its joint, where the bend does not move what he starts on: on up over the
  // joint, past all of its mixing, as it bends.
  if (kind === 'tube' && !still) expect(last.at[1]).toBeGreaterThan(k.bends.at + k.bends.over)
  else expect(took).toBeGreaterThan(least - 0.001)
  if (!still) expect(path).toBeGreaterThan(going(frames - 3) * 0.95)
}

test('12a: held still on a wall sliding to and fro along its width, he is carried with it, his hands and feet planted, framed on it, nothing of him in it', async () => {
  await carried('slider')
})

test('12b: the same, the wall sliding four times as fast (there and back in 3 s, 2.1 m/s at its fastest); and pushed up on it so, he climbs up it as it slides, stepping in pairs on it, never sliding over it, nothing of him in it', async () => {
  await carried('slider', 3)
  await carried('slider', 3, ['w'])
})

test('12c: held still on a wall tipping back and forth about its base, he is carried with it, his body turning with it, his hands and feet planted, framed on it, nothing of him in it; and pushed up on it, he climbs up it as it tips', async () => {
  await carried('tipper')
  await carried('tipper', undefined, ['w'])
})

test('12d: held still on the side of a ball swinging under a pivot, he is carried with it, his body turning with it, his hands and feet planted, framed on it, nothing of him in it; and pushed right, he climbs round it as it swings', async () => {
  await carried('swinger')
  await carried('swinger', undefined, ['d'])
})

test('12e: a tube standing up bends at its joint: every corner of its mesh, bent and taken back, is where it was; the page draws it bent as its row is, and its net is the bent mesh\'s; held still high on it, he is carried with it as it bends, his body turning with it, his hands and feet planted, framed on it, nothing of him in it; and pushed up from below its joint, he climbs up over the joint as it bends', async () => {
  const k = defs.tube
  const mesh = meshOf(k)
  let back = 0, moved = 0
  for (const bend of [-k.most, -0.2, 0.3, k.most]) for (let i = 0; i < mesh.position.length; i += 3) {
    const p = mesh.position.slice(i, i + 3), q = bent(k.bends, bend, p)
    back = Math.max(back, vlen(vsub(unbent(k.bends, bend, q), p)))
    moved = Math.max(moved, vlen(vsub(q, p)))
  }
  expect(back).toBeLessThan(1e-9)
  // Bent all the way, the rim of its top went furthest: its distance from the joint, swung by the bend.
  expect(moved).toBeCloseTo(2 * Math.hypot(k.length - k.bends.at, k.radius) * Math.sin(k.most / 2), 6)
  // Drawn as the page's copy of its row is bent, a quarter of a period in.
  const g = await start()
  await g.frames(Math.round(k.period / 4 / DT))
  const plugins = g.p.client!.plugins
  const row = plugins.wire.rows.find(r => r.kind === 'tube')!
  expect(Math.abs(row.data.bend)).toBeGreaterThan(k.most * 0.9)
  const drawn = plugins.render3d.scene.getObjectByName('tube') as THREE.Mesh
  const at = drawn.geometry.getAttribute('position')
  let off = 0
  for (let i = 0; i < at.count; i++) off = Math.max(off, vlen(vsub([at.getX(i), at.getY(i), at.getZ(i)], bent(k.bends, row.data.bend, mesh.position.slice(i * 3, i * 3 + 3)))))
  expect(off).toBeLessThan(1e-5)
  // Its net, as the rules and the page read it, is that bent mesh's: a point at each of its corners, each
  // way out the faces round it.
  const net = netOf(plugins.wire, row), fresh = netOn({ position: Array.from({ length: at.count * 3 }, (_, i) => at.array[i]), index: mesh.index })
  expect(net.points).toBe(fresh.points)
  let apart = 0, turned = 0
  for (let i = 0; i < net.points; i++) {
    apart = Math.max(apart, vlen(vsub([...net.at.subarray(i * 3, i * 3 + 3)], [...fresh.at.subarray(i * 3, i * 3 + 3)])))
    turned = Math.max(turned, 1 - vdot([...net.out.subarray(i * 3, i * 3 + 3)], [...fresh.out.subarray(i * 3, i * 3 + 3)]))
  }
  expect(apart).toBeLessThan(1e-5)
  expect(turned).toBeLessThan(1e-6)
  // Read off that net as the page reads it (climb's `fromNet`, part by part) as the mesh, bent, measures
  // it: at places in and out of it near every point, and moved along it, within a box of it.
  const measure = signedTo({ position: Array.from({ length: at.count * 3 }, (_, i) => at.array[i]), index: mesh.index }, 0.1)
  let differs = 0, read = 0
  for (let i = 0; i < net.points; i++) for (const by of [-0.06, -0.01, 0.02, 0.07]) for (const along of [0, 0.09]) {
    const o = [...net.out.subarray(i * 3, i * 3 + 3)], side = vcross(o, Math.abs(o[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])
    const p = [0, 1, 2].map(k => net.at[i * 3 + k] + o[k] * by + side[k] * along / (vlen(side) || 1))
    const want = measure(p)
    if (Math.abs(want) >= 0.1) continue
    differs = Math.max(differs, Math.abs(fromNet(net, p).by - want))
    read++
  }
  console.log('12e bent', JSON.stringify({ back, moved, bend: row.data.bend, off, apart, turned, differs, read }))
  expect(differs).toBeLessThan(1e-5)
  await carried('tube')
  await carried('tube', undefined, ['w'])
})