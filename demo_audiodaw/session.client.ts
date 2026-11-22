// The session's look, Ableton's Session View laid along the studio's tracks: a row per track, beside
// its header on the tracks' panel and scrolled with it (`view.tracksTop`), and a column per scene of
// the song, its slot of each track a cell. Every number of its layout is here; the slots are one
// renderdom canvas, their pointer a surface.
//
// Along the top: STOP ALL (every track's slot stopped at the next launch), and LAUNCH ◀ its grain ▶,
// the ticks a launch waits for (`setLaunch`: none, a 16th, an 8th, a beat, half a bar, a bar, two
// bars or four), one step of undo. Under them the scenes' headers, each its name after a ▶: a press
// launches the scene (every track's slot of it, an empty one stopping its track), lit while any slot
// of it plays; two presses rename it; the right button opens its menu (LAUNCH, RENAME, INSERT, which
// puts a new scene before it, DUPLICATE, MOVE ◀, MOVE ▶ and DELETE). + SCENE after the last adds one.
// ◀ ▶ at the right scroll the scenes when there are more than the screen holds, as Shift+wheel or the
// wheel turned sideways does over the slots.
//
// Down the left of the slots, a stop for each track: a press stops its slot at the next launch,
// flashing until it does. A slot holding a pattern is a cell of its track's colour, its pattern's
// name and the notes or the automation line it holds drawn small, after a ▶: a press on the ▶
// launches it, and play starts with it when stopped; a press on the rest picks it, and its pattern
// for the roll; two presses open its pattern on the roll. The ▶ is lit while the slot plays, a bar
// along the cell's foot showing how far through its loop the song is, and flashes while the slot
// waits for its launch. An empty slot shows a stop: a press on it stops its track, two presses make a
// new empty pattern a bar long in it. The right button on any slot opens its menu: LAUNCH and OPEN for
// a slot holding a pattern, then each pattern of the track to put in it, NEW PATTERN and, holding one,
// CLEAR. The wheel over the slots scrolls the tracks. Every change of the song is one step of undo;
// launches and stops are not the song's.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Mods } from '#plugins/renderdom/renderdom.plugin.ts'
import { fromOf, launchOf, playedOf, scenesOf, slotOf, valueAt, type AutomationPattern, type Lane, type Pattern } from '#plugins/audiodaw/audiodaw.sim.ts'
import { LAYOUT, type Studio } from './plugins/studio/studio.plugin.ts'
import { BAR, BEAT, TICKS, row } from './plugins/studio/edits.ts'
import { ROW_H, ROWS_H, geometry, keepTop, trackAt } from './arrange.client.ts'
import { heard } from './mixer.client.ts'

const P = 'session'
const [, , W] = LAYOUT.view
const { SONG_Y, MENU_W, ITEM_H } = geometry
// The controls along the top, and the scenes' headers under them, over the slots' first row.
const TOP_Y = 6
const TOP_H = 22
const HEAD_Y = 32
const HEAD_H = 22
// The stops' column, the slots' columns after it, and the scroll buttons at the right.
const STOP_X = 8
const STOP_W = 36
const COLS_X = STOP_X + STOP_W + 8
const SLOT_W = 136
const SLOT_GAP = 4
const SCROLL_W = 24
const COLS_W = W - 12 - COLS_X
const COLS = Math.floor((COLS_W + SLOT_GAP) / (SLOT_W + SLOT_GAP))
// A cell's inset in its row, the ▶ at its left, the bar along its foot.
const CELL_PAD = 4
const PLAY_W = 20
const FOOT_H = 3
// Two presses within this many ms are one double press.
const TWICE = 350
// A flashing ▶ or stop turns over this often, in ms.
const FLASH = 250
// What a launch can wait for, in the studio's ticks.
export const LAUNCHES: { name: string; ticks: number }[] = [
  { name: 'NONE', ticks: 0 },
  { name: '1/16', ticks: TICKS },
  { name: '1/8', ticks: TICKS * 2 },
  { name: '1/4', ticks: BEAT },
  { name: '1/2', ticks: BEAT * 2 },
  { name: '1 BAR', ticks: BAR },
  { name: '2 BARS', ticks: BAR * 2 },
  { name: '4 BARS', ticks: BAR * 4 },
]
const C = {
  lane: '#d4d9df',
  alt: '#cdd2d8',
  empty: '#e3e6ea',
  emptyEdge: '#aab1ba',
  ink: '#232831',
  soft: '#5d6571',
  play: '#3fae6a',
  stop: '#ef6a5a',
  foot: '#2f7a4c',
  notes: 'rgba(35,40,49,0.55)',
  fill: 'rgba(35,40,49,0.18)',
}
const ACCENT = '#6fd29b'

const STYLE = `
.se-scene { position: absolute; box-sizing: border-box; display: flex; align-items: center; gap: 6px; padding: 0 8px; font: 9px 'Silkscreen', monospace; color: #232831; background: var(--face); border: 1px solid #8b939e; box-shadow: inset 1px 1px 0 #fff; cursor: pointer; user-select: none; white-space: nowrap; overflow: hidden; }
.se-scene b { font-weight: normal; color: #5d6571; }
.se-scene.st-on { background: #161b18; color: ${ACCENT}; border-color: #000; box-shadow: none; }
.se-scene.st-on b { color: ${ACCENT}; }
`

// What a press on the slots is over: a track's stop, or a slot by its scene and whether on its ▶.
type Hit = { track: number; stop: true } | { track: number; scene: number; play: boolean }
// The last press on the slots or a scene's header, for two presses.
let pressed: { key: string; at: number } | undefined
// The menu open: a slot's or a scene's, and where it opened, in the panel's units.
let menu: { slot: { track: number; scene: number } | undefined; scene: number | undefined; x: number; y: number } | undefined

export function setup() {}

// The left of column `c` of the slots shown.
const colX = (c: number) => COLS_X + c * (SLOT_W + SLOT_GAP)

// The columns there are room for: every scene from the first shown, and + SCENE after the last.
function shown(s: Studio) {
  const count = scenesOf(s.project).length
  const from = Math.max(0, Math.min(Math.max(0, count + 1 - COLS), s.view.sceneFrom))
  return { from, count, upto: Math.min(count, from + COLS) }
}

// What a press at `x`, `y` of the slots' surface is over, the tracks scrolled by `top`.
function hitAt(s: Studio, x: number, y: number): Hit | undefined {
  const track = trackAt(y, s.view.tracksTop)
  if (!s.project.tracks[track]) return undefined
  if (x >= STOP_X && x < STOP_X + STOP_W) return { track, stop: true }
  const { from, upto } = shown(s)
  const c = Math.floor((x - COLS_X) / (SLOT_W + SLOT_GAP))
  const scene = from + c
  if (x < COLS_X || scene >= upto || x - colX(c) > SLOT_W) return undefined
  return { track, scene, play: x - colX(c) < PLAY_W + CELL_PAD }
}

// Whether two presses on `key` make one double press, the press now remembered.
function twice(key: string): boolean {
  const now = performance.now()
  const yes = pressed !== undefined && pressed.key === key && now - pressed.at <= TWICE
  pressed = yes ? undefined : { key, at: now }
  return yes
}

const flashing = () => Math.floor(performance.now() / FLASH) % 2 === 0

// A pattern drawn small in a cell at `x`, `y`, `w` by `h`: a note pattern's notes, each a dash at its
// row between the lowest and the highest; an automation pattern's line, filled under.
function miniature(ctx: CanvasRenderingContext2D, lane: Lane, automation: boolean, x: number, y: number, w: number, h: number) {
  const from = fromOf(lane), played = playedOf(lane)
  const xOf = (t: number) => x + ((t - from) / played) * w
  if (automation) {
    const a = lane as AutomationPattern
    for (const n of a.notes) {
      if (n.time < from || n.time >= a.length) continue
      const long = Math.min(n.time + n.duration, a.length) - n.time
      ctx.beginPath()
      ctx.moveTo(xOf(n.time), y + h)
      for (let k = 0; k <= 24; k++) ctx.lineTo(xOf(n.time + (long * k) / 24), y + h - valueAt(n, (long * k) / 24) * h)
      ctx.lineTo(xOf(n.time + long), y + h)
      ctx.closePath()
      ctx.fillStyle = C.fill
      ctx.fill()
      ctx.strokeStyle = C.ink
      ctx.lineWidth = 1
      ctx.stroke()
    }
    return
  }
  const notes = (lane as Pattern).notes.filter(n => n.time >= from && n.time < lane.length)
  if (!notes.length) return
  const rows = notes.map(row)
  const lo = Math.min(...rows), hi = Math.max(...rows)
  ctx.fillStyle = C.notes
  notes.forEach((n, j) => {
    const yy = y + h - 2 - (hi > lo ? ((rows[j]! - lo) / (hi - lo)) * (h - 2) : (h - 2) / 2)
    ctx.fillRect(xOf(n.time), yy, Math.max(1, (Math.min(n.duration, lane.length - n.time) / played) * w - 1), 2)
  })
}

// The slots: a row per track in the window, its stop and its cells.
function slots(s: Studio) {
  const p = s.project
  const v = s.view
  const top = v.tracksTop
  const { from, upto } = shown(s)
  const playing = s.session()
  const ctx = s.dom.canvas(P, 'slots', [0, SONG_Y, W - 12, ROWS_H])
  ctx.save()
  ctx.translate(0, -top)
  ctx.font = "8px 'Silkscreen', monospace"
  ctx.textBaseline = 'top'
  p.tracks.forEach((t, i) => {
    const y = i * ROW_H
    if (y + ROW_H <= top || y >= top + ROWS_H) return
    ctx.fillStyle = i % 2 ? C.alt : C.lane
    ctx.fillRect(0, y, W - 12, ROW_H)
    const l = playing[i]
    const cy = y + CELL_PAD, ch = ROW_H - 2 * CELL_PAD
    // The track's stop: lit while a slot of it plays, flashing while a stop waits.
    const stopping = l?.next !== undefined && l.next.scene === undefined
    const live = l?.scene !== undefined
    ctx.fillStyle = stopping && flashing() ? C.stop : live ? C.ink : C.emptyEdge
    const sq = 12
    ctx.fillRect(STOP_X + (STOP_W - sq) / 2, cy + (ch - sq) / 2, sq, sq)
    const dim = heard(p, i) ? 1 : 0.35
    for (let scene = from; scene < upto; scene++) {
      const x = colX(scene - from)
      const name = slotOf(p, i, scene)
      const picked = v.slot?.track === i && v.slot.scene === scene
      if (name === undefined) {
        ctx.fillStyle = C.empty
        ctx.fillRect(x, cy, SLOT_W, ch)
        ctx.strokeStyle = picked ? C.ink : C.emptyEdge
        ctx.lineWidth = picked ? 2 : 1
        ctx.strokeRect(x + 0.5, cy + 0.5, SLOT_W - 1, ch - 1)
        ctx.fillStyle = C.emptyEdge
        ctx.fillRect(x + (SLOT_W - 8) / 2, cy + (ch - 8) / 2, 8, 8)
        continue
      }
      const lane = t.patterns[name]!
      ctx.globalAlpha = dim
      ctx.fillStyle = t.color
      ctx.fillRect(x, cy, SLOT_W, ch)
      ctx.globalAlpha = 1
      ctx.strokeStyle = picked ? C.ink : C.soft
      ctx.lineWidth = picked ? 2 : 1
      ctx.strokeRect(x + 0.5, cy + 0.5, SLOT_W - 1, ch - 1)
      // The ▶: lit while it plays, flashing while it waits for its launch.
      const on = l?.scene === scene
      const waiting = l?.next?.scene === scene
      ctx.fillStyle = on || (waiting && flashing()) ? C.play : C.ink
      ctx.beginPath()
      ctx.moveTo(x + CELL_PAD + 4, cy + 6)
      ctx.lineTo(x + CELL_PAD + 4 + 10, cy + 12)
      ctx.lineTo(x + CELL_PAD + 4, cy + 18)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = C.ink
      ctx.fillText(name.toUpperCase(), x + PLAY_W + CELL_PAD + 2, cy + 6)
      miniature(ctx, lane, t.kind === 'automation', x + PLAY_W + CELL_PAD + 2, cy + 20, SLOT_W - PLAY_W - 2 * CELL_PAD - 4, ch - 28)
      if (on && l?.through !== undefined) {
        ctx.fillStyle = C.foot
        ctx.fillRect(x + 1, cy + ch - FOOT_H - 1, (SLOT_W - 2) * l.through, FOOT_H)
      }
    }
  })
  ctx.restore()
}

// The slots' hands: presses on the stops and the cells, the right button's menu, and the wheel.
function hands(s: Studio) {
  const v = s.view
  s.dom.surface(P, 'slots:hands', [0, SONG_Y, W - 12, ROWS_H], {
    down(x, y) {
      menu = undefined
      const h = hitAt(s, x, y)
      if (!h) return
      if ('stop' in h) {
        s.stopTrack(h.track)
        return
      }
      const name = slotOf(s.project, h.track, h.scene)
      const again = twice(`slot:${h.track}:${h.scene}`)
      if (name === undefined) {
        if (again) s.newSlot(h.track, h.scene)
        else {
          s.pickSlot(h.track, h.scene)
          s.stopTrack(h.track)
        }
        return
      }
      if (again) {
        s.pick(h.track, name)
        s.show('roll')
        return
      }
      if (h.play) s.launch(h.track, h.scene)
      else s.pickSlot(h.track, h.scene)
    },
    menu(x, y) {
      const h = hitAt(s, x, y)
      if (!h || 'stop' in h) {
        menu = undefined
        return
      }
      s.pickSlot(h.track, h.scene)
      menu = { slot: { track: h.track, scene: h.scene }, scene: undefined, x, y: SONG_Y + y }
    },
    wheel(_x: number, _y: number, mods: Mods, dx: number, dy: number) {
      if (mods.shift || Math.abs(dx) > Math.abs(dy)) scrollScenes(s, Math.sign(Math.abs(dx) > Math.abs(dy) ? dx : dy))
      else v.tracksTop = keepTop(v.tracksTop + dy, s.project.tracks.length)
    },
  })
  s.dom.cursor(P, 'slots:hands', 'pointer')
}

function scrollScenes(s: Studio, by: number) {
  const count = scenesOf(s.project).length
  s.view.sceneFrom = Math.max(0, Math.min(Math.max(0, count + 1 - COLS), s.view.sceneFrom + by))
}

// The controls along the top: STOP ALL, the launch's grain, and the scenes' scroll.
function controls(s: Studio) {
  const p = s.project
  const kit = s.kit
  kit.button(P, 'stop:all', { at: [STOP_X, TOP_Y], size: [88, TOP_H], label: '■ STOP ALL', onPress: () => s.stopAll() })
  const at = LAUNCHES.findIndex(l => l.ticks === launchOf(p))
  const label = at < 0 ? `${launchOf(p)} TICKS` : LAUNCHES[at]!.name
  const step = (by: number) => {
    const k = at < 0 ? LAUNCHES.findIndex(l => l.ticks === BAR) : at
    s.setLaunch(LAUNCHES[Math.max(0, Math.min(LAUNCHES.length - 1, k + by))]!.ticks)
  }
  s.el(P, 'launch:label', 'st-sub', [STOP_X + 100, TOP_Y + 7, 46, 12], 'LAUNCH').style.position = 'absolute'
  kit.button(P, 'launch-', { at: [STOP_X + 148, TOP_Y], size: [22, TOP_H], label: '◀', onPress: () => step(-1) })
  kit.lcd(P, 'launch', { at: [STOP_X + 172, TOP_Y], size: [84, TOP_H], lines: [label] })
  kit.button(P, 'launch+', { at: [STOP_X + 258, TOP_Y], size: [22, TOP_H], label: '▶', onPress: () => step(1) })
  const { from, count, upto } = shown(s)
  if (count + 1 > COLS) {
    const x = W - 12 - 2 * SCROLL_W - 120
    kit.lcd(P, 'scenes', { at: [x, TOP_Y], size: [116, TOP_H], lines: [`SCENES ${from + 1}–${upto} / ${count}`] })
    kit.button(P, 'scenes-', { at: [x + 120, TOP_Y], size: [SCROLL_W, TOP_H], label: '◀', onPress: () => scrollScenes(s, -1) })
    kit.button(P, 'scenes+', { at: [x + 120 + SCROLL_W + 2, TOP_Y], size: [SCROLL_W, TOP_H], label: '▶', onPress: () => scrollScenes(s, 1) })
  }
}

// The scenes' headers, the field renaming one, and + SCENE after the last.
function headers(s: Studio) {
  const p = s.project
  const scenes = scenesOf(p)
  const playing = s.session()
  const { from, upto } = shown(s)
  const stop = s.el(P, 'stop:label', 'st-sub', [STOP_X, HEAD_Y + 6, STOP_W, 12], 'STOP')
  stop.style.position = 'absolute'
  stop.style.textAlign = 'center'
  for (let i = from; i < upto; i++) {
    const x = colX(i - from)
    const lit = playing.some(l => l.scene === i)
    const e = s.el(P, `scene:${i}`, 'se-scene', [x, HEAD_Y, SLOT_W, HEAD_H])
    const html = `<b>▶</b>${scenes[i]!.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}`
    if (e.innerHTML !== html) e.innerHTML = html
    if (e.classList.contains('st-on') !== lit) e.classList.toggle('st-on', lit)
    e.onpointerdown = ev => {
      if (ev.button !== 0) return
      ev.stopPropagation()
      menu = undefined
      if (twice(`scene:${i}`)) s.rename(`scene:${i}`)
      else s.launchScene(i)
    }
    e.oncontextmenu = ev => {
      ev.preventDefault()
      ev.stopPropagation()
      menu = { slot: undefined, scene: i, x, y: HEAD_Y + HEAD_H }
    }
    s.field(P, `scene:${i}`, [x + 2, HEAD_Y + 1, SLOT_W - 4, HEAD_H - 2], scenes[i]!.name, typed => s.renameScene(i, typed))
  }
  if (upto - from < COLS) s.kit.button(P, 'scene:add', { at: [colX(upto - from), HEAD_Y], size: [SLOT_W, HEAD_H], label: '+ SCENE', onPress: () => s.addScene() })
}

// The menu, while open: a slot's or a scene's items, each a press.
function openMenu(s: Studio) {
  const m = menu
  if (!m) return
  const p = s.project
  let items: [string, () => void][] = []
  if (m.slot) {
    const { track, scene } = m.slot
    const t = p.tracks[track]
    if (!t || scene >= scenesOf(p).length) {
      menu = undefined
      return
    }
    const name = slotOf(p, track, scene)
    if (name !== undefined) items.push(['LAUNCH', () => s.launch(track, scene)], ['OPEN', () => { s.pick(track, name); s.show('roll') }])
    for (const k of Object.keys(t.patterns)) items.push([`${k === name ? '● ' : '→ '}${k.toUpperCase()}`, () => s.setSlot(track, scene, k)])
    items.push(['NEW PATTERN', () => s.newSlot(track, scene)])
    if (name !== undefined) items.push(['CLEAR', () => s.setSlot(track, scene, undefined)])
  } else if (m.scene !== undefined) {
    const i = m.scene
    const count = scenesOf(p).length
    if (i >= count) {
      menu = undefined
      return
    }
    items = [
      ['LAUNCH', () => s.launchScene(i)],
      ['RENAME', () => s.rename(`scene:${i}`)],
      ['INSERT', () => s.addScene(i)],
      ['DUPLICATE', () => s.duplicateScene(i)],
      ...(i > 0 ? [['MOVE ◀', () => s.moveScene(i, i - 1)] as [string, () => void]] : []),
      ...(i < count - 1 ? [['MOVE ▶', () => s.moveScene(i, i + 1)] as [string, () => void]] : []),
      ['DELETE', () => s.removeScene(i)],
    ]
  }
  const [, , , H] = LAYOUT.view
  const x = Math.min(W - 12 - MENU_W, m.x)
  const y = Math.min(H - 12 - items.length * ITEM_H - 2, m.y)
  s.el(P, 'menu', 'ar-menu', [x, y, MENU_W, items.length * ITEM_H + 2])
  items.forEach(([label, act], k) => {
    const e = s.el(P, `menu:${k}`, 'ar-item', [x + 1, y + 1 + k * ITEM_H, MENU_W - 2, ITEM_H], label)
    e.onpointerdown = ev => {
      if (ev.button !== 0) return
      ev.stopPropagation()
      menu = undefined
      act()
    }
  })
}

export function tick(_row: Row, plugins: Plugins) {
  const s = plugins.studio as Studio
  if (s.view.screen !== 'session') {
    menu = undefined
    return
  }
  s.dom.style(STYLE)
  s.dom.keys(k => {
    if (k.code !== 'Escape' || !menu) return false
    menu = undefined
    return true
  })
  s.view.tracksTop = keepTop(s.view.tracksTop, s.project.tracks.length)
  s.chassis(P, LAYOUT.view)
  controls(s)
  headers(s)
  slots(s)
  hands(s)
  openMenu(s)
}

export function remove() {
  pressed = undefined
  menu = undefined
}
