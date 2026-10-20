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
import { box, heldPoint, heldWay, linked, netOf, netOn, spotOn } from './plugins/climb/climb.sim.ts'
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
// bone it is bound to most; and the deepest of the vertices bound most to a shin, a foot or a toe, and
// of all the others but the hands, whose touch is their own; and the height of his lowest vertex.
function against(g: Game) {
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const wall = g.yard.rows.find(r => r.kind === 'wall')!
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
    const si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight')
    for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
      lowest = Math.min(lowest, v.y)
      // Into the wall's own frame.
      const local = localTo(wall, [v.x, v.y, v.z])
      const d = fromSurface(local)
      let most = 0
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, most)) most = k
      const bone = mesh.skeleton.bones[si.getComponent(i, most)].name
      for (const side of ['L', 'R'] as const) if (new RegExp(`${side === 'L' ? 'Left' : 'Right'}(Foot|Toe)`).test(bone)) soles[side] = Math.min(soles[side], d)
      for (const side of ['L', 'R'] as const) {
        if (!bone.includes(side === 'L' ? 'LeftHand' : 'RightHand')) continue
        hands[side] = Math.min(hands[side], d)
        const e = extent[side]
        extent[side] = [Math.min(e[0], local[0]), Math.max(e[1], local[0]), Math.min(e[2], local[1]), Math.max(e[3], local[1])]
      }
      if (-d > deepest.depth) deepest = { depth: -d, bone }
      if (/(Left|Right)(Leg|Foot|Toe)/.test(bone)) { if (-d > feet.depth) feet = { depth: -d, bone } }
      else if (!/(Left|Right)Hand/.test(bone) && -d > rest.depth) rest = { depth: -d, bone }
    }
  })
  return { hands, soles, extent, deepest, feet, rest, lowest }
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

// The hero held on the face at `want`, settled, then `keys` held down for `frames` frames: each frame
// where his hold is (in the wall's frame), where his root is, and his skin against the wall.
async function climbing(g: Game, want: number[], keys: string[], frames: number) {
  await g.frames(30)
  const { wall, hero } = putOn(g, want)
  await g.frames(60)
  const wire = g.p.client!.plugins.wire
  // Where his hold is, in the wall's own frame.
  const spot = () => localTo(wall, spotOn(wire, wall, hero.data.hold).at)
  const from = spot()
  for (const k of keys) key('keydown', k)
  const limbs = defs.player.climb.limbs as Record<string, { touch: string[] }>
  type Seen = {
    at: number[]; pos: number[]; m: ReturnType<typeof against>
    touches: Record<string, { point: number; step?: { from: number; to: number; s: number }; room?: number }>
    middles: Record<string, THREE.Vector3>; short: number[]
  }
  const seen: Seen[] = []
  for (let i = 0; i < frames; i++) {
    await g.frames(1)
    expect(hero.data.hold).not.toBeNull()
    const touches = Object.fromEntries([...(g.p.client!.plugins.climb.touches(hero) ?? [])].map(([n, t]) => [n, { point: t.point, step: t.step && { ...t.step }, room: t.room }]))
    const middles = Object.fromEntries(Object.entries(limbs).map(([n, l]) => [n, middleOf(g, l)]))
    seen.push({ at: spot(), pos: [...hero.data.pos], m: against(g), touches, middles, short: g.p.client!.plugins.ik3d.short(hero.id) ?? [] })
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
  // angle its clip has, no point within it is in reach, so the hand lets go and stands as its clip has
  // it; its elbow never goes under the limit.
  const shared = g.shared.player.climb.limbs.handL
  const was = shared.bend
  await g.frames(1)
  const bent = read().handL.angle
  plugins.ik3d.unbend(hero.id)
  const clipped = read().handL.angle
  const least = (bent + clipped) / 2
  shared.bend = [least, 178]
  try {
    for (let i = 0; i < 10; i++) {
      await g.frames(1)
      expect(read().handL.angle).toBeGreaterThanOrEqual(least - 0.01)
    }
    expect(plugins.climb.touches(hero).has('handL')).toBe(false)
    console.log('3f bitten', JSON.stringify({ bent, clipped, least, angle: read().handL.angle }))
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

// Every frame of a climb, step 4's: none gives up its point; never two groups stepping at once; a planted
// hand or foot on its point, its skin out from the face, within 1 mm, reached (ik3d short under 1 mm), and
// not moved since the last frame (1 mm); one in a step off the face (in the wall's frame) by no more than
// its skin, the lift and 1 cm and never into it, landing on the point it stepped to. And every limb steps,
// lifting off the face by at least half the lift. How many steps each took, and how high each lifted.
function climbedWell(r: Awaited<ReturnType<typeof climbing>>, net: ReturnType<typeof netOf>, what: string) {
  const d = defs.wall.size[2] / 2
  // Where a point puts where a limb touches: on the front face, its skin out, in the world.
  const on = (point: number, skin: number) => heldPoint(r.wall, [net.at[point * 3], net.at[point * 3 + 1], net.at[point * 3 + 2] + skin])
  const steps: Record<string, number> = Object.fromEntries(LIMBS.map(n => [n, 0]))
  const lifted: Record<string, number> = Object.fromEntries(LIMBS.map(n => [n, 0]))
  r.seen.forEach((s, i) => {
    for (const name of LIMBS) expect(s.touches[name]).toBeDefined()
    const groups = new Set(LIMBS.filter(n => s.touches[n].step).map(n => limbOf(n).group))
    if (groups.size > 1) console.log('turns', what, i, JSON.stringify(r.seen.slice(Math.max(0, i - 12), i + 1).map(f => Object.fromEntries(LIMBS.map(n => [n, `${f.touches[n].point}${f.touches[n].step ? `>${f.touches[n].step!.to}@${f.touches[n].step!.s.toFixed(2)}` : ''} ${f.touches[n].room?.toFixed(3)}`])))))
    expect(groups.size).toBeLessThanOrEqual(1)
    LIMBS.forEach((name, j) => {
      const t = s.touches[name], skin = limbOf(name).skin, mid = s.middles[name]
      if (!t.step) {
        const want = on(t.point, skin)
        expect(Math.hypot(mid.x - want[0], mid.y - want[1], mid.z - want[2])).toBeLessThanOrEqual(0.001)
        expect(s.short[j]).toBeLessThan(0.001)
        const was = r.seen[i - 1]?.touches[name]
        if (was && !was.step && was.point === t.point) expect(mid.distanceTo(r.seen[i - 1].middles[name])).toBeLessThanOrEqual(0.001)
      } else {
        const off = localTo(r.wall, mid.toArray())[2] - d
        expect(off).toBeLessThanOrEqual(skin + defs.player.climb.step.lift + 0.01)
        expect(off).toBeGreaterThanOrEqual(skin - 0.001)
        lifted[name] = Math.max(lifted[name], off - skin)
        const next = r.seen[i + 1]?.touches[name]
        if (next && !next.step) {
          expect(next.point).toBe(t.step.to)
          steps[name]++
        }
      }
    })
  })
  for (const name of LIMBS) {
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
  const g = await tilted(t.pitch, t.high)
  const { wall, hero } = putOn(g, t.at)
  await g.frames(60)
  const plugins = g.p.client!.plugins
  const T = plugins.render3d.THREE as typeof THREE
  const root: THREE.Object3D = plugins.anim.model(hero.id)
  const out = new T.Vector3(...heldWay(wall, [0, 0, 1]))
  for (let i = 0; i < 60; i++) {
    await g.frames(1)
    root.updateMatrixWorld(true)
    const turn = root.getWorldQuaternion(new T.Quaternion())
    expect(new T.Vector3(0, 0, 1).applyQuaternion(turn).angleTo(out.clone().negate())).toBeLessThan(Math.PI / 180)
    expect(Math.abs(new T.Vector3(0, 1, 0).applyQuaternion(turn).dot(out))).toBeLessThan(Math.sin(Math.PI / 180))
    const m = against(g)
    for (const side of ['L', 'R'] as const) {
      expect(Math.abs(m.hands[side])).toBeLessThanOrEqual(0.001)
      expect(Math.abs(m.soles[side])).toBeLessThanOrEqual(0.001)
    }
    expect(m.rest.depth).toBeLessThanOrEqual(0.001)
    expect(m.feet.depth).toBeLessThanOrEqual(0.001)
  }
  return { g, hero, wall }
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
