// demo_world3d's light bake: the light inside a place's rooms, worked out once at bake time from the place's light
// hints alone, so the rooms are lit with no light running. `demo_world3d.bake.ts` runs it for each place it bakes with
// `light`, after the place's files are copied in; `node assets/demo_world3d.light.ts <folder> <name> <scene file>` runs
// it alone on a place already baked. It reads, from the folder:
//   <name>.glb        the place, unpacked as world3d draws it (`supershader3d.glb.ts`): its vertices, in the order
//                     world3d's one geometry holds them, which are where the light is written
//   <name>.nav.json   the light hints (the library's `stronghold/src/lib/util/light.mjs`), each a place of the nav
//                     graph with `data.light`, which are all the light comes from
// and from the scene file its `world.bakedlight.bake` (the numbers of the bake), its skydome3d row's clock
// (`prefabs.skydome3d`) and `world.skydome3d.day`, which give skydome3d's key light's way: the sun's while it is up,
// else the moon's.
//
// The hints, each a part of a room (its `room`), and what each gives a point standing in that room:
//   room      a box from its `low`, `high` and `across` places: the points it holds are its own
//   opening   a rectangle `width` by `height`, its middle the opening's place, facing its `inward` place, its width
//             toward its `across` place. With `sky`, the sky above the horizon and the ground below it as seen through
//             the rectangle from the point. With `beam`, the key light where the line from the point toward it passes
//             through the rectangle. With `rooms`, an opening between two rooms: each room has, through it, the other
//             room's own light (its mean over its points) `pass` times over.
//   lamp      a fire at its place: intensity 1 over the distance squared (`lampNear` the nearest it is counted)
//   dark      a box from its `low`, `high` and `across` places: a point under its top inside it has all its light
//             `under` times over
// Each is a function of a table from the part to its light, `PARTS`; a hint of a part the table has not throws.
//
// What it works out at each point are four numbers, each the light from one source, irradiance over pi for a source of
// radiance 1 (a floor open to the whole sky reads 1 in sky): sky, ground, key and fire. The page multiplies them by
// skydome3d's sky, ground and key colours and the fires' colour (`bakedlight.plugin.ts`).
//
// Which points: every timber and kit vertex inside a room's box (`margin` metres round it); and on the solids, which
// are big flat faces, a lightmap: each group of solid triangles joined by their vertices (one flat face of a wall,
// floor or ceiling) whose middle is inside a room is a chart, laid flat in the map at `texels` a metre with `pad`
// texels round it, and every texel of it a point. A texel no triangle covers takes its neighbours' light, `gutter`
// passes over.
//
// It writes <name>.light.bin, little-endian:
//   8 Uint32        'LBK1' (0x314b424c), the vertex count, the map's width and height, then four 0s
//   vertex × 8 f32  each vertex in world3d's order: its place (x, y, z), its mode (0 lit live, 1 its own light, 2 its
//                   light in the map), then its sky, ground, key and fire (mode 1) or its map uv and two 0s (mode 2)
//   w × h × 4 f16   the map, each texel's sky, ground, key and fire as half floats, row by row from v 0; its key the
//                   key light come through from another room alone
//   w × h f16       each texel's distance in texels into a sun patch (`edge` within, less than nought outside), which
//                   the page draws the sun patches' edges by and lights by the key light's cosine there
// A vertex's key is the key light's cosine where the line from it toward the key passes through an opening, with what
// comes through from another room.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unpack } from '#plugins/supershader3d/supershader3d.glb.ts'
import { sun as sunOf, moon as moonOf } from '#plugins/skydome3d/skydome3d.sim.ts'

// The numbers of the bake, `world.bakedlight.bake`.
//   texels    the map's texels a metre
//   pad       texels round each chart in the map
//   gutter    passes that give each uncovered texel of a chart its covered neighbours' light
//   map       [least, most] the map's width, a power of two, doubled from least until the charts fit
//   slack     how many times the charts' texels the map's area is at least
//   cover     how far outside a triangle (in its weights) a texel's middle may be and still be on it
//   axis      how near straight up or down a normal is (its y's size) past which a chart is laid out round x, not y
//   margin    the metres round a room's box a point may stand and be inside it
//   lampNear  the nearest any point is counted to a lamp, in metres
//   under     how many times its light a point under a dark hint keeps
//   pass      how many times a room's own light the room an opening between them joins has through it
//   edge      the most texels a sun patch's distance is kept to, either side of its edge
export type Bake = {
  texels: number; pad: number; gutter: number; map: [number, number]; slack: number; cover: number; axis: number
  margin: number; lampNear: number; under: number; pass: number; edge: number
}
// Every field of `world.bakedlight.bake`, each a number but `map`, two
const FIELDS = ['texels', 'pad', 'gutter', 'map', 'slack', 'cover', 'axis', 'margin', 'lampNear', 'under', 'pass', 'edge']
function check(s: Record<string, unknown>, sceneFile: string): Bake {
  for (const k of Object.keys(s)) if (!FIELDS.includes(k)) throw new Error(`demo_world3d's light bake: ${sceneFile}'s world.bakedlight.bake has ${k}, which is no field of it (${FIELDS.join(', ')})`)
  for (const k of FIELDS) {
    const v = s[k]
    const ok = k === 'map' ? Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number' && x > 0 && Number.isInteger(Math.log2(x))) && (v[0] as number) <= (v[1] as number) : typeof v === 'number' && Number.isFinite(v)
    if (!ok) throw new Error(`demo_world3d's light bake: ${sceneFile}'s world.bakedlight.bake.${k} is ${JSON.stringify(v)}, ${k === 'map' ? 'not [least, most], two powers of two' : 'not a number'}`)
  }
  return s as Bake
}
type V = [number, number, number]

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }

// A float as a half float's bits, rounded to the nearest; past the largest half, the largest.
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer)
export function half(x: number): number {
  f32[0] = x
  const b = u32[0], sign = (b >>> 16) & 0x8000
  const e = ((b >>> 23) & 0xff) - 127 + 15
  let m = b & 0x7fffff
  if (e >= 31) return sign | 0x7bff
  if (e <= 0) {
    if (e < -10) return sign
    m = (m | 0x800000) >>> (1 - e)
    return sign | ((m + 0x1000) >>> 13)
  }
  return (sign | (e << 10) | (m >>> 13)) + ((m >>> 12) & 1)
}

// A polygon's corners (relative to the point) cut to the side of the plane through the point where `dot(v, w) >= 0`.
function clip(poly: V[], w: V): V[] {
  const out: V[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = dot(a, w), db = dot(b, w)
    if (da >= 0) out.push(a)
    if ((da >= 0) !== (db >= 0)) out.push(add(a, sub(b, a), da / (da - db)))
  }
  return out
}
// The share of the cosine-weighted hemisphere round `n` a polygon (relative to the point, on its side of the point's
// plane) covers: Lambert's sum over its edges, 1 for the whole hemisphere.
function seen(poly: V[], n: V): number {
  let f = 0
  for (let i = 0; i < poly.length; i++) {
    const a = norm(poly[i]), b = norm(poly[(i + 1) % poly.length])
    const c = cross(a, b), s = Math.hypot(...c)
    if (s < 1e-12) continue
    f += Math.acos(Math.min(1, Math.max(-1, dot(a, b)))) * dot(n, [c[0] / s, c[1] / s, c[2] / s])
  }
  return Math.abs(f) / (2 * Math.PI)
}

// How far inside a convex polygon (its corners in order, either way round) the origin is: the distance to its nearest
// edge, less than nought outside it.
function inside(poly: [number, number][]): number {
  let near = Infinity, side = 0, within = true
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]
    const ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey
    const k = len2 ? Math.max(0, Math.min(1, -(ax * ex + ay * ey) / len2)) : 0
    near = Math.min(near, Math.hypot(ax + ex * k, ay + ey * k))
    const turn = Math.sign(ex * -ay - ey * -ax)
    if (turn && side && turn !== side) within = false
    if (turn) side = turn
  }
  return within ? near : -near
}

// A point: where it stands, its normal, and its room; a texel's also its two sides, each a texel long.
type Point = { p: V; n: V; room: number; across?: [V, V] }
// What every hint's light function is handed: the point, its four numbers to add to, and what the hints are.
// sky, ground, key, fire, and a texel's distance in texels into a sun patch (`edge` within)
type Light = [number, number, number, number, number]
type Hint = { n: string; l: any }
type Opening = { mid: V; inward: V; across: V; along: V; width: number; height: number }
type Lab = { key: V; keyUp: boolean; s: Bake; at: (n: string) => V; opening: (n: string, l: any) => Opening; roomOf: (n: string, room: string) => number; means: Light[] | undefined }
// The light of each part of a hint, by the part's word.
const PARTS: Record<string, (pt: Point, h: Hint, lab: Lab, out: Light) => void> = {
  room() {},
  inward() {},
  across() {},
  dark() {},
  opening(pt, { n, l }, lab, out) {
    const o = lab.opening(n, l)
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => sub(add(add(o.mid, o.across, x * l.width / 2), o.along, y * l.height / 2), pt.p))
    const facing = clip(corners, pt.n)
    if (l.rooms) {
      // between rooms: the other room's own light through it
      if (!lab.means) return
      const here = lab.roomOf(n, l.rooms[0]) === pt.room ? lab.roomOf(n, l.rooms[1]) : lab.roomOf(n, l.rooms[0])
      if (![lab.roomOf(n, l.rooms[0]), lab.roomOf(n, l.rooms[1])].includes(pt.room)) return
      const f = seen(facing, pt.n) * lab.s.pass
      for (let k = 0; k < 4; k++) out[k] += f * lab.means[here][k]
      return
    }
    if (lab.roomOf(n, l.room) !== pt.room) return
    if (l.sky) {
      out[0] += seen(clip(facing, [0, 1, 0]), pt.n)
      out[1] += seen(clip(facing, [0, -1, 0]), pt.n)
    }
    if (l.beam && lab.keyUp) {
      // the line from the point toward the key light, through the opening's plane
      const c = dot(pt.n, lab.key), towards = -dot(lab.key, o.inward)
      if (c <= 0 || towards <= 0) return
      if (!pt.across) {
        // a vertex: 1 where the line from it toward the key light passes through the opening
        const t = dot(sub(o.mid, pt.p), o.inward) / dot(lab.key, o.inward)
        if (t <= 0) return
        const hit = sub(add(pt.p, lab.key, t), o.mid)
        if (Math.abs(dot(hit, o.across)) <= l.width / 2 && Math.abs(dot(hit, o.along)) <= l.height / 2) out[2] += c
        return
      }
      // a texel: the opening cast along the key light onto the texel's face, and the texel's distance in texels to
      // that patch's edge, inside positive, held within `edge`; the largest over the room's openings
      const [ta, tb] = pt.across, ua = norm(ta), ub = norm(tb)
      const kn = dot(lab.key, pt.n)
      const patch: [number, number][] = []
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const corner = add(add(o.mid, o.across, x * l.width / 2), o.along, y * l.height / 2)
        // how far along the key light the corner stands off the texel's face (a door's foot on the floor stands on it)
        const up = dot(sub(corner, pt.p), pt.n) / kn
        const d = sub(add(corner, lab.key, -up), pt.p)
        patch.push([dot(d, ua), dot(d, ub)])
      }
      out[4] = Math.max(out[4], Math.max(-lab.s.edge, Math.min(lab.s.edge, inside(patch) * lab.s.texels)))
    }
  },
  lamp(pt, { n, l }, lab, out) {
    if (lab.roomOf(n, l.room) !== pt.room) return
    const d = sub(lab.at(n), pt.p), dist = Math.hypot(...d)
    const c = dot(pt.n, [d[0] / dist, d[1] / dist, d[2] / dist])
    if (c > 0) out[3] += c / Math.max(dist, lab.s.lampNear) ** 2
  },
}

export async function bakeLight(folder: string, name: string, sceneFile: string) {
  const started = performance.now()
  const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'))
  if (!scene.world.bakedlight?.bake) throw new Error(`demo_world3d's light bake: ${sceneFile} has no world.bakedlight.bake`)
  const s = check(scene.world.bakedlight.bake, sceneFile)
  const sky = scene.prefabs.skydome3d, day = scene.world.skydome3d.day
  const sunWay = sunOf({ t: sky.t, day, doy: sky.doy, lat: sky.lat }) as V
  const key: V = sunWay[1] > 0 ? sunWay : (moonOf({ t: sky.t, day, doy: sky.doy, lat: sky.lat, phase: sky.phase }) as V)
  const u = await unpack(new Uint8Array(fs.readFileSync(path.join(folder, `${name}.glb`))))
  const nav = JSON.parse(fs.readFileSync(path.join(folder, `${name}.nav.json`), 'utf8'))

  // every vertex in world3d's order
  const total = u.meshes.reduce((n, m) => n + m.count, 0)
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3)
  const firsts: number[] = []
  let base = 0
  for (const m of u.meshes) {
    firsts.push(base)
    pos.set(m.inputs.position, base * 3)
    nrm.set(m.inputs.normal, base * 3)
    base += m.count
  }
  const solids = u.info.vertex.meshes.indexOf('solids')
  if (solids < 0) throw new Error(`demo_world3d's light bake: ${name}.glb has no solids mesh`)
  const P = (v: number): V => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]
  const N = (v: number): V => norm([nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]])

  // the hints, by their whole names
  const places = new Map<string, V>()
  const hints: Hint[] = []
  for (const p of nav.places) {
    for (const n of p.data?.nav3d?.tags ?? []) {
      places.set(n, p.point.at)
      if (p.data.light) hints.push({ n, l: p.data.light })
    }
  }
  for (const h of hints) if (!PARTS[h.l.part]) throw new Error(`demo_world3d's light bake: the hint ${h.n} is a ${h.l.part}, which no part of the bake lights (${Object.keys(PARTS).join(', ')})`)
  const at = (n: string) => {
    const v = places.get(n)
    if (!v) throw new Error(`demo_world3d's light bake: ${name}.nav.json has no place ${n}`)
    return v
  }
  const prefix = (n: string) => n.slice(0, n.lastIndexOf('/') + 1)
  type Box = { low: V; u: V; w: V; a: number; b: number; top: number; key: string }
  const boxOf = (k: string): Box => {
    const low = at(`${k} low`), high = at(`${k} high`)
    const uu = norm(sub(at(`${k} across`), low)), ww = cross([0, 1, 0], uu), d = sub(high, low)
    return { low, u: uu, w: ww, a: dot(d, uu), b: dot(d, ww), top: high[1], key: k }
  }
  const holds = (r: Box, p: V, m: number) => {
    const d = sub(p, r.low), a = dot(d, r.u), b = dot(d, r.w)
    return a > -m && a < r.a + m && b > -m && b < r.b + m && p[1] > r.low[1] - m && p[1] < r.top + m
  }
  const rooms: Box[] = hints.filter(h => h.l.part === 'room' && h.l.corner === 'low').map(h => boxOf(prefix(h.n) + h.l.room))
  if (!rooms.length) throw new Error(`demo_world3d's light bake: ${name}.nav.json has no room hints`)
  const roomIndex = new Map(rooms.map((r, i) => [r.key, i]))
  const roomOf = (n: string, room: string) => {
    const i = roomIndex.get(prefix(n) + room)
    if (i === undefined) throw new Error(`demo_world3d's light bake: the hint ${n} is of the room ${room}, which no room hint makes`)
    return i
  }
  const darks: (Box & { room: number })[] = hints.filter(h => h.l.part === 'dark' && h.l.corner === 'low').map(h => ({ ...boxOf(h.n.slice(0, -' low'.length)), room: roomOf(h.n, h.l.room) }))
  const roomAt = (p: V) => rooms.findIndex(r => holds(r, p, s.margin))
  const opening = (n: string, l: any): Opening => {
    const mid = at(n), inward = norm(sub(at(`${n} inward`), mid)), across = norm(sub(at(`${n} across`), mid))
    return { mid, inward, across, along: norm(cross(inward, across)), width: l.width, height: l.height }
  }

  // each vertex's mode: 1 for a timber or kit vertex inside a room
  const mode = new Uint8Array(total)
  u.meshes.forEach((m, k) => {
    if (k === solids) return
    for (let v = firsts[k]; v < firsts[k] + m.count; v++) if (roomAt(P(v)) >= 0) mode[v] = 1
  })

  // the solids' charts: their triangles joined by vertices, each chart one flat face
  const sm = u.meshes[solids], s0 = firsts[solids]
  const up = new Int32Array(sm.count).map((_, i) => i)
  const find = (i: number): number => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i] } return i }
  for (let i = 0; i < sm.index.length; i += 3) {
    const a = find(sm.index[i]), b = find(sm.index[i + 1])
    up[b] = a
    up[find(sm.index[i + 2])] = a
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < sm.index.length; i += 3) {
    const g = find(sm.index[i])
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(i / 3)
  }
  type Chart = { tris: number[]; n: V; t: V; b: V; lo: [number, number]; w: number; h: number; x: number; y: number }
  const charts: Chart[] = []
  for (const list of groups.values()) {
    let area = 0, big = 0
    const mid: V = [0, 0, 0]
    let n: V = [0, 1, 0]
    for (const t of list) {
      const a = P(s0 + sm.index[t * 3]), b = P(s0 + sm.index[t * 3 + 1]), c = P(s0 + sm.index[t * 3 + 2])
      const cr = cross(sub(b, a), sub(c, a)), ar = Math.hypot(...cr) / 2
      area += ar
      for (let k = 0; k < 3; k++) mid[k] += ar * (a[k] + b[k] + c[k]) / 3
      if (ar > big) { big = ar; n = N(s0 + sm.index[t * 3]) }
    }
    if (!area || roomAt([mid[0] / area, mid[1] / area, mid[2] / area]) < 0) continue
    const t = norm(cross(n, Math.abs(n[1]) < s.axis ? [0, 1, 0] : [1, 0, 0])), b = cross(n, t)
    const lo: [number, number] = [Infinity, Infinity], hi = [-Infinity, -Infinity]
    for (const tr of list) for (let k = 0; k < 3; k++) {
      const p = P(s0 + sm.index[tr * 3 + k])
      lo[0] = Math.min(lo[0], dot(p, t)); lo[1] = Math.min(lo[1], dot(p, b))
      hi[0] = Math.max(hi[0], dot(p, t)); hi[1] = Math.max(hi[1], dot(p, b))
    }
    charts.push({ tris: list, n, t, b, lo, w: Math.ceil((hi[0] - lo[0]) * s.texels) + 2 * s.pad, h: Math.ceil((hi[1] - lo[1]) * s.texels) + 2 * s.pad, x: 0, y: 0 })
  }
  // packed in shelves, tallest first, into the narrowest power of two that holds them
  const area = charts.reduce((n, c) => n + c.w * c.h, 0)
  let W = s.map[0]
  while (W * W < area * s.slack || W < Math.max(0, ...charts.map(c => c.w))) W *= 2
  if (W > s.map[1]) throw new Error(`demo_world3d's light bake: ${name}'s charts need a map ${W} wide, past world.bakedlight.bake.map's most, ${s.map[1]}`)
  charts.sort((a, b) => b.h - a.h)
  let x = 0, y = 0, row = 0
  for (const c of charts) {
    if (x + c.w > W) { x = 0; y += row; row = 0 }
    c.x = x; c.y = y
    x += c.w
    row = Math.max(row, c.h)
  }
  const H = Math.max(4, Math.ceil((y + row) / 4) * 4)
  const mapUv = new Float32Array(total * 2)
  for (const c of charts) for (const tr of c.tris) for (let k = 0; k < 3; k++) {
    const v = s0 + sm.index[tr * 3 + k], p = P(v)
    mode[v] = 2
    mapUv[v * 2] = (c.x + s.pad + (dot(p, c.t) - c.lo[0]) * s.texels) / W
    mapUv[v * 2 + 1] = (c.y + s.pad + (dot(p, c.b) - c.lo[1]) * s.texels) / H
  }
  // the points: each texel a chart's triangle covers, then each vertex lit by its own light
  const points: Point[] = []
  const owner: number[] = [] // a vertex (v) or a texel (-1 - texel)
  const texel = new Int32Array(W * H).fill(-1)
  for (const c of charts) for (const tr of c.tris) {
    const vs = [0, 1, 2].map(k => s0 + sm.index[tr * 3 + k])
    const q = vs.map(v => [mapUv[v * 2] * W, mapUv[v * 2 + 1] * H])
    const x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])))
    const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])))
    const den = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1])
    if (!den) continue
    const [a, b, cc] = vs.map(P)
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (texel[ty * W + tx] >= 0) continue
      const px = tx + 0.5, py = ty + 0.5
      const l0 = ((q[1][1] - q[2][1]) * (px - q[2][0]) + (q[2][0] - q[1][0]) * (py - q[2][1])) / den
      const l1 = ((q[2][1] - q[0][1]) * (px - q[2][0]) + (q[0][0] - q[2][0]) * (py - q[2][1])) / den
      const l2 = 1 - l0 - l1
      if (l0 < -s.cover || l1 < -s.cover || l2 < -s.cover) continue
      const p = [0, 1, 2].map(k => l0 * a[k] + l1 * b[k] + l2 * cc[k]) as V
      texel[ty * W + tx] = points.length
      points.push({ p, n: c.n, room: roomAt(p), across: [[c.t[0] / s.texels, c.t[1] / s.texels, c.t[2] / s.texels], [c.b[0] / s.texels, c.b[1] / s.texels, c.b[2] / s.texels]] })
      owner.push(-1 - (ty * W + tx))
    }
  }
  const pointOfVertex = new Int32Array(total).fill(-1)
  for (let v = 0; v < total; v++) if (mode[v] === 1) { pointOfVertex[v] = points.length; points.push({ p: P(v), n: N(v), room: roomAt(P(v)) }); owner.push(v) }

  // every point's light from the hints of its room: first without what comes between rooms, which takes each room's
  // mean light of that first pass; then again with it
  const lab: Lab = { key, keyUp: key[1] > 0, s, at, opening, roomOf, means: undefined }
  const lightAll = () => {
    const lit = new Float32Array(points.length * 5)
    const out: Light = [0, 0, 0, 0, 0]
    points.forEach((pt, i) => {
      // a texel's distance into a sun patch from none
      out.fill(0)
      out[4] = -s.edge
      if (pt.room >= 0) for (const h of hints) PARTS[h.l.part](pt, h, lab, out)
      // under a dark hint of its room its light `under` times over, and in no sun patch
      if (darks.some(d => d.room === pt.room && holds(d, pt.p, 0))) {
        for (let k = 0; k < 4; k++) out[k] *= s.under
        out[4] = -s.edge
      }
      lit.set(out, i * 5)
    })
    return lit
  }
  let lit = lightAll()
  // each room's mean light: a texel's key with its sun patch's, the share of it lit times the key light's cosine there
  const means: Light[] = rooms.map(() => [0, 0, 0, 0, 0])
  const counts = rooms.map(() => 0)
  points.forEach((pt, i) => {
    if (pt.room < 0) return
    counts[pt.room]++
    const patch = pt.across ? Math.max(0, Math.min(1, 0.5 + lit[i * 5 + 4])) * Math.max(0, dot(pt.n, key)) : 0
    const here: number[] = [lit[i * 5], lit[i * 5 + 1], lit[i * 5 + 2] + patch, lit[i * 5 + 3]]
    for (let k = 0; k < 4; k++) means[pt.room][k] += here[k]
  })
  means.forEach((m, r) => { for (let k = 0; k < 4; k++) m[k] /= Math.max(1, counts[r]) })
  lab.means = means
  lit = lightAll()

  // the map: each covered texel its point's light, then every uncovered one inside a chart its covered neighbours'
  const map = new Float32Array(W * H * 5)
  const filled = new Uint8Array(W * H)
  owner.forEach((o, i) => { if (o < 0) { map.set(lit.subarray(i * 5, i * 5 + 5), (-1 - o) * 5); filled[-1 - o] = 1 } })
  for (let pass = 0; pass < s.gutter; pass++) {
    const was = filled.slice()
    for (const c of charts) for (let ty = c.y; ty < c.y + c.h; ty++) for (let tx = c.x; tx < c.x + c.w; tx++) {
      const k = ty * W + tx
      if (was[k]) continue
      const sum = [0, 0, 0, 0, 0]
      let got = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx, ny = ty + dy
        if (nx < c.x || ny < c.y || nx >= c.x + c.w || ny >= c.y + c.h || !was[ny * W + nx]) continue
        for (let q = 0; q < 5; q++) sum[q] += map[(ny * W + nx) * 5 + q]
        got++
      }
      if (!got) continue
      for (let q = 0; q < 5; q++) map[k * 5 + q] = sum[q] / got
      filled[k] = 1
    }
  }

  // the file
  const head = new Uint32Array([0x314b424c, total, W, H, 0, 0, 0, 0])
  const verts = new Float32Array(total * 8)
  for (let v = 0; v < total; v++) {
    verts.set([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], mode[v]], v * 8)
    if (mode[v] === 1) verts.set(lit.subarray(pointOfVertex[v] * 5, pointOfVertex[v] * 5 + 4), v * 8 + 4)
    if (mode[v] === 2) verts.set([mapUv[v * 2], mapUv[v * 2 + 1], 0, 0], v * 8 + 4)
  }
  // the map's four lights, then its sun patches' distances, as half floats
  const halves = new Uint16Array(W * H * 4), edges = new Uint16Array(W * H)
  for (let k = 0; k < W * H; k++) {
    for (let q = 0; q < 4; q++) halves[k * 4 + q] = half(map[k * 5 + q])
    edges[k] = half(map[k * 5 + 4])
  }
  const out = path.join(folder, `${name}.light.bin`)
  fs.writeFileSync(out, Buffer.concat([Buffer.from(head.buffer), Buffer.from(verts.buffer), Buffer.from(halves.buffer), Buffer.from(edges.buffer)]))
  console.log(`demo_world3d's light bake: ${name}: ${rooms.length} rooms, ${hints.length} hints, the key ${lab.keyUp ? (key === sunWay ? 'the sun' : 'the moon') : 'below the horizon'}; ${points.length} points in ${((performance.now() - started) / 1000).toFixed(1)} s; wrote ${out} (${(fs.statSync(out).size / 1048576).toFixed(2)} MB)`)
  rooms.forEach((r, i) => console.log(`  ${r.key.padEnd(24)} mean sky ${means[i][0].toFixed(3)} ground ${means[i][1].toFixed(3)} key ${means[i][2].toFixed(3)} fire ${means[i][3].toFixed(3)} before what comes between rooms`))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [folder, name, sceneFile] = process.argv.slice(2)
  await bakeLight(path.resolve(folder), name, path.resolve(sceneFile))
}
