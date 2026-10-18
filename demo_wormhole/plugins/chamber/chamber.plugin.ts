// The browser half of chamber: draws the `chamber` row's level on render3d's scene, the first frame the
// row is there, and the light the level is seen by. Every number is the chamber's definition in
// `assets/demo_wormhole.json`:
//   surfaces  each surface by name. A baked one, with a library `set`, is the maps `surfaces/panels.py`
//             bakes from it (`maps.colour`, `maps.normal`, `maps.roughness`, catalogue `texture`
//             entries, and `glow.map` for one that glows), laid on a square of `tile` metres; a plain
//             one is a `colour` and a `roughness`. Each has its `metalness`, and `reflect`, how much of
//             the level's reflection (below) it takes; one with a `glow` and `power` shines that colour
//             at that power, past 1 brighter than white, so render3d's bloom takes it.
//   strip     the `glow` and `power` of the level's light strips.
//   env       the level's reflection: the level seen from its `probe`, its boxes and ramps in `walls`,
//             its strips shining, on `background`, at `size` texels a side, from `near` to `far`
//             metres, made once render3d has a renderer and laid on the scene's `environment`, so every
//             surface reflects the strips and the walls round it.
//   haze      the scene's fog, `colour` at `density` per metre.
// A level's boxes and ramps are drawn in their `surface`, a baked surface's panels laid on the world
// (`panelled`), so a panel's seam runs on from one box to the next; its `strips`, boxes from `min` to
// `max` that nothing stands on or meets, are drawn shining, casting no shadow. Every box and ramp casts
// and takes shadows.
//
// For the kinds' looks, which draw in the chamber's surfaces too: `surfaced(plugins, name, surface?)`
// is a dressed material of surface `name` (`surface` handed to render3d's `dress` with it), its maps
// laid on as they land; `panelled(three, geometry, tile, at?)` writes a geometry's uvs off its
// positions moved by `at`, each face along the two axes it lies across, `tile` metres to 1;
// `surfaceOf(plugins, name)` is the surface's entry; `glowing(material, glow)` makes a material shine
// a `{ glow, power }`, or not at all for null. `close` takes off and disposes what it made.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { levelOf } from './chamber.sim.ts'

export type Glow = { glow: string; power: number }
type Maps = { colour: string; normal: string; roughness: string }
export type Surface = {
  set?: string; tile?: number; maps?: Maps; glow?: string | { map: string; colour: string; power: number }; power?: number
  colour?: string; roughness?: number; metalness: number; reflect: number
}
type Piece = { min: number[]; max: number[]; surface: string; toward?: [number, number] }
type Level = { boxes: Piece[]; ramps: Piece[]; strips: Piece[]; probe: number[] }

const chamberDef = (plugins: Plugins) => def(plugins.wire, 'chamber')

export const surfaceOf = (plugins: Plugins, name: string): Surface => {
  const found = chamberDef(plugins).surfaces[name]
  if (!found) throw new Error(`chamber has no surface ${name}`)
  return found
}

export function glowing(material: THREE.MeshStandardMaterial, glow: Glow | null) {
  if (glow) material.emissive.set(glow.glow)
  else material.emissive.setRGB(0, 0, 0)
  material.emissiveIntensity = glow ? glow.power : 1
}

export function surfaced(plugins: Plugins, name: string, surface?: object): THREE.MeshStandardMaterial {
  const s = surfaceOf(plugins, name)
  const three = plugins.render3d.THREE as typeof THREE
  const material = new three.MeshStandardMaterial({ metalness: s.metalness, envMapIntensity: s.reflect })
  const lay = (entry: string, put: (t: THREE.Texture) => void) => {
    plugins.loader.load(entry).then((t: THREE.Texture) => { put(t); material.needsUpdate = true }, () => {})
  }
  if (s.maps) {
    material.roughness = 1
    lay(s.maps.colour, t => { material.map = t })
    lay(s.maps.normal, t => { material.normalMap = t })
    lay(s.maps.roughness, t => { material.roughnessMap = t })
  } else {
    material.color.set(s.colour!)
    material.roughness = s.roughness!
  }
  if (typeof s.glow === 'object') {
    const { map, colour, power } = s.glow
    glowing(material, { glow: colour, power })
    lay(map, t => { material.emissiveMap = t })
  } else if (s.glow) glowing(material, { glow: s.glow, power: s.power! })
  return plugins.render3d.dress(material, surface ? { surface } : undefined)
}

export function panelled(three: typeof THREE, geometry: THREE.BufferGeometry, tile: number, at: number[] = [0, 0, 0]) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal')
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + at[0], y = p.getY(i) + at[1], z = p.getZ(i) + at[2]
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i))
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y]
    uv[i * 2] = u / tile
    uv[i * 2 + 1] = v / tile
  }
  geometry.setAttribute('uv', new three.BufferAttribute(uv, 2))
}

// A ramp's wedge as triangles, its six corners: the low edge on the base, the high edge at the top,
// each triangle wound to face out of the wedge, away from its middle, so it is lit on the side seen.
function wedge(three: typeof THREE, r: Piece) {
  const [tx, tz] = r.toward!
  const [x0, y0, z0] = r.min, [x1, y1, z1] = r.max
  const corner = (x: number, z: number, high: boolean) => [x, high ? y1 : y0, z]
  const highAt = (x: number, z: number) => (x - (tx + tz > 0 ? x0 : x1)) * tx + (z - (tx + tz > 0 ? z0 : z1)) * tz > 0
  const quad = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
  const top = quad.map(([x, z]) => corner(x, z, highAt(x, z)))
  const base = quad.map(([x, z]) => corner(x, z, false))
  const faces = [
    [top[0], top[1], top[2]], [top[0], top[2], top[3]],
    [base[0], base[2], base[1]], [base[0], base[3], base[2]],
    ...[0, 1, 2, 3].flatMap(i => {
      const j = (i + 1) % 4
      return [[base[i], base[j], top[j]], [base[i], top[j], top[i]]]
    }),
  ]
  // The wedge's middle, the mean of its six corners: the base's four and the high edge's two.
  const six = [...base, ...top.filter(p => p[1] === y1)]
  const middle = six.reduce((m, p) => m.add(new three.Vector3().fromArray(p)), new three.Vector3()).divideScalar(six.length)
  const [a, b, c, n] = [new three.Vector3(), new three.Vector3(), new three.Vector3(), new three.Vector3()]
  // A face of no area (a side wedge's edge where the top meets the base) is left out.
  const out = faces.filter(([p, q, s]) => {
    n.crossVectors(b.fromArray(q).sub(a.fromArray(p)), c.fromArray(s).sub(a))
    return n.lengthSq() > 0
  }).map(([p, q, s]) => {
    n.crossVectors(b.fromArray(q).sub(a.fromArray(p)), c.fromArray(s).sub(a))
    const centre = a.fromArray(p).add(b.fromArray(q)).add(c.fromArray(s)).divideScalar(3)
    return n.dot(centre.sub(middle)) < 0 ? [p, s, q] : [p, q, s]
  })
  const geometry = new three.BufferGeometry().setAttribute('position', new three.Float32BufferAttribute(out.flat(2), 3))
  geometry.computeVertexNormals()
  return geometry
}

const slab = (three: typeof THREE, b: Piece) => {
  const size = [0, 1, 2].map(i => b.max[i] - b.min[i])
  return { geometry: new three.BoxGeometry(size[0], size[1], size[2]), at: [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2) }
}

export function chamber() {
  let made: (THREE.Mesh)[] | undefined
  let scene: THREE.Scene | undefined
  let level: Level | undefined
  let reflection: THREE.WebGLRenderTarget | undefined
  return {
    tick(plugins: Plugins) {
      const three = plugins.render3d.THREE as typeof THREE
      if (!made) {
        const row = plugins.wire.rows.find(r => r.kind === 'chamber')
        if (!row) return
        const d = def(plugins.wire, row.kind)
        level = levelOf(row, d) as unknown as Level
        made = []
        const solid = (geometry: THREE.BufferGeometry, name: string, at: number[]) => {
          const s = surfaceOf(plugins, name)
          if (s.tile) panelled(three, geometry, s.tile, at)
          const mesh = new three.Mesh(geometry, surfaced(plugins, name))
          mesh.position.fromArray(at)
          mesh.castShadow = true
          mesh.receiveShadow = true
          made!.push(mesh)
        }
        for (const b of level.boxes) {
          const { geometry, at } = slab(three, b)
          solid(geometry, b.surface, at)
        }
        for (const r of level.ramps) solid(wedge(three, r), r.surface, [0, 0, 0])
        const shine = new three.Color(d.strip.glow).multiplyScalar(d.strip.power)
        for (const s of level.strips) {
          const { geometry, at } = slab(three, s)
          const mesh = new three.Mesh(geometry, new three.MeshBasicMaterial({ color: shine }))
          mesh.position.fromArray(at)
          made.push(mesh)
        }
        scene = plugins.render3d.scene
        scene!.add(...made)
        scene!.fog = new three.FogExp2(d.haze.colour, d.haze.density)
      }
      const renderer: THREE.WebGLRenderer | undefined = plugins.render3d.renderer
      if (reflection || !renderer || !level) return
      const { env, strip } = chamberDef(plugins)
      const room = new three.Scene()
      room.background = new three.Color(env.background)
      const walls = new three.MeshBasicMaterial({ color: env.walls })
      const shine = new three.MeshBasicMaterial({ color: new three.Color(strip.glow).multiplyScalar(strip.power) })
      const parts: THREE.BufferGeometry[] = []
      for (const b of [...level.boxes, ...level.strips]) {
        const { geometry, at } = slab(three, b)
        const mesh = new three.Mesh(geometry, level.strips.includes(b) ? shine : walls)
        mesh.position.fromArray(at)
        room.add(mesh)
        parts.push(geometry)
      }
      for (const r of level.ramps) {
        const geometry = wedge(three, r)
        room.add(new three.Mesh(geometry, walls))
        parts.push(geometry)
      }
      const generator = new three.PMREMGenerator(renderer)
      reflection = generator.fromScene(room, 0, env.near, env.far, { size: env.size, position: new three.Vector3().fromArray(level.probe) })
      generator.dispose()
      for (const g of parts) g.dispose()
      walls.dispose()
      shine.dispose()
      scene!.environment = reflection.texture
    },
    close() {
      if (!made) return
      scene?.remove(...made)
      for (const o of made) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
      if (scene) {
        scene.fog = null
        scene.environment = null
      }
      reflection?.dispose()
    },
  }
}
