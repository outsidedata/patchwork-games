// flight3d's plane stepped on its own, with the flight3d numbers of games/flight's sky and its three
// planes. A plane in the air starts wings level at 600 m flying north (−z) at its cruise; a plane on
// the ground starts at rest on flat ground at y = 0 with every wheel touching it. A test holds the
// stick where it says, or flies it as a pilot does (`pilot`). The nose is the body's −z turned by `rot`.
import { expect, test } from 'vitest'
import sky from '#games/flight/sky.scene.json' with { type: 'json' }
import {
  aero, airframeOf, contact, fromAttitude, fromHeading, impact, modelOf, noseOf, rotate, stallSpeed, step, thrustOf, topSpeed,
  type Flight, type Plane,
} from '#plugins/flight3d/flight3d.sim.ts'

const DT = 1 / 60
const f = sky.world.flight3d as unknown as Flight
const TYPES = ['camel', 'cessna', 'trainer']
const CRUISE: Record<string, number> = { camel: 40, cessna: 55, trainer: 180 }
const flat = () => 0
const plane = (type: string, over: Partial<Plane> = {}): Plane => ({
  type, pos: [0, 600, 0], rot: fromHeading(0), vel: noseOf(0).map(v => v * CRUISE[type]), spin: [0, 0, 0],
  aileron: 0, elevator: 0, rudder: 0, pitch: 0, roll: 0, yaw: 0, throttle: 0.7, throttling: 0, airbrake: 0, brake: 0, gear: 1, gearDown: true, press: [], crashed: false,
  ...over,
})
const fly = (p: Plane, steps: number, ground?: (x: number, z: number) => number, ff: Flight = f) => { for (let i = 0; i < steps; i++) step(p, ff, DT, ground) }
const nose = (p: Plane) => rotate(p.rot, [0, 0, -1])
const up = (p: Plane) => rotate(p.rot, [0, 1, 0])
const speed = (p: Plane) => Math.hypot(...p.vel)
const pitchOf = (p: Plane) => Math.asin(nose(p)[1])
const bankOf = (p: Plane) => Math.asin(rotate(p.rot, [1, 0, 0])[1]) // + is the right wing up
const headingOf = (p: Plane) => Math.atan2(nose(p)[0], -nose(p)[2])
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const deg = (d: number) => (d * Math.PI) / 180
const stall = (type: string) => stallSpeed(airframeOf(f, type), f.gravity, f.air.density)

// Plane `type` at rest on flat ground, every wheel on it: pitched as its main wheels and its nose or
// tail wheel lie, tan θ = (main's contact height − other's) / (main's z − other's z), and let settle.
function parked(type: string, over: Partial<Plane> = {}): Plane {
  const ws = modelOf(f, type).gear.wheels
  const main = ws.find(w => w.at[0] !== 0)!, other = ws.find(w => w.at[0] === 0)!
  const pitch = Math.atan(((main.at[1] - main.radius) - (other.at[1] - other.radius)) / (main.at[2] - other.at[2]))
  const p = plane(type, { pos: [0, 0, 0], rot: fromAttitude(0, pitch), vel: [0, 0, 0], throttle: 0, ...over })
  p.pos[1] = -Math.min(...ws.map(w => rotate(p.rot, w.at)[1] - w.radius)) + 0.005
  fly(p, 180, flat)
  return p
}

// A pilot's hands: rudder on the heading, aileron on the wings, elevator on a pitch attitude.
function pilot(p: Plane, pitch: number) {
  p.yaw = clamp(-3 * headingOf(p) + 0.5 * p.spin[1], -1, 1)
  p.roll = clamp(3 * bankOf(p) + 0.6 * p.spin[2], -1, 1)
  p.pitch = clamp(8 * (pitch - pitchOf(p)) - 1.5 * p.spin[0], -1, 1)
}

test('hands off at its cruise each plane holds its height within 10 m over two seconds; the stick pitches, rolls and yaws it the way it says', () => {
  for (const type of TYPES) {
    const still = plane(type, { throttle: 0.6 })
    fly(still, 120)
    expect(Math.abs(still.pos[1] - 600)).toBeLessThan(10)
  }
  const pitch = plane('cessna', { pitch: 1 }), down = plane('cessna', { pitch: -1 }), roll = plane('cessna', { roll: 1 }), left = plane('cessna', { roll: -1 }), yaw = plane('cessna', { yaw: 1 })
  for (const p of [pitch, down, roll, left, yaw]) fly(p, 60)
  expect(nose(pitch)[1]).toBeGreaterThan(0.2)
  expect(nose(down)[1]).toBeLessThan(-0.2)
  expect(up(roll)[0]).toBeGreaterThan(0.2) // right wing down: the top of the plane leans right
  expect(up(left)[0]).toBeLessThan(-0.2)
  expect(nose(yaw)[0]).toBeGreaterThan(0.1)
  // The surfaces slew toward the stick at their rate and stop at their limit.
  const t = airframeOf(f, 'cessna')
  expect(pitch.elevator).toBeCloseTo(t.maxElevator, 12)
  const once = plane('cessna', { roll: 1 })
  fly(once, 1)
  expect(once.aileron).toBeCloseTo(t.aileronRate * DT, 12)
})

test('top speed is where full thrust meets drag with the wing at no lift, and no dive goes past overspeed times it', () => {
  for (const type of TYPES) {
    const t = airframeOf(f, type)
    const v = topSpeed(t, f.air.density)
    // The body pitched down by the incidence, so the wing meets the air at its zero-lift angle.
    const level = plane(type, { pos: [0, 0, 0], rot: fromAttitude(0, -t.incidence), vel: noseOf(0).map(c => c * v), throttle: 1 })
    const a = aero(level, level, f, t, DT)
    expect(a.cl).toBeCloseTo(0, 12)
    expect(a.thrust).toBeCloseTo(a.drag, 6)
    const dive = plane(type, { rot: [Math.sin(-Math.PI / 4), 0, 0, Math.cos(-Math.PI / 4)], vel: [0, -60, 0], throttle: 1, pos: [0, 15000, 0] })
    let most = 0
    // Held in the dive by the pilot's hands, since a stable plane left alone pulls itself out of it, from
    // high enough that the fastest of them is past its top speed before it is at y = 0, where the air
    // thickening below would slow it again.
    for (let i = 0; i < 3600; i++) { pilot(dive, deg(-60)); step(dive, f, DT); most = Math.max(most, speed(dive)) }
    expect(most).toBeLessThanOrEqual(f.overspeed * v + 1e-9)
    expect(most).toBeGreaterThan(v)
  }
})

test('a propeller\'s thrust falls as power past its propSpeed; a jet\'s holds', () => {
  const prop = airframeOf(f, 'cessna'), jet = airframeOf(f, 'trainer')
  expect(thrustOf(prop, 1, 1, 1, prop.propSpeed / 2)).toBe(prop.maxThrust)
  expect(thrustOf(prop, 1, 1, 1, prop.propSpeed * 2)).toBeCloseTo(prop.maxThrust / 2, 9)
  expect(thrustOf(prop, 0.5, 0.5, 1, prop.propSpeed * 4)).toBeCloseTo(prop.maxThrust / 16, 9)
  expect(thrustOf(jet, 1, 1, 1, 250)).toBe(jet.maxThrust)
})

test('the wing stalls past its stall angle, measured on the wing: lift falls and drag climbs', () => {
  const t = airframeOf(f, 'cessna')
  const at = (wing: number) => {
    const aoa = wing - t.incidence
    const p = plane('cessna', { vel: [0, -60 * Math.sin(aoa), -60 * Math.cos(aoa)] })
    return aero(p, p, f, t, DT)
  }
  const before = at(t.alphaStall - t.stallBlend), after = at(t.alphaStall + 3 * t.stallBlend)
  expect(before.stall).toBe(0)
  expect(after.stall).toBe(1)
  expect(after.cl).toBeLessThan(before.cl)
  expect(after.cd).toBeGreaterThan(2 * before.cd)
})

test('the Camel\'s rotary rolls it left under power, drops its nose yawing right and raises it yawing left; without its engine\'s spin it does neither', () => {
  const still = (type: string, ff: Flight, over: Partial<Plane>) => {
    const p = plane(type, { throttle: 1, ...over })
    const a = aero(p, p, ff, airframeOf(ff, type), 0)
    return a.torque
  }
  const quiet = structuredClone(f)
  Object.assign(quiet.planes.camel.airframe, { engineTorque: 0, engineInertia: 0 })
  // Under power the torque is against the engine's turn: τz > 0 is a roll to the left.
  expect(still('camel', f, {})[2]).toBeCloseTo(f.planes.camel.airframe.engineTorque, 6)
  expect(still('camel', quiet, {})[2]).toBeCloseTo(0, 9)
  // Yawing right (body wy < 0) the gyroscope pitches the nose down (τx < 0), yawing left up.
  const right = still('camel', f, { spin: [0, -1, 0] })[0] - still('camel', quiet, { spin: [0, -1, 0] })[0]
  const left = still('camel', f, { spin: [0, 1, 0] })[0] - still('camel', quiet, { spin: [0, 1, 0] })[0]
  const t = f.planes.camel.airframe
  expect(right).toBeCloseTo(-t.engineInertia * t.engineSpin, 6)
  expect(left).toBeCloseTo(t.engineInertia * t.engineSpin, 6)
  // Flown: hands off at full throttle for two seconds the Camel banks left; with no engine torque it
  // does not.
  const camel = plane('camel', { throttle: 1 }), calm = plane('camel', { throttle: 1 })
  fly(camel, 120)
  fly(calm, 120, undefined, quiet)
  expect(bankOf(camel)).toBeGreaterThan(deg(5))
  expect(Math.abs(bankOf(calm))).toBeLessThan(deg(1))
  // A jet's engine puts nothing on it: the trainer turns the same with its engine's figures zeroed.
  Object.assign(quiet.planes.trainer.airframe, { engineTorque: 0, engineInertia: 0 })
  expect(still('trainer', f, { spin: [0.3, -1, 0.2] })).toEqual(still('trainer', quiet, { spin: [0.3, -1, 0.2] }))
})

test('each plane parked comes to rest on its wheels, every wheel pressed in and nothing else touching', () => {
  for (const type of TYPES) {
    const p = parked(type)
    expect(p.crashed).toBe(false)
    expect(speed(p)).toBeLessThan(0.01)
    expect(p.press).toHaveLength(modelOf(f, type).gear.wheels.length)
    for (const c of p.press) expect(c).toBeGreaterThan(0.005)
    for (const c of p.press) expect(c).toBeLessThan(0.15)
    // It stays: another ten seconds and it has not crept or bounced.
    const where = [...p.pos]
    fly(p, 600, flat)
    expect(Math.hypot(...p.pos.map((c, i) => c - where[i]))).toBeLessThan(0.01)
    // And in the air no wheel is pressed.
    const flying = plane(type)
    fly(flying, 1, flat)
    expect(flying.press.every(c => c === 0)).toBe(true)
  }
})

test('each plane at full throttle, rotated to its attitude past 1.1 times its stall speed, lifts off below 1.5 times it and climbs to 60 m', () => {
  // The pilot's hands are proportional: the trainer's stiff pitch, which holds its wing short of the stall
  // at full stick, settles some degrees short of what they aim for, so they aim higher.
  const ROTATE: Record<string, number> = { camel: 9, cessna: 7, trainer: 14 }
  for (const type of TYPES) {
    const p = parked(type)
    const vs = stall(type)
    p.throttle = 1
    let off = 0, k = 0
    while (p.pos[1] < 60 && !p.crashed && k++ < 60 * 90) {
      pilot(p, deg(ROTATE[type]))
      if (speed(p) < 1.1 * vs && !off) p.pitch = 0
      step(p, f, DT, flat)
      if (!off && p.press.every(c => c === 0)) off = speed(p)
    }
    expect(p.crashed).toBe(false)
    expect(off).toBeGreaterThan(vs)
    expect(off).toBeLessThan(1.5 * vs)
    expect(p.pos[1]).toBeGreaterThanOrEqual(60)
  }
})

test('each plane put down on its wheels under its sink rate rolls out and stops; a little over it, it crashes', () => {
  // Over the threshold at 1.35 times stall speed, wings level, in the attitude whose lift holds its
  // weight there, its main wheels 2 cm off the ground, sinking `sink`.
  const final = (type: string, sink: number) => {
    const t = airframeOf(f, type)
    const ws = modelOf(f, type).gear.wheels
    const main = ws.find(w => w.at[0] !== 0)!
    const v = 1.35 * stall(type)
    const pitch = (2 * t.mass * f.gravity) / (f.air.density * t.wingArea * v * v) / t.clAlpha - t.incidence
    const p = plane(type, { rot: fromAttitude(0, pitch), vel: [0, -sink, -v], throttle: 0 })
    p.pos = [0, 0, 0]
    p.pos[1] = -(rotate(p.rot, main.at)[1] - main.radius) + 0.02
    return { p, pitch }
  }
  for (const type of TYPES) {
    const { sink } = modelOf(f, type).gear
    const { p: soft, pitch } = final(type, sink * 0.6)
    let k = 0
    while (speed(soft) > 0.2 && !soft.crashed && k++ < 60 * 120) {
      pilot(soft, pitch)
      soft.throttle = 0
      soft.brake = 1
      step(soft, f, DT, flat)
    }
    expect(soft.crashed).toBe(false)
    expect(speed(soft)).toBeLessThanOrEqual(0.2)
    const { p: hard } = final(type, sink + 1)
    fly(hard, 30, flat)
    expect(hard.crashed).toBe(true)
  }
})

test('a wing put on the ground crashes the plane; the gear alone does not', () => {
  for (const type of TYPES) {
    const p = parked(type)
    expect(p.crashed).toBe(false)
    // Rolled 30° about its nose where it stands: a wingtip goes under.
    const tipped = structuredClone(p)
    tipped.rot = [0, 0, Math.sin(deg(15)), Math.cos(deg(15))]
    expect(contact(p, modelOf(f, type).gear, flat).crash).toBe(false)
    expect(contact(tipped, modelOf(f, type).gear, flat).crash).toBe(true)
    fly(tipped, 1, flat)
    expect(tipped.crashed).toBe(true)
  }
})

test('the brakes stop a rolling plane far shorter than rolling alone, and a plane with none has none', () => {
  const rolled = (type: string, brake: number) => {
    const p = parked(type)
    p.vel = noseOf(0).map(v => v * 15)
    const from = p.pos[2]
    let k = 0
    while (speed(p) > 0.2 && k++ < 60 * 300) {
      p.brake = brake
      p.yaw = clamp(-3 * headingOf(p), -1, 1)
      step(p, f, DT, flat)
    }
    expect(p.crashed).toBe(false)
    return from - p.pos[2]
  }
  const free = rolled('cessna', 0), braked = rolled('cessna', 1)
  expect(braked).toBeLessThan(free / 5)
  expect(braked).toBeGreaterThan(15 * 15 / (2 * 9.81)) // no better than 1 g
  expect(rolled('camel', 1)).toBeCloseTo(rolled('camel', 0), 6)
})

test('the steered nosewheel turns a taxiing plane the way the yaw stick says, and a held stick holds the turn', () => {
  for (const [type, yaw] of [['cessna', 1], ['cessna', -1], ['trainer', 1]] as const) {
    const p = parked(type)
    p.vel = noseOf(0).map(v => v * 5)
    let k = 0
    while (k++ < 240) {
      p.yaw = yaw
      p.throttle = 0.15
      step(p, f, DT, flat)
    }
    expect(p.crashed).toBe(false)
    expect(Math.sign(headingOf(p))).toBe(yaw)
    expect(Math.abs(headingOf(p))).toBeGreaterThan(deg(20))
  }
})

test('a plane flown into the ground crashes where it first meets it, and with no ground it flies on', () => {
  const steep = { rot: [Math.sin(-Math.PI / 4), 0, 0, Math.cos(-Math.PI / 4)] as Plane['rot'], vel: [0, -80, -10] }
  const hills = (x: number, z: number) => 550 + 10 * Math.sin(x / 7) + 10 * Math.cos(z / 5)
  const p = plane('cessna', steep)
  let k = 0
  while (!p.crashed && k < 600) { fly(p, 1, hills); k++ }
  expect(p.crashed).toBe(true)
  // It lies where its nose first went under the hill: a touch point is under the ground there, its
  // centre above it.
  expect(contact(p, modelOf(f, 'cessna').gear, hills).crash).toBe(true)
  expect(p.pos[1]).toBeGreaterThan(hills(p.pos[0], p.pos[2]))
  expect(p.vel).toEqual([0, 0, 0])
  const where = [...p.pos]
  fly(p, 60, hills)
  expect(p.pos).toEqual(where)
  const free = plane('cessna', steep)
  fly(free, 600)
  expect(free.crashed).toBe(false)
  expect(free.pos[1]).toBeLessThan(550)
  // The path is checked along its length: a ridge thinner than a step's travel still stops it.
  const ridge = (_x: number, z: number) => (Math.abs(z + 2) < 0.5 ? 100 : 0)
  expect(impact(ridge, [0, 50, 0], [0, 50, -5], f.sweep)).toEqual([0, 100, -2])
})

test('the trainer pulled at full stick holds its wing short of the stall at every speed it flies', () => {
  for (const v of [70, 120, 200, 300, 400]) {
    const p = plane('trainer', { vel: noseOf(0).map(c => c * v), pitch: 1, throttle: 1, gear: 0, gearDown: false })
    for (let i = 0; i < 240; i++) expect(step(p, f, DT).stall).toBe(0)
  }
})

test('the throttle lever moves at its rate while pushed and stays in 0 to 1', () => {
  const t = airframeOf(f, 'cessna')
  const p = plane('cessna', { throttle: 0.5, throttling: 1 })
  fly(p, 30)
  expect(p.throttle).toBeCloseTo(0.5 + 30 * DT * t.throttleRate, 9)
  fly(p, 600)
  expect(p.throttle).toBe(1)
  p.throttling = -1
  fly(p, 600)
  expect(p.throttle).toBe(0)
})
