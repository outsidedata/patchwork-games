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
// A mesh to climb. `box(size, cell)` is a box's mesh (`Mesh`, below), the shape a `wall` is drawn by, and
// `sphere(radius, cell)` a sphere's, a `sphere`'s, and `cylinder(radius, length, cell)` a cylinder's,
// closed at both ends, a `pillar`'s and a `pole`'s. `prism(xs, zs, inside, height, cell)` is a solid
// stood up from a footprint of grid cells, and `corner(size, thick, cell)` the one of two walls at a right
// angle, a `corner`'s. `dish(size, cell, radius, depth)` is a box with a hollow pressed into its front by
// a ball, a `bowl`'s (`box(size, cell, front)` moves a box's front out or in by a height), and
// `bumps(size, cell, waves, height)` a box whose front rises and falls in bumps and dips, a `bumpy`'s.
// `meshOf(k)` is the mesh of a held kind's definition, by the shape it names: `{ shape: "box", size,
// cell }`, `{ shape: "sphere", radius, cell }`, `{ shape: "cylinder", radius, length, cell }`,
// `{ shape: "corner", size, thick, cell }`, `{ shape: "dish", size, cell, radius, depth }` or
// `{ shape: "bumps", size, cell, waves, height }`.
// `settle(me, w)` is a held kind's rule: on its first step it stands its row's `pos` that high over the
// ground under it (walker's), and marks it `placed`.
// `netOn(mesh)` is the net a body climbs on it (`Net`, below): its vertices the points, its triangles'
// edges the links, and its triangles kept by point. `linked(net, i)` is the points point `i` links to,
// and `nearestOn(net, place, to, from, ok)` the point nearest a place, walking the links from point
// `from` while each step comes nearer, onto points `ok` allows only (any, when it is not given).
// `outOf(net, place, ps, out, near, rings)` is how far the nearest of some places (`Places`, handed over
// by what they are along ways) stands out of the
// surface along a way out, read off the triangles round a point. `fromNet(net, p)` is how far a place of
// the net's own frame is out of its surface (the distance to its nearest point, under 0 in it) and the
// way further out from there, read off a grid of the net's triangles made once a net (exact within 10 cm
// of the surface, and further only that far, in or out); `nearNet(net, p, near, rings)` the same read off
// the triangles round a point, as far as it is; and `heldLocal(held, p)` a place in the world in a held
// row's own frame.
//
// Holding a net. A hold on a net is `{ on, a, b, t }` (`NetHold`): the held row's id, two linked points
// of its net, and how far from `a` (0) to `b` (1) the holder's hands are between them; `onNet(hold)`
// tells one from a hold on a limb. A held row's net is its kind's mesh (`netOf(from, held)`), placed
// where the row stands, turned back by its `pitch` (radians, its front faced up that much) about its own
// x through its base's middle and then by its `yaw` (`heldPoint`, `heldWay`); `spotOn(from, held, h)` is
// a place on it in the world, `{ at, out }`. The holder's body is framed on the surface (`frameOn(out,
// had, yaw, turn)`): its front into it, its up the up it had (`had`) laid flat on it, so it is carried
// over the surface as he goes and never flips over a top; where the world's up laid flat on the surface
// is more than a little and within a quarter turn of his, his turns toward it by at most `turn` radians,
// so on a slope he comes upright. With no up yet (taking hold), it is the world's up laid flat, or where
// the surface faces up or down so that leaves next to nothing (under a ceiling), the way he faces.
// `stay(me, w, turn)` puts the holder where its hold is: framed on the surface there, turning upright by
// at most `turn` (`climbNet` hands it `climb.upright` radians a second; taking hold, none)
// (kept on its row as `lean`, `{ up, ahead }`, which the page turns its body by; its `yaw` its front laid
// flat, or kept while it faces straight up or down), its root set back so the middle of its palms (each
// midway between its wrist and its middle fingertip, in its `clips.still` clip's first frame, its own
// `ends`) is on the spot, and out
// along the surface's way out by its `climb.brace` metres (under 0, in: his body stands nearer the
// surface than that clip holds it from its hands, whose real hands reach the surface by IK on the page),
// and further out, if he must, until his front is off the surface (in a bowl, over bumps): his front the
// line from the top of his head to his hips (its own `ends`), carried on past them by his `climb.past` of
// its length, with his skin ahead of it by his `climb.front`, metres for each band of `climb.across`
// metres to either side of it;
// standing, not falling, holding its `clips.still` clip at its first frame (played at rate 0).
// `grabNet(me, w, kinds)` takes hold of the point of a row of one of `kinds` nearest the middle of the
// holder's palms, as they are in that clip's first frame where it stands now, within its `climb.reach`,
// and stays there; it returns whether it did. `climbNet(me, w, dt, stick)` moves the hold by the stick
// (x to the right, y down, each −1 to 1, pushed less than `climb.still` counting as not pushed): the
// way is his right and his up as his frame lies on the surface at his hold, mixed by the stick, and he
// goes `climb.speed` metres a second times how far it is pushed (at most 1). Along a link he goes to
// its end lying that way; from a point, on over a link he goes over (`crosses`: the surface turning
// there within `climb.bend`, a cosine, or folding in toward him, so an outside edge sharper than that, a
// wall's sides and top, stops him, and an inside corner does not) to a point where his hands fit: each
// palm, placed as his still pose places it with the middle of his palms on that point and his body
// framed on the surface there, nearest a point of the net reached from that point over links he goes
// over. `crosses(place, face, p, o, bend)` is that test. Of those links, the ones within `climb.fan` (a cosine) of
// the way pushed, the one leaving him nearest the straight line he has been pushed along (the hold's
// `lat`, how far he has drifted to one side of it, and `way`, the way he was pushed, kept while the way
// stays the same), so a slant between the net's links zigzags along its line; failing those, the link
// lying most the way pushed within `climb.turn` (a cosine). A link lying across the way he pushes he
// leaves by its nearer end. At a point with no such link he stops. A move that would put his root under
// the ground (walker's) is not made. Then he stays where the hold is. Letting go of a net (`release`), the body is moved back
// from the surface, if it must be, until the toes of the body standing (its stance's `still` role's
// first frame, its own `ends`) are its `climb.clear` metres off it, so it falls and stands clear; its
// `lean` is let go of, and it is upright again.
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { animKind, clipOf, ends, momentOf, play, rigOf, stanceOf, stop } from '#plugins/anim/anim.sim.ts'
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
// on a side as its length divides into; its front's every corner moved out along +z by `front(x, y)`
// metres when that is given (under 0, in; 0 at the front's edges, where it meets the sides).
export function box(size: number[], cell: number, front?: (x: number, y: number) => number): Mesh {
  const [w, h, d] = size
  const position: number[] = [], index: number[] = []
  // A face from its corner `o` along `u` and `v`, u × v pointing out of the box, each corner moved out
  // by `lift` (along +z) when that is given.
  const face = (o: V, u: V, v: V, lift?: (p: V) => number) => {
    const nu = Math.max(1, Math.round(len(u) / cell)), nv = Math.max(1, Math.round(len(v) / cell))
    const first = position.length / 3
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = add(o, add(mul(u, i / nu), mul(v, j / nv)))
        position.push(...(lift ? add(p, [0, 0, lift(p)]) : p))
      }
    }
    const at = (i: number, j: number) => first + j * (nu + 1) + i
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) index.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1))
  }
  face([-w / 2, 0, d / 2], [w, 0, 0], [0, h, 0], front && (p => front(p[0], p[1])))
  face([w / 2, 0, -d / 2], [-w, 0, 0], [0, h, 0])
  face([w / 2, 0, d / 2], [0, 0, -d], [0, h, 0])
  face([-w / 2, 0, -d / 2], [0, 0, d], [0, h, 0])
  face([-w / 2, h, d / 2], [w, 0, 0], [0, 0, -d])
  face([-w / 2, 0, -d / 2], [w, 0, 0], [0, 0, d])
  return { position, index }
}

// A sphere of `radius` metres about the origin: an icosahedron's twenty faces, each cut into a grid of
// triangles whose edges divide the face's edge into as many as come nearest `cell` metres long, every
// corner pushed out onto the sphere.
export function sphere(radius: number, cell: number): Mesh {
  const g = (1 + Math.sqrt(5)) / 2
  const corners = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]].map(unit)
  const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
  const n = Math.max(1, Math.round((len(sub(corners[0], corners[11])) * radius) / cell))
  const position: number[] = [], index: number[] = []
  for (const [i, j, k] of faces) {
    const [a, b, c] = [corners[i], corners[j], corners[k]]
    const first = position.length / 3
    // Row v of the face's grid holds n − v + 1 corners, from the edge a–b toward c.
    for (let v = 0; v <= n; v++) for (let u = 0; u <= n - v; u++) position.push(...mul(unit(add(a, add(mul(sub(b, a), u / n), mul(sub(c, a), v / n)))), radius))
    const at = (u: number, v: number) => first + v * (n + 1) - (v * (v - 1)) / 2 + u
    for (let v = 0; v < n; v++) {
      for (let u = 0; u < n - v; u++) {
        index.push(at(u, v), at(u + 1, v), at(u, v + 1))
        if (u < n - v - 1) index.push(at(u + 1, v), at(u + 1, v + 1), at(u, v + 1))
      }
    }
  }
  return { position, index }
}

// A cylinder of `radius` metres standing on its base, its base's middle at the origin, `length` metres
// up: round it as many sides as come nearest `cell` metres each, up it as many rows; each end closed by
// rings in to its middle, as many as come nearest `cell` apart, each of as many sides as its round.
export function cylinder(radius: number, length: number, cell: number): Mesh {
  const round = Math.max(3, Math.round((2 * Math.PI * radius) / cell)), rows = Math.max(1, Math.round(length / cell))
  const rings = Math.max(1, Math.round(radius / cell))
  const position: number[] = [], index: number[] = []
  const ring = (r: number, y: number) => {
    const first = position.length / 3
    for (let i = 0; i < round; i++) position.push(r * math.sin((2 * Math.PI * i) / round), y, r * math.cos((2 * Math.PI * i) / round))
    return first
  }
  // Two rings of the same round joined, the triangles facing the way that takes from `a` to `b` across
  // the way round (out of the side, from a lower ring to a higher; on an end, from its outer ring in
  // for the top, from its inner out for the bottom).
  const join = (a: number, b: number) => {
    for (let i = 0; i < round; i++) {
      const j = (i + 1) % round
      index.push(a + i, a + j, b + j, a + i, b + j, b + i)
    }
  }
  // The side: rows of rings up it.
  const side = Array.from({ length: rows + 1 }, (_, n) => ring(radius, (length * n) / rows))
  for (let n = 0; n < rows; n++) join(side[n], side[n + 1])
  // An end at height `y` facing `face` (+1 up, −1 down): rings in from the rim, then its middle.
  const end = (y: number, face: number, rim: number) => {
    let outer = rim
    for (let n = rings - 1; n >= 1; n--) {
      const inner = ring((radius * n) / rings, y)
      if (face > 0) join(outer, inner)
      else join(inner, outer)
      outer = inner
    }
    const middle = position.length / 3
    position.push(0, y, 0)
    for (let i = 0; i < round; i++) {
      const j = (i + 1) % round
      if (face > 0) index.push(middle, outer + i, outer + j)
      else index.push(middle, outer + j, outer + i)
    }
  }
  end(length, 1, ring(radius, length))
  end(0, -1, ring(radius, 0))
  return { position, index }
}

// A solid stood up from a footprint on the ground: the cells between the grid lines `xs` (across, x) and
// `zs` (through, z) that `inside(i, j)` holds, each `height` metres high; its top and bottom a square of
// two triangles for each cell, and its sides, wherever a held cell meets one not held or the grid's edge,
// a wall of rows as near `cell` metres high as its height divides into.
export function prism(xs: number[], zs: number[], inside: (i: number, j: number) => boolean, height: number, cell: number): Mesh {
  const position: number[] = [], index: number[] = []
  // Four corners going round, the two triangles they make turned to face `out`.
  const quad = (a: V, b: V, c: V, d: V, out: V) => {
    const first = position.length / 3
    position.push(...a, ...b, ...c, ...d)
    if (dot(cross(sub(b, a), sub(c, a)), out) > 0) index.push(first, first + 1, first + 2, first, first + 2, first + 3)
    else index.push(first, first + 2, first + 1, first, first + 3, first + 2)
  }
  const rows = Math.max(1, Math.round(height / cell))
  const held = (i: number, j: number) => i >= 0 && j >= 0 && i < xs.length - 1 && j < zs.length - 1 && inside(i, j)
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      if (!held(i, j)) continue
      const [x0, x1, z0, z1] = [xs[i], xs[i + 1], zs[j], zs[j + 1]]
      quad([x0, height, z0], [x1, height, z0], [x1, height, z1], [x0, height, z1], [0, 1, 0])
      quad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [0, -1, 0])
      // Each side that meets a cell not held: its edge on the ground, and the way out of it.
      const sides: [V, V, V, boolean][] = [
        [[x1, 0, z0], [x1, 0, z1], [1, 0, 0], !held(i + 1, j)],
        [[x0, 0, z0], [x0, 0, z1], [-1, 0, 0], !held(i - 1, j)],
        [[x0, 0, z1], [x1, 0, z1], [0, 0, 1], !held(i, j + 1)],
        [[x0, 0, z0], [x1, 0, z0], [0, 0, -1], !held(i, j - 1)],
      ]
      for (const [a, b, out, open] of sides) {
        if (!open) continue
        for (let n = 0; n < rows; n++) {
          const y0 = (height * n) / rows, y1 = (height * (n + 1)) / rows
          quad([a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], [a[0], y1, a[2]], out)
        }
      }
    }
  }
  return { position, index }
}

// Grid lines from 0 through each of `marks` in turn, each stretch between two cut into as many as come
// nearest `cell` metres.
const lines = (marks: number[], cell: number) => {
  const out = [0]
  for (const to of marks) {
    const from = out[out.length - 1], n = Math.max(1, Math.round((to - from) / cell))
    for (let k = 1; k <= n; k++) out.push(from + ((to - from) * k) / n)
  }
  return out
}

// An inside corner: two walls `thick` metres thick standing at a right angle, their outer corner's foot
// at the origin, one running `size[0]` metres along x and the other `size[2]` along z, both `size[1]`
// high; the faces between them, at x and z `thick`, look in at each other.
export function corner(size: number[], thick: number, cell: number): Mesh {
  const [w, h, d] = size
  const xs = lines([thick, w], cell), zs = lines([thick, d], cell)
  return prism(xs, zs, (i, j) => xs[i] < thick - 1e-9 || zs[j] < thick - 1e-9, h, cell)
}

// A dish: a box of `size` (`box`) with a hollow in the middle of its front, the dent a ball of `radius`
// metres makes pressed `depth` metres in, its rim where the ball leaves the front.
export function dish(size: number[], cell: number, radius: number, depth: number): Mesh {
  const rim = Math.sqrt(2 * radius * depth - depth * depth)
  return box(size, cell, (x, y) => {
    const r = Math.hypot(x, y - size[1] / 2)
    return r >= rim ? 0 : -(Math.sqrt(radius * radius - r * r) - (radius - depth))
  })
}

// A bumpy slab: a box of `size` (`box`) whose front rises and falls in bumps and dips, `waves[0]` whole
// waves across it and `waves[1]` up it, `height` metres out at a bump's top and in at a dip's bottom,
// flat at its edges.
export function bumps(size: number[], cell: number, waves: number[], height: number): Mesh {
  const [w, h] = size
  return box(size, cell, (x, y) => height * Math.sin((2 * Math.PI * waves[0] * (x + w / 2)) / w) * Math.sin((2 * Math.PI * waves[1] * y) / h))
}

// The shapes a held kind's definition names as its `shape`, each the mesh it makes of that definition:
// `box`, of its `size` and `cell`; `sphere`, of its `radius` and `cell`; `cylinder`, of its `radius`,
// `length` and `cell`; `corner`, of its `size`, `thick` and `cell`; `dish`, of its `size`, `cell`,
// `radius` and `depth`; `bumps`, of its `size`, `cell`, `waves` and `height`.
const shapes: Record<string, (k: any) => Mesh> = {
  box: k => box(k.size, k.cell),
  sphere: k => sphere(k.radius, k.cell),
  cylinder: k => cylinder(k.radius, k.length, k.cell),
  corner: k => corner(k.size, k.thick, k.cell),
  dish: k => dish(k.size, k.cell, k.radius, k.depth),
  bumps: k => bumps(k.size, k.cell, k.waves, k.height),
}
export function meshOf(k: { shape: string }): Mesh {
  // A definition comes from the game's data file.
  if (!(k.shape in shapes)) throw new Error(`climb: no shape ${k.shape}; the shapes are ${Object.keys(shapes).join(', ')}`)
  return shapes[k.shape](k)
}

// A shape put where its row says: on its first step its `pos` is raised by the height of the ground under
// it (walker's), so the height its row starts with is how far above the ground it stands; `placed` once
// it has.
export function settle(me: Row, w: W) {
  const d = me.data
  if (d.placed) return
  const [x, y, z] = d.pos
  d.pos = [x, groundOf(w).height(x, z) + y, z]
  d.placed = true
}

// A net: `points` points, each one's place (`at`, three numbers) and the way out of the surface there
// (`out`, three, one long) in the mesh's own frame, and its links: point i links to `to[start[i]]` up to
// `to[start[i + 1]]`, both ways; and the mesh's triangles, three points each (`tri`), point i's being
// `round[first[i]]` up to `round[first[i + 1]]`.
export type Net = { points: number; at: Float32Array; out: Float32Array; start: Uint32Array; to: Uint32Array; tri: Uint32Array; first: Uint32Array; round: Uint32Array }

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
  const tri: number[] = []
  const rounds = Array.from({ length: points }, () => [] as number[])
  for (let t = 0; t < mesh.index.length; t += 3) {
    const [a, b, c] = [of[mesh.index[t]], of[mesh.index[t + 1]], of[mesh.index[t + 2]]]
    const pa = at.slice(a * 3, a * 3 + 3), pb = at.slice(b * 3, b * 3 + 3), pc = at.slice(c * 3, c * 3 + 3)
    const n = cross(sub(pb, pa), sub(pc, pa))
    for (const p of [a, b, c]) for (let k = 0; k < 3; k++) out[p * 3 + k] += n[k]
    for (const [x, y] of [[a, b], [b, c], [c, a]]) if (x !== y) { links[x].add(y); links[y].add(x) }
    for (const p of new Set([a, b, c])) rounds[p].push(tri.length / 3)
    tri.push(a, b, c)
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
  const first = new Uint32Array(points + 1), round: number[] = []
  rounds.forEach((r, p) => {
    first[p] = round.length
    round.push(...r)
  })
  first[points] = round.length
  return { points, at: new Float32Array(at), out: new Float32Array(out), start, to: new Uint32Array(to), tri: new Uint32Array(tri), first, round: new Uint32Array(round) }
}

// The points point `i` links to.
export const linked = (net: Net, i: number): Uint32Array => net.to.subarray(net.start[i], net.start[i + 1])

// Whether a body on a surface goes over the link from point `p` to point `o` (each placed by `place`,
// each with its way out `face`): when the surface turns there by no more than `bend` (a cosine), or when
// it folds in toward him, neither point behind the other's face and one in front of it (an inside corner,
// whose seam lies in the faces that meet there), however sharply; not over an outside edge sharper than
// `bend` (a wall's sides and top), where each stands behind the other's.
export function crosses(place: (i: number) => V, face: (i: number) => V, p: number, o: number, bend: number): boolean {
  if (dot(face(o), face(p)) >= bend) return true
  const po = sub(place(o), place(p))
  const ahead = dot(po, face(p)), back = -dot(po, face(o))
  return ahead > -1e-9 && back > -1e-9 && Math.max(ahead, back) > 1e-9
}

// A net's field: its triangles in a grid of `h`-metre boxes in the net's own frame, each box holding every
// triangle that comes within `h` of it, with each triangle's way out and the ways out of its edges and its
// corners (the faces along an edge summed; round a corner, each by its angle there) worked out once; and
// for each box with no triangle that near, whether its middle is inside (a ray from it crossing the
// surface an odd number of times), found when first asked.
type Field = {
  h: number; lo: V; n: number[]; boxes: Map<number, number[]>; inside: Map<number, boolean>
  // Each triangle's way out (three numbers), each of its edges' (a–b, a–c, b–c; nine), each point's.
  normal: Float64Array; edge: Float64Array; corner: Float64Array
}
// Metres: a field's box, and how far it reads exactly.
export const FIELD = 0.1
const fields = new WeakMap<Net, Field>()
function fieldOf(net: Net): Field {
  let f = fields.get(net)
  if (f) return f
  const h = FIELD
  const at = (i: number) => [net.at[i * 3], net.at[i * 3 + 1], net.at[i * 3 + 2]]
  const tris = net.tri.length / 3
  const corners = (t: number) => [net.tri[t * 3], net.tri[t * 3 + 1], net.tri[t * 3 + 2]]
  const normals: V[] = [], corners3: V[] = Array.from({ length: net.points }, () => [0, 0, 0])
  const edges = new Map<string, V>()
  const key = (a: number, b: number) => (a < b ? `${a} ${b}` : `${b} ${a}`)
  for (let t = 0; t < tris; t++) {
    const cs = corners(t), [a, b, c] = cs.map(at)
    normals.push(unit(cross(sub(b, a), sub(c, a))))
    for (let k = 0; k < 3; k++) {
      const i = cs[k], j = cs[(k + 1) % 3], l = cs[(k + 2) % 3]
      const u = sub(at(j), at(i)), v = sub(at(l), at(i))
      const angle = Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v) || 1))))
      corners3[i] = add(corners3[i], mul(normals[t], angle))
      edges.set(key(i, j), add(edges.get(key(i, j)) ?? [0, 0, 0], normals[t]))
    }
  }
  const normal = new Float64Array(tris * 3), edge = new Float64Array(tris * 9), corner = new Float64Array(net.points * 3)
  for (let t = 0; t < tris; t++) {
    const [a, b, c] = corners(t)
    normal.set(normals[t], t * 3)
    edge.set(edges.get(key(a, b))!, t * 9)
    edge.set(edges.get(key(a, c))!, t * 9 + 3)
    edge.set(edges.get(key(b, c))!, t * 9 + 6)
  }
  corners3.forEach((v, i) => corner.set(v, i * 3))
  const lo = [0, 1, 2].map(k => Math.min(...Array.from({ length: net.points }, (_, i) => net.at[i * 3 + k])) - 2 * h)
  const hi = [0, 1, 2].map(k => Math.max(...Array.from({ length: net.points }, (_, i) => net.at[i * 3 + k])) + 2 * h)
  const n = [0, 1, 2].map(k => Math.ceil((hi[k] - lo[k]) / h))
  const cell = (p: V) => p.map((v, k) => Math.floor((v - lo[k]) / h))
  const boxes = new Map<number, number[]>()
  for (let t = 0; t < tris; t++) {
    const ps = corners(t).map(at)
    const from = cell([0, 1, 2].map(k => Math.min(...ps.map(p => p[k])) - h)), to = cell([0, 1, 2].map(k => Math.max(...ps.map(p => p[k])) + h))
    for (let z = from[2]; z <= to[2]; z++) for (let y = from[1]; y <= to[1]; y++) for (let x = from[0]; x <= to[0]; x++) {
      const i = (z * n[1] + y) * n[0] + x
      let box = boxes.get(i)
      if (!box) boxes.set(i, (box = []))
      box.push(t)
    }
  }
  f = { h, lo, n, boxes, inside: new Map(), normal, edge, corner }
  fields.set(net, f)
  return f
}

// How far a place `p` of a net's own frame is out of its surface, and the way further out from there, off
// its field: within the field's box size, the distance to the nearest point of the nearest triangle, in
// when the place is behind the way out there (the triangle's own, or its edge's or corner's where the
// nearest point is on one); further than that, the box size, in or out as the box's middle is. Off the
// field's grid, out.
export function fromNet(net: Net, p: V): { by: number; way: V } {
  const f = fieldOf(net)
  const cx = Math.floor((p[0] - f.lo[0]) / f.h), cy = Math.floor((p[1] - f.lo[1]) / f.h), cz = Math.floor((p[2] - f.lo[2]) / f.h)
  if (cx < 0 || cy < 0 || cz < 0 || cx >= f.n[0] || cy >= f.n[1] || cz >= f.n[2]) return { by: f.h, way: [0, 0, 1] }
  const i = (cz * f.n[1] + cy) * f.n[0] + cx
  const { best, by, way } = nearestOf(net, f, p, f.boxes.get(i) ?? [])
  if (best <= f.h) return { by, way }
  // Further than a box: in or out as the box's middle is.
  if (!f.inside.has(i)) {
    const middle = [cx, cy, cz].map((v, k) => f.lo[k] + (v + 0.5) * f.h)
    const at = (j: number) => [net.at[j * 3], net.at[j * 3 + 1], net.at[j * 3 + 2]]
    const ray = unit([0.5772, 0.3123, 0.7547])
    let crossed = 0
    for (let t = 0; t < net.tri.length / 3; t++) {
      const a = at(net.tri[t * 3]), e1 = sub(at(net.tri[t * 3 + 1]), a), e2 = sub(at(net.tri[t * 3 + 2]), a)
      const q = cross(ray, e2), det = dot(e1, q)
      if (Math.abs(det) < 1e-12) continue
      const s = sub(middle, a), u = dot(s, q) / det
      if (u < 0 || u > 1) continue
      const r = cross(s, e1), v = dot(ray, r) / det
      if (v < 0 || u + v > 1) continue
      if (dot(e2, r) / det > 0) crossed++
    }
    f.inside.set(i, crossed % 2 === 1)
  }
  return { by: f.inside.get(i) ? -f.h : f.h, way }
}

// How far a place `p` of a net's own frame is out of its surface and the way further out, as `fromNet`
// reads it, off the net's triangles with a corner out to `rings` links from point `near` instead of its
// field: as far as it is, however far, so long as its nearest point is among them.
export function nearNet(net: Net, p: V, near: number, rings: number): { by: number; way: V } {
  let ring = [near]
  const seen = new Set(ring), tris = new Set<number>()
  for (let n = 0; n <= rings && ring.length; n++) {
    for (const q of ring) for (const t of net.round.subarray(net.first[q], net.first[q + 1])) tris.add(t)
    ring = ring.flatMap(q => [...linked(net, q)]).filter(o => !seen.has(o) && (seen.add(o), true))
  }
  const { by, way } = nearestOf(net, fieldOf(net), p, tris)
  return { by, way }
}

// The nearest point to `p` of the triangles `tris` (a net's own frame): how far it is, how far `p` is out
// of the surface there (under 0, in: behind the way out there, the triangle's own, or its edge's or
// corner's where the nearest point is on one), and the way further out.
function nearestOf(net: Net, f: Field, p: V, tris: Iterable<number>): { best: number; by: number; way: V } {
  const A = net.at, px = p[0], py = p[1], pz = p[2]
  let best = Infinity, sign = 1, wx = 0, wy = 0, wz = 1
  for (const t of tris) {
    const ia = net.tri[t * 3], ib = net.tri[t * 3 + 1], ic = net.tri[t * 3 + 2]
    const ax = A[ia * 3], ay = A[ia * 3 + 1], az = A[ia * 3 + 2]
    const abx = A[ib * 3] - ax, aby = A[ib * 3 + 1] - ay, abz = A[ib * 3 + 2] - az
    const acx = A[ic * 3] - ax, acy = A[ic * 3 + 1] - ay, acz = A[ic * 3 + 2] - az
    const apx = px - ax, apy = py - ay, apz = pz - az
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz
    const bpx = apx - abx, bpy = apy - aby, bpz = apz - abz
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz
    const cpx = apx - acx, cpy = apy - acy, cpz = apz - acz
    const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4
    // The nearest point, as how far along ab and ac from a, and the feature it lies on.
    let u: number, w: number, feature: number
    if (d1 <= 0 && d2 <= 0) { u = 0; w = 0; feature = 0 }
    else if (d3 >= 0 && d4 <= d3) { u = 1; w = 0; feature = 1 }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { u = d1 / (d1 - d3); w = 0; feature = 3 }
    else if (d6 >= 0 && d5 <= d6) { u = 0; w = 1; feature = 2 }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { u = 0; w = d2 / (d2 - d6); feature = 4 }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { w = (d4 - d3) / (d4 - d3 + (d5 - d6)); u = 1 - w; feature = 5 }
    else { const den = 1 / (va + vb + vc); u = vb * den; w = vc * den; feature = 6 }
    const qx = apx - abx * u - acx * w, qy = apy - aby * u - acy * w, qz = apz - abz * u - acz * w
    const far = Math.sqrt(qx * qx + qy * qy + qz * qz)
    if (far >= best) continue
    best = far
    // The way out there: its corner's, its edge's or its own.
    const [arr, at] =
      feature === 0 ? [f.corner, ia * 3] : feature === 1 ? [f.corner, ib * 3] : feature === 2 ? [f.corner, ic * 3]
      : feature === 3 ? [f.edge, t * 9] : feature === 4 ? [f.edge, t * 9 + 3] : feature === 5 ? [f.edge, t * 9 + 6] : [f.normal, t * 3]
    const ox = arr[at], oy = arr[at + 1], oz = arr[at + 2]
    sign = qx * ox + qy * oy + qz * oz < 0 ? -1 : 1
    if (far > 1e-9) { wx = (qx * sign) / far; wy = (qy * sign) / far; wz = (qz * sign) / far }
    else { const o = Math.hypot(ox, oy, oz) || 1; wx = ox / o; wy = oy / o; wz = oz / o }
  }
  return { best, by: sign * best, way: [wx, wy, wz] }
}

// Where a held row stands: its `pos`, `yaw` and `pitch` (a row, or those kept from one).
export type Placed = { data: { pos: V; yaw: number; pitch: number } }

// A place in the world in a held row's own frame (the reverse of `heldPoint`).
export function heldLocal(held: Placed, p: V): V {
  const [x, y, z] = held.data.pos, s = math.sin(held.data.yaw), c = math.cos(held.data.yaw)
  const dx = p[0] - x, dy = p[1] - y, dz = p[2] - z
  const u = [dx * c - dz * s, dy, dx * s + dz * c]
  const cp = math.cos(held.data.pitch), sp = math.sin(held.data.pitch)
  return [u[0], u[1] * cp - u[2] * sp, u[1] * sp + u[2] * cp]
}

// Places handed over all at once by what they are along ways: `dots(ways)` is, for each way, every
// place's dot with it (where it is, read along that way), `length` places.
export type Places = { length: number; dots(ways: V[]): Float64Array[] }

// Metres: the squares `outOf` sorts triangles into, seen down its way.
const SQUARE = 0.05

// How far the nearest of places `ps` stands out of a net's surface along `out` (a unit way; under 0, in
// it): of the net's triangles with a corner out to `rings` links from point `near` (each corner placed by
// `place`), those a line through a place along `out` meets, the least way out from where it meets them,
// of all the places; undefined when no line meets any of them. Seen down `out`, the triangles are sorted
// into squares; a place is set against those of its own square only, and only when its height less the
// highest corner of its square could be nearer than the nearest yet.
export function outOf(net: Net, place: (i: number) => V, ps: Places, out: V, near: number, rings: number): number | undefined {
  let ring = [near]
  const seen = new Set(ring), tris = new Set<number>()
  for (let n = 0; n <= rings && ring.length; n++) {
    for (const q of ring) for (const t of net.round.subarray(net.first[q], net.first[q + 1])) tris.add(t)
    ring = ring.flatMap(q => [...linked(net, q)]).filter(o => !seen.has(o) && (seen.add(o), true))
  }
  if (!ps.length) return undefined
  // Everything seen down `out`: two ways across it, and how far out along it.
  const u = unit(cross(out, Math.abs(out[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(out, u)
  const flat = (p: V) => [dot(p, u), dot(p, v), dot(p, out)]
  // The triangles not lying along `out` (no line along it meets those), and the squares each covers.
  type Seen = { a: V; b: V; c: V; area: number }
  const squares = new Map<number, { tris: Seen[]; top: number }>()
  const keyOf = (x: number, y: number) => (x + 32768) * 65536 + (y + 32768)
  for (const t of tris) {
    const [a, b, c] = [0, 1, 2].map(k => flat(place(net.tri[t * 3 + k])))
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    if (Math.abs(area) < 1e-12) continue
    const seen1 = { a, b, c, area }, top = Math.max(a[2], b[2], c[2])
    for (let x = Math.floor(Math.min(a[0], b[0], c[0]) / SQUARE); x <= Math.floor(Math.max(a[0], b[0], c[0]) / SQUARE); x++) {
      for (let y = Math.floor(Math.min(a[1], b[1], c[1]) / SQUARE); y <= Math.floor(Math.max(a[1], b[1], c[1]) / SQUARE); y++) {
        const key = keyOf(x, y)
        let sq = squares.get(key)
        if (!sq) squares.set(key, (sq = { tris: [], top: -Infinity }))
        sq.tris.push(seen1)
        sq.top = Math.max(sq.top, top)
      }
    }
  }
  const [hs, us, vs] = ps.dots([out, u, v])
  // How far place `i` stands out of the surface where the line through it meets one of its square's
  // triangles, the least; undefined if it meets none.
  const meet = (i: number, sq: { tris: Seen[] }) => {
    let least: number | undefined
    const px = us[i], py = vs[i]
    for (const { a, b, c, area } of sq.tris) {
      const wb = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / area
      const wc = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / area
      if (wb < -1e-9 || wc < -1e-9 || wb + wc > 1 + 1e-9) continue
      const s = hs[i] - (a[2] + (b[2] - a[2]) * wb + (c[2] - a[2]) * wc)
      if (least === undefined || s < least) least = s
    }
    return least
  }
  const squareOf = (i: number) => squares.get(keyOf(Math.floor(us[i] / SQUARE), Math.floor(vs[i] / SQUARE)))
  // The lowest place first, then each other set against its square while it could still be the nearest:
  // first against the highest corner of all (no square looked up), then of its own square.
  let lowest = 0, top = -Infinity
  for (let i = 1; i < ps.length; i++) if (hs[i] < hs[lowest]) lowest = i
  for (const sq of squares.values()) top = Math.max(top, sq.top)
  const first = squareOf(lowest)
  let least = first && meet(lowest, first)
  for (let i = 0; i < ps.length; i++) {
    if (least !== undefined && hs[i] - top >= least) continue
    const sq = squareOf(i)
    if (!sq || (least !== undefined && hs[i] - sq.top >= least)) continue
    const s = meet(i, sq)
    if (s !== undefined && (least === undefined || s < least)) least = s
  }
  return least
}

// ---------------------------------------------------------------- holding a net

// A hold on a net: the held row's id, two linked points of its net, and how far from `a` (0) to `b` (1).
export type NetHold = { on: number; a: number; b: number; t: number; lat?: number; way?: V }
export const onNet = (h: Hold | NetHold): h is NetHold => 'a' in h

// A point of a held row's own frame in the world, and a way: turned back by its `pitch` (radians, its
// front faced up that much) about its x, then by its `yaw`, from where it stands.
const pitched = (pitch: number, v: V) => [v[0], v[1] * math.cos(pitch) + v[2] * math.sin(pitch), -v[1] * math.sin(pitch) + v[2] * math.cos(pitch)]
export const heldPoint = (held: Placed, p: V) => world(held.data.pos, held.data.yaw, pitched(held.data.pitch, p))
export const heldWay = (held: Placed, v: V) => world([0, 0, 0], held.data.yaw, pitched(held.data.pitch, v))
// Where a held row stands now, kept apart from its row.
export const placedOf = (held: Placed): Placed => ({ data: { pos: [...held.data.pos], yaw: held.data.yaw, pitch: held.data.pitch } })

// The body's frame on a surface facing `out`: its front into the surface, and its up the up it had
// (`had`) laid flat on it, carried over the surface as he goes; then, where the world's up laid flat on it
// is more than a little (the surface is not facing straight up or down) and within a quarter turn of
// his, turned toward it by at most `turn` radians, so on a slope he comes upright and over a top he never
// flips round. With no up yet, it is the world's up laid flat on it, or where that is next to nothing,
// the way he faces, `yaw`, laid flat on it.
export function frameOn(out: V, had: V | null | undefined, yaw: number, turn: number): { up: V; ahead: V } {
  const lay = (v: V) => sub(v, mul(out, dot(v, out)))
  const upright = lay([0, 1, 0])
  const steep = len(upright) >= 0.2
  let up = had ? lay(had) : steep ? upright : lay([math.sin(yaw), 0, math.cos(yaw)])
  if (len(up) < 1e-9) up = steep ? upright : lay([math.sin(yaw), 0, math.cos(yaw)])
  up = unit(up)
  if (had && steep && dot(up, upright) > 0) {
    // Turned about the way out, toward upright, by no more than `turn`.
    const to = unit(upright)
    const angle = math.atan2(dot(cross(up, to), out), dot(up, to))
    const by = Math.max(-turn, Math.min(turn, angle))
    up = unit(add(mul(up, math.cos(by)), mul(cross(out, up), math.sin(by))))
  }
  return { up, ahead: mul(out, -1) }
}
// A way in the body's frame (x its left, y up, z ahead) in the world, for a body whose up and front are
// `up` and `ahead`.
const framed = (f: { up: V; ahead: V }, p: V) => add(add(mul(cross(f.up, f.ahead), p[0]), mul(f.up, p[1])), mul(f.ahead, p[2]))

const nets = new WeakMap<object, Net>()
// The net of a held row: the mesh of its kind's definition (`meshOf`), made once a definition.
export function netOf(from: W | Wire, held: Row): Net {
  const k = def(from, held.kind)
  let net = nets.get(k)
  if (!net) {
    net = netOn(meshOf(k))
    nets.set(k, net)
  }
  return net
}

// A place on a held row's net in the world now: the spot, and the way out of the surface there.
export function spotOn(from: W | Wire, held: Row, h: { a: number; b: number; t: number }): { at: V; out: V } {
  const net = netOf(from, held)
  const p = (i: number) => [...net.at.subarray(i * 3, i * 3 + 3)]
  const o = (i: number) => [...net.out.subarray(i * 3, i * 3 + 3)]
  return {
    at: heldPoint(held, add(p(h.a), mul(sub(p(h.b), p(h.a)), h.t))),
    out: unit(heldWay(held, add(o(h.a), mul(sub(o(h.b), o(h.a)), h.t)))),
  }
}

// A palm in the holder's own frame on a clip's first frame: midway between the wrist and the middle
// fingertip (its own `ends`); and the middle of the two palms.
function palm(w: W, me: Row, clip: string, hand: 'L' | 'R'): V {
  const e = ends(w, me, `hand${hand}`, { clip, clipT: 0 })
  return [(e[0] + e[3]) / 2, (e[1] + e[4]) / 2, (e[2] + e[5]) / 2]
}
const palms = (w: W, me: Row, clip: string): V => mul(add(palm(w, me, clip, 'L'), palm(w, me, clip, 'R')), 0.5)

export function grabNet(me: Row, w: W, kinds: string[]): boolean {
  const k = def(w, me.kind).climb
  const hands = world(me.data.pos, me.data.yaw, palms(w, me, k.clips.still))
  let best: { on: number; a: number; far: number } | undefined
  for (const held of kinds.flatMap(kind => w.all(kind))) {
    const net = netOf(w, held)
    for (let i = 0; i < net.points; i++) {
      const far = len(sub(heldPoint(held, [...net.at.subarray(i * 3, i * 3 + 3)]), hands))
      if (far <= k.reach && (!best || far < best.far)) best = { on: held.id, a: i, far }
    }
  }
  if (!best) return false
  me.data.hold = { on: best.on, a: best.a, b: linked(netOf(w, w.get(best.on)!), best.a)[0], t: 0 }
  stay(me, w, 0)
  return true
}

// The point of a net nearest `to`, walking its links from `from` while each step comes nearer, onto
// points `ok` allows only (handed the point stepped onto and the one stepped from).
export function nearestOn(net: Net, place: (i: number) => V, to: V, from: number, ok: (i: number, from: number) => boolean = () => true): number {
  let at = from, far = len(sub(place(from), to))
  for (;;) {
    let next = -1
    for (const o of linked(net, at)) {
      if (!ok(o, at)) continue
      const d = len(sub(place(o), to))
      if (d < far) { far = d; next = o }
    }
    if (next < 0) return at
    at = next
  }
}

// How a hold moves over a net (`place` and `face` a point's place and way out in the world): `way` the
// unit way pushed on the surface; `turn`, `fan` and `bend` cosines; `fits(p)` whether the holder's hands
// fit at point `p`.
type Travel = { place: (i: number) => V; face: (i: number) => V; way: V; turn: number; fan: number; bend: number; fits: (p: number) => boolean }

// The hold moved `dist` metres the way pushed: along its link to the end lying that way, and from a
// point on along a link to a point whose way out is within `bend` of the one it leaves and where the
// hands fit. Of the links within `fan` of the way pushed, the one that leaves the hold nearest the
// straight line it has been pushed along (`lat`, how far it has drifted to one side of that line, kept
// on the hold while the way pushed stays the same); if none is, the link lying most that way within
// `turn`. A link lying across the way pushed is left by its nearer end. It stops at a point with no
// such link.
function travel(net: Net, m: Travel, h: NetHold, dist: number): NetHold {
  let { a, b, t } = h
  const side = (out: V) => unit(cross(out, m.way))
  // The drift is kept while the way pushed stays within a degree of the last.
  let lat = h.way && dot(h.way, m.way) > 0.9998 ? h.lat ?? 0 : 0
  let left = dist
  const onward = (p: number) => {
    const ok = [...linked(net, p)].filter(o => crosses(m.place, m.face, p, o, m.bend) && m.fits(o))
    const dir = (o: number) => sub(m.place(o), m.place(p))
    const near = ok.filter(o => dot(unit(dir(o)), m.way) >= m.fan)
    if (near.length) return near.reduce((x, y) => (Math.abs(lat + dot(dir(y), side(m.face(p)))) < Math.abs(lat + dot(dir(x), side(m.face(p)))) ? y : x))
    let best: number | undefined, most = m.turn
    for (const o of ok) {
      const c = dot(unit(dir(o)), m.way)
      if (c > most) { most = c; best = o }
    }
    return best
  }
  for (let n = 0; n < 256 && left > 1e-9; n++) {
    // At a point: on along the best link from it.
    if (t <= 0 || t >= 1) {
      const p = t <= 0 ? a : b
      const o = onward(p)
      if (o === undefined) return { ...h, a: p, b: p === a ? b : a, t: 0, lat, way: m.way }
      a = p
      b = o
      t = 0
    }
    const e = sub(m.place(b), m.place(a)), l = len(e) || 1e-9
    let along = dot(e, m.way) / l
    if (Math.abs(along) < m.turn) along = t < 0.5 ? -1 : 1
    const room = along > 0 ? (1 - t) * l : t * l
    const go = Math.min(left, room)
    lat += dot(mul(e, ((along > 0 ? 1 : -1) * go) / l), side(m.face(a)))
    t += ((along > 0 ? 1 : -1) * go) / l
    if (go === room) t = along > 0 ? 1 : 0
    left -= go
  }
  return { ...h, a, b, t, lat, way: m.way }
}

export function climbNet(me: Row, w: W, dt: number, stick: V) {
  const d = me.data
  const k = def(w, me.kind).climb
  const push = (v: number) => (Math.abs(v) < k.still ? 0 : v)
  const x = push(stick[0]), y = push(-stick[1])
  if (x || y) {
    const held = w.get(d.hold.on)!
    const net = netOf(w, held)
    const place = (i: number) => heldPoint(held, [...net.at.subarray(i * 3, i * 3 + 3)])
    const face = (i: number) => heldWay(held, [...net.out.subarray(i * 3, i * 3 + 3)])
    const { out } = spotOn(w, held, d.hold)
    // His right and his up, laid on the surface.
    const f = frameOn(out, d.lean?.up, d.yaw, 0)
    const along = add(mul(framed(f, [-1, 0, 0]), x), mul(f.up, y))
    const way = unit(sub(along, mul(out, dot(along, out))))
    // His hands fit at a point when each palm, placed as his still pose places it with the middle of his
    // palms on that point, his body framed on the surface there, is nearest a point of the net that is
    // reached from that point over links he goes over (`crosses`: so a sharp outside edge between the two
    // leaves no fit, and round a pole or into an inside corner his palms fit).
    const [mid, hands] = [palms(w, me, k.clips.still), [palm(w, me, k.clips.still, 'L'), palm(w, me, k.clips.still, 'R')]]
    const fits = (p: number) => {
      const there = frameOn(face(p), f.up, d.yaw, 0)
      return hands.every(hand => {
        const to = add(place(p), framed(there, sub(hand, mid)))
        return nearestOn(net, place, to, p) === nearestOn(net, place, to, p, (o, from) => crosses(place, face, from, o, k.bend))
      })
    }
    const to = travel(net, { place, face, way, turn: k.turn, fan: k.fan, bend: k.bend, fits }, d.hold, k.speed * Math.min(1, math.hypot(x, y)) * dt)
    // A hold that would put his root under the ground is not taken: he stays where he was.
    const [px, py, pz] = standing(me, w, to, 0).root
    if (py >= stand(numbers(me, w), groundOf(w), px, pz)) d.hold = to
  }
  stay(me, w, k.upright * dt)
}

// Where he stands for a hold: framed on the surface there (`frameOn`, from the up he has, turned toward
// upright by at most `turn` radians), his root set back from the middle of his palms on the spot and out
// by his `climb.brace`.
function standing(me: Row, w: W, hold: NetHold, turn: number) {
  const d = me.data
  const k = def(w, me.kind).climb
  const held = w.get(hold.on)!
  const { at, out } = spotOn(w, held, hold)
  const lean = frameOn(out, d.lean?.up, d.yaw, turn)
  const root = add(sub(at, framed(lean, palms(w, me, k.clips.still))), mul(out, k.brace))
  // Stood out from the surface as far as he must to keep the front of his body off it. His front is
  // told by the line down his middle, from the top of his head to his hips and on past them by his
  // `climb.past` of its length, as far as the skin of his body goes (his still clip's first frame, his own
  // `ends`; his legs below keep out by how the page bends them), and by how far his skin stands ahead of
  // that line in bands of `climb.across` metres to either side of it, `climb.front` (out from the middle,
  // the most of each band). Every `climb.across` metres along the line, at the edge of every band, a
  // place that far ahead of the line (the more of the two bands it parts) is kept out of the surface under
  // it along the way out (read off the net, `outOf`): so close together that the surface between them
  // rises over them by no more than a tenth of a millimetre over a bump's top. On a flat face his skin is
  // further out than that, and he stays where he is.
  const net = netOf(w, held)
  const place = (i: number) => heldPoint(held, [...net.at.subarray(i * 3, i * 3 + 3)])
  const still = { clip: k.clips.still, clipT: 0 }
  const top = ends(w, me, 'head', still).slice(3), hips = ends(w, me, 'torso', still).slice(0, 3)
  const down = mul(sub(hips, top), 1 + k.past)
  const along = Math.ceil(len(down) / k.across)
  // At each edge, out from the middle, how far ahead: the more of the bands on either side.
  const edges = k.front.length
  const ahead = (j: number) => Math.max(k.front[Math.max(0, j - 1)], k.front[Math.min(edges - 1, j)])
  let more = 0
  for (let n = 0; n <= along; n++) {
    const middle = add(top, mul(down, n / along))
    const ps: V[] = []
    for (let j = -edges; j <= edges; j++) ps.push(add(root, framed(lean, add(middle, [j * k.across, 0, ahead(Math.abs(j))]))))
    const there = outOf(net, place, { length: ps.length, dots: ways => ways.map(w => Float64Array.from(ps, p => dot(p, w))) }, out, nearestOn(net, place, add(root, framed(lean, middle)), hold.a), 1)
    if (there !== undefined) more = Math.max(more, -there)
  }
  return { lean, root: add(root, mul(out, more)) }
}

export function stay(me: Row, w: W, turn: number) {
  const d = me.data
  const k = def(w, me.kind).climb
  const { lean, root } = standing(me, w, d.hold, turn)
  // His yaw is his front laid flat; facing straight up or down he keeps the one he had.
  const flat = math.hypot(lean.ahead[0], lean.ahead[2])
  const yaw = flat > 1e-6 ? math.atan2(lean.ahead[0], lean.ahead[2]) : d.yaw
  Object.assign(d, { pos: root, yaw, lean, vel: [0, 0, 0], want: [0, 0], face: null, grounded: true, sliding: false, speed: 0 })
  if (d.clip !== k.clips.still) play(me, k.clips.still, { rate: 0 })
}

export function release(me: Row, w: W) {
  const d = me.data
  // Off a net: back from the surface until the toes of the body standing (its stance's `still` role's
  // first frame, its own `ends`) are its `climb.clear` metres off it.
  if (onNet(d.hold)) {
    const { at, out } = spotOn(w, w.get(d.hold.on)!, d.hold)
    const rig = rigOf(w, animKind(me))
    const still = { clip: momentOf(rig, stanceOf(rig, d), 'still')!, clipT: 0 }
    const toes = Math.max(ends(w, me, 'footL', still)[5], ends(w, me, 'footR', still)[5])
    const short = toes + def(w, me.kind).climb.clear - dot(sub(d.pos, at), out)
    if (short > 0) d.pos = add(d.pos, mul(out, short))
    d.lean = null
  }
  d.hold = null
  d.grounded = false
  stop(me, w)
}
