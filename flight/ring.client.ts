// A ring of the course (`ring.sim.ts`) drawn: a torus `radius` inside and `tube` thick, at the row's
// `pos`, its face toward its `yaw` and `pitch`, glowing `glow` in its colour. It is drawn only on a page
// whose seat is flying the course (the `course` of its own `player` row) and has not flown it yet: the
// seat's next ring in `next`, the ones after it in `ahead`. Its material is dressed by render3d.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { possessed } from '#plugins/player/player.plugin.ts'

// This ring as each client draws it, by its render3d: two pages in one process share this module.
const drawn = new WeakMap<object, THREE.Mesh>()

export function setup() {}

export function tick(row: Row, plugins: Plugins) {
  const { render3d, wire } = plugins
  const k = def(wire, row.kind)
  let mesh = drawn.get(render3d)
  if (!mesh) {
    const T = render3d.THREE as typeof THREE
    const material = render3d.dress(new T.MeshStandardMaterial({ roughness: 0.4, emissiveIntensity: k.glow }))
    mesh = new T.Mesh(new T.TorusGeometry(k.radius + k.tube, k.tube, 12, 48), material)
    render3d.scene.add(mesh)
    drawn.set(render3d, mesh)
  }
  const me = possessed(wire.rows)
  const course = me?.data.course
  mesh.visible = !!course && !course.done && row.data.order >= course.next
  const colour = course && row.data.order === course.next ? k.next : k.ahead
  const m = mesh.material as THREE.MeshStandardMaterial
  m.color.setHex(colour)
  m.emissive.setHex(colour)
  mesh.position.fromArray(row.data.pos)
  // The torus's axis is its local z: pitched up about x, then turned clockwise from north about y.
  mesh.rotation.set(row.data.pitch, -row.data.yaw, 0, 'YXZ')
}

export function remove(plugins: Plugins) {
  const mesh = drawn.get(plugins.render3d)
  if (!mesh) return
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  ;(mesh.material as THREE.Material).dispose()
  drawn.delete(plugins.render3d)
}
