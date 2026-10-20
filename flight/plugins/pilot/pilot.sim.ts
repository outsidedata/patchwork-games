// flight's pilot, a plugin of the game's own: the hands that fly a `plane` row no seat holds, and the
// controllers a seat's playtester presses with (`player.client.ts`'s `autopilot`). It has no row and no
// numbers of its own: they are the `pilot` definition (the hands) and the `circuit` definition (the
// traffic pattern) in `assets/flight.json`, and the `airport`'s. Every turn and root here is
// `plugins/math`'s, so a page running the sky ahead flies every plane nobody holds to the bit the server
// does.
//
// THE HANDS, the `pilot` definition. In the air (`fly`) a plane banks toward a point `l1` away as pure
// pursuit does, for the lateral pull 2v²·sin η / L1 that flies the circle tangent to its heading through
// the point (`turn` of it, at most `bank` radians); it holds a flight path on the elevator (`path`
// radians of stick a radian off, over `pitch`, damped by `pitchDamp`, a bank's lost lift made up by
// `rise`); and a speed on the lever (`lever` of it a m/s off), the airbrake out when it is fast with the
// lever shut. `hold` holds the wings level and the nose at an attitude. On the ground (`taxi`) the
// nosewheel holds a point `lookahead` metres on along a route (`steer` of yaw a radian off) at `taxi` m/s,
// slower in a turn and slowing to a stop at the route's end, on a lever worked out from the thrust the
// speed wants (`taxiGain` m/s² a m/s off, over the rolling drag): so a jet's and a Camel's lever differ by
// the twentyfold between their engines. `takeoff` runs the lever up on the runway's line and holds
// `climb` radians of pitch past `rotate` times the stall speed.
//
// THE CIRCUIT, the `circuit` definition: a left-hand pattern off the runway, taking off north, the
// downwind to the west, away from the apron. Its size is the plane's own, `planes[type]`: its legs are
// laid on the turn radius R = v² / (g·tan `bank`) at its downwind speed (`speeds[2]` times its stall
// speed), so a jet flies a pattern as much wider as it is faster, and its `height`, `wide` and `final`
// are chosen so every leg clears the land under it.
//   leg 0  upwind     the runway's line from its southern end to R past its northern, climbing to
//                     `height` metres over the field.
//   leg 1  crosswind  west `wide`·R.
//   leg 2  downwind   south to `final`·R past the runway's southern end, coming down to the base's top.
//   leg 3  base       east back onto the runway's line, coming down to Hf, the height of the plane's
//                     `glide` slope at final's start.
//   leg 4  final      north down the runway's line onto the touchdown point, `touchdown` metres in from
//                     its southern end, flared at `pilot.flare` metres.
// Each leg's speed is its `speeds` times the stall speed; it is flown along its line, aiming `lead`
// metres on from the plane's nearest point, its height on the path toward the leg's end, and it hands
// over to the next leg R short of its end, so the turn ends on the next line.
//
// A plane no seat holds is in a `phase`, on its row:
//   parked     on its stand (the `stand` row it names), brakes on. A `circuit` plane's `wait` counts
//              down, then it goes out with `laps` touch-and-goes before it stops; a seat's plane stays.
//   out        taxis from its stand along the taxiway to the hold-short point, `hold` metres east of
//              the runway's line on its southern link.
//   hold       brakes on, until the runway is clear (`busy`): no other plane lining up, rolling, rolling
//              out, on base or on final, on the runway's pavement or within 20 m over it, or in the air
//              inside `clear`'s box over the approach: `side` metres either side of the runway's line,
//              from its southern end `out` metres south, under `above` metres.
//   line       taxis onto the runway's line, facing north.
//   roll       takes off.
//   circuit    flies leg `leg`; on its wheels after final it rolls out.
//   rollout    on the runway after a landing: a touch-and-go while it has `laps` (a `lap` plane always
//              has), the leg 0 next; else the brakes, and once at taxi speed it taxis in.
//   in         taxis from where it stopped (`taxi`, kept on the row) to the nearest link ahead, across to
//              the taxiway, and along it to its stand; there it is parked again for `rest` seconds.
//   towed      a plane that cannot taxi: one with no steered wheel (the Camel, its tailskid fixed and no
//              brakes), stopped, or a plane stopped off the pavement, is put back on its stand after
//              `tow` seconds, as the ground crew would push it.
//   wreck      crashed: put back on its stand after `wreck` seconds.
//   lead       a formation's lead: it flies the formation's loop (`loop`) for ever.
//   seat       a seat holds it. The step a seat lets go, the plane is taken on from where it is: in the
//              air it joins the circuit at the crosswind for a full stop; rolling fast on the ground it
//              rolls out; slow on the pavement it taxis in; anywhere else it is towed.
// The plane's `traffic` says what it does when nobody holds it: `circuit`, out and round and home again;
// `lap`, round the circuit for ever (the Camel, which cannot taxi); `lead`, the formation's loop; and ""
// (a seat's plane), parked until a seat takes it, and flown home when one lets it go.
import type { Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { aero, airframeOf, densityAt, fromAttitude, modelOf, noseOf, rotate, stallSpeed, thrustOf, type Airframe, type Flight, type Plane } from '#plugins/flight3d/flight3d.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

/** The `pilot` definition: the hands. */
export type Hands = {
  taxi: number; taxiGain: number; lookahead: number; steer: number; rotate: number; climb: number; climbShare: number
  trim: number; trimMost: number
  dive: number; flare: number; touch: number
  lead: number; bank: number; liftShare: number; turn: number; roll: number; rollDamp: number; path: number; pitch: number; pitchDamp: number; lever: number
}
/** The `circuit` definition: the traffic pattern. */
export type Circuit = {
  planes: Record<string, { height: number; bank: number; wide: number; final: number; glide: number }>; speeds: number[]; touchdown: number
  hold: number; arrive: number; laps: number; rest: number; tow: number; wreck: number
  clear: { side: number; out: number; above: number }
}
/** The airport as a pilot reads it: its actor's `pos` and `yaw`, and its definition's pavement. */
export type Field = {
  pos: number[]; yaw: number
  runway: { length: number; width: number }
  taxiway: { x: number; width: number; links: number[] }
  apron: { x: number[]; z: number[] }
}
/** What the hands want of each input. `lever` is where the throttle should stand; `off`, while the
 *  elevator holds a flight path, how far the path flown is under the one wanted (radians). */
export type Want = { pitch: number; roll: number; yaw: number; brake: number; airbrake: number; lever: number; off?: number }
/** Where a plane is set down: a stand's or a start's place, attitude and way of flying. */
export type Place = { pos: number[]; heading: number; pitch: number; speed: number; throttle: number }
/** A leg of the circuit: from `a` to `b` in the world, its end `h` metres over the field, flown at `at` m/s. */
export type Leg = { a: number[]; b: number[]; h: number; at: number }
/** The formation's loop as a lead flies it: its samples in the airport's frame, `y` its height, `speed`. */
export type Loop = { pts: number[][]; y: number; speed: number }

const PI = Math.PI
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const wrap = (a: number) => math.atan2(math.sin(a), math.cos(a))
/** The heading from `from` to `to`, clockwise from north (−z) seen from above. */
export const headingTo = (from: number[], to: number[]) => math.atan2(to[0] - from[0], -(to[2] - from[2]))

/** The field off the airport actor's row data and its definition. */
export const fieldOf = (airport: { pos: number[]; yaw: number }, k: Omit<Field, 'pos' | 'yaw'>): Field =>
  ({ pos: airport.pos, yaw: airport.yaw, runway: k.runway, taxiway: k.taxiway, apron: k.apron })
/** This truth's field. */
export const fieldIn = (w: W) => fieldOf(w.find('airport').data as Field, def(w, 'airport'))

/** A point of the airport's frame (x east, z south about its pos, turned by its yaw) in the world. */
export function toWorld(f: Field, x: number, z: number): number[] {
  const c = math.cos(f.yaw), s = math.sin(f.yaw)
  return [f.pos[0] + x * c + z * s, f.pos[1], f.pos[2] - x * s + z * c]
}
/** A world point in the airport's frame, [x, z]. */
export function toField(f: Field, p: number[]): number[] {
  const dx = p[0] - f.pos[0], dz = p[2] - f.pos[2]
  const c = math.cos(f.yaw), s = math.sin(f.yaw)
  return [dx * c - dz * s, dx * s + dz * c]
}
/** A heading in the airport's frame as the world's: a heading in its frame is `yaw` less in the world's. */
const worldHeading = (f: Field, h: number) => h - f.yaw

/** Whether a world point is on the airport's pavement: the runway, the taxiway and its links, the apron. */
export function paved(f: Field, p: number[]): boolean {
  const [x, z] = toField(f, p)
  const R = f.runway, T = f.taxiway, A = f.apron
  if (Math.abs(x) <= R.width / 2 && Math.abs(z) <= R.length / 2) return true
  if (Math.abs(x - T.x) <= T.width / 2 && Math.abs(z) <= Math.max(...T.links.map(Math.abs)) + T.width / 2) return true
  if (T.links.some(l => Math.abs(z - l) <= T.width / 2 && x >= 0 && x <= T.x)) return true
  return x >= A.x[0] && x <= A.x[1] && z >= A.z[0] && z <= A.z[1]
}

/** How the plane is flying: its heading, bank (+ the right wing down), the nose's attitude, its speed,
 *  its flight path's angle, whether it is on its wheels, and its stall speed at the sea. */
export function attitudeOf(p: Plane, f: Flight) {
  const nose = rotate(p.rot, [0, 0, -1]), right = rotate(p.rot, [1, 0, 0])
  const speed = math.hypot(p.vel[0], p.vel[1], p.vel[2])
  return {
    heading: math.atan2(nose[0], -nose[2]),
    bank: -math.asin(clamp(right[1], -1, 1)),
    attitude: math.asin(clamp(nose[1], -1, 1)),
    speed,
    gamma: math.asin(clamp(p.vel[1] / Math.max(speed, 1), -1, 1)),
    ground: p.press.some(c => c > 0),
    vs: stallSpeed(airframeOf(f, p.type), f.gravity, f.air.density),
  }
}
export type Attitude = ReturnType<typeof attitudeOf>

/** Hands off: the stick centred, no brakes, the lever where it stands. */
export const still = (p: Plane): Want => ({ pitch: 0, roll: 0, yaw: 0, brake: 0, airbrake: 0, lever: p.throttle })

/** The stick that trims the plane, flying as it flies, in a level turn at its bank: the elevator whose
 *  pitching moment is nil at the angle of attack whose lift is n = 1 / cos bank times the weight, with
 *  the pitch rate of that turn, g·tan bank / v about the vertical, seen on the body's pitch axis. */
function trimmed(p: Plane, s: Attitude, t: Airframe, f: Flight): number {
  if (s.speed < f.air.calm) return 0
  const qd = 0.5 * densityAt(f.air, p.pos[1]) * s.speed * s.speed
  const n = 1 / Math.max(math.cos(s.bank), 0.2)
  const aoa = (n * t.mass * f.gravity) / (qd * t.wingArea) / t.clAlpha - t.incidence
  const rate = ((f.gravity * math.tan(Math.abs(s.bank))) / s.speed) * math.sin(Math.abs(s.bank))
  const qHat = (rate * (t.wingArea / t.span)) / (2 * s.speed)
  const elevator = -(t.cm0 + t.cmAlpha * aoa + t.cmQ * qHat) / t.cmDeltaE
  return clamp(elevator / t.maxElevator, -1, 1)
}

/** In the air: toward heading `to` by pure pursuit over `l1` metres, its pull `turn` times pursuit's, on
 *  flight path `path`, at `at` m/s. The path is held no steeper than `climbShare` of the climb full
 *  thrust leaves over the drag, (T − D) / W, nor than `climb`; the lever is the thrust that meets the drag
 *  and the climb, with `lever` m/s² more for each m/s under the speed wanted. */
export function fly(want: Want, p: Plane, s: Attitude, k: Hands, f: Flight, to: number, path: number, at: number, l1 = k.lead, turn = k.turn) {
  const t = airframeOf(f, p.type)
  const a = aero(p, p, f, t, 0)
  const full = thrustOf(t, 1, densityAt(f.air, p.pos[1]), f.air.density, s.speed)
  path = Math.min(path, clamp((k.climbShare * (full - a.drag)) / a.weight, 0, k.climb))
  const eta = clamp(wrap(to - s.heading), -PI / 2, PI / 2)
  // No steeper than the bank whose load takes `liftShare` of the lift the wing has at this speed.
  const most = Math.min(k.bank, math.acos(clamp((s.vs * s.vs) / (Math.max(s.speed, 1) ** 2 * k.liftShare), 0, 1)))
  const bankTo = clamp(math.atan((2 * s.speed * s.speed * math.sin(eta) * turn) / (Math.max(l1, 1) * f.gravity)), -most, most)
  want.roll = clamp(k.roll * (bankTo - s.bank) + k.rollDamp * p.spin[2], -1, 1)
  want.pitch = clamp(trimmed(p, s, t, f) + k.pitch * k.path * (path - s.gamma) - k.pitchDamp * p.spin[0], -1, 1)
  want.off = path - s.gamma
  want.yaw = 0
  want.brake = 0
  want.lever = full > 0 ? clamp((a.drag + a.weight * math.sin(path) + t.mass * k.lever * (at - s.speed)) / full, 0, 1) : 0
  // Still fast with the lever shut: the flaps (or airbrake) out.
  want.airbrake = want.lever === 0 && s.speed > at + 2 ? 1 : 0
}

/** Wings level, the nose held at `pitch`. */
export function hold(want: Want, p: Plane, s: Attitude, k: Hands, pitch: number) {
  want.pitch = clamp(k.pitch * (pitch - s.attitude) - k.pitchDamp * p.spin[0], -1, 1)
  want.roll = clamp(k.roll * -s.bank + k.rollDamp * p.spin[2], -1, 1)
  want.off = undefined
}

/** On the ground, along `route` (world points): the yaw on a point `lookahead` on from the nearest point
 *  of it, at taxi speed, slower in a turn and slowing to a stop at its end. The metres left to its end
 *  and the segment the plane is on. */
export function taxi(want: Want, p: Plane, s: Attitude, k: Hands, f: Flight, route: number[][]): { left: number; at: number } {
  let best = { d: Infinity, i: 0, t: 0 }
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1]
    const ab = [b[0] - a[0], b[2] - a[2]], len2 = ab[0] * ab[0] + ab[1] * ab[1]
    const t = len2 > 0 ? clamp(((p.pos[0] - a[0]) * ab[0] + (p.pos[2] - a[2]) * ab[1]) / len2, 0, 1) : 1
    const dx = a[0] + ab[0] * t - p.pos[0], dz = a[2] + ab[1] * t - p.pos[2]
    const d = dx * dx + dz * dz
    if (d < best.d) best = { d, i, t }
  }
  const lengthOf = (i: number) => math.hypot(route[i + 1][0] - route[i][0], route[i + 1][2] - route[i][2])
  let left = (1 - best.t) * lengthOf(best.i)
  for (let i = best.i + 1; i < route.length - 1; i++) left += lengthOf(i)
  let ahead = k.lookahead, i = best.i, t = best.t, aim = route[route.length - 1]
  while (i < route.length - 1) {
    const a = route[i], b = route[i + 1], len = lengthOf(i)
    if ((1 - t) * len >= ahead) { const u = t + ahead / len; aim = [a[0] + (b[0] - a[0]) * u, 0, a[2] + (b[2] - a[2]) * u]; break }
    ahead -= (1 - t) * len
    i++
    t = 0
  }
  const off = wrap(headingTo(p.pos, aim) - s.heading)
  want.yaw = clamp(k.steer * off, -1, 1)
  want.pitch = 0
  want.roll = 0
  want.airbrake = 0
  // Slower in a turn, and down to a stop over the last metres: two seconds from the end at most.
  const at = Math.min(Math.abs(off) > 0.3 ? k.taxi * 0.6 : k.taxi, left / 2)
  const t1 = airframeOf(f, p.type)
  const rolling = f.gravity * Math.max(...modelOf(f, p.type).gear.wheels.map(w => w.roll))
  want.lever = left < 1 ? 0 : clamp((t1.mass * (k.taxiGain * (at - s.speed) + rolling)) / t1.maxThrust, 0, 1)
  want.brake = left < 1 || s.speed > at * 1.4 + 0.5 ? 1 : 0
  return { left, at: best.i }
}

/** On the runway's line, heading north in the airport's frame: the lever full, the nosewheel (or the
 *  rudder) on the line, the nose held at `climb` past `rotate` times the stall speed. */
export function takeoff(want: Want, p: Plane, s: Attitude, k: Hands, fl: Field) {
  want.lever = 1
  want.brake = 0
  want.airbrake = 0
  want.yaw = clamp(k.steer * wrap(lineHeading(fl, p) - s.heading), -1, 1)
  if (s.speed > k.rotate * s.vs) hold(want, p, s, k, k.climb)
  else { want.pitch = 0; want.roll = clamp(k.roll * -s.bank, -1, 1) }
}

/** The world heading back onto the runway's line, north, from where the plane is: off it by x, aimed
 *  300 m on. */
export const lineHeading = (fl: Field, p: Plane) => worldHeading(fl, math.atan2(-toField(fl, p.pos)[0], 300))

/** The circuit of a plane of `type` on this field: its legs, R, and the touchdown point. */
export function legsOf(fl: Field, f: Flight, type: string, c: Circuit): { legs: Leg[]; R: number; touch: number[] } {
  const vs = stallSpeed(airframeOf(f, type), f.gravity, f.air.density)
  const shape = c.planes[type]
  if (!shape) throw new Error(`the circuit definition has no pattern for ${type}`)
  const v = c.speeds[2] * vs
  const R = (v * v) / (f.gravity * math.tan(shape.bank))
  const L = fl.runway.length, W = shape.wide * R, E = shape.final * R
  const H = shape.height
  // On the glide slope at final's start: over final and on into the runway to the touchdown point.
  const Hf = (E + c.touchdown) * math.tan(shape.glide)
  const n = -L / 2 - R, s = L / 2 + E
  // The downwind comes down to the base's top as steeply as the base does, so the two are one slope.
  const Hd = Hf + ((H - Hf) * W) / (W + E)
  const at = (i: number) => c.speeds[i] * vs
  const P = (x: number, z: number) => toWorld(fl, x, z)
  return {
    R,
    touch: P(0, L / 2 - c.touchdown),
    legs: [
      { a: P(0, L / 2), b: P(0, n), h: H, at: at(0) },
      { a: P(0, n), b: P(-W, n), h: H, at: at(1) },
      { a: P(-W, n), b: P(-W, s), h: Hd, at: at(2) },
      { a: P(-W, s), b: P(0, s), h: Hf, at: at(3) },
      { a: P(0, s), b: P(0, -L / 2), h: 0, at: at(4) },
    ],
  }
}
/** Along a leg: the metres along it of the plane's nearest point, its length, and the point `lead`
 *  metres on from there, kept on the leg. */
export function onLeg(p: number[], leg: Leg, lead: number) {
  const ab = [leg.b[0] - leg.a[0], leg.b[2] - leg.a[2]]
  const len = math.hypot(ab[0], ab[1])
  const u = ((p[0] - leg.a[0]) * ab[0] + (p[2] - leg.a[2]) * ab[1]) / len
  // Kept from behind the leg's start; past its end, on along its line.
  const t = Math.max((u + lead) / len, 0)
  return { u, len, aim: [leg.a[0] + ab[0] * t, 0, leg.a[2] + ab[1] * t] }
}

/** Along a leg's line by pursuit of the point R on, so a turn onto it is flown at the pattern's bank:
 *  the pull 2v²·sin η / L1 with η 45° and L1 R√2 at the corner is v² / R, which is g·tan `bank`. */
function along(want: Want, p: Plane, s: Attitude, k: Hands, f: Flight, leg: Leg, R: number, path: number) {
  const { aim } = onLeg(p.pos, leg, R)
  const l1 = Math.max(math.hypot(aim[0] - p.pos[0], aim[2] - p.pos[2]), R / 2)
  fly(want, p, s, k, f, headingTo(p.pos, aim), path, leg.at, l1, 1)
}

/** One leg flown: along its line, on the path toward its end's height, at its speed. True once it has
 *  come within `R` of its end and the next leg should take over: the upwind only once it is up half its
 *  height, flying on along the runway's line till then. */
export function follow(want: Want, p: Plane, s: Attitude, k: Hands, f: Flight, fl: Field, leg: Leg, R: number, upwind = false): boolean {
  const { u, len } = onLeg(p.pos, leg, R)
  const left = len - u
  const path = Math.max(math.atan2(fl.pos[1] + leg.h - p.pos[1], Math.max(left, k.lead / 2)), -k.dive)
  along(want, p, s, k, f, leg, R, path)
  return left < R && (!upwind || p.pos[1] - fl.pos[1] >= leg.h / 2)
}

/** Final: down the runway's line onto `touch`, at the leg's speed, flared under `flare` metres. */
export function final(want: Want, p: Plane, s: Attitude, k: Hands, f: Flight, fl: Field, leg: Leg, R: number, touch: number[]) {
  // How far there is still to fly to the touchdown point: across onto the runway's line, and along it.
  const [x, z] = toField(fl, p.pos)
  const ahead = Math.abs(x) + z - toField(fl, touch)[1]
  const path = clamp(math.atan2(touch[1] - p.pos[1], Math.max(ahead, k.lead / 2)), -k.dive, 0)
  along(want, p, s, k, f, leg, R, path)
  if (p.pos[1] - fl.pos[1] < k.flare) { hold(want, p, s, k, k.touch); want.lever = 0; want.airbrake = 0 }
}

/** The way out from a stand to the hold-short point: west onto the taxiway, south along it to its
 *  southern link, and west along the link to `hold` metres off the runway's line. */
export function outRoute(fl: Field, stand: number[], c: Circuit): number[][] {
  const T = fl.taxiway, south = Math.max(...T.links), z = toField(fl, stand)[1]
  return [stand, toWorld(fl, T.x, z), toWorld(fl, T.x, south), toWorld(fl, c.hold, south)]
}
/** From the hold-short point onto the runway's line, facing north. */
export function lineRoute(fl: Field, c: Circuit): number[][] {
  const south = Math.max(...fl.taxiway.links)
  return [toWorld(fl, c.hold, south), toWorld(fl, 0, south), toWorld(fl, 0, south - fl.runway.width * 2)]
}
/** The way in from `from` (world) to a stand: from the runway along it to the nearest link ahead (north)
 *  or the nearest one if none is ahead, across to the taxiway, along it to the stand's row, and onto the
 *  stand; from the taxiway along it; from the apron straight on. */
export function inRoute(fl: Field, from: number[], stand: number[]): number[][] {
  const T = fl.taxiway
  const [x, z] = toField(fl, from)
  const sz = toField(fl, stand)[1]
  if (x >= fl.apron.x[0]) return [from, stand]
  if (x >= T.x / 2) return [from, toWorld(fl, T.x, z), toWorld(fl, T.x, sz), stand]
  const ahead = T.links.filter(l => l <= z + T.width / 2)
  const link = ahead.length ? Math.max(...ahead) : T.links.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a))
  return [from, toWorld(fl, 0, link), toWorld(fl, T.x, link), toWorld(fl, T.x, sz), stand]
}

/** Whether `me` must wait to take the runway: another plane is lining up, rolling, on base or final, on
 *  the runway's pavement or just over it, or in the air in the box over the final. */
export function busy(w: W, me: Row, fl: Field, c: Circuit): boolean {
  const L = fl.runway.length
  return w.all('plane').some(o => {
    if (o.id === me.id || o.data.crashed) return false
    const ph = o.data.phase
    if (ph === 'line' || ph === 'roll' || ph === 'rollout' || (ph === 'circuit' && o.data.leg >= 3)) return true
    const [x, z] = toField(fl, o.data.pos), agl = o.data.pos[1] - fl.pos[1]
    if (Math.abs(x) <= fl.runway.width / 2 + 10 && Math.abs(z) <= L / 2 + 10 && agl < 20) return true
    return Math.abs(x) <= c.clear.side && z >= L / 2 && z <= L / 2 + c.clear.out && agl < c.clear.above
  })
}

/** Whether a plane of `type` can taxi: it has a steered wheel. */
export const steers = (f: Flight, type: string) => modelOf(f, type).gear.wheels.some(w => w.steer > 0)

/** `p` set down at `at`: there, wings level with the nose on its heading and pitch, moving `speed` along
 *  the heading with the lever at `throttle`, at rest otherwise (no turn, the stick centred, the lever
 *  still, no brakes, the gear down and locked, not crashed). */
export function setDown(p: Plane, at: Place) {
  const nose = noseOf(at.heading)
  Object.assign(p, {
    pos: [...at.pos], rot: fromAttitude(at.heading, at.pitch), vel: nose.map(v => v * at.speed), spin: [0, 0, 0], throttle: at.throttle, throttling: 0,
    aileron: 0, elevator: 0, rudder: 0, pitch: 0, roll: 0, yaw: 0, airbrake: 0, brake: 0, gear: 1, gearDown: true, press: [], crashed: false,
  })
}

/** The `stand` actor `plane` is kept on. */
export function standOf(w: W, plane: Row): Row {
  return w.find('stand', s => s.data.name === plane.data.stand)
}

/** A plane put on its stand, in the phase its traffic and the stand give it: on a stand in the air a
 *  lead flies its loop and a `lap` plane its circuit from the downwind; on the ground it is parked for
 *  `wait` seconds. */
export function onStand(me: Row, stand: Row, wait: number) {
  const p = me.data
  setDown(p as Plane, stand.data as Place)
  const air = stand.data.speed > 0
  p.phase = p.traffic === 'lead' ? 'lead' : air ? 'circuit' : 'parked'
  p.leg = air ? 2 : 0
  p.laps = 0
  p.wait = wait
  p.trim = 0
}

/** The stick and lever written as the hands want them: the lever pushed so it stands at `lever` by the
 *  end of the step, at most full travel. */
export function apply(p: Plane, want: Want, f: Flight, dt: number) {
  p.pitch = want.pitch
  p.roll = want.roll
  p.yaw = want.yaw
  p.brake = want.brake
  p.airbrake = want.airbrake
  const rate = airframeOf(f, p.type).throttleRate
  p.throttling = rate > 0 ? clamp((want.lever - p.throttle) / (rate * dt), -1, 1) : 0
}

/** For a hand on the keys: the input furthest from what is wanted, as the act and value to press, or
 *  undefined while every one is within `dead`. The lever is pushed (`throttle`) while it is more than
 *  0.02 off. */
export function press(p: Plane, want: Want, dead: number): [string, number] | undefined {
  const lever = Math.abs(want.lever - p.throttle) > 0.02 ? Math.sign(want.lever - p.throttle) : 0
  const off: [string, number, number][] = [
    ['pitch', want.pitch, p.pitch], ['roll', want.roll, p.roll], ['yaw', want.yaw, p.yaw],
    ['brake', want.brake, p.brake], ['airbrake', want.airbrake, p.airbrake], ['throttle', lever, p.throttling],
  ]
  const most = off.reduce((a, b) => (Math.abs(b[1] - b[2]) > Math.abs(a[1] - a[2]) ? b : a))
  return Math.abs(most[1] - most[2]) > dead ? [most[0], most[1]] : undefined
}

/** A lead's hands on its loop: the point `lead` metres on from its nearest sample, at the loop's height
 *  and speed. */
export function loop(want: Want, p: Plane, s: Attitude, k: Hands, f: Flight, fl: Field, l: Loop) {
  const [x, z] = toField(fl, p.pos)
  let best = 0, d = Infinity
  l.pts.forEach((q, i) => {
    const e = (q[0] - x) * (q[0] - x) + (q[1] - z) * (q[1] - z)
    if (e < d) { d = e; best = i }
  })
  // The samples are about evenly spaced: count on as many as `lead` spans.
  const step = math.hypot(l.pts[1][0] - l.pts[0][0], l.pts[1][1] - l.pts[0][1])
  const q = l.pts[(best + Math.max(1, Math.round(k.lead / step))) % l.pts.length]
  const aim = toWorld(fl, q[0], q[1])
  const l1 = math.hypot(aim[0] - p.pos[0], aim[2] - p.pos[2])
  const path = Math.max(math.atan2(l.y - p.pos[1], k.lead), -k.dive)
  fly(want, p, s, k, f, headingTo(p.pos, aim), path, l.speed, l1)
}

/** One step of the hands of `me`, a plane no seat holds, before flight3d steps it: its phase run, moved
 *  on, and its stick and lever written. `stand` is the stand it names; `l` the loop, for a lead. */
export function pilot(w: W, me: Row, dt: number, stand: Row, l?: Loop) {
  const p = me.data as Plane & Record<string, any>
  const f = w.world.flight3d as Flight
  const k = def(w, 'pilot') as Hands
  const c = def(w, 'circuit') as Circuit
  const fl = fieldIn(w)
  const s = attitudeOf(p, f)
  const want = still(p)
  p.gearDown = true
  if (p.crashed && p.phase !== 'wreck') { p.phase = 'wreck'; p.wait = c.wreck }
  if (p.phase === 'seat') {
    // Let go of this step: taken on from where it is.
    p.trim = 0
    if (!s.ground) { p.phase = 'circuit'; p.leg = 1; p.laps = 0 }
    else if (s.speed > k.taxi * 1.5) { p.phase = 'rollout'; p.laps = 0 }
    else if (steers(f, p.type) && paved(fl, p.pos)) { p.phase = 'in'; p.taxi = [...p.pos] }
    else { p.phase = 'towed'; p.wait = c.tow }
  }
  switch (p.phase) {
    case 'parked': {
      want.brake = 1
      want.lever = 0
      if (p.traffic !== 'circuit') break
      p.wait -= dt
      if (p.wait <= 0) { p.phase = 'out'; p.laps = c.laps }
      break
    }
    case 'out': {
      const { left } = taxi(want, p, s, k, f, outRoute(fl, stand.data.pos, c))
      if (left < c.arrive && s.speed < 0.5) p.phase = 'hold'
      break
    }
    case 'hold': {
      want.brake = 1
      want.lever = 0
      if (!busy(w, me, fl, c)) p.phase = 'line'
      break
    }
    case 'line': {
      const route = lineRoute(fl, c)
      const { at } = taxi(want, p, s, k, f, route)
      // Lined up: on the runway's line and facing along it.
      if (at === route.length - 2 && Math.abs(wrap(lineHeading(fl, p) - s.heading)) < 0.1) p.phase = 'roll'
      break
    }
    case 'roll': {
      takeoff(want, p, s, k, fl)
      if (!s.ground) { p.phase = 'circuit'; p.leg = 0 }
      break
    }
    case 'circuit': {
      const { legs, R, touch } = legsOf(fl, f, p.type, c)
      if (p.leg === 0 && s.ground) { takeoff(want, p, s, k, fl); break }
      if (p.leg < 4) { if (follow(want, p, s, k, f, fl, legs[p.leg], R, p.leg === 0)) p.leg++ }
      else if (s.ground) { p.phase = 'rollout'; takeoff(want, p, s, k, fl); want.lever = 0 }
      else final(want, p, s, k, f, fl, legs[4], R, touch)
      break
    }
    case 'rollout': {
      if (p.laps > 0 || p.traffic === 'lap') {
        takeoff(want, p, s, k, fl)
        if (!s.ground) { p.phase = 'circuit'; p.leg = 0; if (p.traffic !== 'lap') p.laps-- }
        break
      }
      takeoff(want, p, s, k, fl)
      want.lever = 0
      want.brake = 1
      want.pitch = 0
      if (s.speed < k.taxi) {
        if (steers(f, p.type)) { p.phase = 'in'; p.taxi = [...p.pos] }
        else { p.phase = 'towed'; p.wait = c.tow }
      }
      break
    }
    case 'in': {
      const { left } = taxi(want, p, s, k, f, inRoute(fl, p.taxi, stand.data.pos))
      // Home: parked where it has rolled to, within `arrive` of its stand.
      if (left < c.arrive && s.speed < 0.5) { p.phase = 'parked'; p.wait = c.rest; p.laps = 0; want.brake = 1; want.lever = 0 }
      break
    }
    case 'towed':
    case 'wreck': {
      want.brake = 1
      want.lever = 0
      p.wait -= dt
      if (p.wait <= 0) { onStand(me, stand, c.rest); return }
      break
    }
    case 'lead': {
      if (l) loop(want, p, s, k, f, fl, l)
      break
    }
    default:
      throw new Error(`plane ${me.id} is in no phase the pilot knows: ${p.phase}`)
  }
  // While the elevator holds a path, the trim takes up what it leaves off: `trim` of stick a second for
  // each radian under, at most `trimMost`; off the path it lets go.
  if (want.off === undefined) p.trim = 0
  else {
    p.trim = clamp(p.trim + k.trim * want.off * dt, -k.trimMost, k.trimMost)
    want.pitch = clamp(want.pitch + p.trim, -1, 1)
  }
  apply(p, want, f, dt)
}
