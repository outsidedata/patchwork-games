// punch: a fist thrown at a point on a body, with no body behind it, so a blow lands exactly where it is aimed. The
// fist is a melee3d blade (its mod `punch.melee3d.ts` delivers melee3d the word `punch`), flown in a straight line
// through the point, so melee3d's sweep meets the limb there and fight3d's `strike` lands the blow on it as it lands
// the X Bot's fist: the same `Blow`, the same freeze, shove, blood and jolt.
//
// A row that throws fists carries `fist`: null, or the throw in flight, `{ strike, from, way, gone, run }`: the
// strike's name (fight3d's `strikes` of the row's kind, melee3d's swing), where it set off [x, y, z], the unit way it
// flies, how far it has flown and how far it flies in all, metres. A row's prefab starts it null.
//
// `aim(limbs, from, way)`: where a ray from `from` along the unit `way` first meets one of melee3d's `limbs` (a
// body's capsules, melee3d's `limbs`), `{ limb, point, t }`, or null when it meets none.
// `throws(me, strike, at, way, run)`: a fist thrown on the row through `at` along `way`, setting off `run` metres
// short of it and flying `run` metres past.
// `fly(me, by)`: the fist in flight moved on `by` metres, and put away once it has flown its whole way.
// `fist(me, size)`: the fist's blade now, `{ blade: 'fist', guard, tip }`, its tip where it has flown to and its
// guard `size` metres behind, or null while none flies.
import type { Row } from '#engine/engine.ts'
import type { Blade, Limb } from '#plugins/melee3d/melee3d.sim.ts'

export type Fist = { strike: string; from: number[]; way: number[]; gone: number; run: number }

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const along = (a: number[], v: number[], s: number) => [a[0] + v[0] * s, a[1] + v[1] * s, a[2] + v[2] * s]

// How far along the ray it meets a sphere at `c` of radius `r`, or -1.
function sphere(o: number[], v: number[], c: number[], r: number) {
  const oc = sub(o, c)
  const b = dot(v, oc), h = b * b - (dot(oc, oc) - r * r)
  return h < 0 ? -1 : -b - Math.sqrt(h)
}

// How far along the ray (from `o`, unit `v`) it first meets the capsule `a`–`b` of radius `r`, or -1 (Quílez's
// capsule intersection): the side of the cylinder, else the nearer end's sphere.
function capsule(o: number[], v: number[], a: number[], b: number[], r: number) {
  const ba = sub(b, a), oa = sub(o, a)
  const baba = dot(ba, ba), bard = dot(ba, v), baoa = dot(ba, oa)
  const k = baba - bard * bard
  if (k > 1e-12) {
    const p = baba * dot(v, oa) - baoa * bard
    const h = p * p - k * (baba * dot(oa, oa) - baoa * baoa - r * r * baba)
    if (h < 0) return -1
    const t = (-p - Math.sqrt(h)) / k
    const y = baoa + t * bard
    if (y > 0 && y < baba) return t
    return sphere(o, v, y <= 0 ? a : b, r)
  }
  const ta = sphere(o, v, a, r), tb = sphere(o, v, b, r)
  return ta < 0 ? tb : tb < 0 ? ta : Math.min(ta, tb)
}

export function aim(limbs: Limb[], from: number[], way: number[]): { limb: string; point: number[]; t: number } | null {
  let best: { limb: string; point: number[]; t: number } | null = null
  for (const l of limbs) {
    const t = capsule(from, way, l.a, l.b, l.radius)
    if (t < 0 || (best && best.t <= t)) continue
    best = { limb: l.limb, point: along(from, way, t), t }
  }
  return best
}

export function throws(me: Row, strike: string, at: number[], way: number[], run: number) {
  me.data.fist = { strike, from: along(at, way, -run), way, gone: 0, run: 2 * run } satisfies Fist
}

export function fly(me: Row, by: number) {
  const f: Fist | null = me.data.fist
  if (!f) return
  const gone = f.gone + by
  me.data.fist = gone > f.run ? null : { ...f, gone }
}

export function fist(me: Row, size: number): Blade | null {
  const f: Fist | null = me.data.fist
  if (!f) return null
  const tip = along(f.from, f.way, f.gone)
  return { blade: 'fist', guard: along(tip, f.way, -size), tip }
}
