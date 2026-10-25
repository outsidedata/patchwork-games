// The yard's look: a square of its definition's `size` metres a side, in its `colour`, lying at
// height 0 and taking shadows.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let ground: THREE.Mesh | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const { size, colour } = def(plugins.wire, row.kind)
  ground = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshStandardMaterial({ color: colour }))
  ground.quaternion.setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2)
  ground.receiveShadow = true
  plugins.render3d.scene.add(ground)
}

export function tick() {}

export function remove() {
  ground?.removeFromParent()
  ground?.geometry.dispose()
  ;(ground?.material as THREE.Material | undefined)?.dispose()
  ground = undefined
}
