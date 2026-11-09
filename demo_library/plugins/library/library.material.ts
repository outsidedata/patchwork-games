// The material studio, the library plugin's third tool (`library.plugin.ts`): one material of pro-ng's at a time, drawn
// alone, its settings beside it. It works on the catalogue build (`assets/build.ts materials`, the place `materials`),
// which holds every material of `pro-ng/materials.json` in one looks file and one mesh; nothing is built to pick one.
// `material()` hands back `panel(plugins, d, frame)`, called each frame the tool is up, and `close(plugins)`. Its numbers
// are the `library` definition's `material` (`assets/demo_library.json`).
//
//   The list    down the left (`list`, [x, y, width, height], renderdom's), every material of pro-ng's
//               `materials.json` by its family, as the game's addon reads it live (the `library` row's `materials`,
//               listed again whenever it changes), as text, under a filter box: a material whose name, look or family
//               holds every word typed is listed. A press picks it; ↑ and ↓ pick the one listed above or below the
//               picked one. A truth in a tab reads no library, so there the list is the build's own (`library.studio`).
//               A material the build does not hold yet is listed dimmed and drawn once the addon has built the
//               catalogue again with it.
//   The knobs   down the right (`knobs`): the picked material's name, its look and family, then each of its settings
//               (`library.knobs`, each look's ranges), a range with its number box beside it, a colour a colour box; a
//               change is written with supershader3d's `set` and drawn the next frame. A setting not at the value the
//               build gave it is marked, and `reset` puts every setting back to that value.
//   Drawn       the picked material alone: world3d's mesh of the place is hidden, and a mesh of the picked material's
//               triangles drawn in its place, the place's own attributes with an index of only the triangles whose
//               `lookId` is the material's number, under supershader3d's material for its call; a material whose look
//               has its own mesh (a sidecar, `library.sidecars`, pro-ng's `material/looks/<look>.json`) is drawn on that
//               mesh instead, its faces carrying the slots and every input it names, its courses written into
//               world3d's course table, as pro-ng's looks studio draws them (`lookMesh`). The camera is put on it
//               (`frame(middle, reach)`) each time one is picked.
//   The address The picked material is the page's address's `material` key (`d.material.address`), written as it is
//               picked, so the next client, made when the page goes to the build made again, comes back to it, and so
//               does a reload. With none, the first listed is picked. The filter is kept in the link's store.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'

// the link's store key the list's filter is kept under from one client to the next
const FILTER = 'library.filter'

type Knob = { label: string; min?: number; max?: number; step?: number; colour?: boolean }
type Studio = { families: { name: string; materials: { name: string; look: string; at: number[] }[] }[] }
type Sidecar = { faces: { corners: number[][]; normal: number[]; uv: number[][]; attributes?: Record<string, number[] | number[][]> }[]; courses?: { row: number; feet: number[]; wallDepth: number }[] }
// `at`, its swatch's spot, for a material the build holds
type Entry = { name: string; look: string; family: string; at?: number[] }
type Row = { kind: string; data: { materials?: { name: string; look: string; family: string }[] } }

export const MATERIAL_STYLE = `
  [data-panel="library list"], [data-panel="library knobs"] { background: #15171bf2; color: #e8e8e8; font: 13px system-ui; box-sizing: border-box; display: flex; flex-direction: column }
  [data-panel="library list"] input { font: inherit; margin: 8px; padding: 6px 8px; background: #0b0c0f; color: #e8e8e8; border: 1px solid #333a44; border-radius: 4px }
  [data-panel="library list"] .count { color: #7d8792; font-size: 11px; margin: 0 10px 6px }
  [data-panel="library list"] .names { overflow-y: auto; flex: 1; padding-bottom: 8px }
  [data-panel="library list"] .family { color: #7d8792; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin: 10px 10px 2px }
  [data-panel="library list"] .name { padding: 3px 10px 3px 16px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  [data-panel="library list"] .name:hover { background: #222831 }
  [data-panel="library list"] .name.picked { background: #2d5d8f; color: #fff }
  [data-panel="library list"] .name.unbuilt { color: #6b737c; font-style: italic }
  [data-panel="library knobs"] { padding: 12px; overflow-y: auto }
  [data-panel="library knobs"] h2 { margin: 0; font-size: 17px; word-break: break-word }
  [data-panel="library knobs"] .what { color: #9aa3ad; margin: 4px 0 12px }
  [data-panel="library knobs"] .knob { display: grid; grid-template-columns: 1fr 64px; gap: 2px 8px; align-items: center; margin: 0 0 10px; padding: 2px 4px; border-left: 2px solid transparent }
  [data-panel="library knobs"] .knob.changed { border-left-color: #f5a623 }
  [data-panel="library knobs"] .knob .label { grid-column: 1 / 3; color: #c8cdd3 }
  [data-panel="library knobs"] .knob input[type=range] { width: 100%; margin: 0 }
  [data-panel="library knobs"] .knob input[type=number], [data-panel="library knobs"] .knob .hex { font: 12px monospace; width: 100%; box-sizing: border-box; background: #0b0c0f; color: #e8e8e8; border: 1px solid #333a44 }
  [data-panel="library knobs"] .knob input[type=color] { width: 100%; height: 26px; padding: 0; border: 0; background: none }
  [data-panel="library knobs"] button { font: inherit; padding: 6px; margin-top: 4px }
  [data-panel="library knobs"] .none { color: #9aa3ad }
`

export function material() {
  let entries: Entry[] | undefined
  let picked: string | undefined
  let listEl: HTMLElement | undefined
  let knobsEl: HTMLElement | undefined
  let filter = ''
  // what the build gave each setting of each material, read the first time a material is shown
  const built = new Map<string, Record<string, number | number[]>>()
  // the place's mesh, hidden while the tool draws one material, and what it draws in its place
  let place: THREE.Mesh | undefined
  let alone: THREE.Mesh | undefined
  let sidecars: Map<string, THREE.Mesh> | undefined
  let framing = false

  const worldOf = (plugins: Plugins): Record<string, any> => plugins.wire.scene.world!
  const has = (plugins: Plugins, name: string) => name in worldOf(plugins).loader.assets
  // the row's materials the list was last made from
  let live: string | undefined
  const rowMaterials = (plugins: Plugins) => (plugins.wire.rows as Row[]).find(r => r.kind === 'library')?.data.materials
  // the row's materials as one string, to tell a list read again from the same list sent again
  const liveKey = (plugins: Plugins) => JSON.stringify(rowMaterials(plugins) ?? [])
  // every material, by its family as the build lays them out (the kit's first), with its swatch's spot where the
  // build holds it: the addon's live list, else (a truth in a tab) the build's own
  const listOf = (plugins: Plugins): Entry[] => {
    const built = (json(plugins.wire, 'library.studio') as Studio).families.flatMap(f => f.materials.map(m => ({ name: m.name, look: m.look, family: f.name, at: m.at })))
    const fresh = rowMaterials(plugins)
    if (!fresh?.length) return built
    const at = new Map(built.map(e => [e.name, e.at]))
    const families = [...new Set(fresh.map(m => m.family))].sort((a, b) => (a === 'kit' ? -1 : b === 'kit' ? 1 : 0))
    return families.flatMap(f => fresh.filter(m => m.family === f).map(m => ({ ...m, at: at.get(m.name) })))
  }

  // A look's own mesh (the looks studio's `lookMesh`): each face two triangles, wound so its front faces along its
  // normal, every attribute it names set by that name, one value the whole face or a list of four, one a corner; with
  // `id` its material's number in `lookId`, every other input of the place's mesh (`inputs`, by name and width) zero.
  const sidecarMesh = (T: typeof THREE, m: Sidecar, at: number[], id: number, inputs: Record<string, number>) => {
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], more: Record<string, number[]> = {}
    for (const f of m.faces) {
      const [a, b, c] = f.corners.map(p => new T.Vector3(...p))
      const out = b.clone().sub(a).cross(c.clone().sub(a)).dot(new T.Vector3(...f.normal)) > 0
      for (const i of out ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) {
        pos.push(f.corners[i][0] + at[0], f.corners[i][1] + at[1], f.corners[i][2] + at[2]); nor.push(...f.normal); uv.push(...f.uv[i])
        for (const [name, v] of Object.entries(f.attributes ?? {})) (more[name] ??= []).push(...(Array.isArray(v[0]) ? (v as number[][])[i] : (v as number[])))
      }
    }
    const g = new T.BufferGeometry()
    const n = pos.length / 3
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3))
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
    for (const [name, v] of Object.entries(more)) g.setAttribute(name, new T.Float32BufferAttribute(v, v.length / n))
    g.setAttribute('lookId', new T.Float32BufferAttribute(new Float32Array(n).fill(id), 1))
    for (const [name, width] of Object.entries(inputs)) if (!g.getAttribute(name)) g.setAttribute(name, new T.Float32BufferAttribute(new Float32Array(n * width), width))
    g.computeBoundingSphere()
    return g
  }

  // world3d's mesh of the place: the one mesh whose geometry carries `lookId` and is not the tool's own
  const findPlace = (plugins: Plugins) => {
    let found: THREE.Mesh | undefined
    plugins.render3d.scene.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.geometry?.getAttribute('lookId') && !m.userData.library) found = m
    })
    return found
  }

  // every material's own mesh at its swatch's spot, made once the place's mesh is drawn (its attributes the shader's
  // inputs), each shown with `every`, else hidden until its material is picked; the course table rows they read
  // written into world3d's
  const makeSidecars = (plugins: Plugins, every: boolean) => {
    const T = plugins.render3d.THREE as typeof THREE
    const ss = plugins.supershader3d
    const own: Record<string, Sidecar> = has(plugins, 'library.sidecars') ? json(plugins.wire, 'library.sidecars') : {}
    const inputs = Object.fromEntries(Object.entries(place!.geometry.attributes).map(([k, a]) => [k, (a as THREE.BufferAttribute).itemSize]))
    const table = plugins.world3d.courses(T) as THREE.DataTexture
    const width = table.image.width
    const data = table.image.data as Float32Array
    for (const m of Object.values(own)) for (const c of m.courses ?? []) {
      for (let k = 0; k < width - 1; k++) data[c.row * width + k] = k < c.feet.length ? c.feet[k] : 1e4 + k
      data[c.row * width + width - 1] = c.wallDepth
      table.needsUpdate = true
    }
    sidecars = new Map()
    for (const e of entries!) {
      const mesh = own[e.look]
      if (!mesh || !e.at) continue
      const id = ss.idOf(e.name)
      const drawn = new T.Mesh(sidecarMesh(T, mesh, [e.at[0], 0, e.at[2]], id, inputs), ss.material(ss.callOf(e.name)))
      drawn.userData.library = true
      drawn.castShadow = drawn.receiveShadow = true
      drawn.visible = every
      plugins.render3d.scene.add(drawn)
      sidecars.set(e.name, drawn)
    }
  }

  // the picked material drawn alone and the camera put on it
  const draw = (plugins: Plugins, frame: (middle: number[], reach: number) => void) => {
    const T = plugins.render3d.THREE as typeof THREE
    const ss = plugins.supershader3d
    for (const m of sidecars!.values()) m.visible = false
    if (alone) { plugins.render3d.scene.remove(alone); alone.geometry.dispose(); alone = undefined }
    const name = picked!
    // a material the build does not hold has nothing to draw until the addon has built it in
    if (!entries!.find(e => e.name === name)?.at) return
    let shown: THREE.Mesh
    const own = sidecars!.get(name)
    if (own) shown = own
    else {
      const id = ss.idOf(name) as number
      const geo = place!.geometry
      const lookId = geo.getAttribute('lookId').array as ArrayLike<number>
      const index = geo.getIndex()!.array as ArrayLike<number>
      const mine: number[] = []
      for (let i = 0; i < index.length; i += 3) if (Math.round(lookId[index[i]]) === id) mine.push(index[i], index[i + 1], index[i + 2])
      const g = new T.BufferGeometry()
      for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, a)
      g.setIndex(new T.BufferAttribute(new Uint32Array(mine), 1))
      // its bounds from its own corners alone: three's own reads every position of the shared attribute, the whole place
      const pos = geo.getAttribute('position')
      const corners = [...new Set(mine)].map(v => new T.Vector3(pos.getX(v), pos.getY(v), pos.getZ(v)))
      g.boundingBox = new T.Box3().setFromPoints(corners)
      g.boundingSphere = new T.Sphere().setFromPoints(corners)
      shown = alone = new T.Mesh(g, ss.material(ss.callOf(name)))
      alone.userData.library = true
      alone.castShadow = alone.receiveShadow = true
      alone.matrixAutoUpdate = false
      alone.matrix.copy(place!.matrixWorld)
      plugins.render3d.scene.add(alone)
    }
    shown.visible = true
    const s = shown.geometry.boundingSphere!.clone().applyMatrix4(shown.matrixWorld)
    frame([s.center.x, s.center.y, s.center.z], s.radius)
  }

  const pick = (plugins: Plugins, d: any, name: string) => {
    picked = name
    const url = new URL(location.href)
    url.searchParams.set(d.material.address, name)
    history.replaceState(null, '', url.href)
    framing = true
    for (const el of listEl?.querySelectorAll('.name') ?? []) {
      const on = (el as HTMLElement).dataset.name === name
      el.classList.toggle('picked', on)
      if (on) (el as HTMLElement).scrollIntoView({ block: 'nearest' })
    }
    fillKnobs(plugins, d)
  }

  // the entries a filter keeps: every word typed found in the name, the look or the family
  const kept = () => {
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean)
    return entries!.filter(e => words.every(w => `${e.name} ${e.look} ${e.family}`.toLowerCase().includes(w)))
  }

  const fillList = (plugins: Plugins, d: any) => {
    const names = listEl!.querySelector('.names') as HTMLElement
    const count = listEl!.querySelector('.count') as HTMLElement
    const shown = kept()
    names.replaceChildren()
    let family = ''
    for (const e of shown) {
      if (e.family !== family) {
        family = e.family
        names.append(Object.assign(document.createElement('div'), { className: 'family', textContent: family }))
      }
      const row = Object.assign(document.createElement('div'), { className: `name${e.name === picked ? ' picked' : ''}${e.at ? '' : ' unbuilt'}`, textContent: e.name, title: `${e.name} (${e.look})${e.at ? '' : ': not in this build yet'}` })
      row.dataset.name = e.name
      row.addEventListener('click', () => pick(plugins, d, e.name))
      names.append(row)
    }
    count.textContent = shown.length === entries!.length ? `${entries!.length} materials` : `${shown.length} of ${entries!.length} materials`
  }

  const makeList = (plugins: Plugins, d: any) => {
    const host = document.createElement('div')
    host.style.cssText = 'display: contents'
    const box = Object.assign(document.createElement('input'), { type: 'search', placeholder: 'filter: name, look or family', value: filter })
    // the filter kept in the link's store, so the next client, made when the page goes to a build, keeps it
    box.addEventListener('input', () => { filter = box.value; plugins.scenemanager.link.store[FILTER] = filter; fillList(plugins, d) })
    host.append(box, Object.assign(document.createElement('div'), { className: 'count' }), Object.assign(document.createElement('div'), { className: 'names' }))
    listEl = host
    fillList(plugins, d)
    return host
  }

  const fillKnobs = (plugins: Plugins, d: any) => {
    if (!knobsEl || !picked) return
    const T = plugins.render3d.THREE as typeof THREE
    const ss = plugins.supershader3d
    const e = entries!.find(q => q.name === picked)!
    if (!e.at) {
      knobsEl.replaceChildren(
        Object.assign(document.createElement('h2'), { textContent: e.name }),
        Object.assign(document.createElement('div'), { className: 'what', textContent: `${e.look} · ${e.family}` }),
        Object.assign(document.createElement('p'), { className: 'none', textContent: 'not in this build yet: the server builds the catalogue again with every material of materials.json, and the page goes to it once it is done.' }),
      )
      return
    }
    const knobs: Record<string, Knob> = (json(plugins.wire, 'library.knobs') as Record<string, Record<string, Knob>>)[e.name] ?? {}
    if (!built.has(e.name)) built.set(e.name, Object.fromEntries(Object.keys(knobs).map(k => [k, ss.setting(e.name, k)])))
    const was = built.get(e.name)!
    const toHex = (rgb: number[]) => '#' + new T.Color().setRGB(rgb[0], rgb[1], rgb[2], T.LinearSRGBColorSpace).getHexString()
    const same = (a: number | number[], b: number | number[]) => JSON.stringify(a) === JSON.stringify(b)
    knobsEl.replaceChildren(
      Object.assign(document.createElement('h2'), { textContent: e.name }),
      Object.assign(document.createElement('div'), { className: 'what', textContent: `${e.look} · ${e.family}` }),
    )
    const rows: (() => void)[] = []
    for (const [name, k] of Object.entries(knobs)) {
      const row = Object.assign(document.createElement('div'), { className: 'knob' })
      const label = Object.assign(document.createElement('div'), { className: 'label', textContent: k.label })
      const mark = () => row.classList.toggle('changed', !same(ss.setting(e.name, name), was[name]))
      if (k.colour) {
        const box = Object.assign(document.createElement('input'), { type: 'color' })
        const hex = Object.assign(document.createElement('input'), { className: 'hex' })
        const show = () => { box.value = hex.value = toHex(ss.setting(e.name, name) as number[]); mark() }
        const write = (text: string) => { const c = new T.Color(text); ss.set(e.name, name, [c.r, c.g, c.b]); show() }
        box.addEventListener('input', () => write(box.value))
        hex.addEventListener('change', () => { if (/^#?[0-9a-f]{6}$/i.test(hex.value.trim())) write(hex.value.trim().replace(/^#?/, '#')); else show() })
        row.append(label, box, hex)
        rows.push(show)
      } else {
        const n = was[name] as number
        const slider = Object.assign(document.createElement('input'), { type: 'range', min: String(k.min ?? Math.min(0, n)), max: String(k.max ?? Math.max(1, Math.abs(n) * d.material.rangeOver)), step: String(k.step ?? 'any') })
        const number = Object.assign(document.createElement('input'), { type: 'number', step: String(k.step ?? 'any') })
        const show = () => { const v = ss.setting(e.name, name) as number; slider.value = number.value = String(v); mark() }
        slider.addEventListener('input', () => { ss.set(e.name, name, Number(slider.value)); show() })
        number.addEventListener('change', () => { if (number.value !== '' && Number.isFinite(Number(number.value))) ss.set(e.name, name, Number(number.value)); show() })
        row.append(label, slider, number)
        rows.push(show)
      }
      knobsEl.append(row)
    }
    if (!rows.length) knobsEl.append(Object.assign(document.createElement('p'), { className: 'none', textContent: `${e.look} has no settings.` }))
    else {
      const reset = Object.assign(document.createElement('button'), { textContent: 'reset to the built values' })
      reset.addEventListener('click', () => { for (const [k, v] of Object.entries(was)) ss.set(e.name, k, v); rows.forEach(r => r()) })
      knobsEl.append(reset)
    }
    rows.forEach(r => r())
  }

  return {
    // whether the place is a catalogue build this tool works on
    holds: (plugins: Plugins) => has(plugins, 'library.studio') && has(plugins, 'library.knobs'),
    // ↑ and ↓: the material listed above or below the picked one
    keys: ['ArrowUp', 'ArrowDown'],
    key(plugins: Plugins, d: any, code: string) {
      if (!entries || !picked) return
      const shown = kept()
      const at = shown.findIndex(e => e.name === picked)
      const next = shown[Math.max(0, Math.min(shown.length - 1, at + (code === 'ArrowDown' ? 1 : -1)))]
      if (next && next.name !== picked) pick(plugins, d, next.name)
    },
    panel(plugins: Plugins, d: any, frame: (middle: number[], reach: number) => void) {
      const dom = plugins.renderdom
      const ss = plugins.supershader3d
      if (!entries) {
        filter = (plugins.scenemanager.link.store[FILTER] as string | undefined) ?? ''
        live = liveKey(plugins)
        entries = listOf(plugins)
        const asked = new URL(location.href).searchParams.get(d.material.address)
        picked = entries.some(e => e.name === asked) ? asked! : entries[0].name
        framing = true
      } else if (liveKey(plugins) !== live) {
        // materials.json read again by the addon (or first read, after the page came up): listed again
        live = liveKey(plugins)
        entries = listOf(plugins)
        if (!entries.some(e => e.name === picked)) picked = entries[0].name
        if (listEl) fillList(plugins, d)
        fillKnobs(plugins, d)
        framing = true
      }
      dom.panel('library list', d.material.list)
      dom.show('library list', 'list', () => makeList(plugins, d))
      dom.panel('library knobs', d.material.knobs)
      knobsEl = dom.show('library knobs', 'knobs', () => {
        const host = document.createElement('div')
        knobsEl = host
        if (ss?.looks?.()) fillKnobs(plugins, d)
        return host
      }) as HTMLElement
      if (!ss?.looks?.()) return
      if (!knobsEl.childElementCount) fillKnobs(plugins, d)
      place ??= findPlace(plugins)
      if (!place) return
      place.visible = false
      if (!sidecars) makeSidecars(plugins, false)
      if (framing) { framing = false; draw(plugins, frame) }
    },
    // A shot of the catalogue (`proof`): the whole place, every material on its swatch, each look's own mesh drawn on
    // its swatch's spot, as the looks studio's catalogue shows them; no list, no knobs.
    proof(plugins: Plugins) {
      if (sidecars || !plugins.supershader3d?.looks?.()) return
      entries ??= listOf(plugins)
      place ??= findPlace(plugins)
      if (place) makeSidecars(plugins, true)
    },
    close(plugins: Plugins) {
      if (alone) { plugins.render3d?.scene.remove(alone); alone.geometry.dispose() }
      for (const m of sidecars?.values() ?? []) { plugins.render3d?.scene.remove(m); m.geometry.dispose() }
      if (place) place.visible = true
      alone = sidecars = place = listEl = knobsEl = undefined
      framing = true
    },
  }
}
