// floors: demo_walker's own plugin, the course's shapes as what a walker body stands on and walks
// round. It has no row and no page half. The course is the scene's one `course` row, whose definition
// names its level, a loader `json` entry (`assets/course.json`), and whose `pos` [x, y, z] and `yaw`
// place it: every shape stands on the plane y = pos[1], at its `at` [x, z] turned by the row's `yaw`,
// facing its own `yaw` on top of it. A yaw θ faces (sin θ, cos θ) and its right is (cos θ, −sin θ),
// the camera law's, so a shape's look turned by three's `rotation.y` stands where it stands here.
//
// The shapes, each `{ is, at, yaw, ... }` in metres:
//   stairs  `width`, `riser`, `tread`, `steps`, `landing`: a flight climbing along the shape's facing
//           from `at`, the front of its first step, step i (from 0) `tread` deep and (i + 1)·`riser`
//           high, then a landing `landing` deep at steps·`riser`.
//   ramp    `width`, `grade` (rise over run), `rise`, `depth`: a slope from `at` rising `grade` a metre
//           along the facing to `rise`, then flat at `rise` to `depth` metres from `at`.
//   box     `size` [across, along], `top`: a block centred on `at`, `top` high.
//   tree    `radius`, `tall`, `crown`: a trunk walked round, a circle of `radius` at `at`; `tall` and
//           `crown` are its look's.
//   seat    `radius`, and its look's `height`, `width`, `depth`, `back`, `behind`, `board`, `leg`: a chair, walked round
//           as a circle of `radius` at `at`, the place a body sitting on it stands on the ground, facing
//           the shape's `yaw` (`plugins/seating`).
// Each of the first three is solid from the plane up to its surface: `top(course, x, z)` is the
// highest surface over (x, z) of every shape that covers it, or undefined where none does, and
// `posts(course, x, z, r)` every trunk's and chair's circle reaching within r of (x, z). A shape's
// `tint`, and the level's `checker`, `trunk`, `leaves` and `water`, are its look's
// (`course.client.ts`).
//
// `faces(course)` is every side of every box, `{ a, b, out, top, deep }`: its two ends [x, z] across
// the ground, the way out from it [x, z], its top's height and how deep the box is behind it, for the
// moves made against a wall (`plugins/cover`, `plugins/parkour`). `seats(course)` is every chair as
// `{ x, z, yaw, y, seat }`: where its sitter's hips stand, the way it faces, the plane it stands on,
// and its shape.
//
// `courseOf(w)` is the course of a rule's world, `courseIn(rows, level)` the course of the rows a page
// was sent and the level its loader read. `floors.walker.ts` hands walker the shapes over the ground
// the scene's `world.floors.mods.height` names (`terrain3d.floors.ts`).
import type { Row, W } from '#engine/engine.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export type Stairs = { is: 'stairs'; at: number[]; yaw: number; width: number; riser: number; tread: number; steps: number; landing: number; tint: string }
export type Ramp = { is: 'ramp'; at: number[]; yaw: number; width: number; grade: number; rise: number; depth: number; tint: string }
export type Box = { is: 'box'; at: number[]; yaw: number; size: number[]; top: number; tint: string }
export type Tree = { is: 'tree'; at: number[]; radius: number; tall: number; crown: number }
export type Seat = { is: 'seat'; at: number[]; yaw: number; radius: number; height: number; width: number; depth: number; back: number; behind: number; board: number; leg: number; tint: string }
export type Shape = Stairs | Ramp | Box | Tree | Seat
export type Face = { a: number[]; b: number[]; out: number[]; top: number; deep: number }
export type Level = { shapes: Shape[]; checker: number; trunk: string; leaves: string; water: { colour: string; opacity: number; size: number } }
export type Solid = { x: number; z: number; radius: number }

// A shape placed in the world: where its `at` stands, the way it faces, and its trunk's centre.
type Placed = { shape: Shape; x: number; z: number; s: number; c: number }
export type Course = { level: Level; y: number; placed: Placed[] }

// The course of a level placed by a `course` row's pos and yaw.
function place(level: Level, row: Row): Course {
  const [px, y, pz] = row.data.pos
  const yaw = row.data.yaw ?? 0
  const s = math.sin(yaw), c = math.cos(yaw)
  const placed = level.shapes.map(shape => {
    const [ax, az] = shape.at
    const turn = yaw + (shape.is === 'tree' ? 0 : shape.yaw)
    return { shape, x: px + ax * c + az * s, z: pz - ax * s + az * c, s: math.sin(turn), c: math.cos(turn) }
  })
  return { level, y, placed }
}

// Each course kept with the level and the row's place it was made from.
const made = new WeakMap<object, { key: string; course: Course }>()
export function courseIn(rows: Row[], level: Level): Course {
  const row = rows.find(r => r.kind === 'course')
  if (!row) throw new Error('floors: the scene has no course row')
  const key = JSON.stringify([row.data.pos, row.data.yaw])
  const had = made.get(level)
  if (had && had.key === key) return had.course
  const course = place(level, row)
  made.set(level, { key, course })
  return course
}

export function courseOf(w: W): Course {
  const row = w.find('course')
  return courseIn([row], json(w, def(w, 'course').level))
}

// The surface of one shape over (x, z), above the course's plane, or undefined where it does not cover.
function surface(p: Placed, x: number, z: number): number | undefined {
  const dx = x - p.x, dz = z - p.z
  const along = dx * p.s + dz * p.c
  const across = dx * p.c - dz * p.s
  const sh = p.shape
  switch (sh.is) {
    case 'stairs': {
      const run = sh.steps * sh.tread
      if (Math.abs(across) > sh.width / 2 || along < 0 || along >= run + sh.landing) return undefined
      return along < run ? (Math.floor(along / sh.tread) + 1) * sh.riser : sh.steps * sh.riser
    }
    case 'ramp':
      if (Math.abs(across) > sh.width / 2 || along < 0 || along >= sh.depth) return undefined
      return Math.min(along * sh.grade, sh.rise)
    case 'box':
      if (Math.abs(across) > sh.size[0] / 2 || Math.abs(along) > sh.size[1] / 2) return undefined
      return sh.top
    case 'tree':
    case 'seat':
      return undefined
  }
}

export function top(course: Course, x: number, z: number): number | undefined {
  let best: number | undefined
  for (const p of course.placed) {
    const h = surface(p, x, z)
    if (h !== undefined && (best === undefined || h > best)) best = h
  }
  return best === undefined ? undefined : course.y + best
}

export function posts(course: Course, x: number, z: number, r: number): Solid[] {
  const out: Solid[] = []
  for (const p of course.placed) {
    if (p.shape.is !== 'tree' && p.shape.is !== 'seat') continue
    if (math.hypot(p.x - x, p.z - z) <= r + p.shape.radius) out.push({ x: p.x, z: p.z, radius: p.shape.radius })
  }
  return out
}

// The four sides of each box, each kept with the course it was made from.
const sided = new WeakMap<Course, Face[]>()
export function faces(course: Course): Face[] {
  let all = sided.get(course)
  if (all) return all
  all = []
  for (const p of course.placed) {
    if (p.shape.is !== 'box') continue
    const [across, along] = p.shape.size
    const fwd = [p.s, p.c], right = [p.c, -p.s]
    // Each side: the way out, its half length along it, and the box's half depth behind it.
    for (const [out, half, depth] of [[fwd, across / 2, along / 2], [[-fwd[0], -fwd[1]], across / 2, along / 2], [right, along / 2, across / 2], [[-right[0], -right[1]], along / 2, across / 2]] as [number[], number, number][]) {
      const t = [-out[1], out[0]]
      const mx = p.x + out[0] * depth, mz = p.z + out[1] * depth
      all.push({ a: [mx - t[0] * half, mz - t[1] * half], b: [mx + t[0] * half, mz + t[1] * half], out, top: course.y + p.shape.top, deep: 2 * depth })
    }
  }
  sided.set(course, all)
  return all
}

export function seats(course: Course): { x: number; z: number; yaw: number; y: number; seat: Seat }[] {
  return course.placed.filter(p => p.shape.is === 'seat').map(p => ({ x: p.x, z: p.z, yaw: math.atan2(p.s, p.c), y: course.y, seat: p.shape as Seat }))
}
