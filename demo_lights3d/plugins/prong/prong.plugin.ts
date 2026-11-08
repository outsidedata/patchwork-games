// prong: a pro-ng glb (the library's `pro-ng/procedural.py` cut, `pro-ng/pack.mjs` packed, copied in by the game's
// bake) drawn through supershader3d, the game's own plugin, loaded by `shipped`. It has no row, no numbers and no
// server half.
//
// `mesh(glb)` is a promise of the glb as one THREE.Mesh, `glb` the catalogue name of a `binary` entry. The glb's node
// `pro-ng` says what to draw in its extras' `vertex` (pack.mjs, VERTEX): the meshes, each of the shader's vertex
// inputs as the glb's attributes' numbers, and the number an input reads on a mesh that has not its attribute. Every
// mesh's vertices go into one geometry, each input its own attribute (`lookId`, `lookInfo`, `uv`, the slots `s0` to
// `s3`, `position`, `normal`); every triangle into the run of the draw call that draws its material (its vertices'
// `lookId`, the looks file's `call`): solid, relief, see-through, each drawn by supershader3d's material for that
// call. The promise waits on the glb and on supershader3d's looks file. A glb whose kit moves (a skin, morph targets)
// is refused, naming it: this draws things that stand still. Each mesh made is the caller's: it adds it to the scene
// and takes it away; `close` disposes every geometry made.
import type * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { Plugins } from '#engine/browser.ts'
import type { Call, Looks } from '#plugins/supershader3d/supershader3d.plugin.ts'

type Vertex = { meshes: string[]; attributes: Record<string, [string, number][]>; defaults: Record<string, number> }
type Accessor = { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean; sparse?: unknown }
type Gltf = {
  nodes: { name: string; mesh?: number; skin?: number; extras?: unknown }[]
  meshes: { primitives: { attributes: Record<string, number>; indices: number; targets?: unknown[] }[] }[]
  accessors: Accessor[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: { byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } } }[]
}
// a mesh's vertices: each input's numbers, `count` vertices of the input's width, and its index
type Part = { count: number; inputs: Record<string, Float32Array>; index: Uint32Array }

const CALLS: Call[] = ['solid', 'relief', 'seeThrough']
const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const ARRAYS: Record<number, any> = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const MOST: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }

// The glb's meshes the extras name, each input read off its attributes or its default.
async function unpack(bytes: Uint8Array, name: string): Promise<{ vertex: Vertex; parts: Part[] }> {
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
    if (a.sparse || a.bufferView === undefined) throw new Error(`prong: ${name}'s accessor ${i} is sparse or has no view, which a thing that stands still has not`)
    const width = WIDTH[a.type]
    const Arr = ARRAYS[a.componentType]
    const every = new Arr(views[a.bufferView].slice().buffer)
    const stride = (gltf.bufferViews[a.bufferView].byteStride || width * Arr.BYTES_PER_ELEMENT) / Arr.BYTES_PER_ELEMENT
    const offset = (a.byteOffset || 0) / Arr.BYTES_PER_ELEMENT
    const out = new Float32Array(a.count * width)
    for (let n = 0; n < a.count; n++) for (let k = 0; k < width; k++) {
      const x = every[n * stride + offset + k]
      out[n * width + k] = a.normalized ? Math.max(x / MOST[a.componentType], -1) : x
    }
    return { floats: out, width }
  }
  const info = gltf.nodes.find(n => n.name === 'pro-ng')?.extras as { vertex?: Vertex } | undefined
  if (!info?.vertex) throw new Error(`prong: ${name} has no node pro-ng with the extras \`vertex\`; bake it again with the library's pro-ng/pack.mjs`)
  const vertex = info.vertex
  const parts = vertex.meshes.map((mesh): Part => {
    const node = gltf.nodes.find(n => n.name === mesh && n.mesh !== undefined)
    if (!node) throw new Error(`prong: ${name}'s extras name the mesh ${mesh}, which it has not`)
    const prim = gltf.meshes[node.mesh!].primitives[0]
    if (prim.attributes.JOINTS_0 !== undefined || prim.targets?.length) throw new Error(`prong: ${name}'s mesh ${mesh} moves (a skin or morph targets), and prong draws things that stand still`)
    const count = gltf.accessors[prim.attributes.POSITION].count
    const read: Record<string, { floats: Float32Array; width: number }> = {}
    const inputs: Record<string, Float32Array> = {}
    for (const [input, numbers] of Object.entries(vertex.attributes)) {
      const out = new Float32Array(count * numbers.length).fill(vertex.defaults[input] ?? 0)
      if (numbers.every(([key]) => prim.attributes[key] !== undefined)) {
        for (const [key] of numbers) read[key] ??= floatsOf(prim.attributes[key])
        for (let n = 0; n < count; n++) numbers.forEach(([key, k], j) => { out[n * numbers.length + j] = read[key].floats[n * read[key].width + k] })
      }
      inputs[input] = out
    }
    const ia = gltf.accessors[prim.indices]
    return { count, inputs, index: Uint32Array.from(new ARRAYS[ia.componentType](views[ia.bufferView!].slice().buffer)) }
  })
  return { vertex, parts }
}

// Every part in one geometry, each triangle in its call's run, drawn by that call's material.
function assemble(T: typeof THREE, vertex: Vertex, parts: Part[], looks: Looks, material: (call: Call) => THREE.Material, name: string) {
  const total = parts.reduce((n, m) => n + m.count, 0)
  const geo = new T.BufferGeometry()
  for (const [input, numbers] of Object.entries(vertex.attributes)) {
    const out = new Float32Array(total * numbers.length)
    let at = 0
    for (const m of parts) { out.set(m.inputs[input], at * numbers.length); at += m.count }
    geo.setAttribute(input, new T.BufferAttribute(out, numbers.length))
  }
  const lookId = geo.getAttribute('lookId').array as Float32Array
  const runs: Record<Call, number[]> = { solid: [], relief: [], seeThrough: [] }
  let base = 0
  for (const m of parts) {
    for (let i = 0; i < m.index.length; i++) {
      const v = base + m.index[i]
      const look = looks.materials[Math.round(lookId[v])]
      if (!look) throw new Error(`prong: a vertex of ${name} has the lookId ${lookId[v]}, no material of its looks`)
      runs[look.call].push(v)
    }
    base += m.count
  }
  const index = new Uint32Array(CALLS.reduce((n, c) => n + runs[c].length, 0))
  const materials: THREE.Material[] = []
  let at = 0
  for (const call of CALLS) {
    if (!runs[call].length) continue
    index.set(runs[call], at)
    geo.addGroup(at, runs[call].length, materials.length)
    materials.push(material(call))
    at += runs[call].length
  }
  geo.setIndex(new T.BufferAttribute(index, 1))
  geo.computeBoundingSphere()
  return new T.Mesh(geo, materials)
}

export function prong() {
  let plugins: Plugins | undefined
  // each mesh asked for before the looks file landed, waiting on it
  const waiting: (() => void)[] = []
  const made: THREE.BufferGeometry[] = []
  const me = {
    tick(p: Plugins) {
      plugins = p
      if (!p.supershader3d) throw new Error('prong draws through supershader3d, which this scene does not name')
      if (p.supershader3d.looks()) for (const go of waiting.splice(0)) go()
    },
    async mesh(glb: string): Promise<THREE.Mesh> {
      if (!plugins) throw new Error('prong: mesh asked for before its first tick')
      const p = plugins
      const file = await p.loader.load(glb)
      const { vertex, parts } = await unpack(file.bytes, glb)
      if (!p.supershader3d.looks()) await new Promise<void>(go => waiting.push(go))
      const looks: Looks = p.supershader3d.looks()
      const mesh = assemble(p.render3d.THREE as typeof THREE, vertex, parts, looks, call => {
        const material = p.supershader3d.material(call)
        if (!material) throw new Error(`prong: ${glb} draws ${call} triangles, and supershader3d has no ${call} material`)
        return material
      }, glb)
      made.push(mesh.geometry)
      return mesh
    },
    close() {
      for (const g of made.splice(0)) g.dispose()
      waiting.length = 0
      plugins = undefined
    },
  }
  return me
}
