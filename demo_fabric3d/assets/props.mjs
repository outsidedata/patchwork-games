// Writes the props the X Bots carry (`world.anim.kinds`' `props`), each a .glb beside it built of boxes and
// cylinders: the `pole` a wanderer carries its flag on, and the `stick` the seat's body trails its ribbon
// from. Each prop's frame: metres, its `grip` empty at the origin, where the hand that holds it closes, its
// stave up +y from there, and its `tip` empty where its fabric is pinned (`assets/fabrics.json`). Each part
// is a mesh of its own, `[shape, size, at, colour]`:
//   box       size [x, y, z], its middle at `at`
//   cylinder  size [radius, length], its middle at `at`, its length along `axis` (y unless given)
// Run with
// `node games/demo_fabric3d/assets/props.mjs <folder>`, which writes them into that folder; the game's bake
// runs it into its scratch and packs each from there.
import { writeFileSync } from 'node:fs'
import path from 'node:path'

// The folder the glbs are written into: the one named, the bake's scratch, which the bake then packs from.
const into = process.argv[2]
if (!into) throw new Error('props.mjs is run with the folder to write into: node props.mjs <folder>')

const WOOD =[0.45, 0.3, 0.17], GOLD = [0.85, 0.66, 0.25]

const PROPS = {
  pole: {
    parts: [
      ['cylinder', [0.016, 2.6], [0, 0.8, 0], WOOD],
      ['cylinder', [0.03, 0.06], [0, 2.13, 0], GOLD],
    ],
    tip: [0, 2.1, 0],
  },
  stick: {
    parts: [
      ['cylinder', [0.008, 0.6], [0, 0.22, 0], WOOD],
      ['cylinder', [0.012, 0.02], [0, 0.53, 0], GOLD],
    ],
    tip: [0, 0.52, 0],
  },
}

const SIDES = 16

// One part's triangles: positions, normals and indices, laid where the part stands.
function mesh([shape, size, at, , axis = 'y']) {
  const pos = [], nrm = [], idx = []
  const quad = (a, b, c, d, n) => {
    const o = pos.length / 3
    for (const p of [a, b, c, d]) { pos.push(...p); nrm.push(...n) }
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  if (shape === 'box') {
    const [x, y, z] = size.map(v => v / 2)
    quad([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0])
    quad([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0])
    quad([-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0])
    quad([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0])
    quad([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1])
    quad([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1])
  } else {
    const [r, len] = size
    const h = len / 2
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2, b = ((i + 1) / SIDES) * Math.PI * 2
      const p = (t, y) => [Math.cos(t) * r, y, -Math.sin(t) * r]
      const m = (a + b) / 2
      quad(p(a, -h), p(b, -h), p(b, h), p(a, h), [Math.cos(m), 0, -Math.sin(m)])
      const o = pos.length / 3
      pos.push(0, h, 0, ...p(a, h), ...p(b, h), 0, -h, 0, ...p(b, -h), ...p(a, -h))
      nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0)
      idx.push(o, o + 1, o + 2, o + 3, o + 4, o + 5)
    }
  }
  // Laid along its axis: y as built, x or z turned onto it.
  const lay = axis === 'x' ? ([x, y, z]) => [y, -x, z] : axis === 'z' ? ([x, y, z]) => [x, -z, y] : v => v
  for (const list of [pos, nrm]) for (let i = 0; i < list.length; i += 3) list.splice(i, 3, ...lay(list.slice(i, i + 3)))
  for (let i = 0; i < pos.length; i += 3) for (let j = 0; j < 3; j++) pos[i + j] += at[j]
  return { pos, nrm, idx }
}

function glb(name, { parts, tip }) {
  const f32 = a => Buffer.from(new Float32Array(a).buffer)
  const u16 = a => Buffer.from(new Uint16Array(a).buffer)
  const pad = b => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b)
  const bufs = [], views = [], accessors = [], meshes = [], materials = [], nodes = [{ name, children: [] }]
  let off = 0
  const view = (b, target) => {
    bufs.push(pad(b))
    views.push({ buffer: 0, byteOffset: off, byteLength: b.length, target })
    off += pad(b).length
    return views.length - 1
  }
  parts.forEach((part, i) => {
    const { pos, nrm, idx } = mesh(part)
    const lo = [0, 1, 2].map(k => Math.min(...pos.filter((_, j) => j % 3 === k)))
    const hi = [0, 1, 2].map(k => Math.max(...pos.filter((_, j) => j % 3 === k)))
    accessors.push({ bufferView: view(f32(pos), 34962), componentType: 5126, count: pos.length / 3, type: 'VEC3', min: lo, max: hi })
    accessors.push({ bufferView: view(f32(nrm), 34962), componentType: 5126, count: nrm.length / 3, type: 'VEC3' })
    accessors.push({ bufferView: view(u16(idx), 34963), componentType: 5123, count: idx.length, type: 'SCALAR' })
    const [r, g, b] = part[3]
    materials.push({ pbrMetallicRoughness: { baseColorFactor: [r, g, b, 1], metallicFactor: 0, roughnessFactor: 0.6 } })
    meshes.push({ primitives: [{ attributes: { POSITION: 3 * i, NORMAL: 3 * i + 1 }, indices: 3 * i + 2, material: i }] })
    nodes.push({ name: `${name}${i}`, mesh: i })
    nodes[0].children.push(nodes.length - 1)
  })
  nodes.push({ name: 'grip', translation: [0, 0, 0] })
  nodes[0].children.push(nodes.length - 1)
  nodes.push({ name: 'tip', translation: tip })
  nodes[0].children.push(nodes.length - 1)
  const gltf = {
    asset: { version: '2.0', generator: 'props.mjs' },
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
  const out = path.join(into, `${name}.glb`)
  writeFileSync(out, Buffer.concat([head, chunk(jsonChunk, 0x4e4f534a), chunk(bin, 0x004e4942)]))
  console.log('wrote', out)
}

for (const [name, prop] of Object.entries(PROPS)) glb(name, prop)
