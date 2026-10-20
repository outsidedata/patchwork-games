// The sky's places in the air, written into `sky.scene.json`: the seats' air starts, and the stands in
// the air of the planes that only fly. Rebuilding them means running this again from the repository's
// root:
//
//   node --experimental-strip-types games/flight/assets/airstarts.mts
//
// Each flies level. A seat's air start flies at its plane's hands-off trim there, so a plane started in
// the air holds its height with the stick centred: the angle of attack where the pitching moment is nil
// with the elevator centred, −cm0 / cmAlpha, which is the start's `pitch`, the nose on the flight path;
// the `speed` where lift and thrust's upward part carry the weight; the `throttle` where thrust's forward
// part meets drag. A stand in the air flies at the speed its pilot holds: its `pitch` the angle of attack
// whose lift carries the weight at that speed, its `throttle` the lever whose thrust meets the drag there.
//   free       a seat's start over the runway's southern end, heading north, 300 m over the field.
//   rings      a seat's start on the runway's line south of the first ring, at its height, heading north
//              through it.
//   leads      each formation lead's stand on the formation's loop (`plugins/mission`'s `trackOf`), at
//              the loop's height, a third of the way round from the one before, on the loop's heading
//              there, at its type's formation speed.
//   lap        the lap Camel's stand at the start of its circuit's downwind (`plugins/pilot`'s `legsOf`),
//              at the circuit's height, heading down the downwind at the downwind's speed.
// Slot 1 starts behind slot 0. A seat started in the air on the formation is put in its slot off the
// lead when it starts, so it has no start here. The stands on the apron are not written here.
import { readFileSync, writeFileSync } from 'node:fs'
import { airframeOf, densityAt, stallSpeed, thrustOf, type Flight } from '#plugins/flight3d/flight3d.sim.ts'
import { fieldOf, headingTo, legsOf, toWorld, type Circuit } from '../plugins/pilot/pilot.sim.ts'
import { trackOf } from '../plugins/mission/mission.sim.ts'

const path = new URL('../sky.scene.json', import.meta.url)
const sky = JSON.parse(readFileSync(path, 'utf8'))
const defs = JSON.parse(readFileSync(new URL('flight.json', import.meta.url), 'utf8'))
const f = sky.world.flight3d as Flight
const airport = sky.actors.find((a: any) => a.is === 'airport')
const fl = fieldOf(airport, defs.airport)
const field = airport.pos[1]
const first = sky.actors.find((a: any) => a.is === 'ring' && a.order === 0).pos[1]
const round = (v: number, d: number) => +v.toFixed(d)

const places: Record<string, { at: number[][]; heading: number[] }> = {
  free: { at: [[0, field + 300, 1200], [60, field + 300, 1260]], heading: [0, 0] },
  rings: { at: [[0, first, 700], [0, first, 1000]], heading: [0, 0] },
}

// The lift's slope and the drag at an angle of attack, the wing at `aoa` plus its incidence.
function polar(type: string, aoa: number) {
  const t = airframeOf(f, type)
  const cl = t.clAlpha * (aoa + t.incidence)
  return { t, cl, cd: t.cd0 + (cl * cl) / (Math.PI * ((t.span * t.span) / t.wingArea) * t.oswald) }
}

// Hands-off: the speed and lever where the trim angle of attack flies level.
function trim(type: string, y: number) {
  const aoa = -airframeOf(f, type).cm0 / airframeOf(f, type).cmAlpha
  const { t, cl, cd } = polar(type, aoa)
  const rho = densityAt(f.air, y)
  const weight = t.mass * f.gravity
  let speed = 50, throttle = 0.5
  for (let i = 0; i < 200; i++) {
    speed = Math.sqrt((2 * (weight - thrustOf(t, throttle, rho, f.air.density, speed) * Math.sin(aoa))) / (rho * t.wingArea * cl))
    const q = 0.5 * rho * speed * speed
    throttle = (q * t.wingArea * cd + q * t.structureDragArea) / Math.cos(aoa) / thrustOf(t, 1, rho, f.air.density, speed)
  }
  if (!(throttle > 0 && throttle <= 1)) throw new Error(`${type} cannot hold level flight at ${y} m: it needs ${throttle} of its lever`)
  return { pitch: round(aoa, 4), speed: round(speed, 2), throttle: round(throttle, 3) }
}

// At `speed`: the angle of attack and lever that fly level there.
function level(type: string, y: number, speed: number) {
  const t = airframeOf(f, type)
  const rho = densityAt(f.air, y)
  const q = 0.5 * rho * speed * speed
  const aoa = (t.mass * f.gravity) / (q * t.wingArea) / t.clAlpha - t.incidence
  const { cd } = polar(type, aoa)
  const throttle = (q * t.wingArea * cd + q * t.structureDragArea) / Math.cos(aoa) / thrustOf(t, 1, rho, f.air.density, speed)
  if (!(throttle > 0 && throttle <= 1)) throw new Error(`${type} cannot hold level flight at ${speed} m/s at ${y} m: it needs ${throttle} of its lever`)
  return { pitch: round(aoa, 4), speed: round(speed, 2), throttle: round(throttle, 3) }
}

const air = Object.entries(places).flatMap(([mission, p]) => p.at.flatMap((pos, slot) => Object.keys(f.planes).map(plane =>
  ({ is: 'start', slot, plane, pos, heading: p.heading[slot], ...trim(plane, pos[1]), from: 'air', mission }))))

// The leads, a third of the loop apart.
const k = defs.formation
const track = trackOf(k.path)
const leads = ['camel', 'cessna', 'trainer'].map((type, i) => {
  const j = Math.round((i * track.pts.length) / 3)
  const a = track.pts[j], b = track.pts[(j + 1) % track.pts.length]
  const pos = toWorld(fl, a[0], a[1]), next = toWorld(fl, b[0], b[1])
  pos[1] = field + k.altitude
  return { is: 'stand', name: `lead ${type}`, slot: -1, pos: pos.map(v => round(v, 2)), heading: round(headingTo(pos, next), 4), ...level(type, pos[1], k.speeds[type]) }
})

// The lap Camel, at the start of its downwind.
const c = defs.circuit as Circuit
const { legs } = legsOf(fl, f, 'camel', c)
const down = legs[2]
const lapPos = [down.a[0], field + c.planes.camel.height, down.a[2]]
const lap = { is: 'stand', name: 'lap camel', slot: -1, pos: lapPos.map(v => round(v, 2)), heading: round(headingTo(down.a, down.b), 4), ...level('camel', lapPos[1], c.speeds[2] * stallSpeed(airframeOf(f, 'camel'), f.gravity, f.air.density)) }

const flying = [...leads, lap]
const names = new Set(flying.map(s => s.name))
const kept = sky.actors.filter((a: any) => a.is !== 'start' && !(a.is === 'stand' && names.has(a.name)))
// The stands in the air go where the stands are, before the planes.
const at = kept.findIndex((a: any) => a.is === 'plane')
sky.actors = [...kept.slice(0, at), ...flying, ...kept.slice(at), ...air]
writeFileSync(path, JSON.stringify(sky, null, 2) + '\n')
console.log(`wrote ${air.length} air starts and ${flying.length} stands in the air`)
