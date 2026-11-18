// aviary: the game's own plugin, browser half only, loaded by `shipped`. It dresses the skin of each bird
// puppet3d poses in supershader3d's materials, so a pro-ng bird is drawn in its own looks on puppet3d's bones.
//
// A bird is a kind of BIRDS. The skin of each of its layouts (its definition's `layouts.<n>.skin`, a `model`
// entry that is not `preload`ed) is a pro-ng glb: one skinned mesh, every vertex carrying its material's number
// and its look's slots as the glb's own attributes, which the glb's node `pro-ng` names in its extras' `vertex`
// (the library's `pro-ng/pack.mjs`). Once supershader3d's looks file has landed, aviary asks the loader for the
// skin, and as it lands gives the decoded mesh what supershader3d's materials read: each of the shader's inputs
// (`lookId`, `lookInfo`, the slots `s0` to `s3`) as an attribute of that name, an input the mesh has no attribute
// for filled with its default; every triangle in the run of the draw call that draws its material; and each
// run's material, supershader3d's for that call. puppet3d waits for a skin to land before it builds a body, and
// builds it from the decoded mesh's geometry and material, so the body it builds is drawn in the looks. The
// mesh, its weights and its bones' names are left as they are.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import type { Call, Looks } from '#plugins/supershader3d/supershader3d.plugin.ts'
import type { Def } from '#plugins/puppet3d/puppet3d.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

const BIRDS = ['hawk']
const CALLS: Call[] = ['solid', 'relief', 'seeThrough']
// the shader's inputs three's glTF loader has already named as it reads them
const READ = ['position', 'normal', 'uv']

type Vertex = { attributes: Record<string, [string, number][]>; defaults: Record<string, number> }

function dress(T: typeof THREE, model: { scene: THREE.Object3D }, skin: string, looks: Looks, material: (call: Call) => THREE.Material) {
  let found: THREE.SkinnedMesh | undefined, vertex: Vertex | undefined
  model.scene.traverse(o => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh
    if (o.userData.vertex) vertex = o.userData.vertex as Vertex
  })
  if (!found) throw new Error(`aviary: the skin ${skin} has no skinned mesh`)
  if (!vertex) throw new Error(`aviary: the skin ${skin} has no node pro-ng with the extras \`vertex\`; it is no glb of pro-ng's pack.mjs`)
  const geo = found.geometry, count = geo.getAttribute('position').count
  for (const [input, numbers] of Object.entries(vertex.attributes)) {
    if (READ.includes(input)) continue
    // three's glTF loader keeps an attribute of the glb's own (`_LOOK`) under its name in small letters
    const from = numbers.map(([key, at]) => ({ attribute: geo.getAttribute(key.toLowerCase()), at }))
    const out = new Float32Array(count * numbers.length).fill(vertex.defaults[input] ?? 0)
    if (from.every(f => f.attribute)) for (let v = 0; v < count; v++) from.forEach((f, j) => { out[v * numbers.length + j] = f.attribute.getComponent(v, f.at) })
    geo.setAttribute(input, new T.BufferAttribute(out, numbers.length))
  }
  const lookId = geo.getAttribute('lookId'), index = geo.getIndex()
  if (!index) throw new Error(`aviary: the skin ${skin} has no index`)
  const runs: Record<Call, number[]> = { solid: [], relief: [], seeThrough: [] }
  for (let i = 0; i < index.count; i++) {
    const v = index.getX(i), look = looks.materials[Math.round(lookId.getX(v))]
    if (!look) throw new Error(`aviary: a vertex of ${skin} has the lookId ${lookId.getX(v)}, no material of the looks file`)
    runs[look.call].push(v)
  }
  const order = new Uint32Array(index.count), materials: THREE.Material[] = []
  let at = 0
  geo.clearGroups()
  for (const call of CALLS) {
    if (!runs[call].length) continue
    order.set(runs[call], at)
    geo.addGroup(at, runs[call].length, materials.length)
    materials.push(material(call))
    at += runs[call].length
  }
  geo.setIndex(new T.BufferAttribute(order, 1))
  found.material = materials
}

export function aviary() {
  let asked = false
  return {
    tick(plugins: Plugins) {
      if (asked) return
      const ss = plugins.supershader3d
      if (!ss) throw new Error('aviary dresses its birds in supershader3d\'s materials, and this scene does not list supershader3d')
      const looks: Looks | undefined = ss.looks()
      if (!looks) return
      asked = true
      const T = plugins.render3d.THREE as typeof THREE
      const skins = new Set(BIRDS.flatMap(kind => Object.values((def(plugins.wire, kind) as Def).layouts).map(L => L.skin)))
      for (const skin of skins) {
        plugins.loader.on(skin, (model: { scene: THREE.Object3D }) => dress(T, model, skin, looks, call => {
          const material = ss.material(call)
          if (!material) throw new Error(`aviary: ${skin} draws ${call} triangles, and supershader3d has no ${call} material`)
          return material
        }))
      }
    },
    close() {
      asked = false
    },
  }
}
