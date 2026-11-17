// Reads an AWOL animal's glb, a body on the AWOL bones (pelvis, spine 1 to 5, chest, the four legs from
// the hips and shoulders down to the paws, neck, head, jaw, ears, tail 1 to 7), and writes from it the
// two files its drawing and its walk are read from:
//
//   node games/demo_horse3d/assets/awol/awol.measure.mjs <animal.glb> <animal sheet.json> <animal.skeleton.json>
//
// The skeleton (`<animal.skeleton.json>`): every bone of the glb's skin as skinlab draws a bone, `{ name,
// parent, head, tail, across }`, metres, the body standing as the glb has it: its head the joint, its
// tail the joint it runs to (`TAILS`), and a paw's tail the bottom of its foot, where the skin's points
// that hang most on that paw come lowest. A bone with no joint to run to runs on from its parent, `LEAF`
// metres. Its layout is `awolQuadrupedLayout` (`plugins/skinlab/awolQuadrupedLayout.ts`).
//
// The sheet (`<animal sheet.json>`): its `walk` block's measures of the body, as the pureQuadrupedDriver
// reads them (`plugins/skinlab/pureQuadrupedDriver.ts`), from the same joints, over the lowest point of
// the skin: `hip`, `withers`, `span`, `hoof`, `homes`, `stance`, `centre` (half way between the homes),
// the four lengths of each leg and how far each of its points stands out of its plane (`out`), each leg's `cannon.rest` and `pastern.rest` (so the driver stands the
// legs as the glb has them), and `spine`, the points of the back from the pelvis to the neck. Every
// other number of the sheet is the animal's own and is left as it is.
import { readFileSync, writeFileSync } from 'node:fs'
import { make, step } from '../../plugins/skinlab/pureQuadrupedDriver.ts'

const [glbPath, sheetPath, skeletonPath] = process.argv.slice(2)
if (!glbPath || !sheetPath || !skeletonPath) throw new Error('awol.measure: give <animal.glb> <animal sheet.json> <animal.skeleton.json>')

// The joint each bone runs to; a bone named here with no tail, or not named, runs on from its parent.
const TAILS = {
  'pelvis': 'spine 2', 'spine 1': 'spine 2', 'spine 2': 'spine 3', 'spine 3': 'spine 4', 'spine 4': 'spine 5',
  'spine 5': 'chest', 'chest': 'neck', 'neck': 'head',
  'left shoulder': 'left elbow', 'left elbow': 'left wrist', 'left wrist': 'left front paw',
  'right shoulder': 'right elbow', 'right elbow': 'right wrist', 'right wrist': 'right front paw',
  'left hip': 'left stifle', 'left stifle': 'left hock', 'left hock': 'left hind paw',
  'right hip': 'right stifle', 'right stifle': 'right hock', 'right hock': 'right hind paw',
  'tail 1': 'tail 2', 'tail 2': 'tail 3', 'tail 3': 'tail 4', 'tail 4': 'tail 5', 'tail 5': 'tail 6', 'tail 6': 'tail 7',
}
const PAWS = ['left hind paw', 'left front paw', 'right hind paw', 'right front paw']
// How far a bone with no joint to run to runs on from its parent, metres.
const LEAF = 0.1
// The skin's points within this of a paw's lowest are the bottom of its foot, metres.
const SOLE = 0.01

const buf = readFileSync(glbPath)
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'))
const bin = buf.subarray(20 + jsonLen + 8)

const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
const READ = { 5120: ['readInt8', 1], 5121: ['readUInt8', 1], 5122: ['readInt16LE', 2], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4], 5126: ['readFloatLE', 4] }
const accessor = i => {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView], n = SIZE[a.type], [fn, bytes] = READ[a.componentType]
  const stride = v.byteStride ?? n * bytes, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return Array.from({ length: a.count }, (_, k) => Array.from({ length: n }, (_, c) => bin[fn](base + k * stride + c * bytes)))
}

// The joints, where each stands in the glb (each turned by nothing, so where it stands is the sum of the
// moves from the root down), and each one's parent.
const skin = gltf.skins[0], parent = {}
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach(c => (parent[c] = i)))
const at = i => { const t = gltf.nodes[i].translation ?? [0, 0, 0], p = parent[i]; return p === undefined ? t : at(p).map((v, k) => v + t[k]) }
const joints = skin.joints.map(i => ({ node: i, name: gltf.nodes[i].name, head: at(i), parent: skin.joints.includes(parent[i]) ? gltf.nodes[parent[i]].name : null }))
const named = Object.fromEntries(joints.map(j => [j.name, j]))

// The skin's points and how each hangs on the joints.
const prim = gltf.meshes[gltf.nodes.find(n => n.skin !== undefined).mesh].primitives[0]
const points = accessor(prim.attributes.POSITION), hangs = accessor(prim.attributes.JOINTS_0), weights = accessor(prim.attributes.WEIGHTS_0)
const ground = Math.min(...points.map(p => p[1]))
// The bottom of a paw's foot: the middle of the lowest of the points that hang most on it.
const sole = name => {
  const k = joints.findIndex(j => j.name === name)
  const mine = points.filter((_, v) => hangs[v][weights[v].indexOf(Math.max(...weights[v]))] === k)
  const low = Math.min(...mine.map(p => p[1])), foot = mine.filter(p => p[1] < low + SOLE)
  return [0, 1, 2].map(c => foot.reduce((s, p) => s + p[c], 0) / foot.length)
}
const soles = Object.fromEntries(PAWS.map(p => [p, sole(p)]))

const sub = (a, b) => a.map((v, k) => v - b[k])
const len = v => Math.hypot(...v)
const tailOf = j => {
  if (soles[j.name]) return soles[j.name]
  if (TAILS[j.name]) return named[TAILS[j.name]].head
  const from = sub(j.head, named[j.parent].head), l = len(from)
  return j.head.map((v, k) => v + (from[k] / l) * LEAF)
}
const r6 = v => +v.toFixed(6)
const bones = joints.map(j => ({ name: j.name, parent: j.parent, head: j.head.map(r6), tail: tailOf(j).map(r6), across: [1, 0, 0] }))
const entry = skeletonPath.split('/').pop().replace(/\.skeleton\.json$/, '')
writeFileSync(skeletonPath, JSON.stringify({ entry, layout: 'awolQuadrupedLayout', bones }, null, 2) + '\n')

// The walk's measures. Along the body, `u` is metres ahead of the hip joint (+z) and `y` up; the left
// hip and shoulder (+x) give the stance.
const hip = named['left hip'].head, shoulder = named['left shoulder'].head
// Every measure is kept to a hundredth of a millimetre: a leg the glb stands straight bends by
// centimetres at its elbow for a millimetre it is made short.
const u = p => p[2] - hip[2], kept = v => +v.toFixed(5)
// A leg in its own plane, as the driver lays it: the plane holds the leg's top `T` and the bottom of its
// foot `S` and runs straight ahead; each point is [ahead of the top, up from it along the plane] and how
// far out of the plane it stands, to the leg's own side (left +x). Its bones' lengths are their lengths
// in the plane, and every slope is taken in the plane.
const plane = (top, foot) => {
  const T = named[top].head, S = soles[foot], dy = S[1] - T[1], ds = S[0] - T[0], down = Math.hypot(dy, ds)
  return p => ({ q: [p[2] - T[2], -((p[1] - T[1]) * dy + (p[0] - T[0]) * ds) / down], out: ((p[1] - T[1]) * ds - (p[0] - T[0]) * dy) / down })
}
const legOf = (names, foot) => {
  const flat = plane(names[0], foot), pts = [...names.map(n => named[n].head), soles[foot]].map(flat)
  return { pts, bones: pts.slice(1).map((p, i) => kept(Math.hypot(p.q[0] - pts[i].q[0], p.q[1] - pts[i].q[1]))), out: pts.map(p => kept(p.out)) }
}
const sheet = JSON.parse(readFileSync(sheetPath, 'utf8'))
const W = sheet.walk
W.hip = kept(hip[1] - ground)
W.withers = kept(shoulder[1] - ground)
W.span = kept(u(shoulder))
W.hoof = { hind: kept(soles['left hind paw'][1] - ground), fore: kept(soles['left front paw'][1] - ground) }
W.homes = { hind: kept(u(soles['left hind paw'])), fore: kept(u(soles['left front paw'])) }
W.centre = kept((W.homes.hind + W.homes.fore) / 2)
W.stance = { hip: kept(hip[0]), shoulder: kept(shoulder[0]), hind: kept(soles['left hind paw'][0]), fore: kept(soles['left front paw'][0]) }
// How each leg's cannon and pastern slope as the glb stands, as the driver lays them standing: in the
// leg's own plane [ahead, up], a slope `a` from straight up toward ahead. Standing, every foot bears
// half (`STAND_LOAD`) and none is folded, so the driver lays the cannon at `follow·line + rest` (the line
// from the foot to the top of the leg) and the pastern at `-(rest + sink·half)`: each `rest` is then
// what lays it as the glb has it. `follow` and `sink` are the animal's own.
const STAND_LOAD = 0.5
const slope = (from, to) => Math.atan2(to.q[0] - from.q[0], to.q[1] - from.q[1])
const lay = (leg, names, foot) => {
  const { pts, bones, out } = legOf(names, foot), [H, , J, K, F] = pts
  leg.bones = bones
  leg.out = out
  // A leg the glb stands straighter than its own `straight` lets it reach is let reach that far.
  const reach = Math.hypot(J.q[0] - H.q[0], J.q[1] - H.q[1]) / (bones[0] + bones[1])
  leg.straight = Math.max(leg.straight, Math.ceil(reach * 1e5) / 1e5)
  // A body the glb stands on legs reaching further than its spring's `taut` lets them is let stand so.
  const stands = Math.hypot(F.q[0] - H.q[0], F.q[1] - H.q[1]) / bones.reduce((a, b) => a + b)
  W.spring.taut = Math.max(W.spring.taut, Math.ceil(stands * 1e5) / 1e5)
  leg.cannon.rest = kept(slope(K, J) - leg.cannon.follow * slope(F, H))
  leg.pastern.rest = kept(-slope(F, K) - leg.pastern.sink * STAND_LOAD)
}
lay(W.hind, ['left hip', 'left stifle', 'left hock', 'left hind paw'], 'left hind paw')
lay(W.fore, ['left shoulder', 'left elbow', 'left wrist', 'left front paw'], 'left front paw')
// How far the body rides down at each pace (`crouch`): far enough that a standing leg reaches its foot
// from where it lands to where it lifts, never more than `taut` of its length, so the body is never held
// down to a foot it cannot reach. At a pace's speed `v` a foot stands `cycle·(1−air)` seconds, while the
// body goes `v` times that over it; it lands the pace's lead ahead of its home (`min(reach, travel·lead)`,
// as the driver puts it down) and lifts the rest of that behind. Its home stands ahead of the top of its
// leg as the glb has it, and the leg's drop from its top to its foot in its plane is the glb's.
const reachOf = (names, foot, home, top) => {
  const { pts } = legOf(names, foot), H = pts[0], F = pts[4]
  const length = W.spring.taut * names.reduce((s, _, i) => s + (i < 3 ? Math.hypot(pts[i + 1].q[0] - pts[i].q[0], pts[i + 1].q[1] - pts[i].q[1]) : 0), 0) + Math.hypot(F.q[0] - pts[3].q[0], F.q[1] - pts[3].q[1]) * W.spring.taut
  return { drop: H.q[1] - F.q[1], length, home: home - top }
}
const ends = [
  reachOf(['left hip', 'left stifle', 'left hock', 'left hind paw'], 'left hind paw', W.homes.hind, 0),
  reachOf(['left shoulder', 'left elbow', 'left wrist', 'left front paw'], 'left front paw', W.homes.fore, W.span),
]
const crouchOf = (p, lead) => {
  const standing = p.cycle * (1 - p.air), travel = p.speed * standing, ahead = Math.min(W.gait.reach, travel * lead)
  return Math.max(0, ...ends.map(e => {
    const far = Math.max(Math.abs(e.home + ahead), Math.abs(e.home - (travel - ahead)))
    return e.drop - Math.sqrt(Math.max(0, e.length * e.length - far * far))
  }))
}
// The lead (`gait.lead`, the share of a stand's travel a foot lands ahead of its home) that has the body
// ride down least at its deepest pace: each foot's stand as near as it can be centred under its leg.
const LEADS = Array.from({ length: 101 }, (_, i) => i / 100)
W.gait.lead = LEADS.reduce((best, l) => (Math.max(...W.gait.paces.map(p => crouchOf(p, l))) < Math.max(...W.gait.paces.map(p => crouchOf(p, best))) ? l : best))
for (const p of W.gait.paces) p.crouch = kept(crouchOf(p, W.gait.lead))
// The spring lifts each end of the body above where it rides as its legs push: the crouch is that much
// deeper again, so the legs reach their feet at the top of the body's rise too. Each pace is walked by
// the driver itself, on flat land, its legs let reach as far as they like, for `RISE_STEPS` steps of
// `RISE_DT`, and the most either end rises above its ride once the pace is under way, after the first
// `RISE_SETTLE` steps, is added.
const RISE_DT = 1 / 60, RISE_STEPS = 600, RISE_SETTLE = 120
for (const p of W.gait.paces) {
  const free = { ...W, spring: { ...W.spring, taut: Infinity } }
  let pos = [0, 0, 0], rise = 0
  const g = make(free, { pos, yaw: 0, vel: [0, 0, p.speed] }, () => 0)
  for (let i = 0; i < RISE_STEPS; i++) {
    pos = [0, 0, pos[2] + p.speed * RISE_DT]
    step(free, g, { pos, yaw: 0, vel: [0, 0, p.speed] }, RISE_DT, () => 0)
    if (i >= RISE_SETTLE) rise = Math.max(rise, g.yH, g.yF)
  }
  p.crouch = kept(p.crouch + rise)
}
W.spine = ['pelvis', 'spine 2', 'spine 3', 'spine 4', 'spine 5', 'chest', 'neck'].map(n => [kept(u(named[n].head)), kept(named[n].head[1] - hip[1])])
writeFileSync(sheetPath, JSON.stringify(sheet, null, 2) + '\n')
console.log(`awol.measure: ${bones.length} bones into ${skeletonPath}; ground ${kept(ground)}; walk measures into ${sheetPath}:`, JSON.stringify({ hip: W.hip, withers: W.withers, span: W.span, hoof: W.hoof, homes: W.homes, centre: W.centre, stance: W.stance, hind: W.hind.bones, fore: W.fore.bones, out: [W.hind.out, W.fore.out], straight: [W.hind.straight, W.fore.straight], taut: W.spring.taut, lead: W.gait.lead, crouch: W.gait.paces.map(p => p.crouch), cannon: [W.hind.cannon.rest, W.fore.cannon.rest], pastern: [W.hind.pastern.rest, W.fore.pastern.rest], spine: W.spine }))
