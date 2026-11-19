// Writes sword.glb beside it: a plain glb of boxes, each part a mesh with a glTF material of its own, nothing
// of pro-ng's in it. It is the game's stand-in for any glb brought in from anywhere: the worker and the
// villager hold it as a loader `model`, beside the items of item3d's they hold. Its frame: metres, its grip
// at the origin, where the hand that holds it closes, its blade up +y from there. Each part is
// `[size [x, y, z], its middle, colour [r, g, b]]`. Run with `node games/demo_item3d/assets/sword.mjs`; the
// game's bake runs it.
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const PARTS = [
  [[0.03, 0.17, 0.03], [0, 0.01, 0], [0.32, 0.2, 0.12]],
  [[0.18, 0.025, 0.04], [0, 0.105, 0], [0.85, 0.66, 0.25]],
  [[0.045, 0.72, 0.01], [0, 0.48, 0], [0.78, 0.8, 0.84]],
  [[0.048, 0.04, 0.048], [0, -0.095, 0], [0.85, 0.66, 0.25]],
]

// A box's triangles: positions, normals and indices, its middle at `at`.
function box(size, at) {
  const pos = [], nrm = [], idx = []
  const quad = (a, b, c, d, n) => {
    const o = pos.length / 3
    for (const p of [a, b, c, d]) { pos.push(p[0] + at[0], p[1] + at[1], p[2] + at[2]); nrm.push(...n) }
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  const [x, y, z] = size.map(v => v / 2)
  quad([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0])
  quad([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0])
  quad([-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0])
  quad([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0])
  quad([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1])
  quad([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1])
  return { pos, nrm, idx }
}

const f32 = a => Buffer.from(new Float32Array(a).buffer)
const u16 = a => Buffer.from(new Uint16Array(a).buffer)
const pad = b => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b)
const bufs = [], views = [], accessors = [], meshes = [], materials = [], nodes = [{ name: 'sword', children: [] }]
let off = 0
const view = (b, target) => {
  bufs.push(pad(b))
  views.push({ buffer: 0, byteOffset: off, byteLength: b.length, target })
  off += pad(b).length
  return views.length - 1
}
PARTS.forEach(([size, at, colour], i) => {
  const { pos, nrm, idx } = box(size, at)
  const lo = [0, 1, 2].map(k => Math.min(...pos.filter((_, j) => j % 3 === k)))
  const hi = [0, 1, 2].map(k => Math.max(...pos.filter((_, j) => j % 3 === k)))
  accessors.push({ bufferView: view(f32(pos), 34962), componentType: 5126, count: pos.length / 3, type: 'VEC3', min: lo, max: hi })
  accessors.push({ bufferView: view(f32(nrm), 34962), componentType: 5126, count: nrm.length / 3, type: 'VEC3' })
  accessors.push({ bufferView: view(u16(idx), 34963), componentType: 5123, count: idx.length, type: 'SCALAR' })
  materials.push({ pbrMetallicRoughness: { baseColorFactor: [...colour, 1], metallicFactor: 0, roughnessFactor: 0.6 } })
  meshes.push({ primitives: [{ attributes: { POSITION: 3 * i, NORMAL: 3 * i + 1 }, indices: 3 * i + 2, material: i }] })
  nodes.push({ name: `sword${i}`, mesh: i })
  nodes[0].children.push(nodes.length - 1)
})
const gltf = {
  asset: { version: '2.0', generator: 'sword.mjs' },
  scene: 0, scenes: [{ nodes: [0] }], nodes, meshes, materials,
  buffers: [{ byteLength: off }], bufferViews: views, accessors,
}
const json = Buffer.from(JSON.stringify(gltf))
const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
const bin = Buffer.concat(bufs)
const head = Buffer.alloc(12)
head.writeUInt32LE(0x46546c67, 0)
head.writeUInt32LE(2, 4)
head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8)
const chunk = (data, type) => {
  const h = Buffer.alloc(8)
  h.writeUInt32LE(data.length, 0)
  h.writeUInt32LE(type, 4)
  return Buffer.concat([h, data])
}
const out = path.join(import.meta.dirname, 'sword.glb')
writeFileSync(out, Buffer.concat([head, chunk(jsonChunk, 0x4e4f534a), chunk(bin, 0x004e4942)]))
console.log('wrote', out)
