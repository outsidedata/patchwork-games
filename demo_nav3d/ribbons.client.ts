// The web of ribbons: each ribbon of the loader's `shape` entry (`assets/ribbons.json`, written by
// `assets/web.nav.ts`) a slab along its points from the rim of one hub's disc to the rim of the other's,
// `width` across and `thickness` through, its up face in
// its colour of `colours` in turn and the face under it in `under`, so a half turn shows the colours
// swap; and each hub a disc of `radius`, `disc` through, thicker than the ribbons so it covers
// where they meet, in `discs`. All of it in `roughness`, casting the people's shadows and taking them. The shape is
// preloaded, and `loader.get` hands it back once it has landed, so the web is made the first frame it
// has. Dressed by render3d; it never moves, so render3d never eases it between the steps
// (`userData.teleport`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import type { Shape } from './assets/web.nav.ts'

let made: THREE.Group | undefined

type V = number[]

// One ribbon's slab: its up face, the face under it and its two edges, each its own strip of
// vertices, so each is lit flat across; the up face group 0, the rest group 1.
function slab(T: typeof THREE, points: V[], ups: V[], width: number, thickness: number) {
  const W = width / 2, H = thickness / 2
  // At each point: its four corners, up-left, up-right, under-right, under-left.
  const corners = points.map((p, k) => {
    const way = k === 0 ? sub(points[1], p) : k === points.length - 1 ? sub(p, points[k - 1]) : sub(points[k + 1], points[k - 1])
    const u = new T.Vector3().fromArray(ups[k])
    const side = new T.Vector3().fromArray(way).cross(u).normalize()
    const at = new T.Vector3().fromArray(p)
    const c = (s: number, h: number) => at.clone().addScaledVector(side, s * W).addScaledVector(u, h * H)
    return [c(-1, 1), c(1, 1), c(1, -1), c(-1, -1)]
  })
  const position: number[] = []
  const index: number[] = []
  const groups: [number, number, number][] = []
  // A strip from corner i to corner j of every point, its faces wound so that their front is out.
  const strip = (i: number, j: number, group: number) => {
    const first = position.length / 3, start = index.length
    for (const c of corners) position.push(...c[i].toArray(), ...c[j].toArray())
    for (let k = 0; k < corners.length - 1; k++) {
      const a = first + 2 * k, b = a + 1, c = a + 2, d = a + 3
      index.push(a, c, b, b, c, d)
    }
    groups.push([start, index.length - start, group])
  }
  strip(0, 1, 0)
  strip(2, 3, 1)
  strip(1, 2, 1)
  strip(3, 0, 1)
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(position, 3))
  g.setIndex(index)
  for (const [start, count, group] of groups) g.addGroup(start, count, group)
  g.computeVertexNormals()
  return g
}

const sub = (a: V, b: V) => a.map((v, i) => v - b[i])

export function setup() {}

export function tick(row: Row, plugins: Plugins) {
  if (made) return
  const T = plugins.render3d.THREE as typeof THREE
  const d = def(plugins.wire, row.kind)
  const shape = plugins.loader.get(d.shape) as Shape | undefined
  if (!shape) return
  const dress = plugins.render3d.dress
  const material = (color: string) => dress(new T.MeshStandardMaterial({ color, roughness: d.roughness, side: T.DoubleSide }))
  const under = material(d.under)
  made = new T.Group()
  made.name = 'ribbons'
  shape.ribbons.forEach((r, i) => {
    // From the rim of the disc it leaves to the rim of the one it meets, so no two cross inside a disc.
    const a = r.points[0], b = r.points[r.points.length - 1]
    const out = (p: V) => Math.hypot(...sub(p, a)) >= d.hub && Math.hypot(...sub(p, b)) >= d.hub
    const first = r.points.findIndex(out), last = r.points.findLastIndex(out)
    const points = r.points.slice(Math.max(0, first - 1), last + 2), ups = r.ups.slice(Math.max(0, first - 1), last + 2)
    const mesh = new T.Mesh(slab(T, points, ups, d.width, d.thickness), [material(d.colours[i % d.colours.length]), under])
    mesh.name = `ribbon ${i}`
    made!.add(mesh)
  })
  const disc = new T.CylinderGeometry(d.radius, d.radius, d.disc, 64)
  const discs = material(d.discs)
  const yUp = new T.Vector3(0, 1, 0)
  shape.hubs.forEach((h, i) => {
    const mesh = new T.Mesh(disc, discs)
    mesh.name = `hub ${i}`
    mesh.position.fromArray(h.at)
    mesh.quaternion.setFromUnitVectors(yUp, new T.Vector3().fromArray(h.normal))
    made!.add(mesh)
  })
  made.traverse(o => {
    o.castShadow = true
    o.receiveShadow = true
  })
  made.userData.teleport = true
  plugins.render3d.scene.add(made)
}

export function remove(plugins: Plugins) {
  if (!made) return
  plugins.render3d.scene.remove(made)
  const done = new Set<unknown>()
  made.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    for (const x of [m.geometry, ...(Array.isArray(m.material) ? m.material : [m.material])]) {
      if (done.has(x)) continue
      done.add(x)
      x.dispose()
    }
  })
  made = undefined
}
