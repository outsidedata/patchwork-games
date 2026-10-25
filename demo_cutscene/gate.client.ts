// The gate's look: two posts and two leaves between them, each leaf hinged on its post and swung
// `swing` radians inward as `open` runs from 0 to 1, at the row's `pos` turned by its `yaw`. Its
// sizes and colours are its definition in `assets/demo_cutscene.json`.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let group: THREE.Group | undefined
let leaves: THREE.Object3D[] = []
let up: THREE.Vector3 | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  up = new T.Vector3(0, 1, 0)
  const { width, height, thick, post, wood, stone } = def(plugins.wire, row.kind)
  group = new T.Group()
  const half = width / 2
  for (const side of [-1, 1]) {
    const pillar = new T.Mesh(new T.BoxGeometry(post, height + 0.4, post), new T.MeshStandardMaterial({ color: stone }))
    pillar.position.set(side * (half + post / 2), (height + 0.4) / 2, 0)
    pillar.castShadow = pillar.receiveShadow = true
    group.add(pillar)
    // A leaf hinged on its post: the hinge at the post, the board reaching to the middle.
    const hinge = new T.Group()
    hinge.position.set(side * half, 0, 0)
    const board = new T.Mesh(new T.BoxGeometry(half, height, thick), new T.MeshStandardMaterial({ color: wood }))
    board.position.set(-side * half / 2, height / 2, 0)
    board.castShadow = board.receiveShadow = true
    hinge.add(board)
    hinge.userData.side = side
    group.add(hinge)
    leaves.push(hinge)
  }
  plugins.render3d.scene.add(group)
  tick(row, plugins)
}

// Every turn is set whole, as a quaternion about the upright, so render3d draws it between steps.
export function tick(row: Row, plugins: Plugins) {
  const { swing } = def(plugins.wire, row.kind)
  group!.position.set(row.data.pos[0], row.data.pos[1], row.data.pos[2])
  group!.quaternion.setFromAxisAngle(up!, row.data.yaw)
  for (const hinge of leaves) hinge.quaternion.setFromAxisAngle(up!, hinge.userData.side * swing * row.data.open)
}

export function remove() {
  group?.removeFromParent()
  group?.traverse(o => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    ;(m.material as THREE.Material | undefined)?.dispose()
  })
  group = undefined
  leaves = []
}
