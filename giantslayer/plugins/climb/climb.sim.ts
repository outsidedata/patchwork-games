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
//          how far its body stands out from the surface past its hands; `up` and
//          `side` m/s, how fast it climbs along a limb and round it; `clips`, the clip it plays to
//          hold still (`hold`), climb up, climb down, go left and go right.
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
import type { Row, W } from '#engine/engine.ts'
import type { Wire } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { ends, play, stop } from '#plugins/anim/anim.sim.ts'
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
  const climb = -stick[1], across = stick[0]
  h.along += (climb * k.up * dt / length) * rising
  const r = def(w, held.kind).segments[h.segment].radius
  // Round to the right, as the holder faces the limb, is round it the negative way.
  h.around -= across * k.side * dt / r
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
  const clip = climb > 0.1 ? k.clips.up : climb < -0.1 ? k.clips.down : across > 0.1 ? k.clips.right : across < -0.1 ? k.clips.left : k.clips.hold
  if (d.clip !== clip) play(me, clip)
}

// How far apart two places on one limb of the held row are, over its surface: along it, and round it.
export function apart(w: W, h: Hold, at: { segment: string; along: number; around: number }): number {
  const held = w.get(h.on)!
  const [a, b] = line(w, held, h.segment)
  const r = def(w, held.kind).segments[h.segment].radius
  const turn = Math.abs(math.atan2(math.sin(at.around - h.around), math.cos(at.around - h.around)))
  return math.hypot((at.along - h.along) * len(sub(b, a)), turn * r)
}

export function release(me: Row, w: W) {
  const d = me.data
  d.hold = null
  d.grounded = false
  stop(me, w)
}
