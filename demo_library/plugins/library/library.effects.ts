// pro-ng's kit studio's effects editor (`pro-ng/kit_studio/effects.js`), as the library plugin's part: a kit kind's own
// effects, `kit/<kind>.effects.json`, tuned live on the kind particle3d draws here and saved back into that file. It is
// the kit studio's editor, card for card and field for field: the chosen effect's layers, each a card, every one shut
// on load, its title saying what it throws, how many and how often; mute it or play it alone (on this page only, never
// saved), move it up or down, copy it, remove it, or add a new one (a layer, another effect as a layer, or a lamp). A
// layer that names another effect of the kind (`{ effect, at }`) is, opened, that name and where it is thrown from. A
// lamp (`{ lamp }`) is, opened, every field of its light (`LAMP_SPEC`): its intensity, reach and fall-off, which it
// always has, its colour, flicker, offset, shadows, and a spot's angle and penumbra, × on Spot making it a point light
// again. Every other layer is an emitter: opened, its headline fields (how many, how often, how long, size, colour,
// brightness, speed, swirl), and under them folders, each shut until opened and saying how many of its fields are set:
// Timing, Colour and fade, Picture, Where it starts, Forces and Light. Each field is one line, its name, its control and
// ×; a number is typed, or dragged across the field's name (Shift ten times, Alt a tenth); a field left out shows
// greyed in its control what particle3d does without it; a value set turns its name white, a value changed since the
// file was read amber, and × takes the field out of the layer. `life` and `lasts` are one or the other. `pace` and
// `flips` are lists of lists, written as JSON. Every field particle3d reads (its `FIELDS`, its `LAMP`) has a control
// here, and the module throws on load when one has none.
//
// Over the cards: a button for each effect, the one chosen lit, an effect changed and not saved marked; whether
// anything is changed; Revert, which drops every change; and Save, which hands the whole file to `save`. The build
// names each effect in full, `<kind>/<name>`, and particle3d plays them so; each change is written into the game's
// effects file as this page's loader holds it (`write`), which particle3d takes as a written file from its next step,
// the chosen effect with its muted layers out. Sheets and clips are the game's loader's: this game's catalogue has no
// sheets, so their rows say so.
//
// `effectsEditor(host, kind, file, write, save)`: `host` the element it fills, `kind` the kit kind, `file` its effects
// by their own names, `write(effects)` the kind's effects by their full names as they now play, `save(file)` the
// whole file as it now stands.
import { FIELDS, LAMP } from '#plugins/particle3d/particle3d.plugin.ts'

type Layer = Record<string, any>
type File = Record<string, Layer[]>
type Spec = { kind: string; label: string; none: string; min?: number; max?: number; step?: number; count?: number; names?: string[]; example?: string }

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}
const hex = (n: number) => `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const SPEC: Record<string, Spec> = {
  n: { kind: 'range', label: 'Count', none: '1', min: 0, max: 400, step: 1 },
  every: { kind: 'number', label: 'Repeat every (s)', none: 'once', min: 0, max: 2, step: 0.005 },
  after: { kind: 'number', label: 'Delay (s)', none: '0', min: 0, max: 5, step: 0.01 },
  life: { kind: 'range', label: 'Lifetime (s)', none: '', min: 0, max: 10, step: 0.01 },
  lasts: { kind: 'bool', label: 'Lives with effect', none: '' },
  skip: { kind: 'number', label: 'Start offset (s)', none: '0', min: 0, max: 5, step: 0.01 },
  sheet: { kind: 'sheet', label: 'Sheet', none: 'squares' },
  clip: { kind: 'clip', label: 'Clip', none: '' },
  play: { kind: 'bool', label: 'Sheet timing', none: '' },
  size: { kind: 'range', label: 'Size (m)', none: '1', min: 0, max: 10, step: 0.005 },
  grow: { kind: 'number', label: 'Grow (×)', none: '1', min: 0, max: 40, step: 0.01 },
  dir: { kind: 'vector', label: 'Direction', none: 'spawn', count: 3, min: -1, max: 1, step: 0.01, names: ['x', 'y', 'z'] },
  spread: { kind: 'number', label: 'Spread (rad)', none: 'all', min: 0, max: Math.PI, step: 0.01 },
  speed: { kind: 'range', label: 'Speed (m/s)', none: '0', min: 0, max: 60, step: 0.05 },
  jitter: { kind: 'vector', label: 'Jitter (m)', none: '0', count: 3, min: 0, max: 5, step: 0.01, names: ['x', 'y', 'z'] },
  box: { kind: 'vector', label: 'Spawn box (m)', none: '', count: 6, min: -10, max: 10, step: 0.01, names: ['x', 'y', 'z', 'x', 'y', 'z'] },
  g: { kind: 'number', label: 'Gravity (m/s²)', none: '0', min: -40, max: 40, step: 0.1 },
  drag: { kind: 'number', label: 'Drag (/s)', none: '0', min: 0, max: 20, step: 0.05 },
  pull: { kind: 'number', label: 'Pull (m/s²)', none: '0', min: -100, max: 100, step: 0.1 },
  swirl: { kind: 'number', label: 'Swirl (rad/s)', none: '0', min: -30, max: 30, step: 0.05 },
  axis: { kind: 'vector', label: 'Swirl axis', none: 'dir', count: 3, min: -1, max: 1, step: 0.01, names: ['x', 'y', 'z'] },
  pace: { kind: 'json', label: 'Pace', none: '', example: '[[0.2, 0.5], [0.4, 0]]' },
  follow: { kind: 'bool', label: 'Follow point', none: '' },
  flips: { kind: 'json', label: 'Flips', none: '', example: '[[0.1, 1, 0]]' },
  tint: { kind: 'colour', label: 'Colour', none: 'white' },
  tint1: { kind: 'colour', label: 'End colour', none: 'same' },
  gain: { kind: 'number', label: 'Brightness (×)', none: '1', min: 0, max: 40, step: 0.05 },
  a0: { kind: 'number', label: 'Start opacity', none: '1', min: 0, max: 1, step: 0.01 },
  a1: { kind: 'number', label: 'End opacity', none: '1', min: 0, max: 1, step: 0.01 },
  fade: { kind: 'number', label: 'Fade (s)', none: 'life', min: 0, max: 10, step: 0.01 },
  spin: { kind: 'number', label: 'Spin (rad/s)', none: '0', min: 0, max: 30, step: 0.1 },
  origin: { kind: 'vector', label: 'Pivot', none: '0.5', count: 2, min: 0, max: 1, step: 0.01, names: ['x', 'y'] },
  add: { kind: 'bool', label: 'Additive', none: '' },
  stretch: { kind: 'bool', label: 'Stretch on path', none: '' },
  face: { kind: 'bool', label: 'Face direction', none: '' },
  beam: { kind: 'bool', label: 'Beam to target', none: '' },
  light: { kind: 'light', label: 'Point light', none: '' },
}
for (const f of FIELDS) if (!SPEC[f]) throw new Error(`the effects editor has no control for particle3d's field ${f}`)
const HEADLINE = ['n', 'every', 'life', 'size', 'tint', 'gain', 'speed', 'swirl']
const FOLDERS: [string, string[]][] = [
  ['Timing', ['after', 'lasts', 'skip']],
  ['Colour and fade', ['tint1', 'a0', 'a1', 'fade', 'add']],
  ['Picture', ['sheet', 'clip', 'play', 'grow', 'spin', 'origin', 'stretch', 'face', 'beam', 'flips']],
  ['Where it starts', ['dir', 'spread', 'jitter', 'box']],
  ['Forces', ['g', 'drag', 'pull', 'axis', 'pace', 'follow']],
  ['Light', ['light']],
]
for (const f of FIELDS) if (!HEADLINE.includes(f) && !FOLDERS.some(([, fs]) => fs.includes(f))) throw new Error(`the effects editor shows particle3d's field ${f} nowhere`)

const LAMP_SPEC: Record<string, Spec> = {
  intensity: { kind: 'number', label: 'Intensity', none: '', min: 0, max: 200, step: 0.1 },
  distance: { kind: 'number', label: 'Reach (m)', none: '', min: 0, max: 60, step: 0.05 },
  decay: { kind: 'number', label: 'Fall-off', none: '', min: 0, max: 4, step: 0.05 },
  tint: { kind: 'colour', label: 'Colour', none: 'white' },
  flicker: { kind: 'number', label: 'Flicker', none: '0', min: 0, max: 1, step: 0.01 },
  at: { kind: 'vector', label: 'Offset (m)', none: '0', count: 3, min: -10, max: 10, step: 0.01, names: ['x', 'y', 'z'] },
  shadow: { kind: 'bool', label: 'Shadows', none: '' },
  spot: { kind: 'spot', label: 'Spot', none: 'point' },
}
for (const f of LAMP) if (!LAMP_SPEC[f]) throw new Error(`the effects editor has no control for particle3d's lamp field ${f}`)
// A new lamp's numbers, and a new layer's: the kit studio's, starting points to turn.
const freshLamp = () => ({ lamp: { intensity: 5, distance: 6, decay: 2, tint: 0xffa443, flicker: 0.3 } })
const fresh = () => ({ n: [20, 20], life: [1, 1], size: [0.08, 0.15], speed: [1, 2], gain: 2, a1: 0, add: true })

export const EFFECTS_STYLE = `
[data-panel="library"] .effects{ --line: #2c2f35; --text: #e2e4e8; --dim: #8d929b; --accent: #e0a33a; --pick: #4fc3ff; margin: 8px 0; border: 1px solid var(--line); border-radius: 6px; background: #1a1b1e; font: 12px/1.45 system-ui; color: var(--text) }
[data-panel="library"] .effects * { box-sizing: border-box }
[data-panel="library"] .effects button, [data-panel="library"] .effects select, [data-panel="library"] .effects input { font: inherit; color: var(--text); width: auto }
[data-panel="library"] .effects button { padding: 4px 9px; border: 1px solid var(--line); border-radius: 6px; background: #26292e; cursor: pointer }
[data-panel="library"] .effects button.go { background: var(--accent); border-color: var(--accent); color: #111; font-weight: 600 }
[data-panel="library"] .effects button:disabled { opacity: .35; cursor: default }
[data-panel="library"] .effects select, [data-panel="library"] .effects input { background: #121316; border: 1px solid var(--line); border-radius: 4px; padding: 2px 6px }
[data-panel="library"] .effects .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 6px; border-bottom: 1px solid var(--line) }
[data-panel="library"] .effects .bar .effect.on { border-color: var(--pick); color: var(--pick) }
[data-panel="library"] .effects .bar .effect.changed::after { content: ' •'; color: var(--accent) }
[data-panel="library"] .effects .state { color: var(--dim); width: 100% }
[data-panel="library"] .effects .state.dirty { color: var(--accent) }
[data-panel="library"] .effects .error { color: #ffb4b4; padding: 6px; white-space: pre-wrap; display: none }
[data-panel="library"] .effects .layer { border-bottom: 1px solid var(--line) }
[data-panel="library"] .effects .layer.muted .top .what, [data-panel="library"] .effects .layer.muted .top .often, [data-panel="library"] .effects .layer.muted .top .index { opacity: .4 }
[data-panel="library"] .effects .layer > .top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 3px 4px }
[data-panel="library"] .effects .layer:not(.shut) > .top { background: #202226 }
[data-panel="library"] .effects .top .title { flex: 1 1 100%; display: flex; gap: 6px; cursor: pointer; overflow: hidden; white-space: nowrap }
[data-panel="library"] .effects .top .chev, [data-panel="library"] .effects .folder .chev { width: 12px; color: var(--dim); font-size: 10px }
[data-panel="library"] .effects .top .index { color: var(--dim) }
[data-panel="library"] .effects .top .what { font-weight: 600 }
[data-panel="library"] .effects .top .often { color: var(--dim); overflow: hidden; text-overflow: ellipsis }
[data-panel="library"] .effects button.tool { padding: 1px 5px; font-size: 11px; background: transparent; border-color: transparent; color: var(--dim) }
[data-panel="library"] .effects button.tool.on { color: var(--accent); border-color: #4a3a22 }
[data-panel="library"] .effects .layer.shut > .body { display: none }
[data-panel="library"] .effects .folder { display: flex; gap: 6px; width: 100%; padding: 2px 6px; border: 0; border-top: 1px solid var(--line); border-radius: 0; background: transparent; font-weight: 600; text-align: left }
[data-panel="library"] .effects .folder .count { margin-left: auto; color: var(--dim); font-weight: 400 }
[data-panel="library"] .effects .row { display: grid; grid-template-columns: 86px 1fr 16px; align-items: center; gap: 4px; padding: 1px 4px }
[data-panel="library"] .effects .row .name { color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: none }
[data-panel="library"] .effects .row .name.scrub { cursor: ew-resize }
[data-panel="library"] .effects .row.set .name { color: var(--text) }
[data-panel="library"] .effects .row.changed .name { color: var(--accent) }
[data-panel="library"] .effects .row .val { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; min-width: 0 }
[data-panel="library"] .effects .num { flex: 1 1 40px; min-width: 0; display: flex; align-items: center; background: #131417; border: 1px solid #2a2d33; border-radius: 4px }
[data-panel="library"] .effects .num .axis { width: 12px; text-align: center; font-size: 10px; font-weight: 600 }
[data-panel="library"] .effects .num .axis.x { color: #e5675f } [data-panel="library"] .effects .num .axis.y { color: #7cc46a } [data-panel="library"] .effects .num .axis.z { color: #5f9de5 }
[data-panel="library"] .effects .num input { flex: 1; min-width: 0; width: 100%; padding: 0 4px; border: 0; background: transparent }
[data-panel="library"] .effects .num input::placeholder { color: #5d626b }
[data-panel="library"] .effects .row .to, [data-panel="library"] .effects .row .hex, [data-panel="library"] .effects .row .note { color: var(--dim); font-size: 11px }
[data-panel="library"] .effects .row input[type=color] { width: 28px; height: 18px; padding: 0 }
[data-panel="library"] .effects .row input.code { flex: 1; min-width: 0; font: 11px ui-monospace, Menlo, monospace }
[data-panel="library"] .effects .row .clear { padding: 0; width: 16px; height: 16px; border: 0; background: transparent; color: var(--dim) }
[data-panel="library"] .effects .row:not(.set) .clear, [data-panel="library"] .effects .row.fixed .clear { visibility: hidden }
[data-panel="library"] .effects .empty { color: var(--dim); padding: 6px }
[data-panel="library"] .effects .add { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px }
`

export function effectsEditor(host: HTMLElement, kind: string, file: File, write: (effects: File) => void, save: (file: File) => void) {
  const pristine: File = structuredClone(file)
  const working: File = structuredClone(file)
  let effect = Object.keys(working)[0]
  const muted = new Set<number>()
  let solo: number | undefined
  const opened = new Set<number>()
  const folders = new Set<string>()
  const changedEffects = () => Object.keys(working).filter(n => !same(working[n], pristine[n]))

  host.classList.add('effects')
  const bar = make('div', 'bar')
  const picks = make('span')
  picks.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px'
  const state = make('span', 'state')
  const revert = make('button', '', 'Revert')
  const saveButton = make('button', 'go', `Save to ${kind.split('/').pop()}.effects.json`)
  bar.append(picks, state, revert, saveButton)
  const errorBox = make('div', 'error')
  const edit = make('div')
  host.replaceChildren(bar, errorBox, edit)

  // each effect by its full name, a layer naming another of the kind's effects by its full name too; the chosen one's
  // muted layers out
  const full = (layers: Layer[]) => layers.map(l => ('effect' in l ? { ...l, effect: `${kind}/${l.effect}` } : l))
  const restage = () => {
    const out: File = {}
    for (const [n, layers] of Object.entries(working)) {
      const shown = n !== effect ? layers : layers.filter((_, i) => (solo === undefined ? !muted.has(i) : i === solo))
      out[`${kind}/${n}`] = structuredClone(full(shown))
    }
    write(out)
  }

  function nav() {
    const changed = changedEffects()
    picks.replaceChildren(...Object.keys(working).map(n => {
      const b = make('button', 'effect', n)
      b.classList.toggle('on', n === effect)
      b.classList.toggle('changed', changed.includes(n))
      b.onclick = () => choose(n)
      return b
    }))
  }
  function choose(n: string) {
    effect = n
    muted.clear(); solo = undefined; opened.clear(); folders.clear()
    restage(); nav(); editor(); status()
  }
  function status() {
    const n = changedEffects().length
    state.textContent = n ? `${n} effect${n === 1 ? '' : 's'} changed, not saved` : 'Everything saved'
    state.classList.toggle('dirty', n > 0)
    saveButton.disabled = !n
    revert.disabled = !n
  }
  revert.onclick = () => {
    for (const k of Object.keys(working)) delete working[k]
    Object.assign(working, structuredClone(pristine))
    if (!working[effect]) effect = Object.keys(working)[0]
    choose(effect)
  }
  saveButton.onclick = () => {
    save(structuredClone(working))
    for (const k of Object.keys(pristine)) delete pristine[k]
    Object.assign(pristine, structuredClone(working))
    nav(); editor(); status()
  }

  const changed = () => { errorBox.style.display = 'none'; restage(); nav(); status() }
  const layers = () => working[effect]

  function row(into: HTMLElement, label: string, l: Layer, k: string, i: number, was: unknown = pristine[effect]?.[i]?.[k]) {
    const r = make('div', 'row')
    r.classList.toggle('set', l[k] !== undefined)
    r.classList.toggle('changed', !same(l[k], was))
    const val = make('span', 'val')
    const clear = make('button', 'clear', '×')
    clear.disabled = l[k] === undefined
    clear.onclick = () => { delete l[k]; changed(); editor() }
    const name = make('span', 'name', label)
    r.append(name, val, clear)
    into.append(r)
    const mark = () => { r.classList.add('set'); r.classList.toggle('changed', !same(l[k], was)); clear.disabled = false }
    return { val, mark, name }
  }

  const decimals = (step: number) => Math.max(0, -Math.floor(Math.log10(step)))
  function numField(into: HTMLElement, v: number | undefined, step: number, shown: string, set: (n: number) => void, axis?: string) {
    const wrap = make('span', 'num')
    if (axis) wrap.append(make('span', `axis ${axis}`, axis))
    const input = make('input')
    input.type = 'text'; input.inputMode = 'decimal'; input.spellcheck = false
    input.value = v === undefined ? '' : String(v)
    input.placeholder = shown
    input.oninput = () => { const n = Number(input.value); if (input.value.trim() !== '' && Number.isFinite(n)) set(n) }
    input.onkeydown = e => { if (e.key === 'Enter') input.blur() }
    wrap.append(input)
    into.append(wrap)
    const get = () => (input.value.trim() === '' ? undefined : Number(input.value))
    const put = (n: number) => { input.value = String(+n.toFixed(decimals(step))); set(+n.toFixed(decimals(step))) }
    return { input, get, put }
  }
  function scrub(name: HTMLElement, nums: ReturnType<typeof numField>[], step: number, from: (i: number) => number, least = -Infinity) {
    name.classList.add('scrub')
    name.onpointerdown = e => {
      e.preventDefault()
      name.setPointerCapture(e.pointerId)
      const x0 = e.clientX
      const base = nums.map((n, i) => n.get() ?? from(i))
      name.onpointermove = m => {
        const k = m.shiftKey ? 10 : m.altKey ? 0.1 : 1
        const d = (m.clientX - x0) * step * k
        nums.forEach((n, i) => n.put(Math.max(least, base[i] + d)))
      }
      name.onpointerup = () => { name.onpointermove = null; name.onpointerup = null }
    }
  }

  function control(into: HTMLElement, l: Layer, k: string, i: number, spec: Record<string, Spec> = SPEC, was: unknown = pristine[effect]?.[i]?.[k]) {
    const s = spec[k]
    if (k === 'life' && l.lasts) return
    if (k === 'clip' && !l.sheet) return
    const { val, mark, name } = row(into, s.label, l, k, i, was)
    const put = (v: unknown) => {
      l[k] = v
      if (k === 'life') delete l.lasts
      if (k === 'lasts') delete l.life
      mark(); changed()
    }
    const shown = s.none
    const least = (s.min ?? -Infinity) >= 0 ? s.min! : -Infinity
    if (s.kind === 'number') {
      const n = numField(val, l[k], s.step!, shown, v => put(v))
      scrub(name, [n], s.step!, () => Number(shown) || 0, least)
    } else if (s.kind === 'range') {
      const v = l[k] ?? []
      const lo = numField(val, v[0], s.step!, shown, n => put([n, Math.max(n, (l[k] ?? [n, n])[1])]))
      val.append(make('span', 'to', 'to'))
      const hi = numField(val, v[1], s.step!, shown, n => put([Math.min(n, (l[k] ?? [n, n])[0]), n]))
      scrub(name, [lo, hi], s.step!, () => Number(shown) || 0, least)
    } else if (s.kind === 'vector') {
      const v = l[k] ?? []
      const nums = s.names!.map((axis, j) => numField(val, v[j], s.step!, s.count === 6 ? '' : shown, n => {
        const now = [...(l[k] ?? Array(s.count).fill(0))]
        now[j] = n
        if (k === 'axis' && Math.hypot(...now) === 0) return
        put(now)
      }, axis))
      scrub(name, nums, s.step!, () => 0)
    } else if (s.kind === 'bool') {
      const box = make('input'); box.type = 'checkbox'; box.checked = !!l[k]
      box.onchange = () => {
        if (box.checked) put(true)
        else { delete l[k]; if (k === 'lasts') l.life = [1, 1]; changed(); editor() }
      }
      val.append(box)
    } else if (s.kind === 'colour') {
      const c = make('input'); c.type = 'color'; c.value = hex(l[k] ?? 0xffffff)
      const code = make('span', 'hex', l[k] === undefined ? shown : hex(l[k]))
      c.oninput = () => { code.textContent = c.value; put(parseInt(c.value.slice(1), 16)) }
      val.append(c, code)
    } else if (s.kind === 'sheet') {
      const sel = make('select')
      sel.append(new Option(l.sheet ?? s.none, l.sheet ?? ''))
      sel.disabled = true
      val.append(sel, make('span', 'note', 'this game\'s catalogue has no sheets'))
    } else if (s.kind === 'clip') {
      val.append(make('span', 'note', `${l.clip ?? ''} (this game's catalogue has no sheets)`))
    } else if (s.kind === 'light') {
      const box = make('input'); box.type = 'checkbox'; box.checked = !!l.light
      box.onchange = () => {
        if (box.checked) put({ intensity: 1, distance: 2, decay: 2 })
        else { delete l.light; changed() }
        editor()
      }
      val.append(box)
      if (l.light) {
        const nums = ['intensity', 'distance', 'decay'].map(f => numField(val, l.light[f], 0.05, f, v => put({ ...l.light, [f]: Math.max(0, v) })))
        scrub(name, nums, 0.05, j => [1, 2, 2][j], 0)
      }
    } else if (s.kind === 'spot') {
      const v = l[k] ?? {}
      const set = (f: string, n: number) => put({ angle: 0.6, penumbra: 0.4, ...(l[k] ?? {}), [f]: n })
      const angle = numField(val, v.angle, 0.01, 'angle', n => set('angle', Math.min(Math.PI / 2, Math.max(0.01, n))))
      val.append(make('span', 'to', 'soft'))
      const pen = numField(val, v.penumbra, 0.01, 'penumbra', n => set('penumbra', Math.min(1, Math.max(0, n))))
      scrub(name, [angle, pen], 0.01, j => [0.6, 0.4][j], 0)
    } else if (s.kind === 'json') {
      const t = make('input')
      t.type = 'text'; t.spellcheck = false; t.className = 'code'
      t.value = l[k] === undefined ? '' : JSON.stringify(l[k])
      t.placeholder = s.example!
      t.oninput = () => {
        try {
          const v = JSON.parse(t.value)
          if (!Array.isArray(v) || !v.every(e => Array.isArray(e) && e.every(n => typeof n === 'number'))) return
          t.style.borderColor = ''
          put(v)
        } catch { t.style.borderColor = '#a33' }
      }
      val.append(t)
    }
  }

  function card(l: Layer, i: number) {
    const c = make('div', 'layer')
    c.classList.toggle('muted', solo === undefined ? muted.has(i) : solo !== i)
    c.classList.toggle('shut', !opened.has(i))
    const top = make('div', 'top')
    const what = 'lamp' in l ? 'lamp' : 'effect' in l ? l.effect : l.clip ?? 'squares'
    const often = 'lamp' in l ? `${l.lamp.spot ? 'a spot light' : 'a point light'}, ${l.lamp.intensity} over ${l.lamp.distance} m`
      : 'effect' in l ? 'every layer of it' : `${l.n ? (l.n[0] === l.n[1] ? l.n[0] : `${l.n[0]}–${l.n[1]}`) : 1} ${l.every ? `every ${l.every} s` : 'once'}`
    const title = make('span', 'title')
    title.append(make('span', 'chev', opened.has(i) ? '▾' : '▸'), make('span', 'index', String(i + 1)), make('span', 'what', what), make('span', 'often', often))
    title.onclick = () => { if (opened.has(i)) opened.delete(i); else opened.add(i); editor() }
    top.append(title)
    const button = (text: string, on: boolean, f: () => void) => {
      const b = make('button', `tool${on ? ' on' : ''}`, text)
      b.onclick = f
      top.append(b)
    }
    button('Mute', muted.has(i), () => { if (muted.has(i)) muted.delete(i); else muted.add(i); restage(); editor() })
    button('Solo', solo === i, () => { solo = solo === i ? undefined : i; restage(); editor() })
    // what is opened, muted and played alone follows each layer to where it now stands
    const follow = (to: (j: number) => number | undefined) => {
      const map = (s: Set<number>) => { const was = [...s]; s.clear(); for (const j of was) { const k = to(j); if (k !== undefined) s.add(k) } }
      map(opened); map(muted)
      const was = [...folders]
      folders.clear()
      for (const f of was) {
        const [j, ...name] = f.split(' ')
        const k = to(Number(j))
        if (k !== undefined) folders.add(`${k} ${name.join(' ')}`)
      }
      solo = solo === undefined ? undefined : to(solo)
    }
    const move = (to: number) => {
      const list = layers()
      if (to < 0 || to >= list.length) return
      ;[list[i], list[to]] = [list[to], list[i]]
      follow(j => (j === i ? to : j === to ? i : j))
      changed(); editor()
    }
    button('↑', false, () => move(i - 1))
    button('↓', false, () => move(i + 1))
    button('Copy', false, () => { layers().splice(i + 1, 0, structuredClone(l)); follow(j => (j > i ? j + 1 : j)); changed(); editor() })
    button('Delete', false, () => { layers().splice(i, 1); follow(j => (j === i ? undefined : j > i ? j - 1 : j)); changed(); editor() })
    const body = make('div', 'body')
    c.append(top, body)
    if (!opened.has(i)) return c
    if ('lamp' in l) {
      const was = pristine[effect]?.[i]?.lamp ?? {}
      for (const k of Object.keys(LAMP_SPEC)) {
        control(body, l.lamp, k, i, LAMP_SPEC, was[k])
        if (['intensity', 'distance', 'decay'].includes(k)) (body.lastChild as HTMLElement).classList.add('fixed')
      }
      return c
    }
    if ('effect' in l) {
      const which = row(body, 'Effect', l, 'effect', i)
      const sel = make('select')
      for (const n of Object.keys(working)) if (n !== effect) sel.append(new Option(n, n, false, n === l.effect))
      sel.onchange = () => { l.effect = sel.value; changed(); editor() }
      which.val.append(sel)
      which.name.parentElement!.classList.add('fixed')
      const at = row(body, 'Offset (m)', l, 'at', i)
      const v = l.at ?? []
      const nums = ['x', 'y', 'z'].map((axis, j) => numField(at.val, v[j], 0.05, '0', n => {
        const now = [...(l.at ?? [0, 0, 0])]
        now[j] = n
        l.at = now
        at.mark(); changed()
      }, axis))
      scrub(at.name, nums, 0.05, () => 0)
      return c
    }
    for (const k of HEADLINE) control(body, l, k, i)
    for (const [name, keys] of FOLDERS) {
      const key = `${i} ${name}`
      const open = folders.has(key)
      const set = keys.filter(k => l[k] !== undefined).length
      const head = make('button', `folder${open ? ' open' : ''}`)
      head.append(make('span', 'chev', open ? '▾' : '▸'), make('span', '', name), make('span', 'count', set ? `${set} set` : ''))
      head.onclick = () => { if (open) folders.delete(key); else folders.add(key); editor() }
      body.append(head)
      if (open) {
        const inner = make('div', 'inner')
        for (const k of keys) control(inner, l, k, i)
        body.append(inner)
      }
    }
    return c
  }

  function editor() {
    const list = layers() ?? []
    edit.replaceChildren(...list.map(card))
    if (!list.length) edit.append(make('div', 'empty', 'This effect has no layers.'))
    const add = make('div', 'add')
    const emitter = make('button', '', 'Add a layer')
    emitter.onclick = () => { list.push(fresh()); opened.add(list.length - 1); changed(); editor() }
    const ref = make('button', '', 'Add another effect as a layer')
    const other = Object.keys(working).find(n => n !== effect)
    ref.disabled = !other
    ref.onclick = () => { list.push({ effect: other }); opened.add(list.length - 1); changed(); editor() }
    const lamp = make('button', '', 'Add a lamp')
    lamp.onclick = () => { list.push(freshLamp()); opened.add(list.length - 1); changed(); editor() }
    add.append(emitter, ref, lamp)
    edit.append(add)
  }

  nav()
  editor()
  status()
  return { working, fail: (e: unknown) => { errorBox.style.display = 'block'; errorBox.textContent = e instanceof Error ? e.message : String(e) } }
}
