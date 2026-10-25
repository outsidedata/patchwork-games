// The guard's look: a block `size` across and `tall` high, standing on the row's `pos`, in its
// definition's `colour` (`assets/demo_cutscene.json`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let block: THREE.Mesh | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const { size, tall, colour } = def(plugins.wire, row.kind)
  block = new T.Mesh(new T.BoxGeometry(size, tall, size), new T.MeshStandardMaterial({ color: colour }))
  block.geometry.translate(0, tall / 2, 0)
  block.castShadow = block.receiveShadow = true
  plugins.render3d.scene.add(block)
  tick(row)
}

export function tick(row: Row) {
  block!.position.set(row.data.pos[0], row.data.pos[1], row.data.pos[2])
}

export function remove() {
  block?.removeFromParent()
  block?.geometry.dispose()
  ;(block?.material as THREE.Material | undefined)?.dispose()
  block = undefined
}
