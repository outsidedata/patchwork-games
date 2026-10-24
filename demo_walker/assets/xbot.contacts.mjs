// What every clip of the X Bot's rig does with its body, read off where its skin is on every frame
// (`xbot.contacts.py`, which measures the clips as they are in their FBX files, with no sidecar laid
// on), the bone ends the bake measured (`xbot.rig.json`'s `ends`) and the clips' names. Written to
// `xbot.contacts.json` beside it, and each clip's lift to its sidecar beside its FBX (anim's export,
// `plugins/anim/anim.export.py`, lays a sidecar's offset onto the clip as it bakes it). The game's bake
// runs it (`demo_walker.bake.ts`):
//   node games/demo_walker/assets/xbot.contacts.mjs <skin.json>
//
// Every place is in the clip's own space, metres, glTF's axes (x left of a body facing +z, y up, z
// ahead), its origin the hips at rest across the ground on the first frame, the floor the clip was made
// on at y = 0. Anim draws a clip placed rigidly in the world: wherever it starts the root and whichever
// way it faces it then, every point of the clip stands at that start plus the clip's own place of it
// turned by that facing, a turn the clip makes and its travel included. So what is measured here is
// where the clip needs the things it touches, and a game stands the clip on them by that start and
// facing alone. The bone ends are drawn with the hips' steady progress taken off, so each is first put
// back: the table's `left` and `forward` at its end, times how far into the clip the frame is. They are
// the last bake's, with the lift it laid on, so only the ways the body faces and moves are read off
// them; every height is read off the skin, which is measured with no sidecar laid on, and lifted here.
// The last bake also laid on each clip's turn, so the bone ends and the table's travel are first turned
// back by the turn its sidecar holds now, and every clip is read as its FBX has it.
//
// The game's cover clips are turned (each its sidecar's `offset.rotation`, one row), since anim and the
// game's moves take a clip's +z as the way its body faces, and these were made facing elsewhere: the
// clips of `demo_walker.json`'s `player.moves.cover` (`in`, `out`, `lowIn`, `lowOut`; their mirrors are
// their sources turned the other way) so the body faces +z on their first frame, and the clips of the
// two stances its `stand` and `crouch` name (the rig's `cover` and `low`), each idle so the body faces
// +z over its lap and each gear so it travels the way its `gear` says. Every place below is of the clip turned, about the
// hips on its first frame, as the export turns it about the clip's origin, where those stand.
//
// For each clip:
//   turned    degrees, positive left, its sidecar turns it by (the cover clips, above), 0 for none
//   hints     the words of its rig name and its file's name that say what it does (`ladder`, `sit`, ...)
//   lap       a loop's progress [x, y, z] over one lap: across the ground the table's, up what its hips
//             climb (a ladder's); null for a one-shot
//   facing    the way the body faces on each frame, degrees from +z, positive left, read off the line
//             between the hip joints; `faces` read off the hip joints and the shoulders, a loop's over its
//             lap and a one-shot's on its first frame; `travels` the way a loop that travels goes;
//             `turn` the hip joints' whole turn from the first frame to the last, and `hipsTurn` the
//             table's, read off the hips' own axis, which a roll or a lean can flip
//   plants    each patch of skin held still, slower than PLANT m/s (a palm PRESS m/s) for at least
//             HOLD s (a hand's middle GRIP s): `point` (`soleL`, `ballL`, `handL`, `palmL` the hand's skin within LOW of its
//             lowest, ...), `from` and `to` seconds, `at` its mean place, and `on`:
//               `ground`        a sole, a ball or a palm from NEAR under the floor to FLOAT over it
//               `rung`          in a clip whose name says ladder, a ball held off the floor whose sole
//                               does not stand flat on a raised floor the while (the ladder's top)
//               `wall`          in any other clip, a ball held over its sole by more than LEVEL, its
//                               heel hanging, STEP or more off the floor while the hips move ANCHOR or
//                               more: a foot kicked against a wall
//               `raised floor`  a sole held STEP or more off the floor with its ball within LEVEL of its
//                               height, in a clip whose name says it is not in the air
//               `hold`          a hand's middle held while the hips move ANCHOR or more about it, not
//                               within RESTS of a knee, a thigh or the hips: a grip
//               `ledge`         in a clip whose name says it goes over or up something (LEDGED), a
//                               palm held the same way STEP or more off the floor: a hand set on a
//                               ledge
//               `still`         held with nothing moving about it, or at rest on the body
//   lift      `[[t, metres], ...]` each frame, how far the clip must be raised to stand its planted soles
//             on the floor (lowered where they float over it): the lowest planted sole's depth under it,
//             straight between the frames that plant none, and toward 0 over the frames before a
//             clip's first and after its last planted sole where the clip also stands on rungs or a raised
//             floor, so a clip that leaves the floor for them meets them where it measured them; smoothed
//             over SMOOTH frames. Null where it never reaches LIFT. Written to the clip's sidecar as its
//             `offset.position`, and every place below is measured with it laid on.
//   ladder    for a clip whose name says ladder and that stands on rungs: the rung plane its held balls
//             stand on, `normal` the heading (degrees, positive left, from +z) from the plane toward the
//             body, `at` [x, z] the point of the plane between its left and right balls, `tops` the
//             heights the balls stand on, rung tops; `from` and `to` the seconds of the holds it is
//             read off; `hands`, how far out from the plane, toward the body, the held hands stand;
//             `spread` how far the held balls stand off the plane; `across` the furthest the held balls
//             stand to either side of `at`, along the rungs, and `grips` how far to either side the
//             held hands stand; `rails` the middle of the grips RAIL or more further to the side than
//             the feet, on the rails, how far to either side (null for none); `open` how far out from
//             the plane the grips inside the rails stand that are not closed round a rung, more than
//             CLOSED out (a doubt each)
//   wall      for a clip that kicks a wall: the face its kicked balls stand on, `normal` the heading
//             from it toward the body (the way the body goes at it, turned round: a one-shot's travel
//             where it travels TRAVELS or more, else the way the body faces as it kicks), `at` [x, z]
//             the middle of the kicks, `kicks` their heights, `from` and `to` their seconds
//   ledge     for a clip that sets its palms on a ledge: `top` their height, `at` [x, z] their
//             middle, `way` the heading the body goes as it does, as `wall`'s, `clear` [back, ahead] how far
//             behind and ahead of `at` along that way the ledge may reach with every sole and ball of
//             the clip kept over its top, and `from` and `to` their seconds
//   floor     the height of the raised floor the clip ends standing on, for a clip that does
//   rear      for a clip that sits, the body's skin furthest behind over the whole clip in each square of
//             REAR metres across and up, [[x, y, z], ...], in the chair's frame: from the place the clip's
//             root stands while its first seat holds the hips (its end for a clip that ends seated, its
//             start for one that starts seated, the seat's last frame else, as the table's travel has
//             the root there), turned the way the root faces then; what a chair's back must stand behind
//   surfaces  what it stands on and holds, by kind: `ground`; `seat` (the hips held low and SUPPORT or
//             more off the feet across the ground, where nothing but a seat holds them: `at` the
//             middle of the seat's skin within LOW of its lowest, what sits on the seat); `grip` (`at`,
//             a hand held, off a ladder, by its middle); `raised floor` (`y`); `ladder`; `wall`; `ledge`
//   doubts    what the heuristics could not settle, each `{ t, point, question }` (`t` null for the
//             whole clip), to be answered by eye
// A mirrored clip (`mirror` in the rig) is its source's across x, its left and right swapped, and its
// doubts and its sidecar are its source's.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rig = JSON.parse(readFileSync(join(here, 'xbot.rig.json'), 'utf8'))
if (!process.argv[2]) throw new Error('xbot.contacts.mjs: name the skin file xbot.contacts.py wrote')
const skin = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const BODY = 'xbot'
const CLIPS = join(homedir(), 'troupe-collection')

// Held still: slower than this, m/s, for at least HOLD seconds. A run's foot is down 3 frames at 30 fps;
// a hand holds for at least GRIP seconds, since a swinging arm stops for 3 frames as it turns back.
const PLANT = 0.35
const HOLD = 0.09
const GRIP = 0.15
// A palm bearing the body rolls and slides on what it is set on: held, slower than this, m/s (the
// vault's slide at up to 1.05 while they bear it).
const PRESS = 1.5
// A one-shot that travels this far, metres, faces what it meets along its travel, which the hips,
// twisting as it kicks or vaults, need not face.
const TRAVELS = 0.5
// A held hand within this of a knee, a thigh's middle or the hips rests on the body, metres.
const RESTS = 0.2
// Held on something: the hips move at least this far, metres, while the point is held.
const ANCHOR = 0.05
// A sole or a ball from NEAR under the floor to FLOAT over it stands on it, metres: the run's sink to
// 0.033 under it, the crouch's to 0.069; a foot held higher is held in the air.
const NEAR = 0.1
const FLOAT = 0.02
// A sole held off the floor stands flat on what holds it when its ball is within this of its own
// height, metres; on a rung the heel hangs under the ball.
const LEVEL = 0.02
// A ball or a sole held this far off the floor or more stands on something raised, metres.
const STEP = 0.15
// A lift is smoothed over this many frames, and one that never reaches LIFT metres is none.
const SMOOTH = 5
const LIFT = 0.005
// A seat holds the hips under SEAT metres for at least SITS seconds, SUPPORT metres or more off the
// middle of the feet across the ground.
const SEAT = 0.7
const SITS = 0.3
const SUPPORT = 0.3
// The balls a rung plane is read off stand within this of it, metres.
const FLAT = 0.06
// A hand closed round a rung holds its middle this far out from the rung plane or less, metres: half a
// hand's thickness and the rung's radius (the climb's at 0.041 to 0.058).
const CLOSED = 0.07
// A grip further to the side than the feet by this or more, metres, is on a rail.
const RAIL = 0.1
// Two readings of the facing further apart than this, degrees, are a doubt.
const AGREE = 25
// The side of the squares a sitting clip's rearmost skin is kept in, metres (`xbot.contacts.py`'s REAR).
const REAR = 0.02

// What a clip's names say it does, by word.
const WORDS = [
  ['ladder', /ladder|climb/i],
  ['top', /to top|dismount/i],
  ['sit', /sit|seat/i],
  ['cover', /cover/i],
  ['vault', /vault/i],
  ['wall', /wall/i],
  ['roll', /roll|dodge/i],
  ['slide', /slide/i],
  ['flip', /flip/i],
  ['crouch', /crouch|creep|sneak|low/i],
  ['jump', /jump/i],
  ['fall', /fall/i],
  ['land', /land/i],
  ['idle', /idle/i],
  ['walk', /walk/i],
  ['run', /run/i],
]
// What each word expects to find; a clip whose name says it is in the air stands on no raised floor.
const EXPECTS = { ladder: 'ladder', sit: 'seat', vault: 'ledge', wall: 'wall', cover: 'wall' }
const AIRBORNE = ['fall', 'jump', 'flip']
// A clip whose name says it goes over or up something sets its palms on it; in any other a slow hand
// swinging by the body is no ledge.
const LEDGED = ['vault', 'wall', 'top']

const entryOf = name => (typeof rig.clips[name] === 'string' ? { file: rig.clips[name] } : rig.clips[name])
const round = (v, places = 3) => Math.round(v * 10 ** places) / 10 ** places
const r3 = p => p.map(v => round(v))
const sub = (a, b) => a.map((v, i) => v - b[i])
const len = v => Math.hypot(...v)
const flat = v => Math.hypot(v[0], v[2])
const mean = ps => ps[0].map((_, i) => ps.reduce((s, p) => s + p[i], 0) / ps.length)
const wrapDeg = a => a - 360 * Math.ceil((a - 180) / 360)
const DEG = Math.PI / 180
// The way a line from a body's right to its left faces, degrees from +z, positive left.
const square = (l, r) => { const d = sub(l, r); return Math.atan2(-d[2], d[0]) / DEG }
// The way a direction across the ground points, degrees from +z, positive left.
const heading = v => Math.atan2(v[0], v[2]) / DEG
const meanDeg = as => Math.atan2(as.reduce((s, a) => s + Math.sin(a * DEG), 0), as.reduce((s, a) => s + Math.cos(a * DEG), 0)) / DEG

// A point [x, y, z] turned `deg` degrees left about the vertical through (cx, cz).
function turnAbout(p, deg, cx, cz) {
  if (!deg) return p
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG), x = p[0] - cx, z = p[2] - cz
  return [cx + x * c + z * s, p[1], cz - x * s + z * c, ...p.slice(3)]
}
// A sidecar's rows at t: straight between them, held past either end (the export's `row_at`).
function rowAt(rows, t) {
  if (t <= rows[0][0]) return rows[0].slice(1)
  for (let i = 1; i < rows.length; i++) {
    if (t > rows[i][0]) continue
    const a = rows[i - 1], b = rows[i], u = (t - a[0]) / (b[0] - a[0])
    return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u)
  }
  return rows[rows.length - 1].slice(1)
}
// A clip's sidecar beside its FBX, or {}.
const sidecarPath = file => join(CLIPS, file.replace(/\.fbx$/i, '.json'))
const sidecarOf = file => (existsSync(sidecarPath(file)) ? JSON.parse(readFileSync(sidecarPath(file), 'utf8')) : {})

// Every point the heuristics read, on every frame, as the clip's FBX has it: the bone ends put back where
// the clip has them, turned back by the turn the last bake laid on, and the skin's patches, which are
// measured where the clip has them; the table's travel turned back with them.
function pointsOf(name) {
  const ends = rig.ends[BODY][name]
  const baked = rig.table[name]
  const s = skin.clips[name]
  const n = ends.torso.length - 1
  if (s.soleL.length !== n + 1) throw new Error(`xbot.contacts.mjs: ${name} has ${s.soleL.length} frames of skin and ${n + 1} of bone ends`)
  const laid = sidecarOf(entryOf(name).file).offset?.rotation
  const was = t => (laid ? rowAt(laid, t)[0] : 0)
  const back = (row, f) => {
    const k = n > 0 ? f / n : 0
    return [row[0] + baked.left * k, row[1], row[2] + baked.forward * k, row[3] + baked.left * k, row[4], row[5] + baked.forward * k]
  }
  // The hips on the first frame stand where the turn is about.
  const [cx, , cz] = back(ends.torso[0], 0)
  const raw = (p, f) => turnAbout(p, -was(f / ends.fps), cx, cz)
  const seg = (sg, f) => { const r = back(ends[sg][f], f); return [...raw(r.slice(0, 3), f), ...raw(r.slice(3), f)] }
  const a = r => r.slice(0, 3)
  const frames = []
  for (let f = 0; f <= n; f++) {
    frames.push({
      hips: a(seg('torso', f)),
      shoulderL: a(seg('armL', f)), shoulderR: a(seg('armR', f)),
      hipL: a(seg('uplegL', f)), hipR: a(seg('uplegR', f)),
      kneeL: a(seg('legL', f)), kneeR: a(seg('legR', f)),
      soleL: s.soleL[f], soleR: s.soleR[f], ballL: s.ballL[f], ballR: s.ballR[f],
      handL: s.handL[f].slice(0, 3), handR: s.handR[f].slice(0, 3),
      palmL: s.handL[f].slice(3), palmR: s.handR[f].slice(3),
      seat: s.seat[f], back: s.back[f], rear: s.rear?.[f] ?? null,
    })
  }
  // The table's travel at its end and on each row, turned back as the ends are; its yaw less the turn's
  // own change since the first frame.
  const flatBack = (l, fw, t) => { const q = turnAbout([l, 0, fw], -was(t), 0, 0); return [q[0], q[2]] }
  const [left, forward] = flatBack(baked.left, baked.forward, baked.dur)
  const m = {
    ...baked, left, forward, yaw: baked.yaw - (was(baked.dur) - was(0)),
    travel: baked.travel.map(([t, fw, l, y]) => { const [l2, f2] = flatBack(l, fw, t); return [t, f2, l2, y - (was(t) - was(0))] }),
  }
  return { fps: ends.fps, n, frames, m, centre: [cx, cz] }
}

// The clip turned `deg` degrees left about the hips on its first frame: every point of every frame, and
// the table's travel.
function turned(p, deg) {
  if (!deg) return p
  const [cx, cz] = p.centre
  const t = q => turnAbout(q, deg, cx, cz)
  const frames = p.frames.map(fr => Object.fromEntries(Object.entries(fr).map(([k, v]) => [k, v === null ? null : k === 'rear' ? v.map(t) : t(v)])))
  const flat = (l, fw) => { const q = turnAbout([l, 0, fw], deg, 0, 0); return [q[0], q[2]] }
  const [left, forward] = flat(p.m.left, p.m.forward)
  const m = { ...p.m, left, forward, travel: p.m.travel.map(([tt, fw, l, y]) => { const [l2, f2] = flat(l, fw); return [tt, f2, l2, y] }) }
  return { ...p, frames, m }
}

// The facing of a clip's body on a frame, off its hip joints (`square`, below).
const facingAt = fr => square(fr.hipL, fr.hipR)

// The game's cover clips and the turn each is given (the header), as its FBX has it: a clip in or out so
// its body faces +z on its first frame, an idle so it does over its lap, a gear so it travels its gear.
const cover = JSON.parse(readFileSync(join(here, 'demo_walker.json'), 'utf8')).player.moves.cover
const stances = [cover.stand, cover.crouch]
function turnOf(name, p) {
  const e = entryOf(name)
  if (e.mirror) return 0
  const { frames, n, m } = p
  if ([cover.in, cover.out, cover.lowIn, cover.lowOut].includes(name)) return round(-facingAt(frames[0]), 1)
  const idle = stances.some(s => rig.stances?.[s]?.idle === name)
  if (idle) return round(-meanDeg(Array.from({ length: Math.max(1, n) }, (_, f) => facingAt(frames[f]))), 1)
  if (e.loop && e.gear !== undefined && stances.includes(e.stance)) return round(wrapDeg(e.gear - heading([m.left, 0, m.forward])), 1)
  return 0
}

// Runs of frames where `keep(f)` holds, at least `min` frames long; a loop's run may go round its end,
// its frames past `n` the frames of the next lap.
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

// The lift on each frame: the lowest planted sole's depth under the floor, filled between and smoothed.
function liftOf(n, loop, ground, raised) {
  const at = Array.from({ length: n + 1 }, (_, f) => ground[f])
  const known = at.flatMap((v, f) => (v === undefined ? [] : [f]))
  if (!known.length) return undefined
  const fill = Array(n + 1)
  for (const f of known) fill[f] = at[f]
  const first = known[0], last = known[known.length - 1]
  for (let f = 0; f <= n; f++) {
    if (fill[f] !== undefined) continue
    if (f > first && f < last) {
      const a = known.filter(k => k < f).pop(), b = known.find(k => k > f)
      fill[f] = fill[a] + ((fill[b] - fill[a]) * (f - a)) / (b - a)
    } else if (loop) {
      // Round the lap's end, from the last planted frame to the first of the next lap.
      const a = last, b = first + n, g = f < first ? f + n : f
      fill[f] = fill[a] + ((fill[b - n] - fill[a]) * (g - a)) / (b - a)
    } else if (f < first) {
      // Before the floor: toward 0 by the first raised frame before it, or held where there is none.
      const r = raised.filter(k => k < first).pop()
      fill[f] = r === undefined ? fill[first] : f <= r ? 0 : (fill[first] * (f - r)) / (first - r)
    } else {
      const r = raised.find(k => k > last)
      fill[f] = r === undefined ? fill[last] : f >= r ? 0 : (fill[last] * (r - f)) / (r - last)
    }
  }
  const half = (SMOOTH - 1) / 2
  const out = fill.map((_, f) => {
    let sum = 0, count = 0
    for (let k = f - half; k <= f + half; k++) {
      const g = loop ? ((k % n) + n) % n : Math.max(0, Math.min(n, k))
      sum += fill[g]
      count++
    }
    return sum / count
  })
  if (loop) out[n] = out[0]
  return Math.max(...out.map(Math.abs)) >= LIFT ? out : undefined
}

function analyse(name) {
  const e = entryOf(name)
  const loop = !!e.loop
  const as = pointsOf(name)
  const turnBy = turnOf(name, as)
  const { fps, n, frames, m } = turned(as, turnBy)
  // A lap's whole progress: across the ground the table's, and up what the hips climb (a ladder's).
  const progress = [m.left, frames[n].hips[1] - frames[0].hips[1], m.forward]
  const lap = (p, k) => p.map((v, i) => v + progress[i] * k)
  const at = (point, f) => (f > n ? lap(frames[f - n][point], 1) : f < 0 ? lap(frames[f + n][point], -1) : frames[f][point])
  const speed = (point, f) => {
    if (n === 0) return 0
    const p = loop ? f - 1 : Math.max(0, f - 1), q = loop ? f + 1 : Math.min(n, f + 1)
    return (len(sub(at(point, q), at(point, p))) * fps) / (q - p)
  }
  const sec = f => round(f / fps)
  const hints = [...new Set(WORDS.filter(([, re]) => re.test(name) || re.test(e.file ?? '')).map(([w]) => w))]
  const doubts = []

  // ---- facing
  const facing = frames.map(fr => square(fr.hipL, fr.hipR))
  const shoulders = frames.map(fr => square(fr.shoulderL, fr.shoulderR))
  const lapFrames = Array.from({ length: n }, (_, f) => f)
  const faces = {
    hips: round(loop ? meanDeg(lapFrames.map(f => facing[f])) : facing[0], 1),
    shoulders: round(loop ? meanDeg(lapFrames.map(f => shoulders[f])) : shoulders[0], 1),
  }
  // Hips and shoulders facing apart are a torso the clip twists, and the clips it chains to twist it the
  // same way (the jump into the fall and the landing, the crouch into the crouch idle, cover into its
  // idle), so it is no doubt: straightening one clip would move the twist to the next hand-over.
  const travels = loop && Math.hypot(m.left, m.forward) > 0.05 ? round(heading([m.left, 0, m.forward]), 1) : null
  let turn = 0
  for (let f = 1; f <= n; f++) turn += wrapDeg(facing[f] - facing[f - 1])
  if (Math.abs(wrapDeg(turn - m.yaw)) > AGREE) {
    doubts.push({ t: null, point: 'hips', question: `the hip joints turn ${round(turn, 1)}° over the clip and the hips' own axis ${m.yaw}°: which is the body's turn?` })
  }

  // ---- plants, off the skin
  const plants = []
  for (const point of ['soleL', 'soleR', 'ballL', 'ballR', 'handL', 'handR', 'palmL', 'palmR']) {
    const hold = point.startsWith('hand') ? GRIP : HOLD
    const still = point.startsWith('palm') ? PRESS : PLANT
    for (const [s, en] of runs(n, loop, f => speed(point, f) < still, Math.ceil(hold * fps - 1e-9))) {
      const ps = [], hips = []
      for (let f = s; f <= en; f++) { ps.push(at(point, f)); hips.push(at('hips', f)) }
      const p = mean(ps)
      let moved = 0
      for (const h of hips) moved = Math.max(moved, len(sub(h, hips[0])))
      const mid = Math.round((s + en) / 2) % n
      let on = 'still'
      const floored = p[1] > -NEAR && p[1] < FLOAT
      if (point.startsWith('sole')) {
        const ball = mean(ps.map((_, i) => at('ball' + point.slice(-1), s + i)))
        on = floored ? 'ground' : p[1] >= STEP && Math.abs(ball[1] - p[1]) <= LEVEL && !hints.some(h => AIRBORNE.includes(h)) ? 'raised floor' : 'still'
      } else if (point.startsWith('ball')) {
        // On a rung the heel hangs under the ball. On a ladder a held ball is on a rung unless its sole
        // stands flat on a raised floor the while, the ladder's top.
        const side = point.slice(-1)
        const sole = mean(ps.map((_, i) => at('sole' + side, s + i)))
        const hangs = p[1] - sole[1] > LEVEL
        const topped = plants.some(q => q.point === 'sole' + side && q.on === 'raised floor' && q.s <= en && q.en >= s)
        // Off a ladder, a raised ball held with its heel hanging is a foot kicked against a wall.
        on = floored ? 'ground' : hints.includes('ladder') ? (topped ? 'still' : 'rung') : hangs && moved >= ANCHOR && p[1] >= STEP ? 'wall' : 'still'
      } else if (moved >= ANCHOR) {
        const fr = frames[mid]
        const body = [fr.kneeL, fr.kneeR, mean([fr.hipL, fr.kneeL]), mean([fr.hipR, fr.kneeR]), fr.hips]
        const rests = Math.min(...body.map(b => len(sub(fr[point], b)))) < RESTS
        // A hand's middle held is a grip; its palm held, off a ladder, a hand set on a ledge.
        if (point.startsWith('hand')) on = rests ? 'still' : 'hold'
        else on = floored ? 'ground' : rests || !hints.some(h => LEDGED.includes(h)) || p[1] < STEP ? 'still' : 'ledge'
      }
      plants.push({ point, from: sec(s), to: sec(en), s, en, at: r3(p), on, facing: facing[mid] })
    }
  }

  // ---- the lift, off the soles planted on the floor
  const ground = Array(n + 1).fill(undefined)
  for (const p of plants.filter(p => p.on === 'ground')) {
    for (let f = p.s; f <= p.en; f++) {
      const g = loop ? f % n : f
      const y = at(p.point, f)[1]
      ground[g] = ground[g] === undefined ? -y : Math.max(ground[g], -y)
    }
  }
  const raised = [...new Set(plants.filter(p => p.on === 'rung' || p.on === 'raised floor' || p.on === 'wall').flatMap(p => [p.s, Math.min(n, p.en)]))].sort((a, b) => a - b)
  const lifted = liftOf(n, loop, ground, raised)
  const liftAt = f => (lifted ? lifted[Math.max(0, Math.min(n, f))] : 0)
  const up = (p, f) => [p[0], p[1] + liftAt(f), p[2]]
  for (const p of plants) p.at = r3(up(p.at, Math.round((p.s + p.en) / 2) % (n || 1)))

  // ---- the ladder: the plane its held balls stand on, its rungs their tops
  let ladder = null
  const rungs = plants.filter(p => p.on === 'rung')
  if (hints.includes('ladder') && rungs.length) {
    // The facing most rung holds share, and the balls of it within FLAT of one plane square to it.
    const crowd = rungs.map(h => rungs.filter(o => Math.abs(wrapDeg(o.facing - h.facing)) <= 30)).reduce((a, b) => (b.length > a.length ? b : a))
    const way = meanDeg(crowd.map(h => h.facing))
    const toward = [Math.sin(way * DEG), 0, Math.cos(way * DEG)]
    const depth = p => p.at[0] * toward[0] + p.at[2] * toward[2]
    const ds = crowd.map(depth).sort((a, b) => a - b)
    const mid = ds[Math.floor(ds.length / 2)]
    const held = crowd.filter(h => Math.abs(depth(h) - mid) <= FLAT)
    const L = held.filter(h => h.point.endsWith('L')), R = held.filter(h => h.point.endsWith('R'))
    if (L.length && R.length) {
      // The rung line runs from the right ball to the left; the normal is square to it, toward the body.
      const pl = mean(L.map(h => h.at)), pr = mean(R.map(h => h.at))
      const across = [pl[0] - pr[0], 0, pl[2] - pr[2]]
      let normal = [-across[2], 0, across[0]]
      if (normal[0] * toward[0] + normal[2] * toward[2] > 0) normal = normal.map(v => -v)
      const k = flat(normal)
      normal = normal.map(v => v / k)
      const centre = mean([pl, pr])
      const off = p => (p[0] - centre[0]) * normal[0] + (p[2] - centre[2]) * normal[2]
      const side = p => Math.abs((p[0] - centre[0]) * normal[2] - (p[2] - centre[2]) * normal[0])
      const from = Math.min(...held.map(h => h.s)), to = Math.max(...held.map(h => h.en))
      const hands = plants.filter(p => p.on === 'hold' && p.point.startsWith('hand') && p.en >= from && p.s <= to)
      ladder = {
        normal: round(heading(normal), 2),
        at: [round(centre[0]), round(centre[2])],
        tops: [...new Set(held.map(h => h.at[1]))].sort((a, b) => a - b),
        from: sec(from), to: sec(to),
        hands: hands.map(h => round(off(h.at))),
        spread: round(Math.max(...held.map(h => Math.abs(off(h.at))))),
        across: round(Math.max(...held.map(h => side(h.at)))),
        grips: hands.map(h => round(side(h.at))),
      }
      // The grips out by the rails, beyond the feet: the rails' middles, how far to either side.
      const railed = ladder.grips.filter(g => g >= ladder.across + RAIL)
      ladder.rails = railed.length ? round(railed.reduce((s, g) => s + g, 0) / railed.length) : null
      // The grips on the rungs: inside the rails, closed round them.
      ladder.open = hands.filter(h => side(h.at) < ladder.across + RAIL && Math.abs(off(h.at)) > CLOSED).map(h => round(off(h.at)))
    }
  }

  // The way the body goes at what it meets: a one-shot's travel, where it travels TRAVELS or more, else
  // the way it faces then.
  const wayOf = held => (!loop && Math.hypot(m.forward, m.left) >= TRAVELS ? heading([m.left, 0, m.forward]) : meanDeg(held.map(h => h.facing)))

  // ---- the wall it kicks: the face its kicked balls stand on, square to the way the body goes then
  let wall = null
  const kicks = plants.filter(p => p.on === 'wall')
  if (kicks.length) {
    const way = wayOf(kicks)
    const c = mean(kicks.map(k => k.at))
    wall = {
      normal: round(wrapDeg(way + 180), 2),
      at: [round(c[0]), round(c[2])],
      kicks: kicks.map(k => k.at[1]).sort((a, b) => a - b),
      from: sec(Math.min(...kicks.map(k => k.s))), to: sec(Math.max(...kicks.map(k => k.en))),
    }
  }

  // ---- the ledge it sets its hands on, and how far either way along the body's way its feet keep
  // over its top
  let ledge = null
  const palms = plants.filter(p => p.on === 'ledge')
  if (palms.length) {
    const way = wayOf(palms)
    const dir = [Math.sin(way * DEG), 0, Math.cos(way * DEG)]
    const c = mean(palms.map(p => p.at))
    const along = q => (q[0] - c[0]) * dir[0] + (q[2] - c[2]) * dir[2]
    let back = -Infinity, ahead = Infinity
    for (let f = 0; f <= n; f++) {
      for (const point of ['soleL', 'soleR', 'ballL', 'ballR']) {
        const q = up(at(point, f), f)
        if (q[1] >= c[1]) continue
        const a = along(q)
        if (a < 0) back = Math.max(back, a)
        else ahead = Math.min(ahead, a)
      }
    }
    ledge = {
      top: round(c[1]),
      at: [round(c[0]), round(c[2])],
      way: round(way, 2),
      clear: [round(back), round(ahead)],
      from: sec(Math.min(...palms.map(p => p.s))), to: sec(Math.max(...palms.map(p => p.en))),
    }
  }

  // ---- the raised floor it ends on
  const ends = plants.filter(p => p.on === 'raised floor' && p.en >= n - 1)
  const floor = ends.length ? round(Math.min(...ends.map(p => p.at[1]))) : null

  // ---- surfaces
  const surfaces = []
  const seats = []
  if (plants.some(p => p.on === 'ground')) surfaces.push({ kind: 'ground' })
  for (const [s, en] of runs(n, loop, f => speed('hips', f) < PLANT && at('hips', f)[1] < SEAT, Math.ceil(SITS * fps))) {
    const f = Math.round((s + en) / 2) % (n || 1)
    const fr = frames[f]
    const base = mean([fr.soleL, fr.soleR])
    const off = flat(sub(fr.hips, base))
    if (off < SUPPORT) continue
    surfaces.push({ kind: 'seat', at: r3(up(fr.seat, f)), off: round(off), from: sec(s), to: sec(en) })
    seats.push([s, en])
  }

  // ---- the rearmost skin, in the chair's frame
  let rear = null
  const behind = frames[0].rear ? frames.map(fr => fr.rear) : null
  if (seats.length && behind) {
    const [s, en] = seats[0]
    const f = en >= n ? n : s <= 0 ? 0 : en
    const [fwd, left, yaw] = travelAt(m, f / fps)
    const c = Math.cos(yaw * DEG), si = Math.sin(yaw * DEG)
    const cells = new Map()
    behind.forEach((points, g) => {
      for (const p of points) {
        const dx = p[0] - left, dz = p[2] - fwd
        const q = [dx * c - dz * si, p[1] + liftAt(g), dx * si + dz * c]
        const key = `${Math.floor(q[0] / REAR)} ${Math.floor(q[1] / REAR)}`
        const had = cells.get(key)
        if (!had || q[2] < had[2]) cells.set(key, q)
      }
    })
    rear = [...cells.values()].map(r3).sort((a, b) => a[1] - b[1] || a[0] - b[0])
  }
  for (const p of plants) {
    if (p.on === 'hold' && !ladder) surfaces.push({ kind: 'grip', point: p.point, at: p.at, from: p.from, to: p.to })
    if (p.on === 'raised floor') surfaces.push({ kind: 'raised floor', point: p.point, y: p.at[1], from: p.from, to: p.to })
  }
  if (ladder) surfaces.push({ kind: 'ladder' })
  if (wall) surfaces.push({ kind: 'wall' })
  if (ledge) surfaces.push({ kind: 'ledge' })

  // ---- doubts
  for (const h of hints) {
    const want = EXPECTS[h]
    if (want && !surfaces.some(s => s.kind === want)) doubts.push({ t: null, point: null, question: `its name says ${h}, and no ${want} is found: where is it?` })
  }
  for (const s of surfaces.filter(s => s.kind === 'grip')) {
    if (hints.some(h => ['vault', 'wall', 'top'].includes(h))) continue
    doubts.push({ t: s.from, point: s.point, question: `${s.point} is held at ${s.at[1]} m from ${s.from} s to ${s.to} s while the body moves about it: on what?` })
  }
  if (ladder && ladder.open.length) {
    doubts.push({ t: ladder.from, point: 'hands', question: `hands held inside the rails stand ${ladder.open.join(', ')} m out from the rungs the balls stand on, more than a hand closed round one: what do they hold?` })
  }
  if (!hints.length) doubts.push({ t: null, point: null, question: `neither its name nor its file says what it does (${e.file})` })

  return {
    file: e.file, turned: turnBy, loop, frames: n, fps, dur: m.dur, hints, lap: loop ? r3(progress) : null,
    facing: facing.map(v => round(v, 1)), faces, travels, turn: round(turn, 1), hipsTurn: m.yaw,
    plants: plants.map(({ s, en, facing, ...p }) => p),
    lift: lifted ? lifted.map((v, f) => [sec(f), round(v)]) : null,
    ladder, wall, ledge, floor, rear, surfaces, doubts,
  }
}

// Where the table's travel has the root at t: [forward, left, yaw degrees], straight between its rows,
// the yaw the short way round.
function travelAt(m, t) {
  const rows = m.travel
  if (t <= rows[0][0]) return rows[0].slice(1)
  for (let i = 1; i < rows.length; i++) {
    const b = rows[i]
    if (t > b[0]) continue
    const a = rows[i - 1]
    const u = (t - a[0]) / (b[0] - a[0])
    return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + wrapDeg(b[3] - a[3]) * u]
  }
  return rows[rows.length - 1].slice(1)
}

// A mirrored clip: its source's, across x, left and right swapped.
function mirrored(src) {
  const swap = s => (s ?? '').replace(/L$/, '\0').replace(/R$/, 'L').replace(/\0$/, 'R')
  const flipped = p => [-p[0], p[1], p[2]]
  return {
    ...src,
    facing: src.facing.map(v => -v),
    faces: Object.fromEntries(Object.entries(src.faces).map(([k, v]) => [k, -v])),
    travels: src.travels === null ? null : -src.travels,
    turn: -src.turn, hipsTurn: -src.hipsTurn,
    plants: src.plants.map(p => ({ ...p, point: swap(p.point), at: flipped(p.at) })),
    ladder: src.ladder && { ...src.ladder, normal: -src.ladder.normal, at: [-src.ladder.at[0], src.ladder.at[1]] },
    wall: src.wall && { ...src.wall, normal: -src.wall.normal, at: [-src.wall.at[0], src.wall.at[1]] },
    ledge: src.ledge && { ...src.ledge, way: -src.ledge.way, at: [-src.ledge.at[0], src.ledge.at[1]] },
    rear: src.rear && src.rear.map(flipped),
    turned: -src.turned,
    surfaces: src.surfaces.map(s => ({ ...s, ...(s.point ? { point: swap(s.point) } : {}), ...(s.at ? { at: flipped(s.at) } : {}), ...(s.hips ? { hips: flipped(s.hips) } : {}) })),
    doubts: [],
  }
}

const out = {}
for (const name of Object.keys(rig.clips)) if (!entryOf(name).mirror) out[name] = analyse(name)
for (const name of Object.keys(rig.clips)) {
  const e = entryOf(name)
  if (e.mirror) out[name] = { ...mirrored(out[e.mirror]), mirror: e.mirror }
}
writeFileSync(join(here, 'xbot.contacts.json'), JSON.stringify({ body: BODY, clips: out }, null, 1) + '\n')

// Each clip's lift into its sidecar beside its FBX, as its offset's position, and its turn as its
// offset's rotation, one row; a clip with neither has it taken out of its sidecar, and a sidecar left
// with nothing in it is removed.
for (const [name, c] of Object.entries(out)) {
  if (c.mirror) continue
  const path = sidecarPath(c.file)
  const side = sidecarOf(c.file)
  side.offset = { ...side.offset }
  if (c.lift) side.offset.position = c.lift.map(([t, y]) => [t, 0, y, 0])
  else delete side.offset.position
  if (c.turned) side.offset.rotation = [[0, c.turned]]
  else delete side.offset.rotation
  if (!Object.keys(side.offset).length) delete side.offset
  if (c.turned) console.log(`sidecar ${name}: turned ${c.turned}°`)
  if (Object.keys(side).length) writeFileSync(path, JSON.stringify(side) + '\n')
  else if (existsSync(path)) rmSync(path)
  if (c.lift) console.log(`sidecar ${name}: lift ${Math.min(...c.lift.map(r => r[1]))} to ${Math.max(...c.lift.map(r => r[1]))} m`)
}

// A line a clip, for reading at a glance.
for (const [name, c] of Object.entries(out)) {
  const kinds = c.surfaces.map(s => (s.kind === 'seat' ? `seat (sits at ${s.at[1]} m, ${s.off} m off the feet)` : s.kind === 'raised floor' ? `raised floor ${s.y} m` : s.kind))
  const lad = (c.ladder ? ` ladder normal ${c.ladder.normal}° at ${c.ladder.at} tops ${c.ladder.tops} (${c.ladder.from}–${c.ladder.to} s)` : '')
    + (c.wall ? ` wall normal ${c.wall.normal}° at ${c.wall.at} kicks ${c.wall.kicks} (${c.wall.from}–${c.wall.to} s)` : '')
    + (c.ledge ? ` ledge top ${c.ledge.top} at ${c.ledge.at} way ${c.ledge.way}° clear ${c.ledge.clear} (${c.ledge.from}–${c.ledge.to} s)` : '')
  console.log(`${name.padEnd(17)} [${c.hints.join(' ')}] faces ${c.faces.hips}°${c.floor !== null ? ` ends on ${c.floor} m` : ''}  ${[...new Set(kinds)].join(', ') || 'nothing'}${lad}`)
  for (const d of c.doubts) console.log(`    ? ${d.question}`)
}
