// A laser, drawn: a box of its definition's `size` at `pos` in the chamber's surface its `surface`
// names, and its beam, every stretch of the row's `beam` from point to point a cylinder `width` across
// of `sides` sides, unlit, shining `beam.glow` at `beam.power`, past 1 brighter than white so render3d's
// bloom takes it. The beam is traced again every step and can leap when a portal moves, so each
// cylinder's `userData.teleport` is always up and render3d draws it where it is set
// (`guide-to-smooth-gameplay`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { surfaced } from './plugins/chamber/chamber.plugin.ts'

let housing: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
let rays: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>[] = []
let three: typeof THREE
let scene: THREE.Scene
let width = 0, sides = 0
let shine: THREE.Color

export function setup(row: Row, plugins: Plugins) {
  const d = def(plugins.wire, row.kind)
  three = plugins.render3d.THREE as typeof THREE
  scene = plugins.render3d.scene
  width = d.width
  sides = d.sides
  shine = new three.Color(d.beam.glow).multiplyScalar(d.beam.power)
  housing = new three.Mesh(new three.BoxGeometry(d.size, d.size, d.size), surfaced(plugins, d.surface))
  housing.castShadow = true
  housing.receiveShadow = true
  housing.position.fromArray(row.data.pos)
  scene.add(housing)
  tick(row)
}

const up = () => new three.Vector3(0, 1, 0)

export function tick(row: Row) {
  const pieces: [number[], number[]][] = []
  for (const stretch of row.data.beam as number[][][]) for (let i = 1; i < stretch.length; i += 2) pieces.push([stretch[i - 1], stretch[i]])
  while (rays.length < pieces.length) {
    const ray = new three.Mesh(new three.CylinderGeometry(width, width, 1, sides), new three.MeshBasicMaterial({ color: shine }))
    ray.userData.teleport = true
    scene.add(ray)
    rays.push(ray)
  }
  rays.forEach((ray, i) => {
    ray.visible = i < pieces.length
    if (!ray.visible) return
    const [a, b] = pieces[i]
    const along = new three.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const len = along.length()
    ray.scale.set(1, Math.max(len, 1e-3), 1)
    ray.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    ray.quaternion.setFromUnitVectors(up(), along.normalize())
  })
}

export function remove() {
  scene.remove(housing, ...rays)
  housing.geometry.dispose()
  housing.material.dispose()
  for (const ray of rays) { ray.geometry.dispose(); ray.material.dispose() }
  rays = []
}
