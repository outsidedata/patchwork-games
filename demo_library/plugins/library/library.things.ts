// The things of a place pro-ng built, each with the box it fills, read off the place's glb as pro-ng's viewer reads
// them (`pro-ng/viewer/index.html`): the `pro-ng` node's extras list the buildings, each with its triangles, which
// lie in that order in the mesh `solids`' index; and the kit things, each vertex of the mesh `kit` naming its thing's
// row in its attribute `_KIT`'s second number (the viewer's tenth float of a kit vertex, after the position, the
// normal, the uv and `_KIT`'s first). `things(bytes)` hands back each building `{ name, kind, triangles,
// timber, box }` and each kit thing `{ name, kind, triangles, materials, box }` (a thing with no vertex left out), every
// box `{ min, max }` in three's axes, as the glb is; and `scene`, `materials` (each kit material's name, flat colour and
// triangles) and `vertices` from the extras. Meshopt-compressed views are decoded.
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

export type Box = { min: number[]; max: number[] }
export type Building = { name: string; kind: string; triangles: number; timber: number; box: Box }
export type KitThing = { name: string; kind: string; triangles: number; materials: string[]; box: Box }
export type Things = { scene: string; buildings: Building[]; kit: KitThing[]; materials: { name: string; colour: string; triangles: number }[] }

type Gltf = {
  nodes: { name: string; mesh?: number; extras?: any }[]
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[]
  accessors: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: { byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } } }[]
}

const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const ARRAYS: Record<number, any> = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const MOST: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }

const empty = (): Box => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] })
const grow = (b: Box, x: number, y: number, z: number) => {
  b.min[0] = Math.min(b.min[0], x); b.min[1] = Math.min(b.min[1], y); b.min[2] = Math.min(b.min[2], z)
  b.max[0] = Math.max(b.max[0], x); b.max[1] = Math.max(b.max[1], y); b.max[2] = Math.max(b.max[2], z)
}

export async function things(bytes: Uint8Array): Promise<Things> {
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
  // an accessor's numbers, `width` a vertex
  const floats = (i: number) => {
    const a = gltf.accessors[i]
    const width = WIDTH[a.type]
    const Arr = ARRAYS[a.componentType]
    const every = new Arr(views[a.bufferView!].slice().buffer)
    const stride = (gltf.bufferViews[a.bufferView!].byteStride || width * Arr.BYTES_PER_ELEMENT) / Arr.BYTES_PER_ELEMENT
    const offset = (a.byteOffset || 0) / Arr.BYTES_PER_ELEMENT
    const out = new Float32Array(a.count * width)
    for (let n = 0; n < a.count; n++) for (let k = 0; k < width; k++) {
      const x = every[n * stride + offset + k]
      out[n * width + k] = a.normalized ? Math.max(x / MOST[a.componentType], -1) : x
    }
    return { out, width }
  }
  const prim = (name: string) => {
    const node = gltf.nodes.find(n => n.name === name && n.mesh !== undefined)
    return node ? gltf.meshes[node.mesh!].primitives[0] : undefined
  }
  const info = gltf.nodes.find(n => n.name === 'pro-ng')?.extras
  if (!info) throw new Error('library: the place\'s glb has no `pro-ng` node; build it again with the library\'s pro-ng')

  const buildings: Building[] = []
  const solids = prim('solids')
  if (solids) {
    const pos = floats(solids.attributes.POSITION).out
    const ia = gltf.accessors[solids.indices]
    const index = new ARRAYS[ia.componentType](views[ia.bufferView!].slice().buffer)
    let t = 0
    for (const b of info.buildings ?? []) {
      const box = empty()
      for (let i = t * 3; i < (t + b.triangles) * 3; i++) grow(box, pos[index[i] * 3], pos[index[i] * 3 + 1], pos[index[i] * 3 + 2])
      t += b.triangles
      if (box.min[0] <= box.max[0]) buildings.push({ name: b.name, kind: b.kind, triangles: b.triangles, timber: b.timber ?? 0, box })
    }
  }

  const kit: KitThing[] = []
  const kitPrim = prim('kit')
  if (kitPrim && kitPrim.attributes._KIT !== undefined) {
    const pos = floats(kitPrim.attributes.POSITION).out
    const row = floats(kitPrim.attributes._KIT)
    const boxes = (info.kit?.things ?? []).map(empty)
    for (let n = 0; n < pos.length / 3; n++) {
      const r = Math.round(row.out[n * row.width + 1])
      if (boxes[r]) grow(boxes[r], pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2])
    }
    ;(info.kit?.things ?? []).forEach((t: { name: string; kind: string; parts: { material: string; triangles: number }[] }, r: number) => {
      if (boxes[r].min[0] > boxes[r].max[0]) return
      kit.push({ name: t.name, kind: t.kind, triangles: t.parts.reduce((s, p) => s + p.triangles, 0), materials: [...new Set(t.parts.map(p => p.material))], box: boxes[r] })
    })
  }
  return { scene: info.scene, buildings, kit, materials: info.kit?.materials ?? [] }
}
