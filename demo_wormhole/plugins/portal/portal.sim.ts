// portal, demo_wormhole's own: the portals and what goes through them. Its row is the `portal` kind:
// an opening `width` by `height` (the `portal` definition's) centred on `pos`, lying on the face of
// the chamber's box `on`, its front facing `normal`, its top toward `up`, its right `up × normal`;
// `name`, and `to`, the name of the portal it leads to. The `player` row's `place` spawns and moves
// them. It has no rule of its own: the kinds that go through call these on their own rows.
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
// `rotate(q, v)` is v turned by the quaternion q [x, y, z, w].
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export const portal: Kind = {}

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
