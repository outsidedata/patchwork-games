// The yard, booted as the server boots it and drawn by a page as `index.html` makes it, on node with no
// renderer: what its wall is on the rows and as the page draws it.
import { expect, test, vi } from 'vitest'
import type * as THREE from 'three'
import { boot, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
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
  return { truth, yard, p, frames }
}

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
