// node games/giantslayer/assets/sword.mjs: writes sword.glb beside this file, the hero's sword, made of
// boxes: a blade and a grip along +Y from the origin (where the hand holds it) and a crossguard across
// it. Every size is metres. The grip runs down from the origin, the blade up from the guard.
import { writeFileSync } from 'node:fs'

const BOXES = [
  // [centre x, y, z], [size x, y, z], material
  { at: [0, -0.06, 0], size: [0.035, 0.16, 0.035], material: 1 },
  { at: [0, 0.03, 0], size: [0.2, 0.03, 0.05], material: 1 },
  { at: [0, 0.48, 0], size: [0.06, 0.86, 0.012], material: 0 },
]
const MATERIALS = [
  { name: 'blade', pbrMetallicRoughness: { baseColorFactor: [0.82, 0.84, 0.88, 1], metallicFactor: 0.9, roughnessFactor: 0.3 } },
  { name: 'hilt', pbrMetallicRoughness: { baseColorFactor: [0.35, 0.22, 0.12, 1], metallicFactor: 0, roughnessFactor: 0.8 } },
]

// A box's 24 corners (four a face, so each face has its own normal) and its 36 indices.
function box({ at, size }) {
  const h = size.map(s => s / 2)
  const faces = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ]
  const pos = [], nor = [], idx = []
  for (const [n, u, v] of faces) {
    const base = pos.length / 3
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let i = 0; i < 3; i++) pos.push(at[i] + (n[i] + u[i] * a + v[i] * b) * h[i])
      nor.push(...n)
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  return { pos, nor, idx }
}

const chunks = [], views = [], accessors = [], primitives = []
let offset = 0
const add = (array, target) => {
  const bytes = Buffer.from(array.buffer)
  chunks.push(bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4))
  views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target })
  offset += bytes.length + ((4 - (bytes.length % 4)) % 4)
  return views.length - 1
}
for (const b of BOXES) {
  const { pos, nor, idx } = box(b)
  const lo = [0, 1, 2].map(i => Math.min(...pos.filter((_, j) => j % 3 === i)))
  const hi = [0, 1, 2].map(i => Math.max(...pos.filter((_, j) => j % 3 === i)))
  accessors.push({ bufferView: add(new Float32Array(pos), 34962), componentType: 5126, count: pos.length / 3, type: 'VEC3', min: lo, max: hi })
  accessors.push({ bufferView: add(new Float32Array(nor), 34962), componentType: 5126, count: nor.length / 3, type: 'VEC3' })
  accessors.push({ bufferView: add(new Uint16Array(idx), 34963), componentType: 5123, count: idx.length, type: 'SCALAR' })
  const n = accessors.length
  primitives.push({ attributes: { POSITION: n - 3, NORMAL: n - 2 }, indices: n - 1, material: b.material })
}
const bin = Buffer.concat(chunks)
const gltf = {
  asset: { version: '2.0', generator: 'giantslayer sword.mjs' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'sword', mesh: 0 }],
  meshes: [{ name: 'sword', primitives }], materials: MATERIALS,
  buffers: [{ byteLength: bin.length }], bufferViews: views, accessors,
}
let json = Buffer.from(JSON.stringify(gltf))
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8)
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8)
jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4)
bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4)
const out = new URL('sword.glb', import.meta.url)
writeFileSync(out, Buffer.concat([head, jh, json, bh, bin]))
console.log('wrote', out.pathname, 12 + 8 + json.length + 8 + bin.length, 'bytes')
