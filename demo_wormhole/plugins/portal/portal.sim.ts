// portal, demo_wormhole's own: the portals and what goes through them. Its row is the `portal` kind:
// an opening `width` by `height` (the `portal` definition's) centred on `pos`, lying on the face of
// the chamber's box `on`, its front facing `normal`, its top toward `up`, its right `up × normal`;
// `name`, and `to`, the name of the portal it leads to. The `player` row's `place` spawns and moves
// them, or a scene's `actors` stand them.
//
// A portal's world. While the portal it leads to stands, each portal P holds a Box3D world of its
// own, held one per truth and sent to no seat, for the box3d bodies near its front: every row of a
// kind its definition's `takes` lists whose centre stands within its opening and `edge` metres either
// side of it, and up to `room` metres in front of its plane, is taken out of box3d's world (its live
// `enabled`, false), named `inside` P, and stepped in P's world instead, in P's own tick: its `pos`
// and `rot` written back each step, its speed and spin kept in `drift`, since box3d writes a body it
// holds disabled back with none. P's world holds, as fixed bodies:
//   - every box of the chamber's level within reach of P on P's side of its plane;
//   - the surface around P's opening, four boxes `room` metres deep behind P's plane round the
//     opening, out `edge` metres past it, so a body over the opening falls through and a body beside
//     it rests;
//   - every box of the level within reach of the portal it leads to, Q, on Q's side of Q's plane,
//     carried through to stand behind P, so the part of a body that is through meets what is beyond Q.
// "Within reach" is within `room` plus the opening's half height plus `edge` of the portal on each
// axis. A body there is made from its definition: a sphere of `radius` rolling against its `rolling`,
// or a box `size` a side, each of `density`, `friction` and `restitution`; the world pulls by the definition's `gravity` and steps
// `subSteps` a step. The world is made again whenever either portal moves. A body wholly behind P's
// plane (its reach along P's normal past it) is carried through to Q, its place, turn, speed and spin
// (`point`, `turned`, `vector`), and put back in box3d's world there moving so, its `jumps` one up; a
// body that leaves the space in front of P is put back in box3d's world where it is. With the other
// portal gone, every body inside P is put back where it is. Ramps are not in a portal's world.
//
// Through. A thing that goes in at a portal's front comes out of the other's front: a point, a
// direction or a turn taken from this portal's frame into that one's, turned half a turn about up,
// so right and front are reversed and up kept (`point`, `vector`, `turned`). So a fall into a floor
// portal comes out of a wall portal as a throw, at the speed it went in.
//
// `other(w, a)` is the portal `a` leads to, while it stands. `crossed(w, a, from, to, across, up)` is
// whether the line from `from` to `to` goes in at `a`'s front inside its opening, the opening's sides
// drawn in by `across` metres and its top and bottom by `up`. `over(w, a, p)` is whether point p
// stands over `a`'s opening, in front of it or behind. `ahead(a, p)` is how far point p stands in front of `a`'s plane.
// `rotate(q, v)` is v turned by the quaternion q [x, y, z, w]. `trace(w, from, dir, far, passes,
// marks)` is a line through the portals, as a laser's beam goes (below).
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { b3, castRayClosest, type Quat, type Vec3 } from '#plugins/box3d/box3d.sim.ts'
import { piecesOf } from '../chamber/chamber.sim.ts'

export const portal: Kind = {
  tick(me, dt, w) {
    const q = other(w, me)
    const n: V = me.data.normal
    const bodies = def(w, me.kind).takes.flatMap((k: string) => w.all(k)) as Row[]
    const mine = bodies.filter(r => r.data.inside === me.data.name)
    if (!q) {
      for (const r of mine) release(r)
      drop(w, me)
      return
    }
    for (const r of bodies) if (r.data.inside === null && !r.data.drift && ahead(me, r.data.pos) > 0 && near(w, me, r.data.pos)) {
      r.data.drift = { vel: [...r.data.vel], spin: [...r.data.spin] }
      r.data.enabled = false
      r.data.inside = me.data.name
      mine.push(r)
    }
    if (!mine.length) return
    const s = spaceOf(w, me, q)
    for (const [id, body] of s.bodies) if (!mine.some(r => r.id === id)) { b3.b3DestroyBody(body); s.bodies.delete(id) }
    for (const r of mine) if (!s.bodies.has(r.id)) s.bodies.set(r.id, bodyOf(w, s, r))
    const { subSteps } = def(w, me.kind)
    b3.b3World_Step(s.world, dt, subSteps)
    for (const r of mine) {
      const body = s.bodies.get(r.id)
      const pos = b3.b3Body_GetPosition([0, 0, 0], body), rot = b3.b3Body_GetRotation([0, 0, 0, 1], body)
      const vel = b3.b3Body_GetLinearVelocity([0, 0, 0], body), spin = b3.b3Body_GetAngularVelocity([0, 0, 0], body)
      r.data.pos = [pos[0], pos[1], pos[2]]
      r.data.rot = [rot[0], rot[1], rot[2], rot[3]]
      r.data.drift = { vel: [vel[0], vel[1], vel[2]], spin: [spin[0], spin[1], spin[2]] }
      if (ahead(me, r.data.pos) < -reachOf(w, r, n)) {
        r.data.pos = point(me, q, r.data.pos)
        r.data.rot = turned(me, q, r.data.rot)
        r.data.drift = { vel: vector(me, q, r.data.drift.vel), spin: vector(me, q, r.data.drift.spin) }
        r.data.jumps += 1
      } else if (near(w, me, r.data.pos)) continue
      b3.b3DestroyBody(body)
      s.bodies.delete(r.id)
      release(r)
    }
  },
}

// A line through the portals, as a beam goes: from `from` along the unit `dir` for `far` metres in
// all. It ends at the first thing it meets: a body or a fixed thing of box3d's world (`castRayClosest`,
// whose row id is `hit`, 0 for the level), or a row of a kind in `marks`, each a sphere of its kind's
// definition's `radius` round its `pos` (`hit` its id). Where it meets a portal's opening from the
// front, while the other portal stands, it goes on from the matching point of the other's opening the
// matching way (`point`, `vector`), at most `passes` times. `points` is where it starts, each place it
// goes in and comes out of a portal, and where it ends.
export function trace(w: W, from: V, dir: V, far: number, passes: number, marks: string[]) {
  const points: V[] = [from]
  let at = from, way = dir, left = far, through = passes
  for (;;) {
    let t = left, hit: number | null = null, via: Row | undefined
    const ray = castRayClosest(w, at as Vec3, [way[0] * left, way[1] * left, way[2] * left])
    if (ray) { t = ray.fraction * left; hit = ray.id }
    for (const k of marks) for (const r of w.all(k)) {
      const { radius } = def(w, r.kind)
      const s = sphere(at, way, r.data.pos, radius)
      if (s !== undefined && s < t) { t = s; hit = r.id }
    }
    if (through > 0) for (const p of w.all('portal')) {
      if (!other(w, p)) continue
      const toward = -dot(way, p.data.normal)
      if (toward <= 0) continue
      const s = ahead(p, at) / toward
      // A portal lies on the face of what it stands on, so it is met where that face is: just short of
      // the hit counts.
      if (s < 0 || s > t + 1e-4) continue
      const meets = [0, 1, 2].map(i => at[i] + way[i] * s)
      if (!over(w, p, meets)) continue
      t = s
      via = p
    }
    const end = [0, 1, 2].map(i => at[i] + way[i] * t)
    points.push(end)
    if (!via) return { points, hit }
    const q = other(w, via)!
    way = vector(via, q, way)
    at = point(via, q, end)
    points.push(at)
    // Out a hair in front of the other portal, so its own face is not met again.
    at = [0, 1, 2].map(i => at[i] + way[i] * 1e-3)
    left -= t
    through -= 1
  }
}

// Where the line from `at` along unit `way` first meets the sphere of `radius` round `c`, or undefined.
function sphere(at: V, way: V, c: V, radius: number) {
  const d = minus(at, c)
  const b = dot(d, way), q = dot(d, d) - radius * radius
  const disc = b * b - q
  if (disc < 0) return undefined
  const s = -b - Math.sqrt(disc)
  return s >= 0 ? s : undefined
}

// A body put back in box3d's world, moving as it drifted.
function release(r: Row) {
  r.data.vel = [...r.data.drift.vel]
  r.data.spin = [...r.data.drift.spin]
  r.data.drift = null
  r.data.inside = null
  r.data.enabled = true
}

// How far a body reaches from its centre along `n`: a sphere its radius, a box by how it is turned.
function reachOf(w: W, r: Row, n: V) {
  const d = def(w, r.kind)
  if (d.radius !== undefined) return d.radius
  return (d.size / 2) * [[1, 0, 0], [0, 1, 0], [0, 0, 1]].reduce((sum, axis) => sum + Math.abs(dot(rotate(r.data.rot, axis), n)), 0)
}

// Whether point p is in the space in front of portal a that a's world holds bodies in.
function near(w: W, a: Row, p: V) {
  const { width, height, room, edge } = def(w, a.kind)
  const d = minus(p, a.data.pos)
  const z = dot(d, a.data.normal)
  return z <= room && Math.abs(dot(d, right(a))) < width / 2 + edge && Math.abs(dot(d, a.data.up)) < height / 2 + edge
}

// ---------------------------------------------------------------- a portal's world

type Space = { world: any; sig: string; bodies: Map<number, any> }
// Each truth's portal worlds, by the portal's name, kept on the truth's `world` object.
const spaces = new WeakMap<object, Map<string, Space>>()
const freed = new FinalizationRegistry<any>(world => b3.b3DestroyWorld(world))

function drop(w: W, a: Row) {
  const s = spaces.get(w.world)?.get(a.data.name)
  if (!s) return
  freed.unregister(s)
  b3.b3DestroyWorld(s.world)
  spaces.get(w.world)!.delete(a.data.name)
}

function spaceOf(w: W, a: Row, b: Row): Space {
  const sig = JSON.stringify([a.data.pos, a.data.normal, a.data.up, b.data.pos, b.data.normal, b.data.up])
  let all = spaces.get(w.world)
  if (!all) spaces.set(w.world, (all = new Map()))
  const was = all.get(a.data.name)
  if (was?.sig === sig) return was
  if (was) drop(w, a)
  const { gravity, room, edge, width, height } = def(w, a.kind)
  const wd = b3.b3DefaultWorldDef()
  wd.gravity = gravity
  const world = b3.b3CreateWorld(wd)
  const fixed = b3.b3CreateBody(world, b3.b3DefaultBodyDef())
  const shape = b3.b3DefaultShapeDef()
  const box = (centre: V, half: V, turn: V) => {
    const hull = b3.b3CreateHull(corners(half))
    b3.b3CreateTransformedHullShape(fixed, shape, hull, { position: centre as Vec3, quaternion: turn as Quat }, [1, 1, 1])
    b3.b3DestroyHull(hull)
  }
  const reach = room + height / 2 + edge
  const { boxes } = piecesOf(w)
  // The level on a's side of a, and on b's side of b carried through to stand behind a.
  for (const piece of boxes) {
    const here = clipped(piece, a, reach)
    if (here) box(mid(here), half(here), [0, 0, 0, 1])
    const there = clipped(piece, b, reach)
    if (there) box(point(b, a, mid(there)), half(there), turned(b, a, [0, 0, 0, 1]))
  }
  // The surface round a's opening, behind its plane.
  const W2 = width / 2, H2 = height / 2
  const rim = [
    [-W2 - edge / 2, 0, edge / 2, H2 + edge],
    [W2 + edge / 2, 0, edge / 2, H2 + edge],
    [0, -H2 - edge / 2, W2, edge / 2],
    [0, H2 + edge / 2, W2, edge / 2],
  ]
  const r = right(a), u: V = a.data.up, n: V = a.data.normal
  for (const [x, y, hx, hy] of rim) {
    const centre = [0, 1, 2].map(i => a.data.pos[i] + r[i] * x + u[i] * y - n[i] * room / 2)
    box(centre, [hx, hy, room / 2], frame(a))
  }
  const s: Space = { world, sig, bodies: new Map() }
  freed.register(s, world, s)
  all.set(a.data.name, s)
  return s
}

// A body of row r's definition in space s, where and as its row has it, moving as it drifts.
function bodyOf(w: W, s: Space, r: Row) {
  const d = def(w, r.kind)
  const bd = b3.b3DefaultBodyDef()
  bd.type = b3.b3BodyType.b3_dynamicBody
  bd.position = [...r.data.pos] as Vec3
  bd.rotation = [...r.data.rot] as Quat
  bd.linearVelocity = [...r.data.drift.vel] as Vec3
  bd.angularVelocity = [...r.data.drift.spin] as Vec3
  const body = b3.b3CreateBody(s.world, bd)
  const sd = b3.b3DefaultShapeDef()
  sd.density = d.density
  sd.baseMaterial = { ...sd.baseMaterial, friction: d.friction, restitution: d.restitution, ...(d.rolling === undefined ? {} : { rollingResistance: d.rolling }) }
  if (d.radius !== undefined) b3.b3CreateSphereShape(body, sd, { center: [0, 0, 0], radius: d.radius })
  else b3.b3CreateBoxShape(body, sd, d.size / 2, d.size / 2, d.size / 2)
  return body
}

type Box = { min: V; max: V }
const mid = (b: Box) => [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2)
const half = (b: Box) => [0, 1, 2].map(i => (b.max[i] - b.min[i]) / 2)
const corners = ([x, y, z]: V) => [-x, -y, -z, x, -y, -z, x, -y, z, -x, -y, z, -x, y, -z, x, y, -z, x, y, z, -x, y, z]

// Box `b` cut to the side of portal p's plane it faces (p's normal lies along an axis, being a face's)
// and to within `reach` of p on each axis, or undefined where nothing is left.
function clipped(b: Box, p: Row, reach: number): Box | undefined {
  const min = [...b.min], max = [...b.max]
  const n: V = p.data.normal
  const i = [0, 1, 2].reduce((best, k) => (Math.abs(n[k]) > Math.abs(n[best]) ? k : best), 0)
  if (n[i] > 0) min[i] = Math.max(min[i], p.data.pos[i])
  else max[i] = Math.min(max[i], p.data.pos[i])
  for (const k of [0, 1, 2]) {
    min[k] = Math.max(min[k], p.data.pos[k] - reach)
    max[k] = Math.min(max[k], p.data.pos[k] + reach)
  }
  return [0, 1, 2].every(k => max[k] - min[k] > 1e-6) ? { min, max } : undefined
}

type V = number[]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V, b: V) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const minus = (a: V, b: V) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

export const other = (w: W, a: Row) => w.all('portal').find(p => p.data.name === a.data.to)
export const ahead = (a: Row, p: V) => dot(minus(p, a.data.pos), a.data.normal)

export function crossed(w: W, a: Row, from: V, to: V, across: number, up: number) {
  const { width, height } = def(w, a.kind)
  const t0 = ahead(a, from), t1 = ahead(a, to)
  if (!(t0 > 0 && t1 <= 0)) return false
  const f = t0 / (t0 - t1)
  const hit = minus([0, 1, 2].map(i => from[i] + (to[i] - from[i]) * f), a.data.pos)
  return Math.abs(dot(hit, right(a))) < width / 2 - across && Math.abs(dot(hit, a.data.up)) < height / 2 - up
}

// A portal's right, up × normal.
export const right = (a: Row) => cross(a.data.up, a.data.normal)

// Whether point p stands over `a`'s opening: in front of it or behind, within its width and height.
export function over(w: W, a: Row, p: V) {
  const { width, height } = def(w, a.kind)
  const d = minus(p, a.data.pos)
  return Math.abs(dot(d, right(a))) < width / 2 && Math.abs(dot(d, a.data.up)) < height / 2
}

// A direction in a's frame carried into b's.
export function vector(a: Row, b: Row, v: V) {
  const ar = cross(a.data.up, a.data.normal), br = cross(b.data.up, b.data.normal)
  const x = dot(v, ar), y = dot(v, a.data.up), z = dot(v, a.data.normal)
  return [0, 1, 2].map(i => -x * br[i] + y * b.data.up[i] - z * b.data.normal[i])
}

export const point = (a: Row, b: Row, p: V) => {
  const d = vector(a, b, minus(p, a.data.pos))
  return [0, 1, 2].map(i => b.data.pos[i] + d[i])
}

// A portal's frame (right, up, normal) as a quaternion.
function frame(p: Row): V {
  const [rx, ry, rz] = cross(p.data.up, p.data.normal), [ux, uy, uz] = p.data.up, [nx, ny, nz] = p.data.normal
  const trace = rx + uy + nz
  let q: V
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    q = [(uz - ny) * s, (nx - rz) * s, (ry - ux) * s, 0.25 / s]
  } else if (rx > uy && rx > nz) {
    const s = 2 * Math.sqrt(1 + rx - uy - nz)
    q = [0.25 * s, (ux + ry) / s, (nx + rz) / s, (uz - ny) / s]
  } else if (uy > nz) {
    const s = 2 * Math.sqrt(1 + uy - rx - nz)
    q = [(ux + ry) / s, 0.25 * s, (ny + uz) / s, (nx - rz) / s]
  } else {
    const s = 2 * Math.sqrt(1 + nz - rx - uy)
    q = [(nx + rz) / s, (ny + uz) / s, 0.25 * s, (ry - ux) / s]
  }
  return q
}
const times = (a: V, b: V) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const conj = (q: V) => [-q[0], -q[1], -q[2], q[3]]

// A turn q carried through: b's frame · half a turn about up · a's frame⁻¹ · q.
export function turned(a: Row, b: Row, q: V) {
  const t = times(times(times(frame(b), [0, 1, 0, 0]), conj(frame(a))), q)
  const m = math.hypot(t[0], t[1], t[2], t[3])
  return t.map(v => v / m)
}

export function rotate(q: V, v: V) {
  const t = times(times(q, [v[0], v[1], v[2], 0]), conj(q))
  return [t[0], t[1], t[2]]
}
