// rooms, demo_world3d's own plugin (loaded by `shipped`, `world.shipped.plugins`): a place's rooms lit and drawn from
// the light hints its solver wrote, with nothing baked. It has no row and no server half. The scene lists `shipped`
// after skydome3d and before render3d, so its `afterTick` runs after the sky has set its lights and exposure for the
// frame and before render3d draws it.
//
// The hints are places of the place's nav graph (the library's `stronghold/src/lib/util/light.mjs`), each a whole name
// and `data.light`, read off the json the scene's catalogue names `world.rooms.hints`. A hint's part is one of PARTS:
//   room     a box from its `low`, `high` and `across` places (its floor's top, its ceiling's underside, its first side)
//   opening  a rectangle `width` by `height`, its middle the place, facing into its room toward its `inward` place, its
//            width toward its `across` place; `sky` lets the sky and the ground through it, `beam` the key light,
//            `rooms` makes it an opening between two rooms
//   inward, across   an opening's two ways
//   lamp     a fire of its `kind`, which `world.rooms.fires` names
//   dark     a box from its `low`, `high` and `across` places that darkens what is under it
// A part PARTS has not, a lamp kind `fires` has not, or a hint of a room no room hint makes throws, naming it.
//
// The light. Every dressed material is given one render3d splice, `rooms`. A fragment standing in a room's box
// (`margin` metres round it) is lit by its room's hints alone, in place of the sky's hemisphere light, its key light and
// its reflections; every other fragment is lit as it was, and lights3d's lamps (the player's torch) light everything as
// before. In a room, from the fragment's place and normal:
//   sky, ground  through each `sky` opening of its room, the share of the cosine-weighted hemisphere the opening's
//                rectangle covers above the fragment's height (sky) and below it (ground), times skydome3d's sky and
//                ground light (`light()`), so a floor open to the whole sky reads as the sky outside does
//   the key      through each `beam` opening, where the line from the fragment toward the key light passes through the
//                rectangle, the key light's colour times its cosine; the patch's edge one pixel wide, wherever the sun
//                stands at the hour the sky has, so it moves with the clock
//   fires        each lamp of its room, its fire's colour times `gain` times the cosine over the distance squared
//                (`lampNear` the nearest counted), flickering by its fire's `flicker`, each [amount, rate, phase]:
//                1 + Σ amount · sin(seconds · rate + phase) times as bright
//   between      through each opening between rooms, the share of the hemisphere it covers times `pass` times the
//                other room's mean light: its sky, ground and key worked out at `sample` metres over its floor, walls
//                and ceiling, again whenever the key light has turned `resample` radians, and its fires'
//   dark         under a dark hint of its room, all of it `under` times over, and no sun patch
// The hints go to the GPU once, in one float texture, each room's openings, lamps and darks laid one after another; a
// fragment finds its room in a grid of `grid`-metre cells, each holding the rooms that stand over it (four at most, or
// it throws naming the cell).
//
// Inside. While the camera stands in a room's box, the rooms drawn are that room and every room an opening between rooms
// joins to it:
//   the place   world3d's one mesh (`world3d.mesh()`) draws only the triangles whose bounds meet a drawn room's box
//               (`margin` round it), and the rest of the place too while an opening is seen
//   seen        a `sky` or `beam` opening of a drawn room is seen when its rectangle, grown `portal` metres every way, is
//               in the camera's view; then everything beyond it in the view through it is drawn
//   the rest    every other object of render3d's scene that three would cull (`frustumCulled`) is drawn only when its
//               bounds stand in a drawn room (its middle in the box, its radius within the box's half diagonal) or meet
//               the view through a seen opening; one three never culls is drawn unless an `outdoors` mod hands it
//   outdoors    what each plugin `world.rooms.mods.outdoors` names hands (`(plugins) → Object3D[]`, instances3d's
//               `instances3d.rooms.ts`) is not drawn while no opening is seen
//   shadows     skydome3d's key light draws no shadow map (`shadow.autoUpdate` off), and draws one again on the frame
//               the camera leaves
//   exposure    render3d's exposure, as the sky set it, goes `exposure.inside` times over, eased at `exposure.rate` an
//               e-fold a second, and back outside
//   beams       each `beam` opening of a drawn room while the sun shines in through it shows a prism of light from its
//               corners along the sun to its room's floor, `beams.opacity` times the sun's light, with `beams.dust`
//               motes of `beams.size` metres drifting in it by `beams.drift` ([x, y, z] metres) at `beams.rates`
//               ([x, y, z] radians a second), `beams.near` its colour at the opening and `beams.far` at the floor,
//               `beams.mote` the motes' colour
// What was hidden for a frame is put back as it was the moment three has drawn the scene through render3d's camera, so
// every other plugin sets `visible` as ever. Nothing of it compiles a program again: the place's triangles are chosen
// by swapping its index for one made once for each set of rooms, and everything else by `visible` and uniforms.
//
// `state()` is where it stands: `{ room, drawn, seen, calls, programs, hidden }`, the camera's room's whole name or
// undefined, the drawn rooms, whether an opening is seen, three's draw calls and programs at the last drawing through
// render3d's camera, and how many objects were hidden for it. `close` takes everything off and disposes it.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import { modsOf } from '#addons/scenemanager/scenemanager.addon.ts'

export type Fire = { colour: string; gain: number; flicker: [number, number, number][] }
export type Settings = {
  hints: string
  margin: number; grid: number; sample: number; resample: number
  under: number; pass: number; lampNear: number; portal: number
  fires: Record<string, Fire>
  exposure: { inside: number; rate: number }
  beams: { opacity: number; dust: number; size: number; drift: [number, number, number]; rates: [number, number, number]; near: string; far: string; mote: string }
}

type V = [number, number, number]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l] }
const UP: V = [0, 1, 0]

// A box from its low corner, the unit way along its first side, its two lengths across the floor and its top.
export type Box = { low: V; u: V; w: V; a: number; b: number; top: number }
export type Opening = { name: string; mid: V; across: V; along: V; inward: V; half: [number, number]; sky: boolean; beam: boolean; other: number }
export type Lamp = { name: string; at: V; fire: number }
export type Room = Box & { name: string; openings: Opening[]; lamps: Lamp[]; darks: Box[]; joins: number[] }
export type Hints = { rooms: Room[]; fires: string[] }

// Whether `p` stands in the box, `m` metres round it.
export function inBox(r: Box, p: V, m: number) {
  const d = sub(p, r.low), a = dot(d, r.u), b = dot(d, r.w)
  return a > -m && a < r.a + m && b > -m && b < r.b + m && p[1] > r.low[1] - m && p[1] < r.top + m
}

// What each part of a hint is: what it adds to the hints, its own or with another's.
type Read = { at: (n: string) => V; light: Map<string, any>; rooms: Map<string, Room>; fires: Settings['fires']; fireNames: string[] }
const prefix = (n: string) => n.slice(0, n.lastIndexOf('/') + 1)
const boxOf = (r: Read, k: string): Box => {
  const low = r.at(`${k} low`), high = r.at(`${k} high`)
  const u = norm(sub(r.at(`${k} across`), low)), w = cross(UP, u), d = sub(high, low)
  return { low, u, w, a: dot(d, u), b: dot(d, w), top: high[1] }
}
const roomOf = (r: Read, n: string, room: string) => {
  const it = r.rooms.get(prefix(n) + room)
  if (!it) throw new Error(`rooms: the hint ${n} is of the room ${room}, which no room hint makes`)
  return it
}
export const PARTS: Record<string, { first: (r: Read, n: string, l: any) => void; then: (r: Read, n: string, l: any) => void }> = {
  room: {
    first(r, n, l) {
      if (l.corner !== 'low') return
      const name = prefix(n) + l.room
      r.rooms.set(name, { name, ...boxOf(r, name), openings: [], lamps: [], darks: [], joins: [] })
    },
    then() {},
  },
  inward: { first() {}, then() {} },
  across: { first() {}, then() {} },
  opening: {
    first() {},
    then(r, n, l) {
      const mid = r.at(n), inward = norm(sub(r.at(`${n} inward`), mid)), across = norm(sub(r.at(`${n} across`), mid))
      const along = norm(cross(inward, across))
      const o = { name: n, mid, across, along, inward, half: [l.width / 2, l.height / 2] as [number, number], sky: !!l.sky, beam: !!l.beam }
      if (!l.rooms) {
        roomOf(r, n, l.room).openings.push({ ...o, other: -1 })
        return
      }
      const all = [...r.rooms.values()]
      const [a, b] = l.rooms.map((x: string) => roomOf(r, n, x))
      a.openings.push({ ...o, other: all.indexOf(b) })
      b.openings.push({ ...o, other: all.indexOf(a) })
      a.joins.push(all.indexOf(b))
      b.joins.push(all.indexOf(a))
    },
  },
  lamp: {
    first() {},
    then(r, n, l) {
      if (!r.fires[l.kind]) throw new Error(`rooms: the lamp ${n} is a ${l.kind}, which world.rooms.fires has not (${Object.keys(r.fires).join(', ')})`)
      roomOf(r, n, l.room).lamps.push({ name: n, at: r.at(n), fire: r.fireNames.indexOf(l.kind) })
    },
  },
  dark: {
    first() {},
    then(r, n, l) {
      if (l.corner !== 'low') return
      roomOf(r, n, l.room).darks.push(boxOf(r, n.slice(0, -' low'.length)))
    },
  },
}

// The rooms of a nav graph's light hints.
export function read(nav: { places: { point: { at: V }; data?: any }[] }, fires: Settings['fires']): Hints {
  const places = new Map<string, V>(), light = new Map<string, any>()
  for (const p of nav.places) {
    for (const n of p.data?.nav3d?.tags ?? []) {
      places.set(n, p.point.at)
      if (p.data.light) light.set(n, p.data.light)
    }
  }
  const at = (n: string) => {
    const v = places.get(n)
    if (!v) throw new Error(`rooms: the hints have no place ${n}`)
    return v
  }
  for (const [n, l] of light) if (!PARTS[l.part]) throw new Error(`rooms: the hint ${n} is a ${l.part}, which no part of rooms reads (${Object.keys(PARTS).join(', ')})`)
  const r: Read = { at, light, rooms: new Map(), fires, fireNames: Object.keys(fires) }
  for (const [n, l] of light) PARTS[l.part].first(r, n, l)
  for (const [n, l] of light) PARTS[l.part].then(r, n, l)
  if (!r.rooms.size) throw new Error('rooms: the hints make no room')
  return { rooms: [...r.rooms.values()], fires: r.fireNames }
}

// A polygon's corners, relative to the point, cut to the side where `dot(v, w) >= 0`.
export function clip(poly: V[], w: V): V[] {
  const out: V[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = dot(a, w), db = dot(b, w)
    if (da >= 0) out.push(a)
    if ((da >= 0) !== (db >= 0)) out.push(add(a, sub(b, a), da / (da - db)))
  }
  return out
}
// The share of the cosine-weighted hemisphere round `n` a polygon on its side covers: 1 for the whole hemisphere.
export function seen(poly: V[], n: V) {
  let f = 0
  for (let i = 0; i < poly.length; i++) {
    const a = norm(poly[i]), b = norm(poly[(i + 1) % poly.length])
    const c = cross(a, b), s = Math.hypot(c[0], c[1], c[2])
    if (s < 1e-6) continue
    f += Math.acos(Math.min(1, Math.max(-1, dot(a, b)))) * dot(n, [c[0] / s, c[1] / s, c[2] / s])
  }
  return Math.abs(f) / (2 * Math.PI)
}
const corners = (o: Opening, p: V): V[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => sub(add(add(o.mid, o.across, x * o.half[0]), o.along, y * o.half[1]), p))

// A point's light from its own room's hints, before what comes between rooms, as the shader works it out with the
// patch's edge taken hard: sky, ground, key, and each fire's share.
export function lightAt(room: Room, p: V, n: V, key: V, s: Settings, fires: number): number[] {
  const out = new Array(3 + fires).fill(0)
  let patch = false
  for (const o of room.openings) {
    if (o.other >= 0) continue
    const facing = clip(corners(o, p), n)
    if (o.sky) {
      out[0] += seen(clip(facing, UP), n)
      out[1] += seen(clip(facing, [0, -1, 0]), n)
    }
    const dn = dot(key, o.inward)
    if (o.beam && key[1] > 0 && dn < 0) {
      const t = dot(sub(o.mid, p), o.inward) / dn
      const h = sub(add(p, key, t), o.mid)
      if (t > 0 && Math.abs(dot(h, o.across)) < o.half[0] && Math.abs(dot(h, o.along)) < o.half[1]) patch = true
    }
  }
  if (patch) out[2] += Math.max(0, dot(n, key))
  for (const l of room.lamps) {
    const d = sub(l.at, p), dist = Math.hypot(d[0], d[1], d[2])
    const c = dot(n, [d[0] / dist, d[1] / dist, d[2] / dist])
    if (c > 0) out[3 + l.fire] += c / Math.max(dist, s.lampNear) ** 2
  }
  if (room.darks.some(d => inBox(d, p, 0))) for (let k = 0; k < out.length; k++) out[k] *= s.under
  return out
}

// Where a room's mean light is taken: every `sample` metres over its floor (facing up), its ceiling (down) and its four
// walls (into the room).
export function samples(r: Room, sample: number): { p: V; n: V }[] {
  const out: { p: V; n: V }[] = []
  const h = r.top - r.low[1]
  const steps = (len: number) => Math.max(1, Math.round(len / sample))
  const at = (a: number, b: number, y: number): V => add(add(add(r.low, r.u, a), r.w, b), UP, y)
  const na = steps(r.a), nb = steps(r.b), nh = steps(h)
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
    const a = (i + 0.5) * r.a / na, b = (j + 0.5) * r.b / nb
    out.push({ p: at(a, b, 0.001), n: UP }, { p: at(a, b, h - 0.001), n: [0, -1, 0] })
  }
  const minus = (v: V): V => [-v[0], -v[1], -v[2]]
  for (let k = 0; k < nh; k++) {
    const y = (k + 0.5) * h / nh
    for (let i = 0; i < na; i++) {
      const a = (i + 0.5) * r.a / na
      out.push({ p: at(a, 0.001, y), n: r.w }, { p: at(a, r.b - 0.001, y), n: minus(r.w) })
    }
    for (let j = 0; j < nb; j++) {
      const b = (j + 0.5) * r.b / nb
      out.push({ p: at(0.001, b, y), n: r.u }, { p: at(r.a - 0.001, b, y), n: minus(r.u) })
    }
  }
  return out
}

// Each room's mean light over its samples: [sky, ground, key, ...each fire].
export function means(h: Hints, key: V, s: Settings): number[][] {
  return h.rooms.map(r => {
    const ps = samples(r, s.sample)
    const sum = new Array(3 + h.fires.length).fill(0)
    for (const { p, n } of ps) lightAt(r, p, n, key, s, h.fires.length).forEach((v, k) => { sum[k] += v })
    return sum.map(v => v / ps.length)
  })
}

// The hints as the GPU reads them: one RGBA float texture, `width` texels a row. Each room four texels: [low, a],
// [u, b], [top, first opening, openings, first lamp], [lamps, first dark, darks, 0]; then every room's openings, four
// texels each: [middle, sky + 2·beam], [across × half width, the other room or −1], [along × half height, 0],
// [inward, 0]; its lamps, one each: [at, fire]; its darks, three each: [low, a], [u, b], [top, 0, 0, 0]; then the grid's
// cells (`grid`), row by row from `gridFirst`; then from `meansFirst` each room's mean light, 1 + fires texels:
// [sky, ground, key, 0] and each fire's [share, 0, 0, 0], which `meansInto` writes. One texture, so a material spends
// one of its texture units on it.
export const WIDTH = 256
export function pack(h: Hints, g: ReturnType<typeof grid>) {
  const texels: number[][] = []
  for (const _ of h.rooms) texels.push([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0])
  h.rooms.forEach((r, i) => {
    const openFirst = texels.length
    for (const o of r.openings) {
      texels.push([...o.mid, (o.sky ? 1 : 0) + (o.beam ? 2 : 0)], [...o.across.map(v => v * o.half[0]), o.other], [...o.along.map(v => v * o.half[1]), 0], [...o.inward, 0])
    }
    const lampFirst = texels.length
    for (const l of r.lamps) texels.push([...l.at, l.fire])
    const darkFirst = texels.length
    for (const d of r.darks) texels.push([...d.low, d.a], [...d.u, d.b], [d.top, 0, 0, 0])
    texels[i * 4] = [...r.low, r.a]
    texels[i * 4 + 1] = [...r.u, r.b]
    texels[i * 4 + 2] = [r.top, openFirst, r.openings.length, lampFirst]
    texels[i * 4 + 3] = [r.lamps.length, darkFirst, r.darks.length, 0]
  })
  const gridFirst = texels.length
  const meansFirst = gridFirst + g.w * g.d
  const height = Math.ceil((meansFirst + h.rooms.length * (1 + h.fires.length)) / WIDTH)
  const data = new Float32Array(WIDTH * height * 4)
  texels.forEach((t, i) => data.set(t, i * 4))
  data.set(g.data, gridFirst * 4)
  return { data, width: WIDTH, height, gridFirst, meansFirst }
}

// Each room's mean light (`means`) written where `pack` keeps it.
export function meansInto(data: Float32Array, meansFirst: number, m: number[][], fires: number) {
  m.forEach((v, r) => {
    const at = meansFirst + r * (1 + fires)
    data.set([v[0], v[1], v[2], 0], at * 4)
    for (let q = 0; q < fires; q++) data.set([v[3 + q], 0, 0, 0], (at + 1 + q) * 4)
  })
}

// The grid a fragment finds its room by: cells `cell` metres square over the rooms' footprints, each the numbers (+1) of
// up to four rooms whose boxes, `margin` round them, stand over it.
export function grid(h: Hints, cell: number, margin: number) {
  const foot = (r: Box) => [[0, 0], [r.a, 0], [0, r.b], [r.a, r.b]].map(([a, b]) => add(add(r.low, r.u, a), r.w, b))
  const xs = h.rooms.flatMap(r => foot(r).map(p => p[0])), zs = h.rooms.flatMap(r => foot(r).map(p => p[2]))
  const x0 = Math.min(...xs) - margin - cell, z0 = Math.min(...zs) - margin - cell
  const w = Math.ceil((Math.max(...xs) + margin + cell - x0) / cell), d = Math.ceil((Math.max(...zs) + margin + cell - z0) / cell)
  const data = new Float32Array(w * d * 4)
  const count = new Uint8Array(w * d)
  h.rooms.forEach((r, i) => {
    const f = foot(r)
    const lo = [Math.min(...f.map(p => p[0])) - margin, Math.min(...f.map(p => p[2])) - margin]
    const hi = [Math.max(...f.map(p => p[0])) + margin, Math.max(...f.map(p => p[2])) + margin]
    for (let cz = Math.floor((lo[1] - z0) / cell); cz <= Math.floor((hi[1] - z0) / cell); cz++) {
      for (let cx = Math.floor((lo[0] - x0) / cell); cx <= Math.floor((hi[0] - x0) / cell); cx++) {
        const k = cz * w + cx
        if (count[k] === 4) throw new Error(`rooms: the grid's cell at ${(x0 + cx * cell).toFixed(2)}, ${(z0 + cz * cell).toFixed(2)} stands under more than four rooms; make world.rooms.grid smaller`)
        data[k * 4 + count[k]] = i + 1
        count[k]++
      }
    }
  })
  return { data, x0, z0, cell, w, d }
}

// The splice. Its glsl reads the hints texture as `pack` lays it, and the grid as `grid` does.
const PARS = (fires: number) => `
#define RL_ROOMS
uniform highp sampler2D rlHints;
uniform vec4 rlGridAt;
uniform ivec2 rlGridSize;
uniform ivec2 rlFirst;
uniform vec4 rlNumbers;
uniform vec3 rlSky;
uniform vec3 rlGround;
uniform vec3 rlKey;
uniform vec3 rlKeyDir;
uniform vec3 rlFires[ ${fires} ];
float rlLive = 1.0;
float rlSeenSky = 1.0;
vec3 rlIrr = vec3( 0.0 );
vec4 rlAt( int i ) { return texelFetch( rlHints, ivec2( i % ${WIDTH}, i / ${WIDTH} ), 0 ); }
bool rlIn( int i, vec3 p, float m ) {
  vec4 A = rlAt( i ), B = rlAt( i + 1 ), C = rlAt( i + 2 );
  vec3 d = p - A.xyz;
  vec3 w = cross( vec3( 0.0, 1.0, 0.0 ), B.xyz );
  float a = dot( d, B.xyz ), b = dot( d, w );
  return a > - m && a < A.w + m && b > - m && b < B.w + m && p.y > A.y - m && p.y < C.x + m;
}
int rlRoomOf( vec3 p ) {
  ivec2 c = ivec2( floor( ( p.xz - rlGridAt.xy ) / rlGridAt.z ) );
  if ( c.x < 0 || c.y < 0 || c.x >= rlGridSize.x || c.y >= rlGridSize.y ) return - 1;
  vec4 cand = rlAt( rlFirst.x + c.y * rlGridSize.x + c.x );
  for ( int k = 0; k < 4; k ++ ) {
    int r = int( cand[ k ] ) - 1;
    if ( r < 0 ) break;
    if ( rlIn( r * 4, p, rlGridAt.w ) ) return r;
  }
  return - 1;
}
int rlClip( vec3 i[ 8 ], int n, vec3 w, out vec3 o[ 8 ] ) {
  int m = 0;
  for ( int k = 0; k < 8; k ++ ) {
    if ( k >= n ) break;
    vec3 a = i[ k ], b = i[ ( k + 1 ) % n ];
    float da = dot( a, w ), db = dot( b, w );
    if ( da >= 0.0 && m < 8 ) { o[ m ] = a; m ++; }
    if ( ( da >= 0.0 ) != ( db >= 0.0 ) && m < 8 ) { o[ m ] = a + ( b - a ) * ( da / ( da - db ) ); m ++; }
  }
  return m;
}
float rlLambert( vec3 v[ 8 ], int n, vec3 N ) {
  float f = 0.0;
  for ( int i = 0; i < 8; i ++ ) {
    if ( i >= n ) break;
    vec3 a = normalize( v[ i ] ), b = normalize( v[ ( i + 1 ) % n ] );
    vec3 c = cross( a, b );
    float s = length( c );
    if ( s < 1e-6 ) continue;
    f += acos( clamp( dot( a, b ), - 1.0, 1.0 ) ) * dot( N, c / s );
  }
  return abs( f ) / ( 2.0 * PI );
}
#if NUM_DIR_LIGHTS > 0
void rlDirectional( const in DirectionalLight l, out IncidentLight d ) {
  getDirectionalLightInfo( l, d );
  d.color *= rlLive;
}
#define getDirectionalLightInfo( l, d ) rlDirectional( l, d )
#endif
`
const MAIN = (fires: number) => `
#ifdef RL_ROOMS
{
  vec3 rlP = vDressWorld;
  vec3 rlN = inverseTransformDirection( normal, viewMatrix );
  int rlR = rlRoomOf( rlP );
  float rlEdge = - 1e3;
  if ( rlR >= 0 ) {
    rlLive = 0.0;
    vec4 R2 = rlAt( rlR * 4 + 2 ), R3 = rlAt( rlR * 4 + 3 );
    float sky = 0.0, ground = 0.0, key = 0.0;
    vec3 fire = vec3( 0.0 );
    int first = int( R2.y ), count = int( R2.z );
    for ( int k = 0; k < count; k ++ ) {
      int o = first + k * 4;
      vec4 M = rlAt( o ), X = rlAt( o + 1 ), Y = rlAt( o + 2 ), I = rlAt( o + 3 );
      vec3 c[ 8 ];
      c[ 0 ] = M.xyz - X.xyz - Y.xyz - rlP;
      c[ 1 ] = M.xyz + X.xyz - Y.xyz - rlP;
      c[ 2 ] = M.xyz + X.xyz + Y.xyz - rlP;
      c[ 3 ] = M.xyz - X.xyz + Y.xyz - rlP;
      vec3 f[ 8 ];
      int nf = rlClip( c, 4, rlN, f );
      int other = int( X.w );
      if ( other >= 0 ) {
        float s = rlLambert( f, nf, rlN ) * rlNumbers.y;
        int at = rlFirst.y + other * ${1 + fires};
        vec4 m = rlAt( at );
        sky += s * m.x;
        ground += s * m.y;
        key += s * m.z;
        for ( int q = 0; q < ${fires}; q ++ ) fire += s * rlAt( at + 1 + q ).x * rlFires[ q ];
        continue;
      }
      int flags = int( M.w );
      if ( ( flags & 1 ) != 0 ) {
        vec3 g[ 8 ];
        int ng = rlClip( f, nf, vec3( 0.0, 1.0, 0.0 ), g );
        sky += rlLambert( g, ng, rlN );
        ng = rlClip( f, nf, vec3( 0.0, - 1.0, 0.0 ), g );
        ground += rlLambert( g, ng, rlN );
      }
      float dn = dot( rlKeyDir, I.xyz );
      if ( ( flags & 2 ) != 0 && rlKeyDir.y > 0.0 && dn < 0.0 ) {
        float t = dot( M.xyz - rlP, I.xyz ) / dn;
        if ( t > 0.0 ) {
          vec3 h = rlP + rlKeyDir * t - M.xyz;
          float hx = length( X.xyz ), hy = length( Y.xyz );
          rlEdge = max( rlEdge, min( hx - abs( dot( h, X.xyz ) / hx ), hy - abs( dot( h, Y.xyz ) / hy ) ) );
        }
      }
    }
    int lampFirst = int( R2.w ), lamps = int( R3.x );
    for ( int k = 0; k < lamps; k ++ ) {
      vec4 L = rlAt( lampFirst + k );
      vec3 d = L.xyz - rlP;
      float dist = length( d );
      float c = dot( rlN, d / dist );
      if ( c > 0.0 ) fire += c / pow( max( dist, rlNumbers.z ), 2.0 ) * rlFires[ int( L.w ) ];
    }
    int darkFirst = int( R3.y ), darks = int( R3.z );
    float keep = 1.0;
    for ( int k = 0; k < darks; k ++ ) {
      if ( rlIn( darkFirst + k * 3, rlP, 0.0 ) ) { keep = rlNumbers.x; rlEdge = - 1e3; break; }
    }
    rlIrr = keep * ( sky * rlSky + ground * rlGround + key * rlKey + fire );
    rlSeenSky = clamp( sky + ground, 0.0, 1.0 );
  }
  float rlWide = fwidth( rlEdge );
  float rlSun = rlR >= 0 ? clamp( 0.5 + rlEdge / max( rlWide, 1e-5 ), 0.0, 1.0 ) : 0.0;
  rlIrr += rlSun * max( dot( rlN, rlKeyDir ), 0.0 ) * rlKey;
}
#endif
`
export const SPLICE = (fires: number) => ({
  fragment: {
    '?lights_pars_begin': PARS(fires),
    '?normal_fragment_maps': MAIN(fires),
    '?lights_fragment_begin': 'irradiance = mix( rlIrr, irradiance, rlLive );',
    '?lights_fragment_maps': [
      'float rlSeen = mix( rlSeenSky, 1.0, rlLive );',
      'iblIrradiance *= rlSeen;',
      '#if defined( RE_IndirectSpecular )',
      'radiance *= rlSeen;',
      '#endif',
    ].join('\n'),
  },
})

// Each triangle of the place, the rooms its bounds meet: its corners' extents along each room's three ways overlap the
// room's box, `margin` round it, so one face that runs up two storeys is drawn with either. None, outside every room.
export function cells(position: { getX(i: number): number; getY(i: number): number; getZ(i: number): number }, index: ArrayLike<number>, rooms: Room[], margin: number) {
  const of: number[][] = []
  for (let t = 0; t < index.length / 3; t++) {
    const ps: V[] = [0, 1, 2].map(k => { const v = index[t * 3 + k]; return [position.getX(v), position.getY(v), position.getZ(v)] })
    const mine: number[] = []
    rooms.forEach((r, i) => {
      const a = ps.map(p => dot(sub(p, r.low), r.u)), b = ps.map(p => dot(sub(p, r.low), r.w)), y = ps.map(p => p[1])
      const meets = (vs: number[], lo: number, hi: number) => Math.max(...vs) > lo - margin && Math.min(...vs) < hi + margin
      if (meets(a, 0, r.a) && meets(b, 0, r.b) && meets(y, r.low[1], r.top)) mine.push(i)
    })
    of.push(mine)
  }
  return of
}

export function rooms() {
  let started = false
  let s: Settings | undefined
  let h: Hints | undefined
  let T: typeof THREE | undefined
  const made: { dispose(): void }[] = []
  const uniforms: Record<string, THREE.IUniform> = {}
  // the hints texture (`pack`) and its data, the rooms' means written into it from `meansFirst`
  let hintsTex: THREE.DataTexture | undefined
  let hintsData: Float32Array | undefined
  let meansFirst = 0
  let keyThen: V | undefined
  let fireColours: THREE.Color[] = []
  // the place's mesh as built, its own index, each triangle's cell and an index for each set of rooms drawn
  let place: THREE.Mesh | undefined
  let whole: THREE.BufferAttribute | undefined
  let cellOf: number[][] | undefined
  const indexes = new Map<string, THREE.BufferAttribute>()
  // what was hidden for this frame's drawing, and the key light's shadow as it was
  let hidden: THREE.Object3D[] = []
  let still: THREE.DirectionalLight | undefined
  let k = 0
  let last: number | undefined
  let state = { room: undefined as string | undefined, drawn: [] as string[], seen: false, calls: 0, programs: 0, hidden: 0 }
  let beams: { room: number; o: Opening; mesh: THREE.Mesh; points: THREE.Points; seeds: Float32Array }[] = []
  let hooked: { scene: THREE.Scene; was: THREE.Scene['onAfterRender'] } | undefined

  const restore = () => {
    for (const o of hidden) o.visible = true
    hidden = []
  }

  const build = (plugins: Plugins) => {
    const three = plugins.render3d.THREE as typeof THREE
    T = three
    s = plugins.wire.scene.world!.rooms as Settings
    h = read(json(plugins.wire, s.hints), s.fires)
    const g = grid(h, s.grid, s.margin)
    const packed = pack(h, g)
    hintsData = packed.data
    meansFirst = packed.meansFirst
    hintsTex = new three.DataTexture(packed.data, packed.width, packed.height, three.RGBAFormat, three.FloatType)
    hintsTex.minFilter = hintsTex.magFilter = three.NearestFilter
    hintsTex.needsUpdate = true
    made.push(hintsTex)
    fireColours = h.fires.map(() => new three.Color())
    Object.assign(uniforms, {
      rlHints: { value: hintsTex }, rlFirst: { value: new three.Vector2(packed.gridFirst, packed.meansFirst) },
      rlGridAt: { value: new three.Vector4(g.x0, g.z0, g.cell, s.margin) }, rlGridSize: { value: new three.Vector2(g.w, g.d) },
      rlNumbers: { value: new three.Vector4(s.under, s.pass, s.lampNear, 0) },
      rlSky: { value: new three.Color(0, 0, 0) }, rlGround: { value: new three.Color(0, 0, 0) }, rlKey: { value: new three.Color(0, 0, 0) },
      rlKeyDir: { value: new three.Vector3(0, 1, 0) }, rlFires: { value: fireColours },
    })
    plugins.render3d.splice('rooms', { uniforms, ...SPLICE(h.fires.length) })
    // the beams, one for each beam opening of a room
    const scene = plugins.render3d.scene as THREE.Scene
    const dot = new three.CanvasTexture((() => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const x = c.getContext('2d')!
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, '#fff')
      gr.addColorStop(1, '#000')
      x.fillStyle = gr
      x.fillRect(0, 0, 64, 64)
      return c
    })())
    made.push(dot)
    const near = new three.Color(s.beams.near), far = new three.Color(s.beams.far)
    h.rooms.forEach((r, i) => {
      for (const o of r.openings) {
        if (!o.beam || o.other >= 0) continue
        const geometry = new three.BufferGeometry()
        geometry.setAttribute('position', new three.Float32BufferAttribute(new Array(24).fill(0), 3))
        geometry.setAttribute('color', new three.Float32BufferAttribute([0, 1, 2, 3].flatMap(() => near.toArray()).concat([0, 1, 2, 3].flatMap(() => far.toArray())), 3))
        geometry.setIndex([0, 1, 2, 3].flatMap(a => { const b = (a + 1) % 4; return [a, b, 4 + b, a, 4 + b, 4 + a] }))
        const mesh = new three.Mesh(geometry, new three.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: three.AdditiveBlending, side: three.DoubleSide, depthWrite: false }))
        mesh.frustumCulled = false
        mesh.visible = false
        const points = new three.Points(new three.BufferGeometry(), new three.PointsMaterial({ color: s!.beams.mote, size: s!.beams.size, alphaMap: dot, transparent: true, opacity: 0, blending: three.AdditiveBlending, depthWrite: false }))
        points.geometry.setAttribute('position', new three.Float32BufferAttribute(new Array(s!.beams.dust * 3).fill(0), 3))
        points.frustumCulled = false
        points.visible = false
        scene.add(mesh, points)
        made.push(geometry, mesh.material as THREE.Material, points.geometry, points.material as THREE.Material)
        beams.push({ room: i, o, mesh, points, seeds: Float32Array.from({ length: s!.beams.dust * 4 }, (_, j) => (j % 4 === 3 ? Math.PI * 2 : 1) * Math.random()) })
      }
    })
    // what was hidden put back once three has drawn the scene through render3d's camera, and the calls counted
    const was = scene.onAfterRender
    hooked = { scene, was }
    scene.onAfterRender = function (renderer, sc, camera, geometry, material, group) {
      was.call(this, renderer, sc, camera, geometry, material, group)
      if (camera !== plugins.render3d.camera) return
      state.calls = renderer.info.render.calls
      state.programs = renderer.info.programs?.length ?? 0
      restore()
    }
  }

  // the place's index for a set of rooms drawn, with the rest of the place or without, made once
  const indexFor = (drawn: number[], outside: boolean) => {
    const key = `${drawn.join(',')}|${outside}`
    let got = indexes.get(key)
    if (!got) {
      const all = whole!.array as ArrayLike<number>
      const want = new Set(drawn)
      const out: number[] = []
      for (let t = 0; t < cellOf!.length; t++) {
        const c = cellOf![t]
        if (c.length ? c.some(r => want.has(r)) : outside) out.push(all[t * 3], all[t * 3 + 1], all[t * 3 + 2])
      }
      const Arr = whole!.array.constructor as Uint32ArrayConstructor
      got = new T!.BufferAttribute(new Arr(out), 1)
      indexes.set(key, got)
    }
    return got
  }

  // the planes of the view through an opening from the eye, each facing in
  const through = (o: Opening, eye: THREE.Vector3, grow: number) => {
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new T!.Vector3(...add(add(o.mid, o.across, x * (o.half[0] + grow)), o.along, y * (o.half[1] + grow))))
    const mid = new T!.Vector3(...o.mid)
    const planes = c.map((a, i) => {
      const p = new T!.Plane().setFromCoplanarPoints(eye, a, c[(i + 1) % 4])
      if (p.distanceToPoint(mid) < 0) p.negate()
      return p
    })
    // beyond the opening, away from the room
    planes.push(new T!.Plane().setFromNormalAndCoplanarPoint(new T!.Vector3(-o.inward[0], -o.inward[1], -o.inward[2]), new T!.Vector3(...add(o.mid, o.inward, -grow))))
    return planes
  }

  return {
    state: () => state,
    tick(plugins: Plugins) {
      if (started) return
      started = true
      build(plugins)
    },
    afterTick(plugins: Plugins) {
      const sky = plugins.skydome3d.light()
      const camera = plugins.render3d.camera as THREE.PerspectiveCamera | undefined
      const renderer = plugins.render3d.renderer as THREE.WebGLRenderer | undefined
      if (!sky || !camera || !T || !h || !s) return
      const now = performance.now() / 1000
      const dt = last === undefined ? 0 : now - last
      last = now
      // the sky's light, the fires' flicker, and each room's mean light again once the key has turned
      uniforms.rlSky.value.copy(sky.sky)
      uniforms.rlGround.value.copy(sky.ground)
      uniforms.rlKey.value.copy(sky.keyColor)
      uniforms.rlKeyDir.value.copy(sky.key).normalize()
      h.fires.forEach((name, i) => {
        const f = s!.fires[name]
        const flicker = f.flicker.reduce((a, [amount, rate, phase]) => a + amount * Math.sin(now * rate + phase), 1)
        fireColours[i].set(f.colour).multiplyScalar(f.gain * flicker)
      })
      const key = norm([sky.key.x, sky.key.y, sky.key.z])
      if (!keyThen || Math.acos(Math.min(1, dot(key, keyThen))) > s.resample) {
        keyThen = key
        meansInto(hintsData!, meansFirst, means(h, key, s), h.fires.length)
        hintsTex!.needsUpdate = true
      }

      // the place's cells, once world3d has built it
      const mesh = plugins.world3d.mesh() as THREE.Mesh | undefined
      if (mesh && mesh !== place) {
        place = mesh
        whole = mesh.geometry.getIndex()!
        cellOf = cells(mesh.geometry.getAttribute('position'), whole.array as ArrayLike<number>, h.rooms, s.margin)
        indexes.clear()
      }

      // where the camera stands
      const eye: V = [camera.position.x, camera.position.y, camera.position.z]
      const at = h.rooms.findIndex(r => inBox(r, eye, 0))
      const drawn = at < 0 ? [] : [at, ...h.rooms[at].joins]
      const inside = at >= 0
      camera.updateMatrixWorld()
      const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
      const views: THREE.Plane[][] = []
      if (inside) {
        for (const r of drawn) for (const o of h.rooms[r].openings) {
          if (o.other >= 0 || !(o.sky || o.beam)) continue
          const box = new T.Box3().setFromPoints(corners(o, [0, 0, 0]).map(c => new T!.Vector3(...c))).expandByScalar(s.portal)
          if (frustum.intersectsBox(box)) views.push(through(o, camera.position, s.portal))
        }
      }
      const seenOut = views.length > 0
      state = { ...state, room: inside ? h.rooms[at].name : undefined, drawn: drawn.map(r => h!.rooms[r].name), seen: seenOut, hidden: 0 }

      // the place: its drawn rooms, and the rest of it while an opening is seen
      if (place && whole) place.geometry.setIndex(inside ? indexFor(drawn, seenOut) : whole)

      // the rest of the scene
      restore()
      if (inside) {
        const boxes = drawn.map(r => h!.rooms[r])
        const sphere = new T.Sphere()
        const p: V = [0, 0, 0]
        ;(plugins.render3d.scene as THREE.Scene).traverseVisible(o => {
          const any = o as THREE.Mesh
          if (o === place || !(any.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) || !o.frustumCulled) return
          // an instanced, batched or skinned mesh has bounds of its own, round all it draws; any other its geometry's
          const bounded = o as THREE.InstancedMesh
          if ('boundingSphere' in bounded && bounded.boundingSphere === null) bounded.computeBoundingSphere()
          if (any.geometry && !any.geometry.boundingSphere) any.geometry.computeBoundingSphere()
          const own = 'boundingSphere' in bounded ? bounded.boundingSphere : any.geometry?.boundingSphere
          if (!own) return
          sphere.copy(own).applyMatrix4(o.matrixWorld)
          p[0] = sphere.center.x; p[1] = sphere.center.y; p[2] = sphere.center.z
          const within = boxes.some(b => inBox(b, p, s!.margin) && sphere.radius <= Math.hypot(b.a, b.b, b.top - b.low[1]) / 2)
          const viewed = views.some(planes => planes.every(pl => pl.distanceToPoint(sphere.center) >= -sphere.radius))
          if (within || viewed) return
          o.visible = false
          hidden.push(o)
        })
        // what the `outdoors` mods hand, while no opening is seen
        if (!seenOut) for (const f of modsOf<(plugins: Plugins) => THREE.Object3D[]>(plugins.wire.scene.world!, 'rooms', 'outdoors')) {
          for (const o of f(plugins)) if (o.visible) { o.visible = false; hidden.push(o) }
        }
        state.hidden = hidden.length
      }

      // the key light's shadow, still while inside
      const probe = plugins.skydome3d.sky()
      const keyLight = probe?.key as THREE.DirectionalLight | undefined
      if (keyLight) {
        if (inside && keyLight.shadow.autoUpdate) { keyLight.shadow.autoUpdate = false; still = keyLight }
        if (!inside && still) { still.shadow.autoUpdate = true; still.shadow.needsUpdate = true; still = undefined }
      }

      // the exposure, eased toward the room's
      k += ((inside ? 1 : 0) - k) * (1 - Math.exp(-dt * s.exposure.rate))
      if (renderer) renderer.toneMappingExposure *= 1 + (s.exposure.inside - 1) * k

      // the beams of the drawn rooms while the sun shines in
      const sunLight = Math.max(sky.sunColor.r, sky.sunColor.g, sky.sunColor.b)
      const ray: V = [-sky.sun.x, -sky.sun.y, -sky.sun.z]
      for (const b of beams) {
        const shines = drawn.includes(b.room) && sunLight > 0 && ray[1] < 0 && dot(ray, b.o.inward) > 0
        b.mesh.visible = b.points.visible = shines
        if (!shines) continue
        const floor = h.rooms[b.room].low[1]
        const corner = corners(b.o, [0, 0, 0])
        const pos = b.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
        corner.forEach((c, i) => {
          pos.setXYZ(i, c[0], c[1], c[2])
          const f = add(c, ray, (c[1] - floor) / -ray[1])
          pos.setXYZ(4 + i, f[0], f[1], f[2])
        })
        pos.needsUpdate = true
        ;(b.mesh.material as THREE.MeshBasicMaterial).opacity = s.beams.opacity * sunLight
        ;(b.points.material as THREE.PointsMaterial).opacity = Math.min(1, s.beams.opacity * sunLight * 4)
        const mp = b.points.geometry.getAttribute('position') as THREE.BufferAttribute
        const [dx, dy, dz] = s.beams.drift, [rx, ry, rz] = s.beams.rates
        for (let i = 0; i < s.beams.dust; i++) {
          const x = b.seeds[i * 4] - 0.5, y = b.seeds[i * 4 + 1] - 0.5, f = b.seeds[i * 4 + 2], ph = b.seeds[i * 4 + 3]
          const c = add(add(b.o.mid, b.o.across, x * 2 * b.o.half[0]), b.o.along, y * 2 * b.o.half[1])
          const m = add(c, ray, ((c[1] - floor) / -ray[1]) * f)
          mp.setXYZ(i, m[0] + dx * Math.sin(now * rx + ph), m[1] + dy * Math.sin(now * ry + ph * 2), m[2] + dz * Math.cos(now * rz + ph))
        }
        mp.needsUpdate = true
      }
    },
    close(plugins: Plugins) {
      restore()
      if (place && whole) place.geometry.setIndex(whole)
      if (still) { still.shadow.autoUpdate = true; still = undefined }
      if (hooked) { hooked.scene.onAfterRender = hooked.was; hooked = undefined }
      for (const b of beams) (plugins.render3d.scene as THREE.Scene | undefined)?.remove(b.mesh, b.points)
      beams = []
      indexes.clear()
      for (const m of made) m.dispose()
      made.length = 0
      started = false
      place = whole = cellOf = undefined
      h = undefined
      keyThen = undefined
    },
  }
}
