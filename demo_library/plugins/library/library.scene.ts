// The scene viewer (pro-ng's `pro-ng/viewer/index.html`), the library plugin's first tool (`library.plugin.ts`): a
// landmark or town of pro-ng's flown round, with what it draws over the place. `scene()` hands back `holds(plugins)`,
// whether the place is a scene's build (the `library.made` entry holding a `scene`), `panel(plugins, d, show, look,
// mesh, go)`, called each frame the tool is up (`show` renderdom's, for the tool's panel; `look(middle, reach)` puts
// the camera on a point; `go(landmark)` builds a landmark and goes to it), `views(plugins, show)`, the Show part alone,
// which the kit tool shows too, `keys`, the keys it takes, and `tick(plugins, d)`, called each frame after the camera
// whichever tool is up, since a shot (`proof`) asks for its clip, time and view on any place. Its numbers are the
// `library` definition's `viewer` (`assets/demo_library.json`). It reads what `library.place.ts` names in the
// catalogue:
//
//   Landmark      every landmark pro-ng has (the `library` entry's `landmarks`), the one drawn picked; picking another
//                 builds it and goes to it.
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
type View = { name: string; eye: number[]; at: number[]; expect?: string }

const VIEWS = ['shaded', 'pieces', 'height', 'normal', 'solids']

export function scene() {
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

  // the Show part: supershader3d's views and the flat colours
  const views = (plugins: Plugins, show: Show) => {
    const ss = plugins.supershader3d
    if (!ss?.uniforms?.lookView) return
    show('show', () => Object.assign(document.createElement('h3'), { textContent: 'Show' }))
    const row = show('views', () => {
      const row = document.createElement('div')
      row.className = 'views'
      for (const [i, name] of VIEWS.entries()) {
        const b = Object.assign(document.createElement('button'), { textContent: name })
        b.addEventListener('click', () => { ss.uniforms.lookView.value = i })
        row.append(b)
      }
      return row
    })
    for (const [i, b] of [...row.children].entries()) b.classList.toggle('on', ss.uniforms.lookView.value === i)
    show('flat', () => {
      const row = document.createElement('label')
      const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: ss.uniforms.lookDebug.value === 1 })
      box.addEventListener('change', () => { ss.uniforms.lookDebug.value = box.checked ? 1 : 0 })
      row.append(box, ' flat colours')
      return row
    })
  }

  // the place's mesh, as the panel was last handed it
  let placeMesh: THREE.Mesh | undefined
  // The ground under the place, made once the place is drawn: a square `ground.across` times the place's reach (at
  // least `ground.least` metres) across, under its middle, `ground.below` metres under its lowest point so the
// place's own floor there never fights it, dressed by render3d so the scene's
  // lights, shadows and reflections reach it, and taking the place's shadows.
  const groundUnder = (plugins: Plugins, v: any) => {
    if (ground || !placeMesh) return
    const T = plugins.render3d.THREE as typeof THREE
    placeMesh.updateWorldMatrix(true, false)
    const box = new T.Box3().setFromObject(placeMesh)
    const sphere = box.getBoundingSphere(new T.Sphere())
    const r = Math.max(sphere.radius, v.ground.least) * v.ground.across
    const material = plugins.render3d.dress(new T.MeshStandardMaterial({ color: v.ground.colour, roughness: 1 }))
    ground = new T.Mesh(new T.PlaneGeometry(r, r), material)
    ground.quaternion.setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2)
    ground.position.set(sphere.center.x, box.min.y - v.ground.below, sphere.center.z)
    ground.receiveShadow = true
    ground.userData.library = true
    ground.visible = overlays.ground
    plugins.render3d.scene.add(ground)
  }

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
    holds: (plugins: Plugins) => has(plugins, 'library.made') && !!json(plugins.wire, 'library.made').scene,
    views,
    panel(plugins: Plugins, d: any, show: Show, look: (middle: number[], reach: number) => void, mesh: THREE.Mesh | undefined, go: (landmark: string) => void) {
      const v = d.viewer
      // the place's mesh as it is this frame, read by the ground's box when it is ticked (made on an earlier frame)
      placeMesh = mesh
      const made: string | undefined = has(plugins, 'library.made') ? json(plugins.wire, 'library.made').scene : undefined
      const list: { landmarks: string[] } | undefined = has(plugins, 'library') ? json(plugins.wire, 'library') : undefined
      show('pick label', () => Object.assign(document.createElement('label'), { textContent: list ? `landmark (${list.landmarks.length})` : 'landmark' }))
      if (list) show('pick', () => {
        const select = document.createElement('select')
        if (!made) select.add(new Option('pick one…', ''))
        for (const n of list.landmarks) select.add(new Option(n, n))
        if (made) select.value = made
        select.addEventListener('change', () => { if (select.value) go(select.value) })
        return select
      })
      else show('no list', () => Object.assign(document.createElement('p'), { textContent: 'pro-ng\'s list is not written yet: the server writes it as it starts (yarn serve demo_library).' }))
      if (!made) return
      const heading = (key: string, text: string) => show(key, () => Object.assign(document.createElement('h3'), { textContent: text }))
      const tick = (key: string, text: string, on: () => boolean, set: (on: boolean) => void) => show(key, () => {
        const row = document.createElement('label')
        const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: on() })
        box.addEventListener('change', () => set(box.checked))
        row.append(box, ` ${text}`)
        return row
      })

      heading('overlays', 'Overlays')
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
        groundUnder(plugins, v)
        if (ground) ground.visible = on
      })
      // ticked before the place was drawn: made the first frame it is
      if (overlays.ground) groundUnder(plugins, v)

      views(plugins, show)

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
      for (const g of [shapes, nav, ground]) if (g) plugins.render3d?.scene.remove(g)
    },
  }
}
