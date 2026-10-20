// A wall's look: its box (the climb plugin's `box` of its definition's `size` and `cell`) in its
// definition's `colour`, at its row's `pos`, turned by its `yaw`, casting and taking shadows; the mesh
// is named `wall`. While its definition's `shown` is true its net (climb's `netOn` of that box) is drawn
// over it, a line for each link, named `wall net`, in front of everything.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { box, linked, netOn } from './plugins/climb/climb.sim.ts'

let mesh: THREE.Mesh | undefined
let lines: THREE.LineSegments | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const shape = box(k.size, k.cell)
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(shape.position, 3))
  g.setIndex(shape.index)
  g.computeVertexNormals()
  const material = new T.MeshStandardMaterial({ color: k.colour, roughness: 0.9, flatShading: true })
  plugins.render3d.dress(material)
  mesh = new T.Mesh(g, material)
  mesh.name = 'wall'
  mesh.castShadow = true
  mesh.receiveShadow = true
  const net = netOn(shape)
  const ends: number[] = []
  for (let i = 0; i < net.points; i++) for (const o of linked(net, i)) if (o > i) ends.push(...net.at.subarray(i * 3, i * 3 + 3), ...net.at.subarray(o * 3, o * 3 + 3))
  const lg = new T.BufferGeometry()
  lg.setAttribute('position', new T.Float32BufferAttribute(ends, 3))
  lines = new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x3cff9a, depthTest: false, transparent: true, opacity: 0.7 }))
  lines.name = 'wall net'
  lines.renderOrder = 10
  mesh.add(lines)
  plugins.render3d.scene.add(mesh)
}

export function tick(row: Row, plugins: Plugins) {
  if (!mesh || !lines) return
  const [x, y, z] = row.data.pos
  mesh.position.set(x, y, z)
  mesh.rotation.set(0, row.data.yaw, 0)
  lines.visible = !!def(plugins.wire, row.kind).shown
}

export function remove(plugins: Plugins) {
  if (!mesh) return
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  ;(mesh.material as THREE.Material).dispose()
  lines?.geometry.dispose()
  ;(lines?.material as THREE.Material | undefined)?.dispose()
  mesh = undefined
  lines = undefined
}
