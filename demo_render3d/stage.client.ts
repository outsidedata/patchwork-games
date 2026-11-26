// The stage, drawn from the set of its definition (`assets/demo_render3d.json`) its row's `set` names. A
// set has any of these parts:
//   room       [width, height, depth]: a back wall and two side walls of `wallColour` and
//              `wallRoughness`, open to the front and above; the floor is that wide and deep, else
//              `floorSize` square
//   floor      its `colour`, `roughness` and `metalness`; with `mirror`, a number, it is a mirror of
//              that resolution (render3d's `userData.mirror`)
//   mirrors    flat mirrors, each called `name`, a plane `size` [width, height] at `at`, turned `turn` [x, y, z] degrees,
//              its face toward its local +z, of `colour`, `roughness` and `metalness`, drawn at
//              `resolution` of the frame
//   things     boxes (`size` [x, y, z]) and spheres (`size` [across]) standing on the floor at `at`, of
//              `colour`, `roughness` (0.55 when left out) and `metalness` (0), glowing `glow` times their
//              colour where they give one; with `repeat: { across, deep, spacing: [x, z] }`, in rows
//   movers     things circling the middle `radius` out at `speed` turns a second from `phase` radians,
//              `height` up and rising and falling by `bob`, turning `spin` turns a second
//   fronds     skinned stalks swaying where they stand: a tapering tube `height` up from `at`, `radius`
//              [foot, tip] across, of `colour` and `roughness`, on a chain of `bones` bones, each bone
//              leaning up to `sway` degrees, swaying at `speed` turns a second from `phase` radians, each
//              bone up the chain `lag` radians behind the one below it
//   lights     point lights of `colour`, `intensity` and `distance` at `at`
//   ambient    a faint light everywhere; `sky` [sky colour, ground colour, intensity], a hemisphere light
// Everything is dressed by render3d, so its reflections reach it; everything casts and takes shadows.
// What moves moves by the steps' clock, the moment drawn (`(n − 1 + between) × dt`), so it is drawn
// smooth at any display's rate: it is only drawn, and no rule reads it. Every turn is set as a whole
// quaternion.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let made: THREE.Object3D[] = []
let movers: { mesh: THREE.Mesh; m: any }[] = []
let fronds: { mesh: THREE.SkinnedMesh; bones: THREE.Bone[]; f: any }[] = []
// The axes and the turn every turn is made with, set as a whole quaternion.
let X: THREE.Vector3, Y: THREE.Vector3, euler: THREE.Euler

// The moment drawn, in seconds: a step behind the clock, `between` of the way past the step before the
// newest (`engine/browser.ts`, Drawing between steps), so what moves moves by the steps' clock and is
// drawn where render3d draws everything else.
const drawn = (plugins: Plugins) => (plugins.wire.n - 1 + (plugins.wire.between ?? 1)) * plugins.wire.scene.prefabs.engine.dt

const setOf = (row: Row, plugins: Plugins) => {
  const set = def(plugins.wire, row.kind)[row.data.set]
  if (!set) throw new Error(`the stage has no set ${row.data.set}: ${Object.keys(def(plugins.wire, row.kind)).join(', ')}`)
  return set
}

export function setup(row: Row, plugins: Plugins) {
  const { THREE: T, scene, dress } = plugins.render3d
  const d = setOf(row, plugins)
  X = new T.Vector3(1, 0, 0)
  Y = new T.Vector3(0, 1, 0)
  euler = new T.Euler()
  const material =(t: { colour: string; roughness?: number; metalness?: number; glow?: number }) => dress(new T.MeshStandardMaterial({
    color: t.colour, roughness: t.roughness ?? 0.55, metalness: t.metalness ?? 0,
    emissive: t.glow ? new T.Color(t.colour).multiplyScalar(t.glow) : 0x000000,
  }))
  const geometry = (t: { shape: string; size: number[] }) => (t.shape === 'box' ? new T.BoxGeometry(t.size[0], t.size[1], t.size[2]) : new T.SphereGeometry(t.size[0] / 2, 48, 24))
  const shadowed = (m: THREE.Mesh) => { m.castShadow = m.receiveShadow = true; return m }
  made = [new T.AmbientLight(0xffffff, d.ambient)]
  movers = []
  fronds = []
  if (d.sky) made.push(new T.HemisphereLight(d.sky[0], d.sky[1], d.sky[2]))

  // the floor, a mirror where the set says
  const [w, h, dp] = d.room ?? [d.floorSize, 0, d.floorSize]
  const floor = shadowed(new T.Mesh(new T.PlaneGeometry(w, dp), material(d.floor)))
  floor.quaternion.setFromAxisAngle(X, -Math.PI / 2)
  floor.name = 'floor'
  if (d.floor.mirror) floor.userData.mirror = { resolution: d.floor.mirror }
  made.push(floor)

  // the walls
  if (d.room) {
    const wall = () => material({ colour: d.wallColour, roughness: d.wallRoughness })
    const back = shadowed(new T.Mesh(new T.PlaneGeometry(w, h), wall()))
    back.position.set(0, h / 2, -dp / 2)
    const left = shadowed(new T.Mesh(new T.PlaneGeometry(dp, h), wall()))
    left.position.set(-w / 2, h / 2, 0)
    left.quaternion.setFromAxisAngle(Y, Math.PI / 2)
    const right = shadowed(new T.Mesh(new T.PlaneGeometry(dp, h), wall()))
    right.position.set(w / 2, h / 2, 0)
    right.quaternion.setFromAxisAngle(Y, -Math.PI / 2)
    made.push(back, left, right)
  }

  // the mirrors, each its own material
  ;(d.mirrors ?? []).forEach((m: any, i: number) => {
    const mesh = new T.Mesh(new T.PlaneGeometry(m.size[0], m.size[1]), material(m))
    mesh.position.set(m.at[0], m.at[1], m.at[2])
    mesh.quaternion.setFromEuler(euler.set(...(m.turn.map((a: number) => (a * Math.PI) / 180) as [number, number, number])))
    mesh.name = m.name ?? `mirror ${i + 1}`
    mesh.userData.mirror = { resolution: m.resolution }
    made.push(mesh)
  })

  // the things, each once or in rows
  for (const t of d.things ?? []) {
    const g = geometry(t), mat = material(t)
    const up = t.shape === 'box' ? t.size[1] / 2 : t.size[0] / 2
    const r = t.repeat ?? { across: 1, deep: 1, spacing: [0, 0] }
    for (let i = 0; i < r.across; i++) for (let j = 0; j < r.deep; j++) {
      const m = shadowed(new T.Mesh(g, mat))
      m.position.set(t.at[0] + i * r.spacing[0], t.at[1] + up, t.at[2] + j * r.spacing[1])
      made.push(m)
    }
  }

  // what moves
  for (const m of d.movers ?? []) {
    const mesh = shadowed(new T.Mesh(geometry(m), material(m)))
    movers.push({ mesh, m })
    made.push(mesh)
  }

  // the fronds: a tube from y 0 to its height, each ring of it weighted between the two bones it lies
  // between, the bones a chain up the middle
  for (const f of d.fronds ?? []) {
    const rings = f.bones * 6
    const g = new T.CylinderGeometry(f.radius[1], f.radius[0], f.height, 20, rings)
    g.translate(0, f.height / 2, 0)
    const seg = f.height / f.bones
    const pos = g.getAttribute('position')
    const index: number[] = [], weight: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const along = Math.min(f.bones - 1e-6, Math.max(0, pos.getY(i) / seg))
      const b = Math.floor(along), k = along - b
      index.push(b, Math.min(b + 1, f.bones), 0, 0)
      weight.push(1 - k, k, 0, 0)
    }
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(index, 4))
    g.setAttribute('skinWeight', new T.Float32BufferAttribute(weight, 4))
    const bones: THREE.Bone[] = []
    for (let i = 0; i <= f.bones; i++) {
      const bone = new T.Bone()
      bone.position.y = i === 0 ? 0 : seg
      if (i > 0) bones[i - 1].add(bone)
      bones.push(bone)
    }
    const mesh = new T.SkinnedMesh(g, material(f))
    mesh.castShadow = mesh.receiveShadow = true
    mesh.position.set(f.at[0], f.at[1], f.at[2])
    mesh.add(bones[0])
    mesh.bind(new T.Skeleton(bones))
    mesh.name = 'frond'
    fronds.push({ mesh, bones, f })
    made.push(mesh)
  }

  // the lights
  for (const l of d.lights ?? []) {
    const light = new T.PointLight(l.colour, l.intensity, l.distance, 2)
    light.position.set(l.at[0], l.at[1], l.at[2])
    light.castShadow = true
    made.push(light)
  }
  for (const m of made) scene.add(m)
  tick(row, plugins)
}

export function tick(_row: Row, plugins: Plugins) {
  const t = drawn(plugins)
  for (const { mesh, m } of movers) {
    const a = t * m.speed * Math.PI * 2 + m.phase
    mesh.position.set(Math.cos(a) * m.radius, m.height + Math.sin(a * 3) * m.bob, Math.sin(a) * m.radius)
    if (m.spin) mesh.quaternion.setFromEuler(euler.set(t * m.spin * 1.3, t * m.spin * Math.PI * 2, 0))
  }
  // each bone leans as its wave says; the bounds are worked out again from the skin as posed, so a ray
  // finds the frond where it is drawn
  for (const { mesh, bones, f } of fronds) {
    const lean = (f.sway * Math.PI) / 180
    bones.forEach((bone, i) => {
      const a = t * f.speed * Math.PI * 2 + f.phase - i * f.lag
      bone.quaternion.setFromEuler(euler.set(Math.cos(a * 0.7) * lean * 0.5, 0, Math.sin(a) * lean))
    })
    mesh.updateMatrixWorld(true)
    mesh.computeBoundingSphere()
    mesh.computeBoundingBox()
  }
}

export function remove(plugins: Plugins) {
  for (const m of made) plugins.render3d.scene.remove(m)
  made = []
  movers = []
  fronds = []
}
