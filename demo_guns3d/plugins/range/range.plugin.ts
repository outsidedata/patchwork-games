// range: the steel plates, the browser's half (`range.sim.ts` says what a plate is). Each plate row is drawn as a
// post from its foot up to the plate and a round plate on it facing the firing line, in its definition's colours:
// `stand` the post's, `plate` the plate's standing and `struck` its colour while it lies down. Struck, it goes over
// backward on its post's top over `fall` seconds, as far as a quarter turn, and stands again once its row says it is
// up. A plate whose row ends is taken away; `close` takes every one.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import type { Row } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

type Drawn = { root: THREE.Group; hinge: THREE.Group; face: THREE.MeshStandardMaterial }

export function range() {
  const drawn = new Map<number, Drawn>()
  const made: { dispose(): void }[] = []

  function draw(plugins: Plugins, r: Row): Drawn {
    const T: typeof THREE = plugins.render3d.THREE
    const k = def(plugins.wire, r.kind)
    const root = new T.Group()
    const stand = new T.MeshStandardMaterial({ color: k.stand, roughness: 0.7, metalness: 0.3 })
    const face = new T.MeshStandardMaterial({ color: k.plate, roughness: 0.55, metalness: 0.45 })
    const pole = new T.CylinderGeometry(k.pole, k.pole, k.post - k.radius, 12)
    const disc = new T.CylinderGeometry(k.radius, k.radius, k.thick, 40)
    made.push(stand, face, pole, disc)
    const post = new T.Mesh(pole, stand)
    post.position.y = (k.post - k.radius) / 2
    // the plate hinges on the post's top, at its own foot
    const hinge = new T.Group()
    hinge.position.y = k.post - k.radius
    const plateMesh = new T.Mesh(disc, face)
    plateMesh.rotation.x = Math.PI / 2
    plateMesh.position.set(0, k.radius, 0)
    hinge.add(plateMesh)
    root.add(post, hinge)
    for (const m of [post, plateMesh]) { m.castShadow = true; m.receiveShadow = true }
    plugins.render3d.scene.add(root)
    return { root, hinge, face }
  }

  return {
    tick(plugins: Plugins) {
      const seen = new Set<number>()
      for (const r of plugins.wire.rows as Row[]) {
        if (r.kind !== 'plate') continue
        seen.add(r.id)
        const d = drawn.get(r.id) ?? draw(plugins, r)
        drawn.set(r.id, d)
        const k = def(plugins.wire, r.kind)
        d.root.position.fromArray(r.data.pos)
        const lying = r.data.down > 0
        const over = lying ? Math.min(1, (k.down - r.data.down) / k.fall) : 0
        d.hinge.rotation.x = over * (Math.PI / 2)
        d.face.color.set(lying ? k.struck : k.plate)
      }
      for (const [id, d] of drawn) if (!seen.has(id)) { d.root.removeFromParent(); drawn.delete(id) }
    },
    close() {
      for (const d of drawn.values()) d.root.removeFromParent()
      drawn.clear()
      for (const m of made.splice(0)) m.dispose()
    },
  }
}
