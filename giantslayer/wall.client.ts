// A wall's look: its box (the climb plugin's `box` of its definition's `size` and `cell`) in its
// definition's `colour`, at its row's `pos`, turned by its `yaw`, casting and taking shadows. The mesh is
// named `wall`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { box } from './plugins/climb/climb.sim.ts'

let mesh: THREE.Mesh | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const { position, index } = box(k.size, k.cell)
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(position, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  const material = new T.MeshStandardMaterial({ color: k.colour, roughness: 0.9, flatShading: true })
  plugins.render3d.dress(material)
  mesh = new T.Mesh(g, material)
  mesh.name = 'wall'
  mesh.castShadow = true
  mesh.receiveShadow = true
  plugins.render3d.scene.add(mesh)
}

export function tick(row: Row) {
  if (!mesh) return
  const [x, y, z] = row.data.pos
  mesh.position.set(x, y, z)
  mesh.rotation.set(0, row.data.yaw, 0)
}

export function remove(plugins: Plugins) {
  if (!mesh) return
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  ;(mesh.material as THREE.Material).dispose()
  mesh = undefined
}
