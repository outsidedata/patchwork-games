// Reads what every clip of the library touches, off the skin `touches.mjs` measured, by the taxonomy in
// `touches.json`, and writes `~/troupe-collection/packs/mixamo-touches.json`:
//   node games/demo_walker/assets/touches.read.mjs [<pattern>]
// With a pattern, a regular expression matched case-blind against each clip's path, name and
// description, it reads only those clips and prints them instead of writing the file.
//
// Every place is in the clip's own space as `touches.py` measures it: metres, x the left of a body facing
// +z, y up, z ahead, its origin the hips at rest across the ground on the first frame, the floor the clip
// was made on at y = 0, each place lifted by the clip's `lift` (below). A heading is degrees from +z,
// positive left.
//
// For each clip:
//   name, description   Mixamo's, where `mixamo-roots.json` holds them (a pack's clips have its file's name)
//   case                the first of `touches.json`'s cases whose words match its name, description or
//                       file's name
//   loop, dur, frames   whether Mixamo calls it a loop, its seconds and its frames
//   travel              [left, up, ahead] metres the hips move from the first frame to the last
//   holds               every part held still, slower than PLANT m/s (a palm PRESS m/s) for at least HOLD
//                       seconds (a hand's middle GRIP seconds): `{ part, from, to, at }`, `part` a
//                       `touches.json` part and its side (`soleL`, `gripR`, `seat`, …); a pose, POSE
//                       frames or fewer, holds every part over all of it
//   floors              the levels it stands, kneels, sits or lies on: `{ y, from, to, by }`, `by` the
//                       parts held on it. A part is on a floor while it is the lowest of the parts held
//                       then that bear weight (the soles, balls, heels, knees, seat and belly; the hands
//                       reach down over edges), within LEVEL of it (the belly LIES), and the body hangs
//                       from nothing (a case `by` its grip hangs from its first grip to its last, a loop
//                       of one all the time). A sole is on it flat, its ball level with it and its ankle
//                       ANKLE over it; a ball on tiptoe, its heel raised LEVEL over it and its ankle over
//                       it (on a rung the heel stands level or hangs under). A level within LEVEL of
//                       another is the same one
//   lift                `[[t, metres], ...]`: how far the clip is raised on each frame to stand on its
//                       floor: the deepest of the soles planted within NEAR under it and the knees, seat
//                       and belly within SINKS under it (lying, kneeling and sitting on the floor sink
//                       further), filled between the frames that plant none and smoothed over SMOOTH
//                       frames, as `xbot.contacts.mjs` lifts a clip; null where it never reaches LIFT, and
//                       for a case placed by its grip (`touches.json`'s `by`), which hangs from what it
//                       holds and stands on no floor
//   things              the sizes of each thing its case needs, read by the case's `reads`, each named
//                       below; a size that could not be read is left out and a doubt says so
//   doubts              what could not be settled, each `{ t, question }`, to be answered by eye
//
// The reads:
//   grip     the hands held still over the shoulders: `grips` each `{ hand, y, at, from, to }`, `y` the
//            top of the hand (what a lip or a bar is held by), `lip` their median height, `span` how far
//            apart the two hands hold at once
//   face     the balls of the feet set STEP or more over the floor, slower than KICK m/s for KICKS frames
//            (a run up or along a wall plants a foot for 1 to 4 frames), standing on no floor the while:
//            against an upright face, `face` `{ at, heights, normal, along, under }`. Kicks spread SPREAD or
//            more across the ground lie on the wall's line, its `normal` (the way the face looks) toward
//            the body's side of it, `along` true; else the face looks back along the way the body faces
//            as it kicks. `under` how far beyond the gripping hands the face stands, along the way the
//            body faces
//   top      the floor the clip ends on, where it is a level other than the one it starts on: `top` its
//            height, and `climb` its height over the lip where there is one
//   press    the palms set on something STEP or more over the floor while the hips move ANCHOR or more,
//            each staying within SETTLE of where it was put down for HOLD seconds or more (a palm bearing
//            a vault rolls): `press` `{ hand, y, at, from, to }` each, and `over` `{ top, at, from, to }`,
//            the presses run together in time (gaps of GAP seconds or less) pressed longest, its top
//            their median height
//   swing    the hands' path while they hang over the shoulders and the body stands on no floor: a
//            circle fitted to it (least squares) in the upright plane along the way it goes is the line
//            they swing on, `swing` `{ pivot, radius, from, to }`, where it hangs from and its length; a
//            path whose circle is over STRAIGHT metres across, or hangs under it, is a line run along
//            (a zip line), `swing` `{ line: [start, end], from, to }`
//   floors   the floor it starts on and the one it ends on: `start`, `end`, and `rise`, end less start
//   rungs    the heights the balls stand on while climbing: `rungs` and their `spacing`
//   seat     the hips held low and still off the feet: `seat` `{ y, at, from, to }`, and `rear` how far
//            behind the seat's middle the body's back reaches while it sits
//   back     the torso's back held still: `back` `{ at, y, normal }`, the face it rests on
//   palms    the palms held still off the floor: `palms` `{ y, at, from, to }` each
//   belly    the torso's lowest skin at its lowest, `belly`, and whether it lies (within LIES of a floor)
//   knees    the knees held on a floor: `knees` `{ y, at, from, to }` each
//   holds    the hands held still away from the body: `points` `{ hand, at, from, to }` each
//   span     a carried thing: the hands' mean place before the body, `span` `{ apart, y, ahead }`
//   strike   the moment each foot, knee, hand and the head moves fastest: `strikes` `{ part, t, speed,
//            at }`, fastest first
//   water    where the surface stands, which the skin cannot say, so the clip's words do: under water
//            (`underwater`) UNDER over the highest the crown reaches, else SURFACE over the shoulders'
//            median height; `water` `{ under, surface, crown, shoulders }` and a doubt saying so
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const here = import.meta.dirname
const troupe = path.join(homedir(), 'troupe-collection')
const packs = path.join(troupe, 'packs')
const SKIN = path.join(packs, 'mixamo-skin')
const OUT = path.join(packs, 'mixamo-touches.json')
const taxonomy = JSON.parse(readFileSync(path.join(here, 'touches.json'), 'utf8'))
const roots = JSON.parse(readFileSync(path.join(packs, 'mixamo-roots.json'), 'utf8'))
const cases = taxonomy.cases.map(c => ({ ...c, re: new RegExp(c.words, 'i') }))

// Held still: slower than this, m/s, for at least HOLD seconds; a hand's middle for GRIP seconds, since a
// swinging arm stops for 3 frames as it turns back (`xbot.contacts.mjs`).
const PLANT = 0.35
const HOLD = 0.09
const GRIP = 0.15
// A palm bearing the body rolls and slides on what it is set on (`xbot.contacts.mjs`).
const PRESS = 1.5
// A palm set on something stays within this of where it was put down while the body goes over it,
// metres: the one-hand vault's lowest palm skin wanders 0.16 m across as the hand rolls.
const SETTLE = 0.12
// Presses no more than this apart in time are one push over one top, seconds.
const GAP = 0.2
// A sole or a ball from NEAR under the floor to FLOAT over it stands on it, metres.
const NEAR = 0.1
const FLOAT = 0.02
// A body lying or sitting on the floor sinks its torso under it by up to this, metres: Laying On Back's
// lies 0.098 under.
const SINKS = 0.2
// Two levels within this of each other are one floor; a ball within this of its heel is flat, metres.
const LEVEL = 0.03
// The balls on one rung stand within this of each other, metres: the left and the right foot's balls
// differ by up to 3 cm on the ladder climb (`xbot.contacts.mjs`'s FLAT).
const FLAT = 0.06
// A thing this far over the floor or more is raised off it, metres.
const STEP = 0.15
// The hips move at least this far while a part is held on something, metres (`xbot.contacts.mjs`).
const ANCHOR = 0.05
// A held hand within this of a knee, a thigh's middle or the hips rests on the body, metres.
const RESTS = 0.2
// A lift is smoothed over this many frames, and one that never reaches LIFT metres is none.
const SMOOTH = 5
const LIFT = 0.005
// The seat holds the hip joint under SEAT metres over the floor (standing it stands 0.98 m over it, on a
// chair 0.55, in a car's seat 0.75) for at least SITS seconds, SUPPORT metres or more off the middle of
// the feet across the ground.
const SEAT = 0.9
const SITS = 0.3
const SUPPORT = 0.25
// The torso lies when its lowest skin is within this of a floor, metres.
const LIES = 0.12
// A clip of this many frames or fewer is a pose: the Sitting Pack's and the Laying Pack's are 2.
const POSE = 5
// A foot stands flat on what holds it when its ankle stands this far or more over its sole, metres; on
// a wall the ankle stands beside the sole, not over it.
const ANKLE = 0.05
// A foot set on a wall: slower than KICK m/s for KICKS frames or more (Wall Run (2) plants each foot for
// 2 to 4 frames under 0.7 m/s); kicks spread SPREAD metres or more along the ground run along the wall.
const KICK = 1
const KICKS = 2
const SPREAD = 0.3
// The hands swing from a line (a rope, a trapeze, a zip line) whose path fits a circle of more than this
// radius as a straight line, metres.
const STRAIGHT = 20
// Where a surface swimmer's water stands: over the shoulders by this, metres; under water, over the
// crown by this.
const SURFACE = 0.05
const UNDER = 0.3

const round = (v, places = 3) => Math.round(v * 10 ** places) / 10 ** places
const r3 = p => p.map(v => round(v))
const sub = (a, b) => a.map((v, i) => v - b[i])
const len = v => Math.hypot(...v)
const mean = ps => ps[0].map((_, i) => ps.reduce((s, p) => s + p[i], 0) / ps.length)
const median = vs => { const s = [...vs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
const DEG = Math.PI / 180
const wrapDeg = a => a - 360 * Math.ceil((a - 180) / 360)
const meanDeg = as => Math.atan2(as.reduce((s, a) => s + Math.sin(a * DEG), 0), as.reduce((s, a) => s + Math.cos(a * DEG), 0)) / DEG
// The way a line from a body's right to its left faces, degrees from +z, positive left.
const square = (l, r) => { const d = sub(l, r); return Math.atan2(-d[2], d[0]) / DEG }

// What a clip is called, and the words its case is chosen by: a pack's clips all carry Mixamo's word on
// the whole pack (its description lists every clip), so they go by their file's name.
function wordsOf(file) {
  const e = roots[file] ?? {}
  const base = path.basename(file, path.extname(file)).replace(/\s*\(\d+\)$/, '')
  const pack = (e.description ?? '').split(',').length > 3
  return pack || !e.name ? { name: base, description: null, text: base } : { name: e.name, description: e.description, text: `${e.name} | ${e.description} | ${base}` }
}

// Runs of frames where `keep(f)` holds, at least `min` frames long; a loop's run may go round its end.
function runs(n, loop, keep, min) {
  const out = []
  let start = -1
  for (let f = 0; f <= n; f++) {
    const on = keep(f)
    if (on && start < 0) start = f
    if ((!on || f === n) && start >= 0) {
      out.push([start, on ? f : f - 1])
      start = -1
    }
  }
  if (loop && out.length > 1 && out[0][0] === 0 && out[out.length - 1][1] === n) {
    const last = out.pop()
    out[0] = [last[0], out[0][1] + n]
  }
  return out.filter(([s, e]) => e - s + 1 >= min)
}

// The lift on each frame: the lowest planted sole's depth under the floor, filled between and smoothed
// (`xbot.contacts.mjs`'s, with nothing raised).
function liftOf(n, loop, ground) {
  const known = ground.flatMap((v, f) => (v === undefined ? [] : [f]))
  if (!known.length) return null
  const fill = Array(n + 1)
  for (const f of known) fill[f] = ground[f]
  const first = known[0], last = known[known.length - 1]
  for (let f = 0; f <= n; f++) {
    if (fill[f] !== undefined) continue
    if (f > first && f < last) {
      const a = known.filter(k => k < f).pop(), b = known.find(k => k > f)
      fill[f] = fill[a] + ((fill[b] - fill[a]) * (f - a)) / (b - a)
    } else if (loop && n > 0) {
      const a = last, b = first + n, g = f < first ? f + n : f
      fill[f] = fill[a] + ((fill[first] - fill[a]) * (g - a)) / Math.max(1, b - a)
    } else fill[f] = f < first ? fill[first] : fill[last]
  }
  const half = (SMOOTH - 1) / 2
  const out = fill.map((_, f) => {
    let sum = 0, count = 0
    for (let k = f - half; k <= f + half; k++) {
      const g = loop && n > 0 ? ((k % n) + n) % n : Math.max(0, Math.min(n, k))
      sum += fill[g]
      count++
    }
    return sum / count
  })
  if (loop) out[n] = out[0]
  return Math.max(...out.map(Math.abs)) >= LIFT ? out : null
}

// The parts of one frame of the skin file, by `touches.json`'s names and their sides.
function partsOf(s, f) {
  const j = s.joints[f]
  const at = k => j.slice(k * 3, k * 3 + 3)
  return {
    soleL: s.soleL[f], soleR: s.soleR[f], ballL: s.ballL[f], ballR: s.ballR[f], heelL: s.heelL[f], heelR: s.heelR[f],
    handL: s.handL[f].slice(0, 3), handR: s.handR[f].slice(0, 3),
    palmL: s.handL[f].slice(3, 6), palmR: s.handR[f].slice(3, 6),
    gripL: s.handL[f].slice(6, 9), gripR: s.handR[f].slice(6, 9),
    forearmL: s.forearmL[f], forearmR: s.forearmR[f], kneeL: s.shinL[f], kneeR: s.shinR[f],
    seat: s.seat[f], back: s.back[f], front: s.front[f], belly: s.low[f], head: s.head[f].slice(0, 3), crown: s.head[f].slice(3, 6),
    hips: at(0), hipL: at(1), hipR: at(2), shoulderL: at(3), shoulderR: at(4), jointKneeL: at(5), jointKneeR: at(6), ankleL: at(7), ankleR: at(8),
  }
}

const HELD = ['soleL', 'soleR', 'ballL', 'ballR', 'heelL', 'heelR', 'handL', 'handR', 'palmL', 'palmR', 'gripL', 'gripR', 'forearmL', 'forearmR', 'kneeL', 'kneeR', 'seat', 'back', 'belly']

export function read(file, s) {
  const words = wordsOf(file)
  const kase = cases.find(c => c.re.test(words.text))
  const e = roots[file] ?? {}
  const loop = !!e.loop
  const n = s.frames - 1
  const fps = s.fps
  const raw = Array.from({ length: n + 1 }, (_, f) => partsOf(s, f))
  const sec = f => round(f / fps)
  const doubts = []
  const byGrip = kase.by === 'grip'

  // ---- holds, first as measured, for the lift
  const holdsOf = frames => {
    const at = (part, f) => frames[((f % (n + 1)) + (n + 1)) % (n + 1)][part]
    // A pose (POSE frames or fewer) is the body held still: every part is held over all of it.
    if (n + 1 <= POSE) return HELD.map(part => ({ part, s: 0, e: n, at: mean(frames.map(fr => fr[part])), moved: 0 }))
    const speed = (part, f) => {
      if (n === 0) return 0
      const p = loop ? f - 1 : Math.max(0, f - 1), q = loop ? f + 1 : Math.min(n, f + 1)
      const a = at(part, p), b = at(part, q)
      return (len(sub(b, a)) * fps) / (q - p)
    }
    const out = []
    for (const part of HELD) {
      const min = Math.ceil((part.startsWith('hand') || part.startsWith('grip') ? GRIP : HOLD) * fps - 1e-9)
      const still = part.startsWith('palm') ? PRESS : PLANT
      for (const [a, b] of runs(n, loop, f => speed(part, f) < still, min)) {
        const ps = [], hips = []
        for (let f = a; f <= b; f++) { ps.push(at(part, f)); hips.push(at('hips', f)) }
        let moved = 0
        for (const h of hips) moved = Math.max(moved, len(sub(h, hips[0])))
        out.push({ part, s: a, e: b, at: mean(ps), moved })
      }
    }
    return out
  }

  // ---- the lift, off the soles planted on the floor
  let lift = null
  if (!byGrip) {
    const ground = Array(n + 1).fill(undefined)
    // The soles planted on the floor, and the knees, the seat and the torso a body kneels, sits or lies
    // on it by, which sink further: the deepest of them on each frame is stood on the floor.
    const measured = holdsOf(raw)
    const planted = measured.filter(h => (h.part.startsWith('sole') && h.at[1] > -NEAR && h.at[1] < FLOAT) ||
      (['kneeL', 'kneeR', 'seat', 'belly'].includes(h.part) && h.at[1] > -SINKS && h.at[1] < FLOAT))
    for (const h of planted) {
      for (let f = h.s; f <= h.e; f++) {
        const g = loop && n > 0 ? f % n : f
        const y = raw[g][h.part][1]
        ground[g] = ground[g] === undefined ? -y : Math.max(ground[g], -y)
      }
    }
    lift = liftOf(n, loop, ground)
  }
  const liftAt = f => (lift ? lift[Math.max(0, Math.min(n, f))] : 0)
  const frames = raw.map((p, f) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [v[0], v[1] + liftAt(f), v[2]]])))
  const at = (part, f) => frames[((f % (n + 1)) + (n + 1)) % (n + 1)][part]
  const facing = frames.map(fr => square(fr.hipL, fr.hipR))
  const holds = holdsOf(frames)

  // ---- what the hands hold overhead: a body that hangs from them stands on no floor while it does
  const overhead = holds.filter(h => {
    if (!h.part.startsWith('grip')) return false
    const mid = Math.round((h.s + h.e) / 2)
    return h.at[1] > Math.max(at('shoulderL', mid)[1], at('shoulderR', mid)[1])
  })
  // A case placed by its grip hangs from its hands from its first grip to its last, its hands taking
  // turns (a loop of it all the time). No other case hangs: hands held over the shoulders there hold a
  // rifle up, cheer or reach, and the feet bear the body.
  const gripFrom = overhead.length ? Math.min(...overhead.map(h => h.s)) : Infinity
  const gripTo = overhead.length ? Math.max(...overhead.map(h => h.e)) : -Infinity
  const hanging = f => byGrip && overhead.length > 0 && (loop || (f >= gripFrom && f <= gripTo))
  // A sole held flat on what holds it: its ball level with it and its ankle over it.
  const flat = h => {
    const side = h.part.slice(-1)
    const span = Array.from({ length: h.e - h.s + 1 }, (_, i) => h.s + i)
    const ball = mean(span.map(f => at('ball' + side, f)))
    const ankle = mean(span.map(f => at('ankle' + side, f)))
    return Math.abs(ball[1] - h.at[1]) <= LEVEL && ankle[1] - h.at[1] >= ANKLE
  }

  // ---- floors: the levels the feet stand flat on, the knees kneel on, the seat sits on and the torso lies
  // on, each while it is the lowest of the parts the body bears its weight on that are held still then
  // (the hands left out, which reach down over an edge), and the body hangs from nothing
  const BEARS = ['soleL', 'soleR', 'ballL', 'ballR', 'heelL', 'heelR', 'kneeL', 'kneeR', 'seat', 'belly']
  // A ball stood on (on tiptoe, crouched): its ankle over it and its heel raised LEVEL or more over it;
  // on a rung the heel stands level with the ball or hangs under it, and a flat foot is its sole's.
  const tiptoe = h => {
    const side = h.part.slice(-1)
    const span = Array.from({ length: h.e - h.s + 1 }, (_, i) => h.s + i)
    const heel = mean(span.map(f => at('heel' + side, f)))
    const ankle = mean(span.map(f => at('ankle' + side, f)))
    return heel[1] - h.at[1] >= LEVEL && ankle[1] - h.at[1] >= ANKLE
  }
  const lowest = Array(n + 1).fill(Infinity)
  for (const h of holds.filter(h => BEARS.includes(h.part))) {
    for (let f = h.s; f <= h.e; f++) {
      const g = f % (n + 1)
      lowest[g] = Math.min(lowest[g], at(h.part, g)[1])
    }
  }
  const footed = holds.filter(h => {
    if (!BEARS.includes(h.part)) return false
    let above = 0, hung = 0
    for (let f = h.s; f <= h.e; f++) {
      above += at(h.part, f)[1] - lowest[f % (n + 1)]
      if (hanging(f % (n + 1))) hung++
    }
    if (hung > (h.e - h.s + 1) / 2 || above / (h.e - h.s + 1) > (h.part === 'belly' ? LIES : LEVEL)) return false
    if (h.part.startsWith('sole')) return flat(h)
    if (h.part.startsWith('ball')) return tiptoe(h)
    return h.part.startsWith('knee') || h.part === 'belly' || h.part === 'seat'
  })
  const floors = []
  for (const h of [...footed].sort((a, b) => a.s - b.s)) {
    const f = floors.find(l => Math.abs(l.y - h.at[1]) <= LEVEL)
    if (f) { f.ys.push(h.at[1]); f.from = Math.min(f.from, h.s); f.to = Math.max(f.to, h.e); f.by.add(h.part.replace(/[LR]$/, '')) }
    else floors.push({ y: h.at[1], ys: [h.at[1]], from: h.s, to: h.e, by: new Set([h.part.replace(/[LR]$/, '')]) })
  }
  for (const f of floors) f.y = median(f.ys)
  const floorAt = f => floors.filter(l => l.from <= f && l.to >= f).sort((a, b) => a.y - b.y)[0]
  const startFloor = floors.find(l => l.from <= Math.max(2, Math.round(0.1 * fps)))
  const endFloor = [...floors].reverse().find(l => l.to >= n - Math.max(2, Math.round(0.1 * fps)))
  const floorY = startFloor ? startFloor.y : 0

  // ---- the reads
  const things = {}
  const want = new Set(kase.reads)
  const holdsOn = prefix => holds.filter(h => h.part.startsWith(prefix))
  const span = h => ({ from: sec(h.s), to: sec(Math.min(h.e, n)) })

  if (want.has('grip')) {
    const grips = overhead
    if (grips.length) {
      const both = []
      for (const a of grips.filter(h => h.part === 'gripL')) for (const b of grips.filter(h => h.part === 'gripR')) {
        const s0 = Math.max(a.s, b.s), e0 = Math.min(a.e, b.e)
        if (e0 >= s0) both.push(len(sub(a.at, b.at)))
      }
      things.grips = grips.map(h => ({ hand: h.part.slice(-1), y: round(h.at[1]), at: [round(h.at[0]), round(h.at[2])], ...span(h) }))
      things.lip = round(median(grips.map(h => h.at[1])))
      if (both.length) things.span = round(median(both))
    }
  }

  if (want.has('face')) {
    // A ball set STEP or more over the floor the clip started on, slower than KICK m/s for KICKS frames or
    // more (a run up or along a wall plants each foot for 1 to 4 frames), its foot standing on no floor
    // the while: set against an upright face.
    const kicks = []
    for (const part of ['ballL', 'ballR']) {
      const v = f => { const a = Math.max(0, f - 1), b = Math.min(n, f + 1); return len(sub(at(part, b), at(part, a))) * fps / Math.max(1, b - a) }
      for (const [s0, e0] of runs(n, loop, f => v(Math.min(f, n)) < KICK && at(part, f)[1] - floorY >= STEP, KICKS)) {
        if (footed.some(o => o.part === 'sole' + part.slice(-1) && o.s <= e0 && o.e >= s0)) continue
        kicks.push({ part, s: s0, e: e0, at: mean(Array.from({ length: e0 - s0 + 1 }, (_, i) => at(part, s0 + i))) })
      }
    }
    if (kicks.length) {
      const c = mean(kicks.map(k => k.at))
      // Kicks spread along the ground lie on the wall's line, the body on one side of it; else the face
      // looks back along the way the body faces as it kicks.
      const xs = kicks.map(k => [k.at[0] - c[0], k.at[2] - c[2]])
      const sxx = xs.reduce((s, p) => s + p[0] * p[0], 0), szz = xs.reduce((s, p) => s + p[1] * p[1], 0), sxz = xs.reduce((s, p) => s + p[0] * p[1], 0)
      const theta = 0.5 * Math.atan2(2 * sxz, sxx - szz)
      const along = [Math.cos(theta), Math.sin(theta)]
      const spread = Math.max(...xs.map(p => p[0] * along[0] + p[1] * along[1])) - Math.min(...xs.map(p => p[0] * along[0] + p[1] * along[1]))
      let normal
      if (spread >= SPREAD) {
        const hips = mean(kicks.map(k => at('hips', Math.round((k.s + k.e) / 2))))
        let nx = -along[1], nz = along[0]
        if ((hips[0] - c[0]) * nx + (hips[2] - c[2]) * nz < 0) { nx = -nx; nz = -nz }
        normal = Math.atan2(nx, nz) / DEG
      } else normal = wrapDeg(meanDeg(kicks.map(k => facing[Math.round((k.s + k.e) / 2) % (n + 1)])) + 180)
      const way = wrapDeg(normal + 180)
      things.face = { at: [round(c[0]), round(c[2])], heights: kicks.map(k => round(k.at[1])).sort((a, b) => a - b), normal: round(normal, 1), along: spread >= SPREAD, from: sec(Math.min(...kicks.map(k => k.s))), to: sec(Math.min(n, Math.max(...kicks.map(k => k.e)))) }
      if (things.grips) {
        const g = mean(things.grips.map(gg => [gg.at[0], 0, gg.at[1]]))
        const dir = [Math.sin(way * DEG), 0, Math.cos(way * DEG)]
        things.face.under = round((c[0] - g[0]) * dir[0] + (c[2] - g[2]) * dir[2])
      }
    } else doubts.push({ t: null, question: 'its case sets the feet on a wall, and no foot is held still off the floor without standing on one: where is the wall?' })
  }

  if (want.has('top') || want.has('floors')) {
    if (startFloor) things.start = round(startFloor.y)
    if (endFloor) things.end = round(endFloor.y)
    if (startFloor && endFloor) things.rise = round(endFloor.y - startFloor.y)
    if (want.has('top') && endFloor && (!startFloor || Math.abs(endFloor.y - startFloor.y) >= STEP)) {
      things.top = round(endFloor.y)
      if (things.lip !== undefined) things.climb = round(endFloor.y - things.lip)
    }
  }

  if (want.has('press')) {
    // A palm set on something rolls as the body goes over it: it is set where it stays within SETTLE of
    // where it was put down for HOLD seconds or more, whatever its speed.
    const settled = []
    for (const part of ['palmL', 'palmR']) {
      let a = 0
      while (a <= n) {
        let b = a
        while (b + 1 <= n && len(sub(at(part, b + 1), at(part, a))) <= SETTLE) b++
        if (b - a + 1 >= Math.ceil(HOLD * fps)) {
          const ps = Array.from({ length: b - a + 1 }, (_, i) => at(part, a + i))
          let moved = 0
          for (let f = a; f <= b; f++) moved = Math.max(moved, len(sub(at('hips', f), at('hips', a))))
          settled.push({ part, s: a, e: b, at: mean(ps), moved })
          a = b + 1
        } else a++
      }
    }
    const presses = settled.filter(h => h.moved >= ANCHOR && h.at[1] - floorY >= STEP)
    if (presses.length) {
      things.press = presses.map(h => ({ hand: h.part.slice(-1), y: round(h.at[1]), at: [round(h.at[0]), round(h.at[2])], ...span(h) }))
      // The top the hands go over: the presses run together in time (no gap over GAP seconds), the run
      // pressed longest, its height the median of its presses weighed by their frames.
      const sorted = [...presses].sort((a, b) => a.s - b.s)
      const groups = [[sorted[0]]]
      for (const h of sorted.slice(1)) {
        const g = groups[groups.length - 1]
        if (h.s - Math.max(...g.map(x => x.e)) <= GAP * fps) g.push(h)
        else groups.push([h])
      }
      const frames = g => g.reduce((s, h) => s + h.e - h.s + 1, 0)
      const best = groups.reduce((a, b) => (frames(b) > frames(a) ? b : a))
      const ys = best.flatMap(h => Array(h.e - h.s + 1).fill(h.at[1]))
      const c = mean(best.map(h => h.at))
      things.over = { top: round(median(ys)), at: [round(c[0]), round(c[2])], from: sec(best[0].s), to: sec(Math.min(n, Math.max(...best.map(h => h.e)))) }
    }
    else if (kase.reads[0] === 'press') doubts.push({ t: null, question: 'its case sets the hands on a top, and no palm is set on anything over the floor: what does it go over?' })
  }
  if (want.has('swing')) {
    // The hands' path while they hang overhead and the body stands on nothing: a circle through it in
    // the upright plane along the way they go is the line they swing on, its middle where it hangs from
    // and its radius its length; a path too straight for one is a line run along (a zip line).
    const path = []
    for (let f = 0; f <= n; f++) {
      const fr = frames[f]
      const top = mean([fr.gripL, fr.gripR])
      if (top[1] > Math.max(fr.shoulderL[1], fr.shoulderR[1]) && !footed.some(h => h.s <= f && h.e >= f)) path.push({ f, p: top })
    }
    if (path.length >= Math.ceil(GRIP * fps)) {
      const a = path[0].p, b = path[path.length - 1].p
      const run = Math.hypot(b[0] - a[0], b[2] - a[2])
      const dir = run > 1e-6 ? [(b[0] - a[0]) / run, (b[2] - a[2]) / run] : [0, 1]
      const pts = path.map(({ p }) => [(p[0] - a[0]) * dir[0] + (p[2] - a[2]) * dir[1], p[1]])
      // The circle through the points by least squares (Kåsa's): x² + y² + D x + E y + F = 0.
      let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0
      for (const [x, y] of pts) {
        const z = x * x + y * y
        sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; sxz += x * z; syz += y * z; sz += z
      }
      const m = pts.length
      const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, m]], B = [-sxz, -syz, -sz]
      const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
      const d = det(A)
      const col = (i) => A.map((row, k) => row.map((v, j) => (j === i ? B[k] : v)))
      const [D, E, F] = Math.abs(d) > 1e-12 ? [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d] : [NaN, NaN, NaN]
      const cx = -D / 2, cy = -E / 2, radius = Math.sqrt(cx * cx + cy * cy - F)
      const span = { from: sec(path[0].f), to: sec(path[path.length - 1].f) }
      if (Number.isFinite(radius) && radius <= STRAIGHT && cy > Math.max(...pts.map(p => p[1]))) {
        things.swing = { pivot: [round(a[0] + dir[0] * cx), round(cy), round(a[2] + dir[1] * cx)], radius: round(radius), ...span }
      } else {
        things.swing = { line: [r3(a), r3(b)], ...span }
      }
    }
  }

  if (want.has('grip') && !things.grips && !things.press && !things.swing) doubts.push({ t: null, question: 'its case holds something, and no hand is held over the shoulders or set on a top: what does it hold?' })

  if (want.has('rungs')) {
    // The balls held off the floor, on rungs, but where the sole of the same foot stands flat on a floor
    // the while (the ladder's top, `xbot.contacts.mjs`'s rule). A loop climbs `lap` metres a lap, so a
    // height and that height a lap up are one rung: the heights are folded into one lap first.
    const balls = holds.filter(h => h.part.startsWith('ball') && h.at[1] - floorY >= STEP &&
      !footed.some(o => o.part === 'sole' + h.part.slice(-1) && o.s <= h.e && o.e >= h.s))
    const lap = loop ? at('hips', n)[1] - at('hips', 0)[1] : 0
    const base = balls.length ? Math.min(...balls.map(h => h.at[1])) : 0
    const fold = y => (lap > STEP ? base + ((((y - base) % lap) + lap) % lap) : y)
    const clusters = []
    for (const y of balls.map(h => fold(h.at[1])).sort((a, b) => a - b)) {
      const near = clusters.find(k => Math.abs(median(k) - y) <= FLAT)
      const wrapped = lap > STEP && clusters.find(k => Math.abs(median(k) + lap - y) <= FLAT)
      if (near) near.push(y)
      else if (wrapped) wrapped.push(y - lap)
      else clusters.push([y])
    }
    const heights = clusters.map(median).sort((a, b) => a - b)
    if (heights.length >= 2 || (lap > STEP && heights.length)) {
      const steps = lap > STEP ? heights.map((v, i) => (i + 1 < heights.length ? heights[i + 1] - v : heights[0] + lap - v)) : heights.slice(1).map((v, i) => v - heights[i])
      things.rungs = heights.map(v => round(v))
      if (lap > STEP) things.lap = round(lap)
      things.spacing = round(median(steps))
    } else doubts.push({ t: null, question: 'its case climbs rungs, and the balls stand on fewer than two heights off the floor' })
  }

  if (want.has('seat')) {
    const seats = []
    // The hips steady in height (a seat that moves, a wheelchair's or a car's, carries them across the
    // ground), low, and off the feet.
    const rises = f => { const a = Math.max(0, f - 1), b = Math.min(n, f + 1); return Math.abs(at('hips', b)[1] - at('hips', a)[1]) * fps / Math.max(1, b - a) }
    for (const [a, b] of runs(n, loop, f => rises(Math.min(f, n)) < PLANT && at('hips', f)[1] - floorY < SEAT, Math.min(n + 1, Math.ceil(SITS * fps)))) {
      const mid = Math.round((a + b) / 2) % (n + 1)
      const fr = frames[mid]
      const feet = mean([fr.soleL, fr.soleR])
      const off = Math.hypot(fr.hips[0] - feet[0], fr.hips[2] - feet[2])
      const seatY = mean(Array.from({ length: Math.min(b, n) - a + 1 }, (_, i) => at('seat', a + i)))
      if (off < SUPPORT && seatY[1] - floorY > STEP) continue
      const way = facing[mid]
      const dir = [Math.sin(way * DEG), 0, Math.cos(way * DEG)]
      let rear = Infinity
      for (let f = a; f <= Math.min(b, n); f++) rear = Math.min(rear, (at('back', f)[0] - seatY[0]) * dir[0] + (at('back', f)[2] - seatY[2]) * dir[2])
      seats.push({ y: round(seatY[1]), at: [round(seatY[0]), round(seatY[2])], facing: round(way, 1), rear: round(-rear), from: sec(a), to: sec(Math.min(b, n)) })
    }
    if (seats.length) things.seat = seats
    else doubts.push({ t: null, question: 'its case sits, and the hips are never held low and still off the feet' })
  }

  if (want.has('back')) {
    const backs = holdsOn('back').filter(h => (h.e - h.s) / fps >= SITS)
    if (backs.length) things.back = backs.map(h => { const mid = Math.round((h.s + h.e) / 2) % (n + 1); return { y: round(h.at[1]), at: [round(h.at[0]), round(h.at[2])], normal: round(facing[mid], 1), ...span(h) } })
  }

  if (want.has('palms')) {
    const palms = holdsOn('palm').filter(h => h.at[1] - floorY >= STEP && h.moved < ANCHOR * 4)
    if (palms.length) things.palms = palms.map(h => ({ hand: h.part.slice(-1), y: round(h.at[1]), at: [round(h.at[0]), round(h.at[2])], ...span(h) }))
  }

  if (want.has('belly')) {
    let low = Infinity, lowF = 0
    for (let f = 0; f <= n; f++) if (at('belly', f)[1] < low) { low = at('belly', f)[1]; lowF = f }
    const floorUnder = floorAt(lowF)
    things.belly = round(low)
    things.lies = low - (floorUnder ? floorUnder.y : floorY) <= LIES
    if (kase.case === 'bed') {
      const feetDown = holds.some(h => h.part.startsWith('sole') && Math.abs(h.at[1] - floorY) < FLOAT && h.s <= lowF && h.e >= lowF)
      if (!feetDown && low - floorY > STEP) things.bed = round(low)
    }
  }

  if (want.has('knees')) {
    const knees = holdsOn('knee').filter(h => floors.some(l => Math.abs(l.y - h.at[1]) <= LEVEL))
    if (knees.length) things.knees = knees.map(h => ({ side: h.part.slice(-1), y: round(h.at[1]), at: [round(h.at[0]), round(h.at[2])], ...span(h) }))
  }

  if (want.has('holds')) {
    const points = holdsOn('hand').filter(h => {
      const mid = Math.round((h.s + h.e) / 2) % (n + 1)
      const fr = frames[mid]
      const body = [fr.jointKneeL, fr.jointKneeR, mean([fr.hipL, fr.jointKneeL]), mean([fr.hipR, fr.jointKneeR]), fr.hips]
      return Math.min(...body.map(b => len(sub(h.at, b)))) >= RESTS && h.at[1] - floorY > LEVEL
    })
    if (points.length) things.points = points.map(h => ({ hand: h.part.slice(-1), at: r3(h.at), ...span(h) }))
  }

  if (want.has('span')) {
    const rel = []
    for (let f = 0; f <= n; f++) {
      const fr = frames[f]
      const way = facing[f] * DEG
      const toBody = p => { const d = sub(p, fr.hips); return [d[0] * Math.cos(way) - d[2] * Math.sin(way), p[1], d[0] * Math.sin(way) + d[2] * Math.cos(way)] }
      rel.push([toBody(fr.handL), toBody(fr.handR)])
    }
    things.span = { apart: round(median(rel.map(([a, b]) => len(sub(a, b))))), y: round(median(rel.map(([a, b]) => (a[1] + b[1]) / 2))), ahead: round(median(rel.map(([a, b]) => (a[2] + b[2]) / 2))) }
  }

  if (want.has('strike')) {
    const strikes = []
    for (const part of ['ballL', 'ballR', 'kneeL', 'kneeR', 'handL', 'handR', 'head']) {
      let best = 0, bestF = 0
      for (let f = 1; f < n; f++) {
        const v = len(sub(at(part, f + 1), at(part, f - 1))) * fps / 2
        if (v > best) { best = v; bestF = f }
      }
      strikes.push({ part, t: sec(bestF), speed: round(best, 2), at: r3(at(part, bestF)) })
    }
    things.strikes = strikes.sort((a, b) => b.speed - a.speed)
  }

  if (want.has('water')) {
    // The skin does not say where the water stands, so the clip's words do: under water, UNDER over the
    // highest the crown reaches; else on it, SURFACE over the shoulders' middle height, where a swimmer
    // or a treader holds the head clear.
    const crowns = frames.map(fr => fr.crown[1])
    const shoulders = frames.map(fr => (fr.shoulderL[1] + fr.shoulderR[1]) / 2)
    const under = /underwater|under water/i.test(words.text)
    things.water = { under, surface: round(under ? Math.max(...crowns) + UNDER : median(shoulders) + SURFACE), crown: [round(Math.min(...crowns)), round(Math.max(...crowns))], shoulders: [round(Math.min(...shoulders)), round(Math.max(...shoulders))] }
    doubts.push({ t: null, question: `the surface is set by the clip's words (${under ? 'under water' : 'on it'}), not measured: does the body stand in the water so?` })
  }

  const first = frames[0].hips, last = frames[n].hips
  return {
    name: words.name, description: words.description, case: kase.case, loop, dur: round(n / fps), frames: n + 1,
    travel: r3(sub(last, first)),
    holds: holds.map(h => ({ part: h.part, ...span(h), at: r3(h.at) })),
    floors: floors.map(l => ({ y: round(l.y), from: sec(l.from), to: sec(Math.min(l.to, n)), by: [...l.by] })),
    lift: lift ? lift.map((v, f) => [sec(f), round(v)]) : null,
    things, doubts,
  }
}

if (process.argv[1] === import.meta.filename) {
  const pattern = process.argv[2] ? new RegExp(process.argv[2], 'i') : null
  const files = Object.keys(roots).filter(f => existsSync(path.join(SKIN, f + '.json')))
  const out = {}
  const counts = {}
  for (const file of files) {
    if (pattern && !pattern.test(file) && !pattern.test(roots[file].name ?? '') && !pattern.test(roots[file].description ?? '')) continue
    const s = JSON.parse(readFileSync(path.join(SKIN, file + '.json'), 'utf8'))
    if (s.error) { out[file] = { error: s.error }; continue }
    out[file] = read(file, s)
    counts[out[file].case] = (counts[out[file].case] ?? 0) + 1
  }
  if (pattern) {
    for (const [file, c] of Object.entries(out)) {
      console.log(`\n== ${file}\n   ${c.name} | ${c.description ?? ''} → ${c.case}  (${c.dur}s${c.loop ? ' loop' : ''}, travel ${c.travel})`)
      console.log(`   floors ${c.floors.map(l => `${l.y}@${l.from}-${l.to}[${l.by}]`).join(' ')}${c.lift ? `  lift ${Math.min(...c.lift.map(r => r[1]))}..${Math.max(...c.lift.map(r => r[1]))}` : ''}`)
      console.log(`   things ${JSON.stringify(c.things)}`)
      for (const d of c.doubts) console.log(`   ? ${d.question}`)
    }
  } else {
    writeFileSync(OUT, JSON.stringify({ taxonomy: 'games/demo_walker/assets/touches.json', clips: out }) + '\n')
    console.log(`wrote ${path.relative(troupe, OUT)}: ${Object.keys(out).length} clips`)
  }
  console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
}
