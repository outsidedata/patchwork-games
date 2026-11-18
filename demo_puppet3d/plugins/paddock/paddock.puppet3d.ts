// paddock's mod for puppet3d: the word `upright`, a body that walks on its two hind legs, its trunk
// reared up over them. A scene names `paddock` in `world.puppet3d.mods.behaviors` to have it.
//
// It stands the hind legs, each foot put down on the land where it lands and never let under the land
// it swings over, and the back from the rump up to the breast, reared `rear` radians up from level over
// the hip joints, which ride the land under the feet on a spring the legs' load pushes. The hips sway
// over the foot that bears. Every other bone is the driver's cues', carried by the bone `carried` names
// as it stands now. It gives off `uprightStride`, how far round its stride the body is, 0 to 1. It does
// not leap. It stands any layout: every bone it stands and every bone it carries is named in its block.
//
// Its numbers are the `upright` block of the body's sheet, metres, seconds and radians. Along the body
// `u` is metres ahead of the hip joint, `y` metres up, and a side of 1 is the body's +x:
//   centre   the row's `pos` ahead of the hip joint.
//   hip      the hip joint over the ground standing.
//   rear     how far the back is reared up from level, standing; `lean` how much less for each metre a
//            second it goes.
//   home     where its feet stand under a still body, ahead of the hip joint; `top` and `foot` how far
//            to each side the legs' tops and the feet are; `hoof` the bottom of the pastern over the
//            ground; `sway` how far the hips move across toward a foot bearing all the load.
//   leg      a leg: `bones`, `bend`, `out`, `straight`, `cannon`, `pastern`, as the
//            pureQuadrupedDriver's; `legs` each `{ side, bones }`, in the order of `fall`, `bones` the
//            four bones from the leg's top to its foot.
//   gait     `paces`, `reach`, `lead`, `still`, `settle`, `fold`, `hurry`, as the pureQuadrupedDriver's.
//   spring   `gravity`, `k`, `c`, `cap`, `taut`, `give`; `ride` the hips ride the land this far each way.
//   spine    `{ points, bones }`: the back's points from the rump to the breast, each [u, y] as the body
//            stands level, reared up about the hip joint; `bones` each `[name, from, to]`.
//   carried  `{ <bone>: <bone> }`: every bone it does not stand, and the bone it stood that carries it.
import type { Bone, Height, Ridden, Solver, V3 } from '#plugins/puppet3d/puppet3d.plugin.ts'

type V2 = [number, number]
type Stride = { name: string; speed: number; cycle: number; air: number; fall: number[]; lift: number; crouch: number }
type Leg = { bones: number[]; bend: number; out: number[]; straight: number; cannon: { follow: number; rest: number; flex: number }; pastern: { rest: number; sink: number; flex: number } }
type Upright = {
  centre: number; hip: number; rear: number; lean: number
  home: number; top: number; foot: number; hoof: number; sway: number
  leg: Leg; legs: { side: number; bones: string[] }[]
  gait: { paces: Stride[]; reach: number; lead: number; still: number; settle: number; fold: number; hurry: number }
  spring: { gravity: number; k: number; c: number; cap: number; taut: number; give: number }
  ride: number
  spine: { points: V2[]; bones: [string, number, number][] }
  carried: Record<string, string>
}
type Trunk = { world(q: V3): V3; local(q: V3): V3; at(u: number, y: number): V2; across: V3; shift: number }
type Standing = {
  at: Ridden; spin: number; cycle: number; waiting: boolean; stride: Stride
  planted: V3[]; up: boolean[]; from: V3[]; feet: V3[]; arcs: number[]; loads: number[]; far: number[]
  y: number; v: number; trunk: Trunk; legs: { pts: V3[]; over: number }[]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const frac = (v: number) => v - Math.floor(v)
const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const ease = (t: number) => t * t * (3 - 2 * t)
const dir = (a: number): V2 => [Math.sin(a), Math.cos(a)]

function pace(paces: Stride[], v: number): Stride {
  if (v <= paces[0].speed) return { ...paces[0], crouch: paces[0].crouch * Math.max(0, v) / paces[0].speed }
  for (let i = 1; i < paces.length; i++) {
    const a = paces[i - 1], b = paces[i]
    if (v <= b.speed) {
      const t = (v - a.speed) / (b.speed - a.speed)
      return {
        name: t < 0.5 ? a.name : b.name, speed: v, cycle: lerp(a.cycle, b.cycle, t), air: lerp(a.air, b.air, t),
        fall: a.fall.map((n, j) => frac(n + (b.fall[j] - n - Math.round(b.fall[j] - n)) * t)), lift: lerp(a.lift, b.lift, t), crouch: lerp(a.crouch, b.crouch, t),
      }
    }
  }
  return paces[paces.length - 1]
}

function chain(leg: Leg, H: V2, F: V2, load: number, arc: number) {
  const [l1, l2, l3, l4] = leg.bones
  const u = Math.atan2(H[0] - F[0], H[1] - F[1])
  const pastern = -(leg.pastern.rest + leg.pastern.sink * load) * (1 - arc) + leg.pastern.flex * arc
  const cannon = leg.cannon.follow * u + leg.cannon.rest + leg.cannon.flex * arc
  let K: V2 = F, J: V2 = F, d = 0
  const lower = (s: number) => {
    const dp = dir(lerp(pastern, u, s)), dc = dir(lerp(cannon, u, s))
    K = [F[0] + l4 * dp[0], F[1] + l4 * dp[1]]
    J = [K[0] + l3 * dc[0], K[1] + l3 * dc[1]]
    d = Math.hypot(J[0] - H[0], J[1] - H[1])
    return d
  }
  const far = (l1 + l2) * leg.straight, near = Math.abs(l1 - l2) * 1.001
  if (lower(0) > far) {
    let lo = 0, hi = 1
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2
      if (lower(mid) > far) lo = mid
      else hi = mid
    }
    lower(hi)
  }
  const dd = clamp(d, near, far)
  const phi = Math.atan2(J[0] - H[0], H[1] - J[1])
  const alpha = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1))
  const a = phi + leg.bend * alpha
  const E: V2 = [H[0] + l1 * Math.sin(a), H[1] - l1 * Math.cos(a)]
  return { pts: [H, E, J, K, F] as V2[], stretch: Math.max(0, d - far) }
}

// A leg stood from its top `T` to its foot's bottom `F`, both [ahead, up, across] in the body's level
// frame: its five points in that frame, and how far its top rides higher than it reaches standing.
function stand(leg: Leg, T: V3, F: V3, side: number, load: number, arc: number, free: boolean, taut: number) {
  let foot = F
  const solve = () => {
    const dy = foot[1] - T[1], ds = foot[2] - T[2], down = Math.max(1e-6, Math.hypot(dy, ds))
    const nY = side * ds / down, nS = -side * dy / down
    const lift = (q: V2, o: number): V3 => [q[0], T[1] - q[1] * dy / down + o * nY, T[2] - q[1] * ds / down + o * nS]
    const stood = chain(leg, [T[0], 0], [foot[0], -down], load, arc)
    const far = leg.bones.reduce((x, y) => x + y) * taut, dx = T[0] - foot[0]
    const over = Math.hypot(dx, down) > far && Math.abs(dx) < far ? down - Math.sqrt(far * far - dx * dx) : 0
    return { stood, lift, over }
  }
  let at = solve()
  for (let i = 0; i < 4 && free && at.stood.stretch > 0; i++) {
    const H = at.lift(at.stood.pts[0], leg.out[0]), d = Math.hypot(H[0] - foot[0], H[1] - foot[1], H[2] - foot[2]), pull = (at.stood.stretch + 0.002) / d
    foot = [foot[0] + (H[0] - foot[0]) * pull, foot[1] + (H[1] - foot[1]) * pull, foot[2] + (H[2] - foot[2]) * pull]
    at = solve()
  }
  return { pts: at.stood.pts.map((q, k) => at.lift(q, leg.out[k])), over: free ? 0 : at.over }
}

function home(U: Upright, j: number, x: number, z: number, yaw: number): V2 {
  const u = U.home - U.centre, s = U.legs[j].side * U.foot, sin = Math.sin(yaw), cos = Math.cos(yaw)
  return [x + sin * u + cos * s, z + cos * u - sin * s]
}

function trunkOf(U: Upright, g: Standing, land: Height): Trunk {
  const sin = Math.sin(g.at.yaw), cos = Math.cos(g.at.yaw)
  const forward: V3 = [sin, 0, cos], across: V3 = [cos, 0, -sin]
  const ox = g.at.pos[0] - sin * U.centre, oz = g.at.pos[2] - cos * U.centre
  const ride = [-1, -0.5, 0, 0.5, 1].reduce((sum, o) => sum + land(ox + sin * (U.home + o * U.ride), oz + cos * (U.home + o * U.ride)), 0) / 5
  const hipY = ride + U.hip - g.stride.crouch + g.y
  const pitch = U.rear - U.lean * Math.hypot(g.at.vel[0], g.at.vel[2]), c = Math.cos(pitch), s = Math.sin(pitch)
  const shift = U.sway * U.legs.reduce((sum, L, j) => sum + L.side * g.loads[j], 0) / U.legs.length
  return {
    world: q => [ox + forward[0] * q[0] + across[0] * q[2], q[1], oz + forward[2] * q[0] + across[2] * q[2]],
    local: q => { const dx = q[0] - ox, dz = q[2] - oz; return [dx * forward[0] + dz * forward[2], q[1], dx * across[0] + dz * across[2]] },
    at: (u, y) => [u * c - y * s, hipY + u * s + y * c],
    across, shift,
  }
}

function settle(U: Upright, g: Standing, land: Height) {
  const place = () => {
    g.trunk = trunkOf(U, g, land)
    const top = g.trunk.at(0, 0)
    g.legs = U.legs.map((L, j) => {
      const f = g.trunk.local(g.feet[j])
      return stand(U.leg, [top[0], top[1], L.side * U.top + g.trunk.shift], [f[0], f[1] + U.hoof, f[2]], L.side, g.loads[j], g.arcs[j], g.up[j], U.spring.taut)
    })
  }
  place()
  for (let i = 0; i < 6; i++) {
    const over = Math.max(0, ...g.legs.map(l => l.over))
    if (over < 1e-4) break
    const was = g.y
    g.y = Math.max(g.y - over, Math.min(g.y, -U.spring.give))
    g.v = Math.min(g.v, 0)
    if (g.y === was) break
    place()
  }
}

// The feet a step of `dt` seconds on, as the pureQuadrupedDriver steps its feet, on two legs.
function stride(U: Upright, g: Standing, at: Ridden, dt: number, land: Height) {
  const G = U.gait, legs = U.legs.map((_, j) => j)
  g.spin = wrap(at.yaw - g.at.yaw) / dt
  g.at = { pos: [...at.pos], yaw: at.yaw, vel: [...at.vel] }
  const vx = at.vel[0], vz = at.vel[2], v = Math.hypot(vx, vz), px = at.pos[0], pz = at.pos[2]
  const p = pace(G.paces, v)
  const before = legs.map(j => frac(g.cycle - g.stride.fall[j] + g.stride.air))
  g.stride = p
  const duty = 1 - p.air, airtime = p.cycle * p.air, standing = p.cycle * duty
  const round = (j: number) => frac(g.cycle - p.fall[j] + p.air)
  const target = (j: number, t: number): V3 => {
    const left = airtime * (1 - t), lead = v > 1e-6 ? Math.min(G.reach, v * standing * G.lead) / v : 0
    const [x, z] = home(U, j, px + vx * (left + lead), pz + vz * (left + lead), at.yaw + g.spin * left)
    return [x, land(x, z), z]
  }
  const restless = () => v > G.still || g.planted.some((q, j) => { const [x, z] = home(U, j, px, pz, at.yaw); return Math.hypot(q[0] - x, q[2] - z) > G.settle })
  const lift = (j: number) => { g.up[j] = true; g.from[j] = [...g.planted[j]] }
  if (g.waiting && restless()) {
    const due = legs.map(j => (1 - round(j)) % 1), j = due.indexOf(Math.min(...due))
    g.cycle = frac(g.cycle + due[j])
    lift(j)
    g.waiting = false
  }
  // How fast the stride goes round, as the pureQuadrupedDriver's: its pace's, or as much faster as
  // brings round the turn of each foot standing by the time the body has left it as far behind as a
  // steady stride leaves a foot, to `hurry` times its pace's. `far` is that distance for each foot, at
  // the fastest the body has gone since the foot was put down, so a body slowing down hurries no foot;
  // a turn less than a step late is not hurried.
  const furthest = v * standing - Math.min(G.reach, v * standing * G.lead)
  for (const j of legs) g.far[j] = Math.max(g.far[j], furthest)
  const rate = () => {
    if (v <= G.still) return 1 / p.cycle
    let most = 1 / p.cycle
    for (const j of legs) {
      if (g.up[j]) continue
      const [x, z] = home(U, j, px, pz, at.yaw), behind = -((g.planted[j][0] - x) * vx + (g.planted[j][2] - z) * vz) / v
      const left = (g.far[j] - behind) / v, turn = 1 - round(j)
      if (turn * p.cycle - left <= dt) continue
      most = left > 0 ? Math.max(most, turn / left) : Infinity
    }
    return Math.min(most, G.hurry / p.cycle)
  }
  if (!g.waiting) {
    g.cycle = frac(g.cycle + dt * rate())
    for (const j of legs) {
      const now = round(j)
      if (g.up[j] && (now >= p.air || before[j] - now > 0.5)) { g.planted[j] = target(j, 1); g.up[j] = false; g.far[j] = furthest }
    }
    const going = restless()
    for (const j of legs) if (!g.up[j] && going && before[j] - round(j) > 0.5) lift(j)
    if (!going && !g.up.some(Boolean)) g.waiting = true
  }
  const progress = legs.map(j => (g.up[j] ? Math.min(1, round(j) / p.air) : 0))
  g.feet = g.planted.map((q, j): V3 => {
    if (!g.up[j]) return q
    const s = progress[j], e = ease(s), from = g.from[j], to = target(j, s)
    const x = lerp(from[0], to[0], e), z = lerp(from[2], to[2], e)
    return [x, Math.max(land(x, z), lerp(from[1], to[1], e) + p.lift * Math.sin(Math.PI * s)), z]
  })
  g.arcs = progress.map(t => Math.sin(Math.PI * t) * Math.min(1, p.lift / G.fold))
  g.loads = legs.map(j => {
    if (g.up[j]) return 0
    if (g.waiting) return 0.5
    const r = round(j)
    return r >= p.air ? Math.sin(Math.PI * (r - p.air) / duty) : 0.5
  })
  const S = U.spring, mean = legs.length * duty * 2 / Math.PI
  const push = g.waiting ? 1 : Math.min(S.cap, g.loads.reduce((a, b) => a + b, 0) / mean)
  g.v += (S.gravity * (push - 1) - S.k * g.y - S.c * g.v) * dt
  g.y += g.v * dt
}

function make(U: Upright, at: Ridden, land: Height): Standing {
  const planted = U.legs.map((_, j): V3 => { const [x, z] = home(U, j, at.pos[0], at.pos[2], at.yaw); return [x, land(x, z), z] })
  const copy = () => planted.map(q => [...q] as V3)
  const g: Standing = {
    at: { pos: [...at.pos], yaw: at.yaw, vel: [0, 0, 0] }, spin: 0, cycle: 0, waiting: true, stride: pace(U.gait.paces, 0),
    planted, up: planted.map(() => false), from: copy(), feet: copy(), arcs: planted.map(() => 0), loads: planted.map(() => 0.5), far: planted.map(() => 0),
    y: 0, v: 0, trunk: undefined as unknown as Trunk, legs: [],
  }
  settle(U, g, land)
  return g
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l] }
function frame(b: Bone) {
  const y = norm(sub(b.tail, b.head)), a = b.across, k = dot(a, y)
  const z = norm([a[0] - y[0] * k, a[1] - y[1] * k, a[2] - y[2] * k]), x = cross(y, z)
  return { o: b.head, x, y, z }
}

export const upright: Solver<Upright, Standing> = {
  block: 'upright',
  make,
  step(U, g, at, dt, land) {
    stride(U, g, at, dt, land)
    settle(U, g, land)
  },
  senses: g => ({ uprightStride: g.cycle }),
  bones(U, g, _layout, rest, play) {
    const t = g.trunk
    const spine = U.spine.points.map(([u, y]): V3 => { const q = t.at(u, y); return t.world([q[0], q[1], t.shift]) })
    const posed = new Map<string, Bone>()
    const byName = new Map(rest.map(r => [r.name, r]))
    for (const [name, a, b] of U.spine.bones) posed.set(name, { ...byName.get(name)!, head: spine[a], tail: spine[b], across: t.across })
    U.legs.forEach((L, j) => {
      const pts = g.legs[j].pts.map(q => t.world(q))
      L.bones.forEach((name, k) => posed.set(name, { ...byName.get(name)!, head: pts[k], tail: pts[k + 1], across: t.across }))
    })
    const free = rest.filter(r => U.carried[r.name]).map(r => ({ ...r, parent: r.parent !== null && U.carried[r.parent] ? r.parent : null }))
    const moved = new Map(play(free).map(b => [b.name, b]))
    return rest.map(r => {
      const done = posed.get(r.name)
      if (done) return done
      const on = U.carried[r.name]
      if (!on) throw new Error(`puppet3d: the upright stands no bone ${r.name} and carries it on none`)
      const a = frame(byName.get(on)!), b = frame(posed.get(on)!)
      const local = (v: V3): V3 => [dot(v, a.x), dot(v, a.y), dot(v, a.z)]
      const world = (l: V3): V3 => [b.x[0] * l[0] + b.y[0] * l[1] + b.z[0] * l[2], b.x[1] * l[0] + b.y[1] * l[1] + b.z[1] * l[2], b.x[2] * l[0] + b.y[2] * l[1] + b.z[2] * l[2]]
      const put = (p: V3): V3 => { const w = world(local(sub(p, a.o))); return [b.o[0] + w[0], b.o[1] + w[1], b.o[2] + w[2]] }
      const p = moved.get(r.name)!
      return { ...r, head: put(p.head), tail: put(p.tail), across: world(local(p.across)) }
    })
  },
}

export const behaviors = () => ({ upright })
