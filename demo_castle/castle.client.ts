// The town drawn as the library's pro-ng cuts it (its `procedural.py`, the scene
// `pro-ng/scenes/castle/smallville/smallville.town.json`) and packs it (`pack.mjs`), through supershader3d, the scene's
// one shader, composed from the materials the town draws (`assets/smallville.town.looks.json`, which the pack writes
// beside the glb). Nothing here knows a material or a mesh: the glb's node `pro-ng` says it in its extras' `vertex`
// (pack.mjs, VERTEX): the meshes to draw, each of the shader's vertex inputs as the glb's attributes' numbers, and the
// number an input reads on a mesh that has not its attribute. Every mesh's vertices go into one geometry, each input
// its own attribute; every triangle into the run of the draw call that draws its material (its vertices' `lookId`,
// the looks file's `call`): solid, relief, see-through, at most three calls. The buildings' course table, which the
// wall looks read, is written into the fortress's (`plugins/fortress/fortress.plugin.ts`). Everything casts and takes
// shadows. The ground under it is terrain3d's (`assets/demo_castle.field.json`), flattened under the town by the
// town's layer.
//
// The town's moving things. A kit thing that moves (the tavern's ceiling fan) skins the glb's mesh `kit`: its
// JOINTS_0 and WEIGHTS_0 name the joints of the glb's one skin, joint 0 the node `kit bones` at the world's zero, which
// never moves, and each other joint a node `<thing> <bone>` under it at the bone's pivot. Then the town is one
// THREE.SkinnedMesh in the same calls: its skeleton the skin's nodes as bones under the mesh with the skin's inverse
// bind matrices, every vertex of a mesh with no joints (the solids, the coverings, the timber) wholly on joint 0, so
// it stands where it was cut. A kit mesh with morph targets (sparse POSITION and NORMAL, named in the mesh's
// extras' `targetNames`) gives the geometry its morph attributes, nought on every other mesh's vertices. Three adds
// its skinning and morph chunks to supershader3d's materials for a skinned mesh, and the looks read the vertex's
// `position` and `normal` as cut, so a texture stays on the part that moves. Each clip of the town's clips file
// (`assets/smallville.town.clips.json`, the definition's `clips`) is an AnimationClip on one mixer on that mesh: a
// clip of bones made from the glb's animation it names (each channel's keys, linear, onto its bone's quaternion or
// position), a clip of poses made as the morph targets' weights, at
// each pose's time its target's weight 1 and every other 0, so between two poses the two targets blend in a straight
// line. The fortress plays them (`animate`), each whose `start` is on from the town's first frame, and the game
// starts and stops them by name (`plugins.fortress.clip`). A town with no moving thing is a plain mesh, as before.
import type * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import type { Call, Looks } from '#plugins/supershader3d/supershader3d.plugin.ts'
import type { CourseRow, Played } from './plugins/fortress/fortress.plugin.ts'

// the extras' `vertex`: the meshes drawn, each input's numbers, each input's default
type Vertex = { meshes: string[]; attributes: Record<string, [string, number][]>; defaults: Record<string, number> }
type Info = { courses: CourseRow[]; vertex: Vertex }
type Accessor = {
  bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean
  sparse?: { count: number; indices: { bufferView: number; byteOffset?: number; componentType: number }; values: { bufferView: number; byteOffset?: number } }
}
type Gltf = {
  nodes: { name: string; mesh?: number; skin?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; extras?: unknown }[]
  meshes: { primitives: { attributes: Record<string, number>; indices: number; targets?: Record<string, number>[] }[]; weights?: number[]; extras?: { targetNames?: string[] } }[]
  accessors: Accessor[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: { byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } } }[]
  skins?: { joints: number[]; inverseBindMatrices: number }[]
  animations?: { name: string; channels: { sampler: number; target: { node?: number; path: string } }[]; samplers: { input: number; output: number; interpolation?: string }[] }[]
}

// The clips file: each moving thing's clips, as its kind wrote them.
export type TownClip = {
  about: string; how: string; start: 'on' | 'off'; loop: boolean; seconds: number
  animation?: string; poses?: { time: number; target: number | null }[]
}
export type TownClips = { things: { thing: string; kind: string; clips: Record<string, TownClip> }[] }

// a mesh's vertices: each input's numbers, `count` vertices of the input's width, and its index; on a skinned mesh
// its joints (the skin's) and weights, four a vertex, and on a mesh with morph targets each target's moves
type Mesh = {
  count: number; inputs: Record<string, Float32Array>; index: Uint32Array
  joints?: Float32Array; weights?: Float32Array; targets?: { position: Float32Array; normal?: Float32Array }[]; targetNames?: string[]; morphWeights?: number[]
}
// a bone of the skin: its node's name, the bone it hangs from (its number among the skin's joints, -1 for none) and
// its node's place
type Bone = { name: string; parent: number; translation: number[]; rotation: number[]; scale: number[] }
// a channel of an animation: the bone it moves (its number among the skin's joints), the property, and the keys'
// times and values, linear between keys
type Track = { joint: number; path: 'translation' | 'rotation'; times: Float32Array; values: Float32Array }
export type Unpacked = {
  info: Info; meshes: Mesh[]
  skin?: { bones: Bone[]; inverses: Float32Array }
  animations: { name: string; tracks: Track[] }[]
}

let built: THREE.Object3D[] = []
let disposers: (() => void)[] = []
let gone = false
// the town once unpacked, waiting for supershader3d's materials, and its clips file
let waiting: { town: Unpacked; clips: TownClips } | undefined

const CALLS: Call[] = ['solid', 'relief', 'seeThrough']
const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
const ARRAYS: Record<number, any> = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const MOST: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }
const PATHS = new Set(['translation', 'rotation'])

// the glb's extras, each mesh the extras name with every input read off its attributes, or its default, its joints,
// weights and morph targets, and the skin and the animations
export async function unpack(bytes: Uint8Array): Promise<Unpacked> {
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
  // `count` numbers of `width` of type `componentType` from a view, from `byteOffset`, `stride` bytes apart
  const numbers = (bufferView: number, byteOffset: number, componentType: number, count: number, width: number, normalized: boolean, out: Float32Array, place?: (n: number) => number) => {
    const Arr = ARRAYS[componentType]
    const every = new Arr(views[bufferView].slice().buffer)
    const stride = (gltf.bufferViews[bufferView].byteStride || width * Arr.BYTES_PER_ELEMENT) / Arr.BYTES_PER_ELEMENT
    const offset = byteOffset / Arr.BYTES_PER_ELEMENT
    for (let n = 0; n < count; n++) {
      const to = place ? place(n) : n
      for (let k = 0; k < width; k++) {
        const x = every[n * stride + offset + k]
        out[to * width + k] = normalized ? Math.max(x / MOST[componentType], -1) : x
      }
    }
  }
  const floatsOf = (i: number) => {
    const a = gltf.accessors[i]
    const width = WIDTH[a.type]
    const out = new Float32Array(a.count * width)
    if (a.bufferView !== undefined) numbers(a.bufferView, a.byteOffset || 0, a.componentType, a.count, width, !!a.normalized, out)
    if (a.sparse) {
      const s = a.sparse
      const at = new Float32Array(s.count)
      numbers(s.indices.bufferView, s.indices.byteOffset || 0, s.indices.componentType, s.count, 1, false, at)
      numbers(s.values.bufferView, s.values.byteOffset || 0, a.componentType, s.count, width, !!a.normalized, out, n => at[n])
    }
    return { floats: out, width }
  }
  const info = gltf.nodes.find(n => n.name === 'pro-ng')!.extras as Info
  if (!info.vertex) throw new Error('castle: the town glb has no extras `vertex`; bake it again with the library\'s pro-ng/pack.mjs')
  const skinned = new Set<number>()
  const meshes = info.vertex.meshes.map((name): Mesh => {
    const node = gltf.nodes.find(n => n.name === name && n.mesh !== undefined)
    if (!node) throw new Error(`castle: the town glb's extras name the mesh ${name}, which it has not`)
    const mesh = gltf.meshes[node.mesh!]
    const prim = mesh.primitives[0]
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
    const out: Mesh = { count, inputs, index: Uint32Array.from(new ARRAYS[ia.componentType](views[ia.bufferView!].slice().buffer)) }
    if (prim.attributes.JOINTS_0 !== undefined) {
      if (node.skin === undefined) throw new Error(`castle: the town glb's mesh ${name} has joints and no skin`)
      skinned.add(node.skin)
      out.joints = floatsOf(prim.attributes.JOINTS_0).floats
      out.weights = floatsOf(prim.attributes.WEIGHTS_0).floats
    }
    if (prim.targets?.length) {
      out.targets = prim.targets.map(t => ({ position: floatsOf(t.POSITION).floats, ...(t.NORMAL !== undefined ? { normal: floatsOf(t.NORMAL).floats } : {}) }))
      out.targetNames = mesh.extras?.targetNames
      out.morphWeights = mesh.weights
    }
    return out
  })
  if (skinned.size > 1) throw new Error(`castle: the town glb's meshes are skinned to ${skinned.size} skins, and the town is drawn on one`)
  if (meshes.filter(m => m.targets).length > 1) throw new Error('castle: more than one of the town glb\'s meshes has morph targets, and a pose names its target by its number on the one')
  const unpacked: Unpacked = { info, meshes, animations: [] }
  const joints = skinned.size ? gltf.skins![[...skinned][0]].joints : []
  if (skinned.size) {
    const skin = gltf.skins![[...skinned][0]]
    const parentOf = new Map<number, number>()
    gltf.nodes.forEach((n, i) => n.children?.forEach(c => parentOf.set(c, i)))
    const bones = joints.map((j): Bone => {
      const n = gltf.nodes[j]
      const up = parentOf.get(j)
      return { name: n.name, parent: up === undefined ? -1 : joints.indexOf(up), translation: n.translation ?? [0, 0, 0], rotation: n.rotation ?? [0, 0, 0, 1], scale: n.scale ?? [1, 1, 1] }
    })
    bones.forEach((b, k) => {
      if (b.parent === -1 && parentOf.get(joints[k]) !== undefined) throw new Error(`castle: the town glb's bone ${b.name} hangs from a node that is no joint of its skin`)
    })
    unpacked.skin = { bones, inverses: floatsOf(skin.inverseBindMatrices).floats }
  }
  for (const a of gltf.animations ?? []) {
    const tracks = a.channels.map((c): Track => {
      const s = a.samplers[c.sampler]
      if (!PATHS.has(c.target.path)) throw new Error(`castle: the town glb's animation ${a.name} moves ${c.target.path}, which is not a bone's rotation or translation`)
      if ((s.interpolation ?? 'LINEAR') !== 'LINEAR') throw new Error(`castle: the town glb's animation ${a.name} is ${s.interpolation}, and the town's clips are linear`)
      const path = c.target.path as Track['path']
      const joint = joints.indexOf(c.target.node!)
      if (joint < 0) throw new Error(`castle: the town glb's animation ${a.name} moves the node ${gltf.nodes[c.target.node!]?.name}, which is no joint of the town's skin`)
      return { joint, path, times: floatsOf(s.input).floats, values: floatsOf(s.output).floats }
    })
    unpacked.animations.push({ name: a.name, tracks })
  }
  return unpacked
}

export function setup(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind)
  const clips = json(plugins.wire, k.clips) as TownClips
  // An actor is set up before the loader's first tick, so the town is built once its glb has landed.
  plugins.loader.load(k.glb).then(async (glb: any) => {
    const town = await unpack(glb.bytes)
    if (!gone) waiting = { town, clips }
  })
}

// Every mesh in one geometry, each triangle in its call's run, drawn by that call's material (`material(call)`): a
// SkinnedMesh on the glb's skin when it has one, its bones under it, else a Mesh.
export function assemble(T: typeof THREE, { info, meshes, skin }: Unpacked, looks: Looks, material: (call: Call) => THREE.Material) {
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
      const look = looks.materials[Math.round(lookId[v])]
      if (!look) throw new Error(`castle: a vertex's lookId ${lookId[v]} is no material of the town's looks`)
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
  // the morph targets: each one's moves on its mesh's vertices, nought on every other's
  const morphed = meshes.find(m => m.targets)
  if (morphed) {
    const from = meshes.slice(0, meshes.indexOf(morphed)).reduce((n, m) => n + m.count, 0)
    const position: THREE.BufferAttribute[] = [], normal: THREE.BufferAttribute[] = []
    const normals = morphed.targets!.some(t => t.normal)
    for (const t of morphed.targets!) {
      const p = new Float32Array(total * 3)
      p.set(t.position, from * 3)
      position.push(new T.BufferAttribute(p, 3))
      if (normals) {
        const n = new Float32Array(total * 3)
        if (t.normal) n.set(t.normal, from * 3)
        normal.push(new T.BufferAttribute(n, 3))
      }
    }
    geo.morphAttributes.position = position
    if (normals) geo.morphAttributes.normal = normal
    geo.morphTargetsRelative = true
  }
  geo.computeBoundingSphere()
  if (!skin) {
    const mesh = new T.Mesh(geo, materials)
    if (morphed) prime(mesh, morphed)
    return mesh
  }
  // the joints and weights, four a vertex: a mesh with none wholly on joint 0, the bone that never moves
  const wide = skin.bones.length > 256
  const joints = wide ? new Uint16Array(total * 4) : new Uint8Array(total * 4)
  const weights = new Uint8Array(total * 4)
  base = 0
  for (const m of meshes) {
    if (m.joints) {
      joints.set(m.joints, base * 4)
      for (let i = 0; i < m.count * 4; i++) weights[base * 4 + i] = Math.round(m.weights![i] * 255)
    } else {
      for (let v = 0; v < m.count; v++) weights[(base + v) * 4] = 255
    }
    base += m.count
  }
  geo.setAttribute('skinIndex', new T.BufferAttribute(joints, 4))
  geo.setAttribute('skinWeight', new T.BufferAttribute(weights, 4, true))
  const mesh = new T.SkinnedMesh(geo, materials)
  const bones = skin.bones.map(b => {
    const bone = new T.Bone()
    bone.name = b.name
    bone.position.fromArray(b.translation)
    bone.quaternion.fromArray(b.rotation)
    bone.scale.fromArray(b.scale)
    return bone
  })
  skin.bones.forEach((b, k) => (b.parent < 0 ? mesh : bones[b.parent]).add(bones[k]))
  const inverses = skin.bones.map((_, k) => new T.Matrix4().fromArray(skin.inverses, k * 16))
  mesh.bind(new T.Skeleton(bones, inverses), new T.Matrix4())
  if (morphed) prime(mesh, morphed)
  return mesh
}

// a mesh's morph weights as the glb gives them, and its targets by their names
function prime(mesh: THREE.Mesh, m: Mesh) {
  mesh.updateMorphTargets()
  m.morphWeights?.forEach((w, i) => { mesh.morphTargetInfluences![i] = w })
  if (m.targetNames) mesh.morphTargetDictionary = Object.fromEntries(m.targetNames.map((n, i) => [n, i]))
}

// Each clip of the clips file on `mixer`, its AnimationClip made from the glb's animation it names or from its poses.
export function played(T: typeof THREE, mixer: THREE.AnimationMixer, mesh: THREE.Mesh, { animations, skin }: Unpacked, clips: TownClips): Played[] {
  const bones = (mesh as THREE.SkinnedMesh).skeleton?.bones ?? []
  const targets = mesh.morphTargetInfluences?.length ?? 0
  const out: Played[] = []
  for (const { thing, clips: own } of clips.things) {
    for (const [name, c] of Object.entries(own)) {
      const where = `the clip ${name} of ${thing}`
      const tracks: THREE.KeyframeTrack[] = []
      if (c.animation !== undefined) {
        const a = animations.find(a => a.name === c.animation)
        if (!a) throw new Error(`castle: ${where} plays the animation ${c.animation}, which the town glb has not`)
        if (!skin) throw new Error(`castle: ${where} moves bones, and the town glb has no skin`)
        for (const t of a.tracks) {
          const bone = bones[t.joint].uuid
          if (t.path === 'rotation') tracks.push(new T.QuaternionKeyframeTrack(`${bone}.quaternion`, t.times, t.values))
          else tracks.push(new T.VectorKeyframeTrack(`${bone}.position`, t.times, t.values))
        }
      } else if (c.poses) {
        // each target the poses name: weight 1 at its poses, 0 at every other, a straight line between
        const times = Float32Array.from(c.poses, p => p.time)
        const used = new Set(c.poses.flatMap(p => (p.target === null ? [] : [p.target])))
        for (const i of used) {
          if (i < 0 || i >= targets) throw new Error(`castle: ${where} poses the target ${i}, and the town's mesh has ${targets}`)
          tracks.push(new T.NumberKeyframeTrack(`.morphTargetInfluences[${i}]`, times, Float32Array.from(c.poses, p => (p.target === i ? 1 : 0))))
        }
      } else {
        throw new Error(`castle: ${where} has neither an animation nor poses`)
      }
      const clip = new T.AnimationClip(`${thing} ${name}`, c.seconds, tracks)
      out.push({ thing, clip: name, start: c.start === 'on', loop: c.loop, action: mixer.clipAction(clip) })
    }
  }
  return out
}

// The town built, its course table written into the fortress's and its clips handed to the fortress.
function build(T: typeof THREE, plugins: Plugins, { town, clips }: { town: Unpacked; clips: TownClips }) {
  const looks: Looks = plugins.supershader3d.looks()
  plugins.fortress.town(T, town.info.courses)
  const mesh = assemble(T, town, looks, call => {
    const material = plugins.supershader3d.material(call)
    if (!material) throw new Error(`castle: the town draws ${call} triangles, and supershader3d has no ${call} material`)
    return material
  })
  mesh.castShadow = mesh.receiveShadow = true
  plugins.render3d.scene.add(mesh)
  built.push(mesh)
  disposers.push(() => mesh.geometry.dispose())
  if (clips.things.length) {
    const mixer = new T.AnimationMixer(mesh)
    plugins.fortress.animate(T, mixer, played(T, mixer, mesh, town, clips))
    disposers.push(() => { plugins.fortress.still(); mixer.uncacheRoot(mesh) })
    if (mesh instanceof T.SkinnedMesh) disposers.push(() => mesh.skeleton.dispose())
  }
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
