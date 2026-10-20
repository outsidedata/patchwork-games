// climb: a body holding on to another body's limb, the game's own plugin. The limbs are anim's
// segments (`ends`, `plugins/anim/anim.sim.ts`): each a line between two joints, measured on every frame
// of every clip of the held body as it was baked, at its size. A holder's place is worked out again
// every step from where the held body's clip has that segment now, so the holder goes where the limb
// goes: it walks, swipes and shakes with it.
//
// A hold is the holder's row's `hold`: null when it holds nothing, else `{ on, segment, along,
// around }`: the held row's id, the segment's name, how far along it from its first joint (0) to its
// second (1), and the angle round it, radians, from the side that faces the way the held body faces.
// The holder's hands are on the limb's surface there: the segment's `radius` out from its line, in the
// held kind's definition, `segments.<segment>.radius` metres. Its body faces the limb, upright, turned
// by yaw alone, its root set back from the hands by where its own hands are in its `hold` clip's first
// frame (its own `ends`, so a body of any proportions hangs by its own hands), and out from the limb by
// its `climb.off` metres more, so its body clears the limb's surface.
//
// The numbers, off the definitions of the kinds whose rows it is handed:
//   holder `climb`: `reach` metres, how far from a limb's surface its hands take hold; `off` metres,
//          how far its body stands out from the surface past its hands; `rate`, how fast its climbing
//          clips play with the stick pushed all the way; `still`, how far the stick is pushed, up or
//          down or round, before it climbs that way; `clips`, the clip it plays to hold still
//          (`hold`), climb up, climb down, go left and go right. It climbs along a limb as fast as its
//          `up` clip raises its hips (the rig's measured `rise` over the clip's length) and round it as
//          fast as its `right` clip carries them sideways (`left` over its length), each times `rate`
//          and times how far the stick is pushed that way, and the clip it climbs by plays at `rate`
//          times how far the stick is pushed its way, so the hold moves as the clip's body does
//          however far it is pushed.
//   held   `segments`: `{ <segment>: { radius, up } }`, each limb that can be held, its radius, and the
//          segment it leads on to past its upper end, if any.
//
// `grab(me, w, kinds)` takes hold of the nearest limb of a row of one of `kinds` within the holder's
// `reach` of its hands, and returns whether it did. `hang(me, w, dt, stick)` moves the hold by the stick
// (x round to the right, y down the limb) and puts the holder there, playing the clip of the way it
// moves; past a limb's upper end it goes on to the limb its `up` names, and past its lower end to the
// limb whose `up` is this one and whose lower joint it is nearest; a move that would put its feet
// under the ground (walker's) is not made. `spot(from, held, at)` is a place `{ segment, along,
// around }` on a held row's limb in the world now, `{ at, out }`, the point on its surface and the way
// out of it there, off the server's `w` or the page's wire. `place(me, w)` puts the holder where its hold is now,
// `apart(w, hold, at)` is how far another place `{ segment, along, around }` on the hold's limb is
// from it over the limb's surface, metres, and `release(me, w)` lets go: the body is in the air where
// it was, falling.
//
// A mesh to climb. `box(size, cell)` is a box's mesh (`Mesh`, below), the shape a `wall` is drawn by.
// `netOn(mesh)` is the net a body climbs on it (`Net`, below): its vertices the points, its triangles'
// edges the links. `linked(net, i)` is the points point `i` links to.
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animKind, clipOf, ends, play, rigOf, stop } from '#plugins/anim/anim.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf, numbers, stand } from '#plugins/walker/walker.sim.ts'

export type Hold = { on: number; segment: string; along: number; around: number }
type V = number[]

const sub = (a: V, b: V) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V, b: V) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V, k: number) => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V) => math.hypot(a[0], a[1], a[2])
const unit = (a: V) => mul(a, 1 / (len(a) || 1))

// A point of a body's own frame (x its left, y up, z ahead) in the world, for a body at `pos` facing `yaw`.
const world = (pos: V, yaw: number, p: V) => {
  const s = math.sin(yaw), c = math.cos(yaw)
  return [pos[0] + p[0] * c + p[2] * s, pos[1] + p[1], pos[2] - p[0] * s + p[2] * c]
}

// A held row's segment now, its two joints in the world.
function line(w: W | Wire, held: Row, segment: string): [V, V] {
  const e = ends(w, held, segment)
  const { pos, yaw } = held.data
  return [world(pos, yaw, e.slice(0, 3)), world(pos, yaw, e.slice(3))]
}

// The two ways round a segment: `side` the horizontal one across it, turned to face the way the held
// body faces at angle 0, and `over` the third, so a point round it is cos·side + sin·over.
function round(a: V, b: V, facing: V): [V, V] {
  const axis = unit(sub(b, a))
  let side = sub(facing, mul(axis, dot(facing, axis)))
  if (len(side) < 1e-6) side = cross(axis, [0, 1, 0])
  side = unit(side)
  return [side, cross(axis, side)]
}

const facingOf = (held: Row) => [math.sin(held.data.yaw), 0, math.cos(held.data.yaw)]

export function spot(from: W | Wire, held: Row, at: { segment: string; along: number; around: number }): { at: V; out: V } {
  const [a, b] = line(from, held, at.segment)
  const [side, over] = round(a, b, facingOf(held))
  const out = add(mul(side, math.cos(at.around)), mul(over, math.sin(at.around)))
  const r = def(from, held.kind).segments[at.segment].radius
  return { at: add(add(a, mul(sub(b, a), at.along)), mul(out, r)), out }
}

// Where the hold puts the hands, and the way out of the limb there.
function surface(w: W, _me: Row, h: Hold): { hands: V; out: V } {
  const { at, out } = spot(w, w.get(h.on)!, h)
  return { hands: at, out }
}

// The holder's own hands in its frame on its `hold` clip's first frame, midway between them.
function grip(w: W, me: Row): V {
  const clip = def(w, me.kind).climb.clips.hold
  const l = ends(w, me, 'handL', { clip, clipT: 0 }), r = ends(w, me, 'handR', { clip, clipT: 0 })
  return [(l[3] + r[3]) / 2, (l[4] + r[4]) / 2, (l[5] + r[5]) / 2]
}

export function place(me: Row, w: W) {
  const d = me.data
  const { hands, out } = surface(w, me, d.hold)
  // Facing the limb: the way into it, laid flat.
  const yaw = math.atan2(-out[0], -out[2])
  const g = grip(w, me)
  const root = add(sub(hands, world([0, 0, 0], yaw, g)), mul(out, def(w, me.kind).climb.off))
  Object.assign(d, { pos: root, yaw, vel: [0, 0, 0], want: [0, 0], face: null, grounded: true, sliding: false, speed: 0 })
}

export function grab(me: Row, w: W, kinds: string[]): boolean {
  const k = def(w, me.kind).climb
  const hands = world(me.data.pos, me.data.yaw, grip(w, me))
  let best: { h: Hold; far: number } | undefined
  for (const held of kinds.flatMap(kind => w.all(kind))) {
    for (const [segment, s] of Object.entries(def(w, held.kind).segments as Record<string, { radius: number }>)) {
      const [a, b] = line(w, held, segment)
      const ab = sub(b, a)
      const along = Math.max(0, Math.min(1, dot(sub(hands, a), ab) / dot(ab, ab)))
      const off = sub(hands, add(a, mul(ab, along)))
      const far = len(off) - s.radius
      if (far > k.reach || (best && far >= best.far)) continue
      const [side, over] = round(a, b, facingOf(held))
      best = { h: { on: held.id, segment, along, around: math.atan2(dot(off, over), dot(off, side)) }, far }
    }
  }
  if (!best) return false
  me.data.hold = best.h
  play(me, k.clips.hold)
  place(me, w)
  return true
}

// The segment past an end of the hold's: past the upper end the one its `up` names, past the lower the
// one whose `up` is this one and whose own upper end is nearest; and where on it the hold goes on.
function next(w: W, h: Hold, upward: boolean): Hold | undefined {
  const held = w.get(h.on)!
  const segs = def(w, held.kind).segments as Record<string, { up?: string }>
  const [a, b] = line(w, held, h.segment)
  const end = h.along >= 0.5 ? b : a
  const names = upward ? [segs[h.segment].up].filter((s): s is string => !!s) : Object.keys(segs).filter(s => segs[s].up === h.segment)
  let best: { h: Hold; far: number } | undefined
  for (const segment of names) {
    const [c, e] = line(w, held, segment)
    for (const along of [0, 1]) {
      const far = len(sub(along ? e : c, end))
      if (!best || far < best.far) best = { h: { ...h, segment, along: along ? 1 - 1e-3 : 1e-3 }, far }
    }
  }
  return best?.h
}

export function hang(me: Row, w: W, dt: number, stick: V) {
  const d = me.data
  const k = def(w, me.kind).climb
  const h: Hold = { ...d.hold }
  const held = w.get(h.on)!
  const [a, b] = line(w, held, h.segment)
  const length = len(sub(b, a)) || 1
  // Up the limb is toward whichever joint stands higher now.
  const rising = b[1] >= a[1] ? 1 : -1
  const push = (v: number) => (Math.abs(v) < k.still ? 0 : v)
  const climb = push(-stick[1]), across = push(stick[0])
  // The speeds the clips carry the hips at, as they were measured (anim's table), at the clips' rate.
  const rig = rigOf(w, animKind(me))
  const up = clipOf(rig, k.clips.up).measure, side = clipOf(rig, k.clips.right).measure
  h.along += (climb * (up.rise! / up.dur) * k.rate * dt / length) * rising
  const r = def(w, held.kind).segments[h.segment].radius
  // Round to the right, as the holder faces the limb, is round it the negative way.
  h.around -= across * (Math.abs(side.left) / side.dur) * k.rate * dt / r
  if (h.along > 1 || h.along < 0) {
    const upward = (h.along > 1) === (rising > 0)
    const on = next(w, h, upward)
    if (on) Object.assign(h, on)
    else h.along = Math.max(0, Math.min(1, h.along))
  }
  const was = d.hold
  d.hold = h
  place(me, w)
  // A hold that would put the feet under the ground is not taken: the holder stays where it was.
  const [x, y, z] = d.pos
  if (y < stand(numbers(me, w), groundOf(w), x, z)) {
    d.hold = was
    place(me, w)
  }
  const clip = climb > 0 ? k.clips.up : climb < 0 ? k.clips.down : across > 0 ? k.clips.right : across < 0 ? k.clips.left : k.clips.hold
  const rate = climb ? k.rate * Math.abs(climb) : across ? k.rate * Math.abs(across) : 1
  if (d.clip !== clip) play(me, clip, { rate })
  else d.rate = rate
}

// How far apart two places on one limb of the held row are, over its surface: along it, and round it.
export function apart(w: W, h: Hold, at: { segment: string; along: number; around: number }): number {
  const held = w.get(h.on)!
  const [a, b] = line(w, held, h.segment)
  const r = def(w, held.kind).segments[h.segment].radius
  const turn = Math.abs(math.atan2(math.sin(at.around - h.around), math.cos(at.around - h.around)))
  return math.hypot((at.along - h.along) * len(sub(b, a)), turn * r)
}

// ---------------------------------------------------------------- a mesh to climb

// A mesh: every vertex's place, three numbers each, and its triangles, three vertex indices each, each
// turned so its corners go round anticlockwise seen from outside.
export type Mesh = { position: number[]; index: number[] }

// A box `size` `[width, height, depth]` metres standing on its base, its base's middle at the origin
// (x across, y up, z through, its front facing +z), each face a grid of squares as near `cell` metres
// on a side as its length divides into.
export function box(size: number[], cell: number): Mesh {
  const [w, h, d] = size
  const position: number[] = [], index: number[] = []
  // A face from its corner `o` along `u` and `v`, u × v pointing out of the box.
  const face = (o: V, u: V, v: V) => {
    const nu = Math.max(1, Math.round(len(u) / cell)), nv = Math.max(1, Math.round(len(v) / cell))
    const first = position.length / 3
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) position.push(...add(o, add(mul(u, i / nu), mul(v, j / nv))))
    const at = (i: number, j: number) => first + j * (nu + 1) + i
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) index.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1))
  }
  face([-w / 2, 0, d / 2], [w, 0, 0], [0, h, 0])
  face([w / 2, 0, -d / 2], [-w, 0, 0], [0, h, 0])
  face([w / 2, 0, d / 2], [0, 0, -d], [0, h, 0])
  face([-w / 2, 0, -d / 2], [0, 0, d], [0, h, 0])
  face([-w / 2, h, d / 2], [w, 0, 0], [0, 0, -d])
  face([-w / 2, 0, -d / 2], [w, 0, 0], [0, 0, d])
  return { position, index }
}

// A net: `points` points, each one's place (`at`, three numbers) and the way out of the surface there
// (`out`, three, one long) in the mesh's own frame, and its links: point i links to `to[start[i]]` up to
// `to[start[i + 1]]`, both ways.
export type Net = { points: number; at: Float32Array; out: Float32Array; start: Uint32Array; to: Uint32Array }

const SAME = 1e-4 // metres: two vertices this close are one point

// The net of a mesh: a point for each place a vertex stands (vertices at one place, which a mesh splits
// where its faces part, are one point), a link for each edge of a triangle, and each point's way out
// the faces round it, each by its area, made one long.
export function netOn(mesh: Mesh): Net {
  const places = new Map<string, number>()
  const of: number[] = []
  const at: number[] = []
  for (let i = 0; i < mesh.position.length / 3; i++) {
    const p = mesh.position.slice(i * 3, i * 3 + 3)
    const key = p.map(v => Math.round(v / SAME)).join(',')
    let n = places.get(key)
    if (n === undefined) {
      n = at.length / 3
      places.set(key, n)
      at.push(...p)
    }
    of.push(n)
  }
  const points = at.length / 3
  const out = new Array(points * 3).fill(0)
  const links = Array.from({ length: points }, () => new Set<number>())
  for (let t = 0; t < mesh.index.length; t += 3) {
    const [a, b, c] = [of[mesh.index[t]], of[mesh.index[t + 1]], of[mesh.index[t + 2]]]
    const pa = at.slice(a * 3, a * 3 + 3), pb = at.slice(b * 3, b * 3 + 3), pc = at.slice(c * 3, c * 3 + 3)
    const n = cross(sub(pb, pa), sub(pc, pa))
    for (const p of [a, b, c]) for (let k = 0; k < 3; k++) out[p * 3 + k] += n[k]
    for (const [x, y] of [[a, b], [b, c], [c, a]]) if (x !== y) { links[x].add(y); links[y].add(x) }
  }
  for (let p = 0; p < points; p++) {
    const u = unit(out.slice(p * 3, p * 3 + 3))
    for (let k = 0; k < 3; k++) out[p * 3 + k] = u[k]
  }
  const start = new Uint32Array(points + 1), to: number[] = []
  links.forEach((s, p) => {
    start[p] = to.length
    to.push(...[...s].sort((x, y) => x - y))
  })
  start[points] = to.length
  return { points, at: new Float32Array(at), out: new Float32Array(out), start, to: new Uint32Array(to) }
}

// The points point `i` links to.
export const linked = (net: Net, i: number): Uint32Array => net.to.subarray(net.start[i], net.start[i + 1])

export function release(me: Row, w: W) {
  const d = me.data
  d.hold = null
  d.grounded = false
  stop(me, w)
}
