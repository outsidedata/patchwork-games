// punch's page half: each fist in flight (`punch.sim.ts`, on any row that carries `fist`) drawn as a ball of its
// kind's definition's `size` across, at its tip, in its definition's `colour`, so the blow is seen arriving where it
// was aimed. Each ball is placed from the newest rows in its tick, and render3d draws it between the last two steps
// as it draws the bodies. It draws through render3d's scene.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { fist } from './punch.sim.ts'

export function punch() {
  const balls = new Map<number, THREE.Mesh>()
  let geometry: THREE.SphereGeometry | undefined
  const materials = new Map<string, THREE.MeshStandardMaterial>()

  const drop = (plugins: Plugins, id: number) => {
    const b = balls.get(id)
    if (!b) return
    plugins.render3d.scene.remove(b)
    balls.delete(id)
  }

  return {
    tick(plugins: Plugins) {
      const T: typeof THREE = plugins.render3d.THREE
      const live = new Set<number>()
      for (const row of plugins.wire.rows) {
        if (!('fist' in row.data)) continue
        live.add(row.id)
        const k = def(plugins.wire, row.kind)
        const b = fist(row, k.size)
        let ball = balls.get(row.id)
        if (!ball) {
          geometry ??= new T.SphereGeometry(0.5, 16, 12)
          let m = materials.get(k.colour)
          if (!m) materials.set(k.colour, m = new T.MeshStandardMaterial({ color: k.colour, roughness: 0.6 }))
          ball = new T.Mesh(geometry, m)
          ball.castShadow = true
          plugins.render3d.scene.add(ball)
          balls.set(row.id, ball)
        }
        ball.visible = b !== null
        if (!b) continue
        ball.position.fromArray(b.tip)
        ball.scale.setScalar(k.size)
      }
      for (const id of [...balls.keys()]) if (!live.has(id)) drop(plugins, id)
    },
    close(plugins: Plugins) {
      for (const id of [...balls.keys()]) drop(plugins, id)
      geometry?.dispose()
      geometry = undefined
      for (const m of materials.values()) m.dispose()
      materials.clear()
    },
  }
}
