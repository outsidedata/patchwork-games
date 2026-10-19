// A weak point's look: a glowing ball of its definition's `size` metres and `colour`, set into the
// colossus's limb where the point is (the climb plugin's `spot`, off the colossus's pose on this
// page's rows), and gone once it is broken.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { spot } from './plugins/climb/climb.sim.ts'

let ball: THREE.Mesh | undefined

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  ball = new T.Mesh(
    new T.SphereGeometry(k.size / 2, 24, 16),
    new T.MeshStandardMaterial({ color: k.colour, emissive: k.colour, emissiveIntensity: 2.5, roughness: 0.4 }),
  )
  ball.visible = false
  plugins.render3d.scene.add(ball)
}

export function tick(row: Row, plugins: Plugins) {
  const giant = plugins.wire.rows.find(r => r.id === row.data.on)
  if (!ball || !giant || row.data.broken) return void (ball && (ball.visible = false))
  const { at } = spot(plugins.wire, giant, row.data as any)
  ball.position.set(at[0], at[1], at[2])
  ball.visible = true
}

export function remove(plugins: Plugins) {
  if (!ball) return
  plugins.render3d.scene.remove(ball)
  ball.geometry.dispose()
  ;(ball.material as THREE.Material).dispose()
  ball = undefined
}
