// chamber's browser half on a page of the gym, as dev.html enters it, with no canvas: every box and
// ramp of the level is drawn in its surface, casting and taking shadows; a baked surface's maps are
// the loader's and are laid on the world, so each vertex's uv is its world place along the face's two
// axes over the surface's tile, and a seam runs on from one box to the next; each strip shines its
// definition's glow at its power and casts no shadow; the scene's fog is the haze; every face of a
// ramp faces out of it. Every number is read off the definitions.
import { expect, test } from 'vitest'
import type * as THREE from 'three'
import { boot, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { sim } from '../../demo_wormhole.sim.ts'
import file from '../../demo_wormhole.scene.json' with { type: 'json' }
import defs from '../../assets/demo_wormhole.json' with { type: 'json' }

const here = new URL('../../', import.meta.url).href
const DT = file.prefabs.engine.dt
const chamber = defs.chamber
const level = chamber.levels.gym
type Surface = (typeof chamber.surfaces)[keyof typeof chamber.surfaces]
const surfaces = chamber.surfaces as Record<string, Surface & { maps?: Record<string, string>; tile?: number }>
// The player plugin listens on the page, and node has none.
;(globalThis as any).addEventListener = () => {}
;(globalThis as any).removeEventListener = () => {}

async function gym() {
  const scene = structuredClone(file) as unknown as Scene
  scene.prefabs.scenemanager.entry = 'gym'
  const truth = boot(scene, sim)
  await load(truth, here)
  const page = view(link(loopback(accept(manager(truth)))), scene, here, () => {})
  for (let i = 0; i < 6; i++) {
    truth.step(DT)
    await page.frame()
  }
  const plugins = page.client!.plugins
  const meshes: THREE.Mesh[] = []
  plugins.render3d.scene.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
  return { page, plugins, meshes }
}

const centre = (b: { min: number[]; max: number[] }) => [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2)
const at = (m: THREE.Mesh, p: number[]) => [0, 1, 2].every(i => Math.abs(m.position.getComponent(i) - p[i]) < 1e-9)
const boxAt = (meshes: THREE.Mesh[], b: { min: number[]; max: number[] }) => {
  const size = [0, 1, 2].map(i => b.max[i] - b.min[i])
  return meshes.find(m => {
    const g = m.geometry as THREE.BoxGeometry
    return g.type === 'BoxGeometry' && at(m, centre(b)) && [g.parameters.width, g.parameters.height, g.parameters.depth].every((v, i) => Math.abs(v - size[i]) < 1e-9)
  })
}

test('every box of the level is drawn in its surface, its baked maps the loader\'s laid on the world, casting and taking shadows', async () => {
  const { plugins, meshes } = await gym()
  for (const b of level.boxes) {
    const mesh = boxAt(meshes, b)
    expect(mesh, `a box at ${centre(b)}`).toBeDefined()
    const s = surfaces[b.surface]
    const material = mesh!.material as THREE.MeshStandardMaterial
    expect(material.isMeshStandardMaterial).toBe(true)
    expect(material.metalness).toBe(s.metalness)
    expect(material.envMapIntensity).toBe(s.reflect)
    expect(mesh!.castShadow && mesh!.receiveShadow).toBe(true)
    if (!s.maps) continue
    expect(material.map).toBe(plugins.loader.get(s.maps.colour))
    expect(material.normalMap).toBe(plugins.loader.get(s.maps.normal))
    expect(material.roughnessMap).toBe(plugins.loader.get(s.maps.roughness))
    // Each vertex's uv is its world place over the tile, along the two axes its face lies across, to
    // the 32-bit floats three keeps uvs in (10 µm on the level's few tens of metres).
    const p = mesh!.geometry.getAttribute('position'), n = mesh!.geometry.getAttribute('normal'), uv = mesh!.geometry.getAttribute('uv')
    for (let i = 0; i < p.count; i++) {
      const world = [p.getX(i) + mesh!.position.x, p.getY(i) + mesh!.position.y, p.getZ(i) + mesh!.position.z]
      const axis = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))].indexOf(1)
      const [u, v] = axis === 1 ? [world[0], world[2]] : axis === 0 ? [world[2], world[1]] : [world[0], world[1]]
      expect(uv.getX(i) * s.tile!).toBeCloseTo(u, 5)
      expect(uv.getY(i) * s.tile!).toBeCloseTo(v, 5)
    }
  }
  // The box a portal refuses is drawn in a surface of its own, not the one a portal takes.
  const dark = level.boxes.find(b => 'dark' in b && b.dark)!
  const taken = level.boxes.find(b => !('dark' in b))!
  expect((boxAt(meshes, dark)!.material as THREE.MeshStandardMaterial).map).not.toBe((boxAt(meshes, taken)!.material as THREE.MeshStandardMaterial).map)
})

test('each strip shines its glow at its power and casts no shadow, and the scene\'s fog is the haze', async () => {
  const { plugins, meshes } = await gym()
  for (const s of level.strips) {
    const mesh = boxAt(meshes, s)
    expect(mesh, `a strip at ${centre(s)}`).toBeDefined()
    const material = mesh!.material as THREE.MeshBasicMaterial
    expect(material.isMeshBasicMaterial).toBe(true)
    const want = new (plugins.render3d.THREE as typeof THREE).Color(chamber.strip.glow).multiplyScalar(chamber.strip.power)
    expect(material.color.equals(want)).toBe(true)
    expect(mesh!.castShadow).toBe(false)
  }
  const fog = plugins.render3d.scene.fog as THREE.FogExp2
  expect(fog.color.getHexString()).toBe(chamber.haze.colour.slice(1))
  expect(fog.density).toBe(chamber.haze.density)
})

test('every face of a ramp faces out of its wedge, so the side seen is the side lit', async () => {
  const { plugins, meshes } = await gym()
  const ramp = level.ramps[0]
  // The level's one mesh that is not a box, in the ramp's surface.
  const mesh = meshes.find(m => m.geometry.type === 'BufferGeometry' && (m.material as THREE.MeshStandardMaterial).map === plugins.loader.get(surfaces[ramp.surface].maps!.colour))!
  expect(mesh).toBeDefined()
  expect(mesh.castShadow && mesh.receiveShadow).toBe(true)
  const p = mesh.geometry.getAttribute('position')
  // The wedge's middle: below its slope, inside it.
  const inside = [(ramp.min[0] + ramp.max[0]) / 2, ramp.min[1] + (ramp.max[1] - ramp.min[1]) / 4, (ramp.min[2] + ramp.max[2]) / 2]
  for (let t = 0; t < p.count; t += 3) {
    const [a, b, c] = [t, t + 1, t + 2].map(i => [p.getX(i), p.getY(i), p.getZ(i)])
    const e1 = [0, 1, 2].map(i => b[i] - a[i]), e2 = [0, 1, 2].map(i => c[i] - a[i])
    const normal = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const mid = [0, 1, 2].map(i => (a[i] + b[i] + c[i]) / 3 - inside[i])
    expect(normal[0] * mid[0] + normal[1] * mid[1] + normal[2] * mid[2]).toBeGreaterThan(0)
  }
})
