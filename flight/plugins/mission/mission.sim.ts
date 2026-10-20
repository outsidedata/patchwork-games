// flight's missions, a plugin of the game's own: the ring course and the formation, each a seat's own
// progress on its `player` row, flown in the `plane` that row holds, run by the player's rule each step
// after the plane has flown (`player.sim.ts`). It has no numbers of its own: they are the `course`,
// `formation`, `ring` and `airport` definitions in `assets/flight.json`. Its browser half
// (`mission.plugin.ts`) shows them.
//
// The ring course, the row's `course` while the seat flies Rings, null otherwise: `next`, the place in
// the course (by `order`) of the ring to fly through next; `clock`, seconds since it began; `missed`,
// rings passed by; `done`, true once it is over. Each step (`rings`), until it is done, `clock` counts
// on and the plane's path this step (from pos − vel·dt to pos) is checked against the next ring: where
// it crosses the ring's face inside its `radius`, the ring is flown and the next one is next; where it
// crosses within the `course` definition's `near` metres of its middle but outside its radius, the ring
// is missed, counted, and the next one is next. A plane that never comes near a ring has not reached it
// yet. After the last ring the course is done the step the plane stands on its wheels on the runway
// (the `airport` definition's `runway`, about the `airport` actor's `pos` and `yaw`) slower than
// `stopped` m/s. A crashed plane's course stops counting.
//
// The formation, the row's `formation` while the seat flies Formation, off a lead: the `plane` of the
// seat's plane's type whose traffic is `lead` (`leadOf`), which the pilot flies round the formation's
// loop for ever (`plugins/pilot`). Its numbers are the `formation` definition:
//   path       the lead's way round the field, [x, z] points in the `airport`'s frame, a closed loop
//              flown through each in turn along a Catmull-Rom spline (`trackOf`), `altitude` metres over
//              the field.
//   speeds     how fast the lead flies it, m/s, by its type.
//   join       metres over the field the seat's plane climbs, off its wheels, before it is in formation.
//   slots      where each seat's plane flies off the lead, by the seat's slot, in the lead's frame:
//              [right, up, back] m.
//   tight, loose   metres from the slot inside which the seat is TIGHT, else LOOSE, else LOST.
// It holds: `state`, `waiting` until the plane is up, then `tight`, `loose` or `lost`, and `done` once
// round; `s`, metres the lead has flown since; `gap`, metres from the plane to its slot; `tight`, seconds
// flown tight; `score`, 10 points a second tight and 4 loose; `done`. Each step (`formation`): while
// waiting, once the plane is in the air `join` metres up, it is in formation; then the lead's flying is
// counted on, the gap and the state are read and scored, and once the lead has flown the loop's length
// the formation is done. A crashed plane's formation stops. A seat started in the air on the formation is
// put in its slot (`inSlot`), flying as the lead flies.
import type { Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { rotate, type Plane, type Quat } from '#plugins/flight3d/flight3d.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export type Course = { next: number; clock: number; missed: number; done: boolean }
export type Formation = { state: string; s: number; gap: number; tight: number; score: number; done: boolean }

/** A course as a seat starts it. */
export const freshCourse = (): Course => ({ next: 0, clock: 0, missed: 0, done: false })
/** A formation as a seat starts it. */
export const freshFormation = (): Formation => ({ state: 'waiting', s: 0, gap: 0, tight: 0, score: 0, done: false })

// --- the ring course ---

/** The way a ring faces, a unit vector in the world: a plane flying along it passes through. */
export const faceOf = (yaw: number, pitch: number) => [math.sin(yaw) * math.cos(pitch), math.sin(pitch), -math.cos(yaw) * math.cos(pitch)]
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** The rings of the course, in the order they are flown. */
export const ringsOf = (w: W) => w.all('ring').sort((a, b) => a.data.order - b.data.order)

/** Whether a point stands on the runway: inside its rectangle about the airport's pos and yaw. */
export function onRunway(w: W, pos: number[]) {
  const field = w.find('airport').data
  const { length, width } = def(w, 'airport').runway
  const dx = pos[0] - field.pos[0], dz = pos[2] - field.pos[2]
  const c = math.cos(field.yaw), s = math.sin(field.yaw)
  const x = dx * c - dz * s, z = dx * s + dz * c
  return Math.abs(x) <= width / 2 && Math.abs(z) <= length / 2
}

/** One step of the ring course of `me`, a seat flying `plane`, which has flown this step. */
export function rings(w: W, me: Row, plane: Row, dt: number) {
  const c = me.data.course as Course
  const p = plane.data as Plane
  if (c.done || p.crashed) return
  c.clock += dt
  const all = ringsOf(w)
  const ring = all[c.next]
  if (!ring) {
    const speed = math.hypot(p.vel[0], p.vel[1], p.vel[2])
    if (p.press.some(q => q > 0) && speed < def(w, 'course').stopped && onRunway(w, p.pos)) c.done = true
    return
  }
  const r = ring.data
  const face = faceOf(r.yaw, r.pitch)
  const a = sub(sub(p.pos, p.vel.map(v => v * dt)), r.pos), b = sub(p.pos, r.pos)
  const da = dot(a, face), db = dot(b, face)
  if (da === db || da * db > 0) return
  const t = da / (da - db)
  const off = math.hypot(...a.map((v, i) => v + (b[i] - v) * t))
  if (off <= def(w, 'ring').radius) c.next++
  else if (off <= def(w, 'course').near) { c.missed++; c.next++ }
}

// --- the formation ---

export type Track = { pts: number[][]; cum: number[]; length: number }
const EACH = 40 // samples of each span of the spline

// The loop sampled along its spline in the airport's frame, with the distance along it at each sample:
// fixed data, so worked out once a loop.
const tracks = new WeakMap<object, Track>()
export function trackOf(path: number[][]): Track {
  const had = tracks.get(path)
  if (had) return had
  const n = path.length, pts: number[][] = []
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [path[(i - 1 + n) % n], path[i], path[(i + 1) % n], path[(i + 2) % n]]
    for (let k = 0; k < EACH; k++) {
      const t = k / EACH, t2 = t * t, t3 = t2 * t
      pts.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)))
    }
  }
  const cum = [0]
  for (let i = 1; i <= pts.length; i++) cum.push(cum[i - 1] + math.hypot(pts[i % pts.length][0] - pts[i - 1][0], pts[i % pts.length][1] - pts[i - 1][1]))
  const track = { pts, cum, length: cum[pts.length] }
  tracks.set(path, track)
  return track
}

/** Where a slot is, off a plane at `pos` turned by `rot`: [right, up, back] in its frame. */
export const slotOf = (pos: number[], rot: Quat, slot: number[]) => rotate(rot, slot).map((v, i) => v + pos[i])

/** The formation's lead of planes of `type`: the plane of that type whose traffic is `lead`. */
export const leadOf = (rows: Row[], type: string) => rows.find(r => r.kind === 'plane' && r.data.traffic === 'lead' && r.data.type === type)

/** `plane` put in the slot of seat slot `seat` off its lead, flying as the lead flies: its attitude, its
 *  velocity, its lever. */
export function inSlot(w: W, plane: Row, seat: number) {
  const lead = leadOf(w.all('plane'), plane.data.type)
  if (!lead) throw new Error(`no plane leads the formation in a ${plane.data.type}`)
  const slot = def(w, 'formation').slots[seat]
  const p = plane.data as Plane, l = lead.data as Plane
  Object.assign(p, {
    pos: slotOf(l.pos, l.rot, slot), rot: [...l.rot], vel: [...l.vel], spin: [...l.spin], throttle: l.throttle, throttling: 0,
    aileron: l.aileron, elevator: l.elevator, rudder: l.rudder, pitch: l.pitch, roll: l.roll, yaw: 0, airbrake: 0, brake: 0, gear: 1, gearDown: true, press: [], crashed: false,
  })
}

/** One step of the formation of `me`, a seat flying `plane`, which has flown this step. */
export function formation(w: W, me: Row, plane: Row, dt: number) {
  const f = me.data.formation as Formation
  const p = plane.data as Plane
  if (f.done || p.crashed) return
  const k = def(w, 'formation')
  const lead = leadOf(w.all('plane'), p.type)
  if (!lead) throw new Error(`no plane leads the formation in a ${p.type}`)
  const l = lead.data as Plane
  if (f.state === 'waiting') {
    if (p.press.some(q => q > 0) || p.pos[1] - w.find('airport').data.pos[1] < k.join) return
    f.state = 'lost'
  } else f.s += math.hypot(l.vel[0], l.vel[1], l.vel[2]) * dt
  const slot = slotOf(l.pos, l.rot, k.slots[me.data.seat])
  f.gap = math.hypot(p.pos[0] - slot[0], p.pos[1] - slot[1], p.pos[2] - slot[2])
  f.state = f.gap <= k.tight ? 'tight' : f.gap <= k.loose ? 'loose' : 'lost'
  if (f.state === 'tight') { f.tight += dt; f.score += 10 * dt } else if (f.state === 'loose') f.score += 4 * dt
  if (f.s >= trackOf(k.path).length) { f.done = true; f.state = 'done' }
}
