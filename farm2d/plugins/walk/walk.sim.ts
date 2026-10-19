// The server half of walk, farm2d's own plugin for everything that walks the field: the farmer, the
// cows and the chickens. Each kind's rule calls these on its own row, and every number is that row's
// kind's definition (`assets/farm2d.json`):
//   speed    cells a second at a full stride.
//   radius   the body, a circle of that many cells, which tilemap's `slide` stops against every
//            cell that blocks: the fences, the house, the trees' trunks, the field's edge.
//   bounds   [[left, top], [right, bottom]], the box it is kept inside: the whole field for the
//            farmer, its pen for a cow or a chicken, so the gate the farmer walks through holds no
//            animal.
//   faces    4, it faces the nearer of right, up, left and down as it walks; 2, it faces right or
//            left, the way it last stepped across.
//   rest     [least, most] seconds it stands when it has nothing to do (`between`).
//   nav      `{ sub, window, clear }` for a kind that finds its way round the fences (`route`): each
//            map cell is `sub` × `sub` nav cells, a search looks `window` map cells across, and the
//            way is planned for a body of radius `clear`, wider than its own `radius`, so the way it
//            walks keeps off every post and corner by the difference. Planned at its own radius, the
//            way ran a radius off a gatepost exactly, and a millionth of a cell's drift across put the
//            body inside the post's corner, where `slide` held it.
//
// The row's own fields: `pos`, its feet, [x, y] in cells; `move`, the way it is going, at most a
// unit long, a seat's keys or its brain's; `facing`, in whole turns from right, counter-clockwise;
// `clip`, `frame` and `ft`, what sprite2d draws of its sheet (the row's `sheet` where its kind's
// entry in `world.sprite2d` names none).
//
//   steer(me, x, y)           `move` set from a seat's keys, the act `move` of every kind that walks:
//                             two finite numbers, kept to a unit's length at most, and nothing else.
//   stride(w, me, dt)         a step of `move`, slid along what blocks, kept in `bounds`, facing the
//                             way it went; whether it moved.
//   animate(w, me, clip, dt)  `clip` played, from its first frame when it was not playing already.
//   head(w, me, to, dt)       `move` set straight at the point `to`, short of a full stride when a
//                             full one would step past it; how far off it is.
//   route(w, me, goal)        where to head next on the way to `goal`: the goal itself when a body
//                             of radius `nav.clear` passes straight there, else the furthest point
//                             down nav's path, pulled straight, that it does.
//   roam(w, me)               a point inside `bounds`, rolled with the scene's die.
//   between(w, [least, most]) a number between, rolled with the scene's die.
//   nearest(me, rows)         of `rows`, the one nearest `me`, or undefined.
//   apart(a, b)               how far apart two points are.
//
// The nav grid of each map is made once, from tilemap's `blocked` on the map as it was read: no rule
// of this game edits the map.
import type { Row, W } from '#engine/engine.ts'
import { def, play, sheet, tiled, type Tiled } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { at, centre, grid, path, pull, sight, type Blocked, type Nav } from '#plugins/nav/nav.sim.ts'
import { blocked, slide } from '#plugins/tilemap/tilemap.sim.ts'

type Point = readonly number[]
type Floor = { g: Nav; blocked: Blocked }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

export const apart = (a: Point, b: Point) => math.hypot(b[0] - a[0], b[1] - a[1])

export const between = (w: W, [least, most]: number[]) => least + w.die() * (most - least)

export function nearest(me: Row, rows: Row[]): Row | undefined {
  let best: Row | undefined, gap = Infinity
  for (const r of rows) {
    const d = apart(me.data.pos, r.data.pos)
    if (d < gap) { gap = d; best = r }
  }
  return best
}

const mapOf = (w: W): Tiled => tiled(w, w.world.tilemap.file)

export function steer(me: Row, x: unknown, y: unknown) {
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return
  const len = math.hypot(x, y)
  me.data.move = len > 1 ? [x / len, y / len] : [x, y]
}

export function stride(w: W, me: Row, dt: number): boolean {
  const d = me.data, k = def(w, me.kind)
  const [x, y] = d.move
  if (x === 0 && y === 0) return false
  const map = mapOf(w), step = k.speed * dt, [[left, top], [right, bottom]] = k.bounds
  const was = [d.pos[0], d.pos[1]]
  const across = slide(map, undefined, d.pos, 0, d.pos[0] + x * step, k.radius)
  const down = slide(map, undefined, [across, d.pos[1]], 1, d.pos[1] + y * step, k.radius)
  d.pos = [clamp(across, left, right), clamp(down, top, bottom)]
  if (k.faces === 2) {
    if (x !== 0) d.facing = x > 0 ? 0 : 0.5
  } else d.facing = Math.abs(x) >= Math.abs(y) ? (x > 0 ? 0 : 0.5) : y < 0 ? 0.25 : 0.75
  return d.pos[0] !== was[0] || d.pos[1] !== was[1]
}

export function animate(w: W, me: Row, clip: string, dt: number) {
  const d = me.data
  if (clip !== d.clip) {
    d.clip = clip
    d.frame = 0
    d.ft = 0
  }
  const s = sheet(w, w.world.sprite2d.kinds[me.kind].sheet ?? d.sheet)
  ;[d.frame, d.ft] = play(s, d.clip, d.frame, d.ft, dt)
}

export function head(w: W, me: Row, to: Point, dt: number): number {
  const d = me.data, gap = apart(d.pos, to)
  if (gap === 0) {
    d.move = [0, 0]
    return 0
  }
  const part = Math.min(1, gap / (def(w, me.kind).speed * dt))
  d.move = [((to[0] - d.pos[0]) / gap) * part, ((to[1] - d.pos[1]) / gap) * part]
  return gap
}

// Each map's grid, by its `sub` and `window`.
const floors = new WeakMap<Tiled, Map<string, Floor>>()
function floorOf(w: W, nav: { sub: number; window: number }): Floor {
  const map = mapOf(w)
  let kept = floors.get(map)
  if (!kept) floors.set(map, (kept = new Map()))
  const key = `${nav.sub}:${nav.window}`
  const had = kept.get(key)
  if (had) return had
  const walled: Blocked = (c, r) => blocked(map, undefined, c, r)
  const made = { g: grid(map.width, map.height, walled, nav.sub, nav.window), blocked: walled }
  kept.set(key, made)
  return made
}

export function route(w: W, me: Row, goal: Point): Point {
  const k = def(w, me.kind), f = floorOf(w, k.nav), p = me.data.pos, r = k.nav.clear
  if (sight(f.blocked, p, goal, r)) return goal
  const cells = path(f.g, at(f.g, p), at(f.g, goal))
  if (!cells.length) return goal
  return pull([p, ...cells.map(c => centre(f.g, c, r)), goal], f.blocked, r)[1]
}

export function roam(w: W, me: Row): number[] {
  const [[left, top], [right, bottom]] = def(w, me.kind).bounds
  return [between(w, [left, right]), between(w, [top, bottom])]
}
