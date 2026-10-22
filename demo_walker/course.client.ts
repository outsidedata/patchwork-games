// The course's look: each shape of its level (`assets/course.json`, read through floors' `courseIn`, so
// each stands where walker stands bodies on it) drawn on the course row's plane, and the water.
//   stairs, ramp, box  a solid of the shape's profile across its width, from the plane up to its
//                      surface, in the `checker` texture tinted by the shape's `tint`. Its texture is
//                      laid in metres, a repeat every level's `checker` metres, the land's ground
//                      layer's `scale` (`assets/land.json`), so a square is as wide on every face of
//                      every shape as on the ground.
//   tree               a trunk of its `radius` and `tall` in the level's `trunk`, under a crown of
//                      its `crown` radius in its `leaves`.
//   seat               a chair whose sitter's hips stand over its `at`: a seat `width` across and
//                      `depth` deep with its top `height` up, reaching `behind` metres behind the hips,
//                      a back `back` tall at its rear edge, and four legs `leg` square, its boards
//                      `board` thick, in the checker tinted by its `tint`.
//   water              a sheet of the level's `water` `colour` and `opacity`, `size` metres a side,
//                      on the waterline, y = 0, which terrain3d's land floods up to: it shows where the
//                      land dips under it, the pond, and lies under the land everywhere else.
// Every mesh casts and takes shadows. They are made once, when the row arrives, and the shapes take
// the checker when the loader has it, which may be a frame or more after.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import { courseIn, type Level, type Shape } from './plugins/floors/floors.sim.ts'

let group: THREE.Group | undefined

type Solid = Exclude<Shape, { is: 'tree' } | { is: 'seat' }>

// A shape's profile, along its facing and up, from the plane.
function profile(sh: Solid): number[][] {
  switch (sh.is) {
    case 'stairs': {
      const p = [[0, 0]]
      for (let i = 0; i < sh.steps; i++) p.push([i * sh.tread, (i + 1) * sh.riser], [(i + 1) * sh.tread, (i + 1) * sh.riser])
      p.push([sh.steps * sh.tread + sh.landing, sh.steps * sh.riser], [sh.steps * sh.tread + sh.landing, 0])
      return p
    }
    case 'ramp':
      return [[0, 0], [sh.rise / sh.grade, sh.rise], [sh.depth, sh.rise], [sh.depth, 0]]
    case 'box':
      return [[-sh.size[1] / 2, 0], [-sh.size[1] / 2, sh.top], [sh.size[1] / 2, sh.top], [sh.size[1] / 2, 0]]
  }
}

const widthOf = (sh: Solid) => (sh.is === 'box' ? sh.size[0] : sh.width)

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const level = json(plugins.wire, def(plugins.wire, row.kind).level) as Level
  const course = courseIn([row], level)
  const yaw = row.data.yaw ?? 0
  // The shapes' materials, which take the checker the moment it lands.
  const checked: THREE.MeshStandardMaterial[] = []
  group = new T.Group()
  const shade = (m: THREE.Mesh) => {
    m.castShadow = m.receiveShadow = true
    group!.add(m)
  }
  for (const p of course.placed) {
    const sh = p.shape
    if (sh.is === 'tree') {
      const trunk = new T.Mesh(new T.CylinderGeometry(sh.radius * 0.8, sh.radius, sh.tall, 10), plugins.render3d.dress(new T.MeshStandardMaterial({ color: level.trunk, roughness: 0.9 })))
      trunk.position.set(p.x, course.y + sh.tall / 2, p.z)
      shade(trunk)
      const crown = new T.Mesh(new T.IcosahedronGeometry(sh.crown, 1), plugins.render3d.dress(new T.MeshStandardMaterial({ color: level.leaves, roughness: 0.85, flatShading: true })))
      crown.position.set(p.x, course.y + sh.tall, p.z)
      shade(crown)
      continue
    }
    if (sh.is === 'seat') {
      // In the chair's own frame: z the way its sitter faces, the sitter's hips over z = 0.
      const material = new T.MeshStandardMaterial({ color: sh.tint, roughness: 0.8 })
      checked.push(material)
      const dressed = plugins.render3d.dress(material)
      const chair = new T.Group()
      const piece = (w: number, h: number, d: number, x: number, y: number, z: number) => {
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), dressed)
        m.position.set(x, y, z)
        m.castShadow = m.receiveShadow = true
        chair.add(m)
      }
      const front = sh.depth - sh.behind, back = -sh.behind, { board, leg } = sh
      piece(sh.width, board, sh.depth, 0, sh.height - board / 2, (front + back) / 2)
      piece(sh.width, sh.back, board, 0, sh.height + sh.back / 2, back + board / 2)
      for (const x of [-1, 1]) for (const z of [back + leg / 2, front - leg / 2]) piece(leg, sh.height - board, leg, (x * (sh.width - leg)) / 2, (sh.height - board) / 2, z)
      chair.position.set(p.x, course.y, p.z)
      chair.rotation.y = yaw + sh.yaw
      group.add(chair)
      continue
    }
    const outline = new T.Shape(profile(sh).map(([a, h]) => new T.Vector2(a, h)))
    const width = widthOf(sh)
    // Extruded across its width along z, then turned so the profile's run lies along the shape's facing.
    const geometry = new T.ExtrudeGeometry(outline, { depth: width, bevelEnabled: false })
    geometry.translate(0, 0, -width / 2)
    geometry.rotateY(-Math.PI / 2)
    const material = new T.MeshStandardMaterial({ color: sh.tint, roughness: 0.8 })
    checked.push(material)
    const solid = new T.Mesh(geometry, plugins.render3d.dress(material))
    solid.position.set(p.x, course.y, p.z)
    solid.rotation.y = yaw + sh.yaw
    shade(solid)
  }
  const water = new T.Mesh(
    new T.PlaneGeometry(level.water.size, level.water.size),
    plugins.render3d.dress(new T.MeshStandardMaterial({ color: level.water.colour, transparent: true, opacity: level.water.opacity, roughness: 0.15 })),
  )
  water.rotation.x = -Math.PI / 2
  water.receiveShadow = true
  group.add(water)
  plugins.render3d.scene.add(group)
  plugins.loader.on('checker', (texture: THREE.Texture) => {
    if (!group) return
    const checker = texture.clone()
    checker.repeat.set(1 / level.checker, 1 / level.checker)
    checker.needsUpdate = true
    for (const m of checked) {
      m.map = checker
      m.needsUpdate = true
    }
  })
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (!group) return
  plugins.render3d.scene.remove(group)
  group.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    const mat = m.material as THREE.MeshStandardMaterial
    mat.map?.dispose()
    mat.dispose()
  })
  group = undefined
}
