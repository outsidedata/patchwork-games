// The yard, booted as the server boots it and drawn by a page as `index.html` makes it, on node with no
// renderer: what its wall is on the rows and as the page draws it.
import { expect, test, vi } from 'vitest'
import type * as THREE from 'three'
import { boot, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { prepared } from '#plugins/loader/loader.sim.ts'
import { box, linked, netOf, netOn, spotOn } from './plugins/climb/climb.sim.ts'
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

// How far a point of the wall's own frame is from the box's surface: 0 on it, negative inside it.
function fromSurface(p: ArrayLike<number>) {
  const [w, h, d] = defs.wall.size
  const q = [Math.abs(p[0]) - w / 2, Math.abs(p[1] - h / 2) - h / 2, Math.abs(p[2]) - d / 2]
  const outside = Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0))
  return outside > 0 ? outside : Math.max(q[0], q[1], q[2])
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
  expect([...new Set(yard.rows.map(r => r.kind))].sort()).toEqual(['loader', 'player', 'scenemanager', 'skydome3d', 'start', 'wall'])
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

// The hero put on the point of the wall's net nearest `want` (in the wall's own frame), holding grip,
// as a hold its rule keeps: from that point toward its first link, at 0.
function putOn(g: Game, want: number[]) {
  const wall = g.yard.rows.find(r => r.kind === 'wall')!
  const hero = g.yard.rows.find(r => r.kind === 'player')!
  const net = netOf(g.p.client!.plugins.wire, wall)
  let a = 0, far = Infinity
  for (let i = 0; i < net.points; i++) {
    const d = Math.hypot(net.at[i * 3] - want[0], net.at[i * 3 + 1] - want[1], net.at[i * 3 + 2] - want[2])
    if (d < far) { far = d; a = i }
  }
  Object.assign(hero.data, { hold: { on: wall.id, a, b: linked(net, a)[0], t: 0 }, gripping: true, grip: 1 })
  return { wall, hero, a }
}

// The hero's skin as the page draws it, against the wall: each vertex's distance from the wall's
// surface (negative inside), each hand's nearest to it, and the deepest any vertex is inside and the
// bone it is bound to most.
function against(g: Game) {
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const wall = g.yard.rows.find(r => r.kind === 'wall')!
  const hero = g.yard.rows.find(r => r.kind === 'player')!
  const root: THREE.Object3D = plugins.anim.model(hero.id)
  root.updateMatrixWorld(true)
  const [x, y, z] = wall.data.pos
  const c = Math.cos(wall.data.yaw), s = Math.sin(wall.data.yaw)
  const hands: Record<'L' | 'R', number> = { L: Infinity, R: Infinity }
  let deepest = { depth: 0, bone: '' }
  const v = new T.Vector3()
  root.traverse(o => {
    const mesh = o as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    const si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight')
    for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
      // Into the wall's own frame.
      const dx = v.x - x, dz = v.z - z
      const d = fromSurface([dx * c - dz * s, v.y - y, dx * s + dz * c])
      let most = 0
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, most)) most = k
      const bone = mesh.skeleton.bones[si.getComponent(i, most)].name
      for (const side of ['L', 'R'] as const) if (bone.includes(side === 'L' ? 'LeftHand' : 'RightHand')) hands[side] = Math.min(hands[side], d)
      if (-d > deepest.depth) deepest = { depth: -d, bone }
    }
  })
  return { hands, deepest }
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
  console.log('1c', JSON.stringify({ pos: hero.data.pos, clip: hero.data.clip, ...against(g) }))
})
