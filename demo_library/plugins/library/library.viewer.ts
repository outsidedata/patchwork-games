// pro-ng's scene viewer (`pro-ng/viewer/index.html`), as the library plugin's part (`library.plugin.ts`): what it draws
// over the place and the panel's parts for it. `viewer()` hands back `panel(plugins, d, show, look)`, called each frame
// as the panel is drawn (`show` renderdom's, for the library's panel; `look(box)` puts the camera on a box), `keys`,
// the keys it takes, and `tick(plugins, d)`, called each frame after the camera. Its numbers are the `library`
// definition's `viewer` (`assets/demo_library.json`). It reads what `library.place.ts` names in the catalogue:
//
//   Walk shapes   the place's shapes3d file (`library.shapes`, pro-ng's `shapes.py`): each shape of its kind's at `pos`,
//                 turned `yaw`, a box from its foot's middle `size` [across, tall, long], a plane its middle, rising
//                 `tilt` along its length, a cylinder from its foot's middle; each drawn see-through (`opacity`) with its
//                 edges, coloured by its shape (`shapes`).
//   Nav graph     the place's nav3d graph (`library.nav`, pro-ng's `town_nav.py`): each way a line, or its spline's
//                 Catmull-Rom curve (`curve` points a point, at least `curveLeast`), `lift` over the ground, coloured
//                 by its word (`words`, else `wordElse`), and each place a point `point` pixels across, drawn over
//                 everything.
//   Ground        a plane `ground.across` times the place's reach, at y 0, `ground.colour`.
//   Show          supershader3d's views (its `lookView`: shaded, pieces, height, normal, solids) and `lookDebug`
//                 (every material in its flat colour).
//   Materials     each material the place draws, its settings as sliders (each look's ranges, `library.knobs`, from
//                 `assets/build.ts`), a colour as a colour box, each change written with supershader3d's `set`.
//   Sidecars      a catalogue build's looks' own meshes (`library.sidecars`, pro-ng's `material/looks/<look>.json`): each
//                 material whose look has one drawn on it at its swatch's spot, its faces carrying the slots (`s0` to
//                 `s3`) and every other input it names, the rest zero, its `courses` written into world3d's course
//                 table, as pro-ng's looks studio draws them (its `lookMesh`).
//   Studio        a catalogue build's (`library.studio`, `assets/build.ts`'s `buildMaterials`): a button for each family
//                 that puts the camera on its row, and every material, picked to put the camera on its swatch
//                 (`swatch` metres round it) and open its settings.
//   Things        the whole place, each building and each kit thing (`library.things.ts`, off the place's glb), its
//                 triangles beside it; a press puts the camera on its box.
//   Check spots   the scene's views (`library.proof`, pro-ng's `proof/<scene>.json`): `]` the next, `[` the one before,
//                 the camera at its eye looking at its point (the scene's axes, x east, y north, z up, made three's),
//                 its number, name and what should be seen there under the stats.
//   Clips, time   the scene's `world.library` may say `clip`, a clip every moving thing that has it plays in place of
//                 those that start on, `view` (one of VIEWS) and `flat`, the view and the flat colours it starts in,
//                 and `at`, seconds: the clips held at that moment and the looks' clock
//                 (supershader3d's `lookTime`) held there. `shapes` and `nav` true there start the overlays on.
//   Stats         the draw calls and triangles of the last frame, the materials and pictures of the looks.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import { binary, json } from '#plugins/loader/loader.sim.ts'
import { things, type Box, type Things } from './library.things.ts'

type Show = (key: string, make: () => HTMLElement) => HTMLElement
type Knob = { label: string; min?: number; max?: number; step?: number; colour?: boolean }
type View = { name: string; eye: number[]; at: number[]; expect?: string }

const VIEWS = ['shaded', 'pieces', 'height', 'normal', 'solids']

export function viewer() {
  let built = false
  let shapes: THREE.Group | undefined
  let nav: THREE.Group | undefined
  let ground: THREE.Mesh | undefined
  let listed: Things | undefined
  let reading = false
  let spot = -1
  let held = false
  let viewed = false
  const overlays = { shapes: false, nav: false, ground: false }

  const worldOf = (plugins: Plugins): Record<string, any> => plugins.wire.scene.world!
  const has = (plugins: Plugins, name: string) => name in worldOf(plugins).loader.assets

  // the overlays, made once render3d and the files are there
  const build = (plugins: Plugins, d: any) => {
    const T = plugins.render3d.THREE as typeof THREE
    const scene = plugins.render3d.scene as THREE.Scene
    const v = d.viewer
    const asked = worldOf(plugins).library ?? {}
    overlays.shapes = !!asked.shapes
    overlays.nav = !!asked.nav
    if (has(plugins, 'library.shapes')) {
      const file = json(plugins.wire, 'library.shapes')
      shapes = new T.Group()
      const fills: Record<string, THREE.Material> = {}, edges: Record<string, THREE.Material> = {}
      for (const [word, colour] of Object.entries(v.shapes as Record<string, string>)) {
        fills[word] = new T.MeshBasicMaterial({ color: colour, transparent: true, opacity: v.opacity, depthWrite: false, side: T.DoubleSide })
        edges[word] = new T.LineBasicMaterial({ color: colour })
      }
      for (const a of file.shapes) {
        const shape = file.kinds[a.kind].shape
        const word = Object.keys(shape)[0]
        const n = shape[word]
        let g: THREE.BufferGeometry
        if (word === 'box') { g = new T.BoxGeometry(n.size[0], n.size[1], n.size[2]); g.translate(0, n.size[1] / 2, 0) }
        else if (word === 'cylinder') { g = new T.CylinderGeometry(n.radius, n.radius, n.height, v.cylinderSides); g.translate(0, n.height / 2, 0) }
        else { g = new T.PlaneGeometry(n.size[0], n.size[1]); g.rotateX(-Math.PI / 2); g.rotateX(-(n.tilt ?? 0)) }
        const holder = new T.Group()
        holder.position.set(a.pos[0], a.pos[1], a.pos[2])
        holder.rotation.y = a.yaw
        holder.add(new T.Mesh(g, fills[word]), new T.LineSegments(new T.EdgesGeometry(g), edges[word]))
        shapes.add(holder)
      }
      shapes.visible = overlays.shapes
      scene.add(shapes)
    }
    if (has(plugins, 'library.nav')) {
      const file = json(plugins.wire, 'library.nav')
      nav = new T.Group()
      const up = (p: number[]) => [p[0], p[1] + v.lift, p[2]]
      const curve = (pts: number[][]) => new T.CatmullRomCurve3(pts.map(q => new T.Vector3(...up(q))), false, 'catmullrom', 0.5)
        .getPoints(Math.max(v.curveLeast, pts.length * v.curve)).map(p => p.toArray())
      const byWord: Record<string, number[]> = {}
      for (const w of file.ways) {
        const word = w.data?.nav3d?.word ?? 'ground'
        const pts = w.line ? [up(w.line.from), up(w.line.to)] : curve(w.spline.points)
        ;(byWord[word] ??= []).push(...pts.slice(1).flatMap((q: number[], i: number) => [...pts[i], ...q]))
      }
      for (const [word, flat] of Object.entries(byWord)) {
        const g = new T.BufferGeometry()
        g.setAttribute('position', new T.Float32BufferAttribute(flat, 3))
        const line = new T.LineSegments(g, new T.LineBasicMaterial({ color: v.words[word] ?? v.wordElse, depthTest: false }))
        line.renderOrder = v.over
        nav.add(line)
      }
      const spots = new T.BufferGeometry()
      spots.setAttribute('position', new T.Float32BufferAttribute(file.places.flatMap((p: { point: { at: number[] } }) => up(p.point.at)), 3))
      const points = new T.Points(spots, new T.PointsMaterial({ color: v.wordElse, size: v.point, sizeAttenuation: false, depthTest: false }))
      points.renderOrder = v.over
      nav.add(points)
      nav.visible = overlays.nav
      scene.add(nav)
    }
    built = true
  }

  // A look's own mesh (a sidecar, the looks studio's `lookMesh`): each face two triangles, wound so its front faces along
  // its normal, every attribute it names set by that name, one value the whole face or a list of four, one a corner; at
  // `at`, with `id` its material's number in `lookId`; every other input `inputs` lists (world3d's mesh's attributes,
  // the shader's inputs, by name and width) zero, as the looks studio leaves a sidecar's.
  type Sidecar = { faces: { corners: number[][]; normal: number[]; uv: number[][]; attributes?: Record<string, number[] | number[][]> }[]; courses?: { row: number; feet: number[]; wallDepth: number }[] }
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
    return g
  }
  let sidecars: THREE.Mesh[] | undefined

  // a box the camera is put on: its middle and its reach
  const boxOf = (b: Box) => ({ middle: b.min.map((x, i) => (x + b.max[i]) / 2), reach: Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2 })

  const goTo = (plugins: Plugins, k: number, put: (eye: number[], at: number[]) => void, label: HTMLElement) => {
    const views: View[] = has(plugins, 'library.proof') ? json(plugins.wire, 'library.proof').views : []
    if (!views.length) return
    spot = (k + views.length) % views.length
    const s = views[spot]
    // the scene's axes to three's: y up, north its -z
    put([s.eye[0], s.eye[2], -s.eye[1]], [s.at[0], s.at[2], -s.at[1]])
    label.textContent = `${spot + 1} / ${views.length}  ${s.name}\n${s.expect ?? ''}`
  }

  return {
    keys: ['BracketLeft', 'BracketRight'],
    key(plugins: Plugins, code: string, put: (eye: number[], at: number[]) => void, label: HTMLElement) {
      if (code === 'BracketRight') goTo(plugins, spot + 1, put, label)
      if (code === 'BracketLeft') goTo(plugins, spot - 1, put, label)
    },
    panel(plugins: Plugins, d: any, show: Show, look: (middle: number[], reach: number) => void, mesh: THREE.Mesh | undefined) {
      const v = d.viewer
      const T = plugins.render3d.THREE as typeof THREE
      const ss = plugins.supershader3d
      const heading = (key: string, text: string) => show(key, () => Object.assign(document.createElement('h3'), { textContent: text }))
      const tick = (key: string, text: string, on: () => boolean, set: (on: boolean) => void) => show(key, () => {
        const row = document.createElement('label')
        const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: on() })
        box.addEventListener('change', () => set(box.checked))
        row.append(box, ` ${text}`)
        return row
      })

      heading('viewer', 'Viewer')
      if (shapes) {
        const file = json(plugins.wire, 'library.shapes')
        tick('shapes', `walk shapes: ${file.shapes.length} of ${Object.keys(file.kinds).length} kinds`, () => overlays.shapes, on => { overlays.shapes = on; shapes!.visible = on })
        show('shapes key', () => { const p = document.createElement('p'); p.innerHTML = Object.entries(v.shapes).map(([w, c]) => `<span style="color:${c}">■</span> ${w}`).join(' &nbsp;'); return p })
      }
      if (nav) {
        const file = json(plugins.wire, 'library.nav')
        tick('nav', `nav graph: ${file.places.length} places, ${file.ways.length} ways`, () => overlays.nav, on => { overlays.nav = on; nav!.visible = on })
        show('nav key', () => { const p = document.createElement('p'); p.innerHTML = Object.entries(v.words).map(([w, c]) => `<span style="color:${c}">■</span> ${w}`).join(' &nbsp;'); return p })
      }
      tick('ground', 'ground', () => overlays.ground, on => {
        overlays.ground = on
        if (on && !ground && mesh) {
          mesh.geometry.computeBoundingSphere()
          const r = Math.max(mesh.geometry.boundingSphere!.radius, v.ground.least) * v.ground.across
          ground = new T.Mesh(new T.PlaneGeometry(r, r), new T.MeshStandardMaterial({ color: v.ground.colour, roughness: 1 }))
          ground.rotation.x = -Math.PI / 2
          ground.position.set(mesh.geometry.boundingSphere!.center.x, 0, mesh.geometry.boundingSphere!.center.z)
          ground.receiveShadow = true
          plugins.render3d.scene.add(ground)
        }
        if (ground) ground.visible = on
      })

      if (ss?.uniforms?.lookView) {
        heading('show', 'Show')
        show('views', () => {
          const row = document.createElement('div')
          for (const [i, name] of VIEWS.entries()) {
            const b = Object.assign(document.createElement('button'), { textContent: name, className: 'half' })
            b.addEventListener('click', () => { ss.uniforms.lookView.value = i })
            row.append(b)
          }
          return row
        })
        tick('flat', 'flat colours', () => ss.uniforms.lookDebug.value === 1, on => { ss.uniforms.lookDebug.value = on ? 1 : 0 })
      }

      const looks = ss?.looks?.()
      if (looks && has(plugins, 'library.knobs')) {
        const knobs: Record<string, Record<string, Knob>> = json(plugins.wire, 'library.knobs')
        heading('materials', `Materials (${looks.materials.length}, ${looks.pictures.length} pictures)`)
        for (const m of looks.materials as { name: string; look: string }[]) {
          show(`material ${m.name}`, () => {
            const box = document.createElement('details')
            box.append(Object.assign(document.createElement('summary'), { textContent: `${m.name} (${m.look})` }))
            for (const [name, k] of Object.entries(knobs[m.name] ?? {})) {
              const row = document.createElement('label')
              const value = ss.setting(m.name, name)
              const input = document.createElement('input')
              const shown = document.createElement('span')
              if (k.colour) {
                input.type = 'color'
                input.value = '#' + new T.Color().setRGB(...(value as [number, number, number]), T.LinearSRGBColorSpace).getHexString()
                shown.textContent = input.value
                input.addEventListener('input', () => { const c = new T.Color(input.value); ss.set(m.name, name, [c.r, c.g, c.b]); shown.textContent = input.value })
              } else {
                const n = value as number
                Object.assign(input, { type: 'range', min: k.min ?? Math.min(0, n), max: k.max ?? Math.max(1, Math.abs(n) * v.rangeOver), step: k.step ?? 'any', value: n })
                shown.textContent = String(n)
                input.addEventListener('input', () => { ss.set(m.name, name, Number(input.value)); shown.textContent = input.value })
              }
              row.append(`${k.label} `, input, ' ', shown)
              box.append(row)
            }
            return box
          })
        }
      }

      // the looks studio: a catalogue build's families, each a button that puts the camera on its row, and every
      // material, picked to put the camera on its swatch and open its settings
      if (has(plugins, 'library.studio')) {
        const studio: { families: { name: string; materials: { name: string; look: string; at: number[] }[] }[] } = json(plugins.wire, 'library.studio')
        heading('studio', `Studio: ${studio.families.reduce((n, f) => n + f.materials.length, 0)} materials in ${studio.families.length} families`)
        for (const f of studio.families) show(`family ${f.name}`, () => {
          const b = Object.assign(document.createElement('button'), { textContent: `${f.name} (${f.materials.length})`, className: 'thing' })
          b.addEventListener('click', () => {
            const xs = f.materials.map(m => m.at[0])
            look([(Math.min(...xs) + Math.max(...xs)) / 2, f.materials[0].at[1], f.materials[0].at[2]], (Math.max(...xs) - Math.min(...xs)) / 2 + v.swatch)
          })
          return b
        })
        show('studio pick', () => {
          const select = document.createElement('select')
          select.add(new Option('a material…', ''))
          for (const f of studio.families) for (const m of f.materials) select.add(new Option(`${m.name} (${m.look})`, m.name))
          select.addEventListener('change', () => {
            const m = studio.families.flatMap(f => f.materials).find(q => q.name === select.value)
            if (!m) return
            look(m.at, v.swatch)
            const box = show(`material ${m.name}`, () => document.createElement('details')) as HTMLDetailsElement
            box.open = true
            box.scrollIntoView({ block: 'nearest' })
          })
          return select
        })
      }

      if (listed) {
        heading('things', `Things: ${listed.buildings.length} buildings, ${listed.kit.length} kit`)
        if (mesh) show('thing whole', () => {
          const b = Object.assign(document.createElement('button'), { textContent: `the whole ${listed!.scene}` })
          b.addEventListener('click', () => { mesh.geometry.computeBoundingSphere(); const s = mesh.geometry.boundingSphere!; look([s.center.x, s.center.y, s.center.z], s.radius) })
          return b
        })
        for (const t of [...listed.buildings.map(b => ({ ...b, text: `${b.name} (${b.kind}) ${b.timber ? `${b.triangles} + ${b.timber} wood` : b.triangles} tris` })),
          ...listed.kit.map(k => ({ ...k, text: `${k.name} (${k.kind}) ${k.triangles} tris` }))]) {
          show(`thing ${t.name}`, () => {
            const b = Object.assign(document.createElement('button'), { textContent: t.text, className: 'thing' })
            b.addEventListener('click', () => { const { middle, reach } = boxOf(t.box); look(middle, reach) })
            return b
          })
        }
      }
      if (has(plugins, 'library.proof')) {
        const views: View[] = json(plugins.wire, 'library.proof').views
        show('spots', () => Object.assign(document.createElement('p'), { textContent: `check spots: ${views.length} ( ] the next, [ the one before)` }))
      }
    },
    tick(plugins: Plugins, d: any, stats?: HTMLElement) {
      const world = worldOf(plugins)
      if (!built && plugins.render3d?.THREE) build(plugins, d)
      if (!listed && !reading && has(plugins, `${world.world3d.place}.glb`)) {
        reading = true
        things(binary(plugins.wire, `${world.world3d.place}.glb`)).then(t => { listed = t }, e => console.error(e))
      }
      const asked = world.library ?? {}
      const ss = plugins.supershader3d
      // each material whose look has its own mesh drawn on it at its swatch's spot, once world3d's mesh is drawn (its
      // attributes the shader's inputs) and its looks file has landed; their course table rows written into world3d's
      if (!sidecars && has(plugins, 'library.sidecars') && has(plugins, 'library.studio') && ss?.looks?.() && plugins.world3d) {
        let place: THREE.Mesh | undefined
        plugins.render3d.scene.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.getAttribute('lookId') && !o.userData.sidecar) place = o as THREE.Mesh })
        if (place) {
          const T = plugins.render3d.THREE as typeof THREE
          const inputs = Object.fromEntries(Object.entries(place.geometry.attributes).map(([k, a]) => [k, (a as THREE.BufferAttribute).itemSize]))
          const own: Record<string, Sidecar> = json(plugins.wire, 'library.sidecars')
          const studio: { families: { materials: { name: string; look: string; at: number[] }[] }[] } = json(plugins.wire, 'library.studio')
          const table = plugins.world3d.courses(T) as THREE.DataTexture
          const width = table.image.width
          for (const m of Object.values(own)) for (const c of m.courses ?? []) {
            const data = table.image.data as Float32Array
            for (let k = 0; k < width - 1; k++) data[c.row * width + k] = k < c.feet.length ? c.feet[k] : 1e4 + k
            data[c.row * width + width - 1] = c.wallDepth
            table.needsUpdate = true
          }
          sidecars = []
          for (const f of studio.families) for (const m of f.materials) {
            const mesh = own[m.look]
            if (!mesh) continue
            const id = ss.idOf(m.name)
            const material = ss.material(ss.callOf(m.name))
            if (id === undefined || !material) continue
            const drawn = new T.Mesh(sidecarMesh(T, mesh, [m.at[0], 0, m.at[2]], id, inputs), material)
            drawn.userData.sidecar = true
            drawn.castShadow = drawn.receiveShadow = true
            plugins.render3d.scene.add(drawn)
            sidecars.push(drawn)
          }
        }
      }
      if (typeof asked.at === 'number' && ss?.uniforms?.lookTime) ss.uniforms.lookTime.value = asked.at
      // the clip asked for, played on every thing that has it, then held at `at`
      const w3 = plugins.world3d
      if (!held && (asked.clip || typeof asked.at === 'number') && has(plugins, `${world.world3d.place}.clips`)) {
        const clips = json(plugins.wire, `${world.world3d.place}.clips`) as { things: { thing: string; clips: Record<string, { start: string }> }[] }
        try {
          for (const t of clips.things) for (const [name, c] of Object.entries(t.clips)) {
            const on = asked.clip ? name === asked.clip : c.start === 'on'
            w3.clip(t.thing, name, on)
          }
          if (typeof asked.at === 'number') {
            w3.advance(asked.at)
            for (const t of clips.things) for (const name of Object.keys(t.clips)) w3.clip(t.thing, name, false)
          }
          held = true
        } catch (e) {
          // world3d throws until its place is built: asked again next frame
          if (!String((e as Error).message).includes('no place is animated')) throw e
        }
      }
      const info = plugins.render3d?.renderer?.info
      const looks = ss?.looks?.()
      // the view and the flat colours a scene's `world.library` asks for (`view`, one of VIEWS; `flat`), set once
      if (!viewed && ss?.uniforms?.lookView) {
        viewed = true
        if (asked.view) ss.uniforms.lookView.value = Math.max(0, VIEWS.indexOf(asked.view))
        if (asked.flat) ss.uniforms.lookDebug.value = 1
      }
      if (info && looks && stats) stats.textContent = `${info.render.calls} draw calls, ${info.render.triangles} triangles · ${looks.materials.length} materials, ${looks.pictures.length} pictures`
    },
    close(plugins: Plugins) {
      for (const g of [shapes, nav, ground, ...(sidecars ?? [])]) if (g) plugins.render3d?.scene.remove(g)
      for (const m of sidecars ?? []) m.geometry.dispose()
    },
  }
}
