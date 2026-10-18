// A prop, drawn: its definition's look `looks[row.data.look]`, a `box` of `size` metres a side or a
// `ball` of `size` metres across, in `colour`, lit by the scene's lights, its bottom on the row's `pos`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

export function setup(row: Row, plugins: Plugins) {
  const { shape, size, colour } = def(plugins.wire, row.kind).looks[row.data.look]
  const three = plugins.render3d.THREE as typeof THREE
  const geometry = shape === 'box' ? new three.BoxGeometry(size, size, size) : new three.SphereGeometry(size / 2, 32, 16)
  mesh = new three.Mesh(geometry, plugins.render3d.dress(new three.MeshStandardMaterial({ color: colour, roughness: 0.6 })))
  mesh.position.set(row.data.pos[0], row.data.pos[1] + size / 2, row.data.pos[2])
  plugins.render3d.scene.add(mesh)
}

export function tick() {}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}
