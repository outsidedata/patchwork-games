// Writes `world.motion3d.offsets` in `main.scene.json`: each clip of the yard's motions, its `beginOffset`
// and `endOffset`, where its spot stands from the point it is held to at its first frame and at its last,
// and its `beginTurn`, the way the body faces at its first frame from the way the point faces (motion3d's
// Offsets). Every number is arithmetic on what the rig measures (`xbot.rig.json`); none is tried in the
// game. The game's bake runs it once the rig is baked and the yard written (`demo_motion3d.bake.ts`):
//   node games/demo_motion3d/assets/offsets.mjs
//
// The spot is what motion3d holds on the point: the middle of the bones a motion's `ik` names to its root
// point (`plugins/zones/zones.motion3d.ts`), as anim draws them (motion3d's `spotIn`), or the root with
// none. Which one matters, and where the clip has it on its point, is the judgement each clip is given in
// `CLIPS`:
//   on: 'both'   the spot on the point from the first frame to the last: a hang, a seat, a lap of a climb
//   on: 'begin'  on the point at the first frame, going where the clip carries it: up off a lip, out of
//                a seat
//   on: 'end'    on the point at the last frame, come from where the clip starts it: up onto a lip, down
//                into a seat or onto the ground, facing the point's way then
//   on: 'face'   against the plane the clip's hands or feet are on (its `touches`' `face`), the point that
//                plane, facing `into` it or `along` it the way the spot goes: its offsets where the spot
//                stands from where it starts on the plane, at each end (for a loop, the place on the plane
//                going with it, so at each end of the lap alike), and its `normal` the plane's, out of it
//                toward the body
//   after        the root held to the point the clip `after` held, from where that clip ends the root,
//                measured against what it was
// The point's frame is motion3d's: its up the point's normal, its ahead its facing laid square to it, its
// left the third way.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const rig = JSON.parse(readFileSync(path.join(here, 'xbot.rig.json'), 'utf8'))
const sceneFile = path.join(here, '..', 'main.scene.json')
const scene = JSON.parse(readFileSync(sceneFile, 'utf8'))
const anim = scene.world.anim
const ends = rig.ends.xbot
const touches = rig.touches.xbot

const HANDS = ['LeftHand', 'RightHand']
const FEET = ['LeftFoot', 'RightFoot']
const HIPS = ['Hips']
const ROOT = []

const CLIPS = {
  // ledge, and the pool's way out
  bracedjump: { spot: HANDS, on: 'end' },
  bracedidle: { spot: HANDS, on: 'both' },
  bracedleft: { spot: HANDS, on: 'both' },
  bracedright: { spot: HANDS, on: 'both' },
  bracedclimb: { spot: HANDS, on: 'begin' },
  braceddrop: { spot: ROOT, on: 'end' },
  // bar and ceiling
  freejump: { spot: HANDS, on: 'end' },
  freeidle: { spot: HANDS, on: 'both' },
  barmove: { spot: HANDS, on: 'both' },
  barleft: { spot: HANDS, on: 'both' },
  freeleft: { spot: HANDS, on: 'both' },
  freeright: { spot: HANDS, on: 'both' },
  freedrop: { spot: ROOT, on: 'end' },
  // rope, swing, climbing wall
  ropeclimb: { spot: HANDS, on: 'both' },
  ropeswing: { spot: ROOT, on: 'begin' },
  wallclimb: { spot: [...HANDS, ...FEET], on: 'face', facing: 'into' },
  walldown: { spot: [...HANDS, ...FEET], on: 'face', facing: 'into' },
  // wall run
  wallside: { spot: FEET, on: 'face', facing: 'along' },
  land: { spot: ROOT, after: 'wallside' },
  // vault, edge, stairs
  vaultone: { spot: ROOT, on: 'begin' },
  teeter: { spot: FEET, on: 'both' },
  jumpdown: { spot: ROOT, on: 'end' },
  stairsup: { spot: ROOT, on: 'both' },
  // pool
  poolin: { spot: HIPS, on: 'end' },
  tread: { spot: HIPS, on: 'both' },
  swimunder: { spot: HIPS, on: 'both' },
  // desk, bed, car, chair
  typing: { spot: HIPS, on: 'both' },
  liedown: { spot: HIPS, on: 'end' },
  bedidle: { spot: HIPS, on: 'both' },
  carin: { spot: HIPS, on: 'end' },
  drive: { spot: HIPS, on: 'both' },
  honk: { spot: HIPS, on: 'both' },
  carout: { spot: HIPS, on: 'begin' },
  sitdown: { spot: HIPS, on: 'end' },
  seated: { spot: HIPS, on: 'both' },
  standup: { spot: HIPS, on: 'begin' },
}

const DEG = Math.PI / 180
const round = (v, k = 1000) => Math.round(v * k) / k + 0
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const scaled = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const wrap = a => a - 360 * Math.ceil((a - 180) / 360)

// A clip as anim reads it (anim's `clipOf`): its entry, its measures, its source and whether it mirrors
// it.
function clipOf(name) {
  const own = typeof rig.clips[name] === 'string' ? { file: rig.clips[name] } : rig.clips[name]
  if (!own) throw new Error(`offsets.mjs: the rig has no clip ${name}`)
  if (own.mirror === undefined) return { ...own, source: name, mirrored: false, measure: rig.table[name] }
  const src = typeof rig.clips[own.mirror] === 'string' ? { file: rig.clips[own.mirror] } : rig.clips[own.mirror]
  const m = rig.table[own.mirror]
  return { ...src, ...own, source: own.mirror, mirrored: true, measure: { ...m, left: -m.left, yaw: -m.yaw, travel: m.travel.map(([t, f, l, y]) => [t, f, -l, -y]) } }
}

// Whether anim carries a one-shot's travel, and keeps its turn (anim's `carries`).
function carries(c) {
  if (c.loop) return { carries: false, turns: false }
  const turns = Math.abs(wrap(c.measure.yaw)) >= anim.turns
  return { carries: turns || Math.hypot(c.measure.forward, c.measure.left) > anim.moves, turns }
}

// The travel curve at `t` seconds, [forward, left, turn degrees] (anim's `at`).
function curve(c, t) {
  const rows = c.measure.travel
  if (t <= rows[0][0]) return rows[0].slice(1)
  for (let i = 1; i < rows.length; i++) {
    const b = rows[i]
    if (t > b[0]) continue
    const a = rows[i - 1], u = (t - a[0]) / (b[0] - a[0])
    return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + wrap(b[3] - a[3]) * u]
  }
  return rows[rows.length - 1].slice(1)
}

// A segment's two ends in the body's frame `t` seconds in (anim's `ends`), a mirrored clip's from its
// source's other side, across x.
const SEGMENT = { Hips: 'torso', LeftHand: 'handL', RightHand: 'handR', LeftFoot: 'footL', RightFoot: 'footR' }
function endsOf(c, seg, t) {
  const e = ends[c.source]
  const rows = e[c.mirrored ? seg.replace(/[LR]$/, s => (s === 'L' ? 'R' : 'L')) : seg]
  const f = Math.min(rows.length - 1, Math.max(0, t * e.fps))
  const i = Math.floor(f), s = f - i
  const a = rows[i], b = rows[Math.min(rows.length - 1, i + 1)]
  const got = a.map((v, k) => v + (b[k] - v) * s)
  return c.mirrored ? got.map((v, k) => (k % 3 === 0 ? -v : v)) : got
}

// (f, l) metres ahead and to the left of yaw θ's facing, across the ground, as [x, y, z].
const fromBody = (yaw, v) => [v[2] * Math.sin(yaw) + v[0] * Math.cos(yaw), v[1], v[2] * Math.cos(yaw) - v[0] * Math.sin(yaw)]

// A bone's start as anim draws it in the body's frame (motion3d's `drawnAt`).
function drawnAt(c, seg, t) {
  const at = endsOf(c, seg, t)
  const how = carries(c)
  if (!how.carries) return at.slice(0, 3)
  const hips = endsOf(c, 'torso', t), rest = endsOf(c, 'torso', 0)
  const a = how.turns ? -curve(c, t)[2] * DEG : 0
  const x = at[0] - hips[0], z = at[2] - hips[2]
  return [rest[0] + x * Math.cos(a) + z * Math.sin(a), at[1], rest[2] - x * Math.sin(a) + z * Math.cos(a)]
}

// The root `t` seconds in, in the clip's frame at its start, and its turn, radians (motion3d's `rootIn`).
function rootIn(c, t) {
  const how = carries(c)
  if (!how.carries) return { at: [0, 0, 0], turn: 0 }
  const [f, l, turn] = curve(c, t)
  const scale = c.scale ?? 1
  return { at: [l * scale, 0, f * scale], turn: how.turns ? turn * DEG : 0 }
}

// The spot `t` seconds in, in the clip's frame at its start (motion3d's `spotIn`).
function spotIn(c, bones, t) {
  const { at, turn } = rootIn(c, t)
  if (!bones.length) {
    if (!c.loop) return at
    return [at[0], at[1] + endsOf(c, 'torso', t)[1] - endsOf(c, 'torso', 0)[1], at[2]]
  }
  const drawn = bones.map(b => drawnAt(c, SEGMENT[b], t))
  const mid = [0, 1, 2].map(i => drawn.reduce((s, p) => s + p[i], 0) / drawn.length)
  return add(at, fromBody(turn, mid))
}

// A point's frame facing yaw `yaw` with up `n` (motion3d's `axesOf`), in the clip's frame at its start:
// its ahead its facing laid square to its up, or, where its facing is its up, up laid square to it.
function axes(yaw, n = [0, 1, 0]) {
  const square = v => {
    const s = sub(v, scaled(n, dot(v, n)))
    const l = Math.hypot(...s)
    return l > 1e-6 ? scaled(s, 1 / l) : undefined
  }
  const z = square([Math.sin(yaw), 0, Math.cos(yaw)]) ?? square([0, 1, 0])
  return { x: [n[1] * z[2] - n[2] * z[1], n[2] * z[0] - n[0] * z[2], n[0] * z[1] - n[1] * z[0]], y: n, z }
}
const inAxes = (a, v) => [dot(v, a.x), dot(v, a.y), dot(v, a.z)]
const zero = [0, 0, 0]

// Each clip's offsets, and for one held to a plane its feet kick, where that plane stands (in the clip's
// frame at its start) and how the root ends from it, for the clip held `after` it.
const out = {}
const ended = {}
for (const [name, j] of Object.entries(CLIPS)) {
  const c = clipOf(name)
  const dur = c.measure.dur
  const P0 = spotIn(c, j.spot, 0), P1 = spotIn(c, j.spot, dur)
  if (j.on === 'both') out[name] = { beginOffset: zero, endOffset: zero, beginTurn: 0 }
  else if (j.on === 'begin') out[name] = { beginOffset: zero, endOffset: inAxes(axes(0), sub(P1, P0)), beginTurn: 0 }
  else if (j.on === 'end') {
    const turn = rootIn(c, dur).turn
    out[name] = { beginOffset: inAxes(axes(turn), sub(P0, P1)), endOffset: zero, beginTurn: -turn / DEG }
  } else if (j.on === 'face') {
    const face = touches[c.source].things?.face
    if (!face) throw new Error(`offsets.mjs: ${name} is held against the plane its feet kick, and the rig measures it none (its touches' face)`)
    const n = [Math.sin(face.normal * DEG), 0, Math.cos(face.normal * DEG)]
    // The plane's facing: into it, against its normal; or along it the way the clip runs, square to its
    // normal, toward where the spot ends.
    const way = sub(P1, P0)
    const along = sub(way, scaled(n, dot(way, n)))
    const yaw = j.facing === 'into' ? Math.atan2(-n[0], -n[2]) : Math.atan2(along[0], along[2])
    const a = axes(yaw, n)
    // The place on the plane where the spot starts, square under it.
    const on = [face.at[0], 0, face.at[1]]
    const T0 = sub(P0, scaled(n, dot(sub(P0, on), n)))
    const begin = inAxes(a, sub(P0, T0))
    out[name] = { beginOffset: begin, endOffset: c.loop ? begin : inAxes(a, sub(P1, T0)), beginTurn: -yaw / DEG, normal: n }
    const root = rootIn(c, dur)
    ended[name] = { root: inAxes(a, sub(root.at, T0)), turn: (root.turn - yaw) / DEG, axes: a, facing: root.turn, normal: n }
  } else if (j.after) {
    const was = ended[j.after]
    if (!was) throw new Error(`offsets.mjs: ${name} is held from where ${j.after} ends the root, and ${j.after} comes after it in CLIPS or ends none`)
    if (j.spot.length) throw new Error(`offsets.mjs: ${name} is held from where ${j.after} ends the root, so its spot is the root`)
    // Its spot the root, from where the clip before ends it, going where this clip carries it, the body
    // facing as that clip ends it.
    const moved = inAxes(was.axes, fromBody(was.facing, sub(P1, P0)))
    // What the clip before was measured against, in the frame this one starts in, the body as it ends it.
    const f = was.facing
    const normal = [was.normal[0] * Math.cos(f) - was.normal[2] * Math.sin(f), was.normal[1], was.normal[0] * Math.sin(f) + was.normal[2] * Math.cos(f)]
    out[name] = { beginOffset: was.root, endOffset: add(was.root, moved), beginTurn: was.turn, normal }
  } else throw new Error(`offsets.mjs: ${name} is on none of both, begin, end, face, and after none`)
}

const rounded = Object.fromEntries(Object.entries(out).map(([n, o]) => [n, {
  beginOffset: o.beginOffset.map(v => round(v)),
  endOffset: o.endOffset.map(v => round(v)),
  beginTurn: round(o.beginTurn, 100),
  ...(o.normal ? { normal: o.normal.map(v => round(v)) } : {}),
}]))
scene.world.motion3d.offsets = rounded

// The scene as it is written by hand: a value on one line where it fits in `WIDE` characters, else its
// entries a line each (yard.mjs's).
const WIDE = 150
const pretty = (v, indent = '') => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  const list = Array.isArray(v)
  const items = list ? v.map(x => pretty(x, indent + '  ')) : Object.entries(v).map(([key, x]) => `${JSON.stringify(key)}: ${pretty(x, indent + '  ')}`)
  if (!items.length) return list ? '[]' : '{}'
  const one = list ? `[${items.join(', ')}]` : `{ ${items.join(', ')} }`
  if (!one.includes('\n') && indent.length + one.length <= WIDE) return one
  return `${list ? '[' : '{'}\n${items.map(i => `${indent}  ${i}`).join(',\n')}\n${indent}${list ? ']' : '}'}`
}
writeFileSync(sceneFile, pretty(scene) + '\n')
for (const [n, o] of Object.entries(rounded)) console.log(n.padEnd(12), 'begin', JSON.stringify(o.beginOffset).padEnd(24), 'end', JSON.stringify(o.endOffset).padEnd(24), 'turn', o.beginTurn)
