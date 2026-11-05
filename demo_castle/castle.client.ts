// The town drawn as the library's pro-ng cuts it (its `procedural.py`, the scene `pro-ng/scenes/smallville.town.json`)
// and packs it (`pack.mjs`), through supershader3d, the scene's one shader, composed from the materials the town draws
// (`assets/smallville.town.looks.json`, which the pack writes beside the glb). Nothing here knows a material or a
// mesh: the glb's node `pro-ng` says it in its extras' `vertex` (pack.mjs, VERTEX): the meshes to draw, each of the
// shader's vertex inputs as the glb's attributes' numbers, and the number an input reads on a mesh that has not its
// attribute. Every mesh's vertices go into one geometry, each input its own attribute; every triangle into the run of
// the draw call that draws its material (its vertices' `lookId`, the looks file's `call`): solid, relief, see-through,
// at most three calls. The buildings' course table, which the wall looks read, is written into the fortress's
// (`plugins/fortress/fortress.plugin.ts`). Everything casts and takes shadows. The ground under it is terrain3d's
// (`assets/demo_castle.field.json`), flattened under the town by the town's layer.
import type * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import type { Call, Looks } from '#plugins/supershader3d/supershader3d.plugin.ts'
import type { CourseRow } from './plugins/fortress/fortress.plugin.ts'

// the extras' `vertex`: the meshes drawn, each input's numbers, each input's default
type Vertex = { meshes: string[]; attributes: Record<string, [string, number][]>; defaults: Record<string, number> }
type Info = { courses: CourseRow[]; vertex: Vertex }
type Gltf = {
  nodes: { name: string; mesh?: number; extras?: unknown }[]
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[]
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: { byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } } }[]
}

let built: THREE.Object3D[] = []
let disposers: (() => void)[] = []
let gone = false
// the town once unpacked, waiting for supershader3d's materials
let waiting: { info: Info; meshes: Mesh[] } | undefined

const CALLS: Call[] = ['solid', 'relief', 'seeThrough']
const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const ARRAYS: Record<number, any> = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const MOST: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }

// a mesh's vertices: each input's numbers, `count` vertices of the input's width, and its index
type Mesh = { count: number; inputs: Record<string, Float32Array>; index: Uint32Array }

// the glb's extras and each mesh the extras name, every input read off its attributes, or its default
async function unpack(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const jsonLength = view.getUint32(12, true)
  const gltf: Gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)))
  const bin = bytes.subarray(28 + jsonLength, 28 + jsonLength + view.getUint32(20 + jsonLength, true))
  await MeshoptDecoder.ready
  const views = gltf.bufferViews.map(v => {
    const m = v.extensions?.EXT_meshopt_compression
    if (!m) return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)
    const out = new Uint8Array(m.count * m.byteStride)
    MeshoptDecoder.decodeGltfBuffer(out, m.count, m.byteStride, bin.subarray(m.byteOffset || 0, (m.byteOffset || 0) + m.byteLength), m.mode, m.filter)
    return out
  })
  const floatsOf = (i: number) => {
    const a = gltf.accessors[i]
    const v = gltf.bufferViews[a.bufferView]
    const width = WIDTH[a.type]
    const Arr = ARRAYS[a.componentType]
    const every = new Arr(views[a.bufferView].slice().buffer)
    const stride = (v.byteStride || width * Arr.BYTES_PER_ELEMENT) / Arr.BYTES_PER_ELEMENT
    const offset = (a.byteOffset || 0) / Arr.BYTES_PER_ELEMENT
    const out = new Float32Array(a.count * width)
    for (let n = 0; n < a.count; n++) {
      for (let k = 0; k < width; k++) {
        const x = every[n * stride + offset + k]
        out[n * width + k] = a.normalized ? Math.max(x / MOST[a.componentType], -1) : x
      }
    }
    return { floats: out, width }
  }
  const info = gltf.nodes.find(n => n.name === 'pro-ng')!.extras as Info
  if (!info.vertex) throw new Error('castle: the town glb has no extras `vertex`; bake it again with the library\'s pro-ng/pack.mjs')
  const meshes = info.vertex.meshes.map((name): Mesh => {
    const node = gltf.nodes.find(n => n.name === name && n.mesh !== undefined)
    if (!node) throw new Error(`castle: the town glb's extras name the mesh ${name}, which it has not`)
    const prim = gltf.meshes[node.mesh!].primitives[0]
    const count = gltf.accessors[prim.attributes.POSITION].count
    const read: Record<string, { floats: Float32Array; width: number }> = {}
    const inputs: Record<string, Float32Array> = {}
    for (const [input, numbers] of Object.entries(info.vertex.attributes)) {
      const out = new Float32Array(count * numbers.length).fill(info.vertex.defaults[input] ?? 0)
      if (numbers.every(([key]) => prim.attributes[key] !== undefined)) {
        for (const [key] of numbers) read[key] ??= floatsOf(prim.attributes[key])
        for (let n = 0; n < count; n++) numbers.forEach(([key, k], j) => { out[n * numbers.length + j] = read[key].floats[n * read[key].width + k] })
      }
      inputs[input] = out
    }
    const ia = gltf.accessors[prim.indices]
    return { count, inputs, index: Uint32Array.from(new ARRAYS[ia.componentType](views[ia.bufferView].slice().buffer)) }
  })
  return { info, meshes }
}

export function setup(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind)
  // An actor is set up before the loader's first tick, so the town is built once its glb has landed.
  plugins.loader.load(k.glb).then(async (glb: any) => {
    const unpacked = await unpack(glb.bytes)
    if (!gone) waiting = unpacked
  })
}

// Every mesh in one geometry, each triangle in its call's run, drawn by that call's material.
function build(T: typeof THREE, plugins: Plugins, { info, meshes }: { info: Info; meshes: Mesh[] }) {
  const looks: Looks = plugins.supershader3d.looks()
  plugins.fortress.town(T, info.courses)
  const total = meshes.reduce((n, m) => n + m.count, 0)
  const geo = new T.BufferGeometry()
  for (const [input, numbers] of Object.entries(info.vertex.attributes)) {
    const out = new Float32Array(total * numbers.length)
    let at = 0
    for (const m of meshes) { out.set(m.inputs[input], at * numbers.length); at += m.count }
    geo.setAttribute(input, new T.BufferAttribute(out, numbers.length))
  }
  const lookId = geo.getAttribute('lookId').array as Float32Array
  const runs: Record<Call, number[]> = { solid: [], relief: [], seeThrough: [] }
  let base = 0
  for (const m of meshes) {
    for (let i = 0; i < m.index.length; i++) {
      const v = base + m.index[i]
      const material = looks.materials[Math.round(lookId[v])]
      if (!material) throw new Error(`castle: a vertex's lookId ${lookId[v]} is no material of the town's looks`)
      runs[material.call].push(v)
    }
    base += m.count
  }
  const index = new Uint32Array(CALLS.reduce((n, c) => n + runs[c].length, 0))
  const materials: THREE.Material[] = []
  let at = 0
  for (const call of CALLS) {
    if (!runs[call].length) continue
    const material = plugins.supershader3d.material(call)
    if (!material) throw new Error(`castle: the town draws ${call} triangles, and supershader3d has no ${call} material`)
    index.set(runs[call], at)
    geo.addGroup(at, runs[call].length, materials.length)
    materials.push(material)
    at += runs[call].length
  }
  geo.setIndex(new T.BufferAttribute(index, 1))
  geo.computeBoundingSphere()
  const mesh = new T.Mesh(geo, materials)
  mesh.castShadow = mesh.receiveShadow = true
  plugins.render3d.scene.add(mesh)
  built.push(mesh)
  disposers.push(() => geo.dispose())
}

export function tick(_row: Row, plugins: Plugins) {
  if (!waiting || !plugins.supershader3d.looks()) return
  const town = waiting
  waiting = undefined
  build(plugins.render3d.THREE as typeof THREE, plugins, town)
}

export function remove(plugins: Plugins) {
  gone = true
  waiting = undefined
  for (const o of built) plugins.render3d.scene.remove(o)
  for (const f of disposers) f()
  built = []
  disposers = []
}
