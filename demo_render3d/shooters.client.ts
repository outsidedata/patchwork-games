// The guns of the marks scene, firing by themselves, drawn from the set of their definition
// (`assets/demo_render3d.json`) the row's `set` names. A set is `{ guns }`, each gun:
//   at       [x, y, z], metres: its muzzle
//   aim      [x, y, z], metres: the middle of what it fires at
//   spread   [x, y, z], metres: each shot aimed up to that far either way of `aim`, chosen per shot
//   every    seconds between shots
//   phase    seconds into the clock of its first shot
//   look     the decal3d look it presses where a shot lands (`marks.decal3d.json`)
//   colour   its tracer's colour, `#rrggbb`
//   tracer   seconds a tracer is drawn from the muzzle to where the shot landed
//   size     [across, long] metres: the barrel, drawn pointing at `aim`
// A shot is a ray from the muzzle toward its aim through what render3d draws; where it meets a face,
// the gun presses its look there, along that face's normal as the face lies this frame (a skinned
// frond's as its bones bend it). A thing whose `userData.decal` is false (a barrel, a tracer, a mark)
// stops no shot. Which way each shot goes is rolled from its gun and its count, the same each time.
// The clock is the steps' clock, the moment drawn; a gun fires its newest shot that is due, and a
// shot missed while the page was away is never fired.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { roll } from '#plugins/decal3d/decal3d.plugin.ts'

type Gun = {
  at: number[]; aim: number[]; spread: number[]; every: number; phase: number
  look: string; colour: string; tracer: number; size: number[]
}

let made: THREE.Object3D[] = []
let guns: { g: Gun; fired: number }[] = []
let tracers: { line: THREE.Line; until: number }[] = []

const drawn = (plugins: Plugins) => (plugins.wire.n - 1 + (plugins.wire.between ?? 1)) * plugins.wire.scene.prefabs.engine.dt

// How many shots a gun has had due by `t`.
const due = (g: Gun, t: number) => (t < g.phase ? 0 : Math.floor((t - g.phase) / g.every) + 1)

const setOf = (row: Row, plugins: Plugins) => {
  const set = def(plugins.wire, row.kind)[row.data.set]
  if (!set) throw new Error(`the shooters have no set ${row.data.set}: ${Object.keys(def(plugins.wire, row.kind)).join(', ')}`)
  return set as { guns: Gun[] }
}

export function setup(row: Row, plugins: Plugins) {
  const { THREE: T, scene, dress } = plugins.render3d
  const set = setOf(row, plugins)
  const t = drawn(plugins)
  made = []
  tracers = []
  guns = set.guns.map(g => ({ g, fired: due(g, t) }))
  const metal = dress(new T.MeshStandardMaterial({ color: '#2a2c33', roughness: 0.35, metalness: 0.9 }))
  for (const g of set.guns) {
    const barrel = new T.Mesh(new T.CylinderGeometry(g.size[0] / 2, g.size[0] / 2, g.size[1], 16), metal)
    barrel.geometry.rotateX(Math.PI / 2)
    // the barrel ends at the muzzle, running back from it, away from the aim
    barrel.geometry.translate(0, 0, -g.size[1] / 2)
    barrel.position.set(g.at[0], g.at[1], g.at[2])
    barrel.lookAt(new T.Vector3(g.aim[0], g.aim[1], g.aim[2]))
    barrel.castShadow = true
    barrel.userData.decal = false
    barrel.name = `gun ${g.look}`
    made.push(barrel)
  }
  for (const m of made) scene.add(m)
}

// Where a shot from `from` along `way` first meets a face that takes marks: the point and the face's
// normal as the face lies this frame, in the world.
function shoot(plugins: Plugins, from: THREE.Vector3, way: THREE.Vector3): { point: THREE.Vector3; normal: THREE.Vector3 } | undefined {
  const T = plugins.render3d.THREE as typeof THREE
  const scene = plugins.render3d.scene as THREE.Scene
  scene.updateMatrixWorld()
  const ray = new T.Raycaster(from, way)
  const meshes: THREE.Object3D[] = []
  scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh && o.userData.decal !== false) meshes.push(o) })
  const hit = ray.intersectObjects(meshes, false).find(h => h.face)
  if (!hit) return undefined
  const mesh = hit.object as THREE.Mesh
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3()
  mesh.getVertexPosition(hit.face!.a, a)
  mesh.getVertexPosition(hit.face!.b, b)
  mesh.getVertexPosition(hit.face!.c, c)
  a.applyMatrix4(mesh.matrixWorld)
  b.applyMatrix4(mesh.matrixWorld)
  c.applyMatrix4(mesh.matrixWorld)
  const normal = b.sub(a).cross(c.sub(a)).normalize()
  if (normal.dot(way) > 0) normal.negate()
  return { point: hit.point, normal }
}

export function tick(_row: Row, plugins: Plugins) {
  const { THREE: T, scene } = plugins.render3d
  const t = drawn(plugins)
  tracers = tracers.filter(tr => {
    if (t < tr.until) return true
    scene.remove(tr.line)
    tr.line.geometry.dispose()
    ;(tr.line.material as THREE.Material).dispose()
    return false
  })
  if (!plugins.decal3d.ready()) return
  guns.forEach((gun, i) => {
    const { g } = gun
    const now = due(g, t)
    if (now <= gun.fired) return
    gun.fired = now
    const seed = (i + 1) * 100003 + now * 3
    const target = new T.Vector3(...g.aim.map((v, k) => v + (roll(seed + k) * 2 - 1) * g.spread[k]))
    const from = new T.Vector3(g.at[0], g.at[1], g.at[2])
    const way = target.clone().sub(from).normalize()
    const shot = shoot(plugins, from, way)
    if (!shot) return
    plugins.decal3d.stamp(g.look, shot.point.toArray(), shot.normal.toArray())
    const line = new T.Line(
      new T.BufferGeometry().setFromPoints([from, shot.point]),
      new T.LineBasicMaterial({ color: g.colour, transparent: true, opacity: 0.85 }),
    )
    line.userData.decal = false
    scene.add(line)
    tracers.push({ line, until: t + g.tracer })
  })
}

export function remove(plugins: Plugins) {
  for (const m of made) plugins.render3d.scene.remove(m)
  for (const tr of tracers) plugins.render3d.scene.remove(tr.line)
  made = []
  guns = []
  tracers = []
}
