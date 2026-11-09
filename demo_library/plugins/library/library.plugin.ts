// demo_library's own plugin, loaded through `shipped`: pro-ng's content shown in the engine, by three tools, one up at a
// time. It has no row; it reads the `library` row (`library.sim.ts`), what the game's addon has built on the server,
// and the catalogue entries `library.place.ts` writes before the boot. Every number it uses is the `library`
// definition's (`assets/demo_library.json`). It is listed after render3d and renderdom, and draws through them.
//
// The place. world3d draws the scene's place, `world.world3d.place`, a build of pro-ng's in `assets/builds/`.
//
// The tools, each a part of its own:
//   Scene     (`library.scene.ts`) a landmark or town flown round: its overlays, views, things and check spots.
//   Kit       (`library.kit.ts`) one kit item: its keys, built again with them, and its effects.
//   Material  (`library.material.ts`) one material drawn alone, picked from a list, its settings beside it.
// The tool up is the one that holds the place drawn (a scene's build, a kit kind's, the catalogue of materials), until
// another is picked on the bar across the game's top (`bar`, [x, y, width, height] in the game's units, renderdom's).
// Only the tool up has a panel: Scene and Kit down the right (`panel`), Material its list down the left and its knobs
// down the right (its own boxes, `material`). A tool picked that does not hold the place hides it and shows its picker
// alone; Material goes to the catalogue (`materials`), built first when it is not there. The bar's right end says what
// the server builds now, and the last failed build's last line.
//
// The camera, the page's (render3d's `claim`): once world3d's mesh is in render3d's scene (the one mesh whose geometry
// carries `lookId`), it stands round the middle of the place's bounding sphere, `frame.yaw` and `frame.pitch` round
// it, far enough back that the sphere fills the view `frame.fill` times over. A drag over the game turns it round the
// point it looks at (`turn` radians a pixel, its pitch held within `pitchMost`), a drag with Shift moves that point
// across the view (`pan` of the distance a pixel), the wheel goes nearer or further (`zoom`, never nearer than
// `nearest`), and W A S D (forward, left, back, right), E (up) and Q (down) move it, `fly` times the place's reach a
// second (at least `flyLeast` metres), Shift `fast` times as fast. A frame is taken as no longer than `longestFrame`
// seconds. A scene whose `world.library` gives `eye` and `look` ([x, y, z] metres, y up) starts it there instead.
//
// Building. A place built from a scene (the `library.made` entry) is built again from it, a kit kind with the keys its
// boxes hold, whenever the library's pro-ng changes (the row's `changed`), as pro-ng's kit studio does. A catalogue the
// addon builds again itself; the page goes to it once that build is done (the row's `rebuilt`). Going to a build, once
// the row's `done` reaches the build asked for, is no reload (`swap`): the build is written into the scene this client
// was made from, every url of it at a new version, the address's `address` key set to it, the tool up and the camera
// kept in the link's store, and the seat sent to its own scene (the definition's `scene`), so the next client is made
// on the build. On a failed build it stays, the build's last line on the bar.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def, json, jsonAt } from '#plugins/loader/loader.sim.ts'
import { EFFECTS_STYLE } from './library.effects.ts'
import { kit, type Kit } from './library.kit.ts'
import { material, MATERIAL_STYLE } from './library.material.ts'
import { BUILDS, place } from './library.place.ts'
import { scene } from './library.scene.ts'

type Tool = 'scene' | 'kit' | 'material'
const TOOLS: [Tool, string][] = [['scene', 'Scene'], ['kit', 'Kit'], ['material', 'Material']]
const OWNER = 'library'
// the place the catalogue of materials is built as (`assets/build.ts materials`)
const CATALOGUE = 'materials'
// the link's store key the tool up and the camera are kept under from one client to the next (`swap`)
const KEPT = 'library.kept'

// main's world: every scene this plugin is listed in has one
const worldOf = (plugins: Plugins): Record<string, any> => plugins.wire.scene.world!
const FLY: Record<string, [number, number, number]> = { KeyW: [0, 0, -1], KeyS: [0, 0, 1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], KeyE: [0, 1, 0], KeyQ: [0, -1, 0] }

const STYLE = `
  [data-panel="library bar"] { background: #0f1114f2; color: #e8e8e8; font: 13px system-ui; display: flex; align-items: center; gap: 4px; padding: 0 8px; box-sizing: border-box; border-bottom: 1px solid #262b33 }
  [data-panel="library bar"] button { font: inherit; background: none; color: #9aa3ad; border: 0; border-bottom: 2px solid transparent; padding: 8px 14px; cursor: pointer }
  [data-panel="library bar"] button:hover { color: #e8e8e8 }
  [data-panel="library bar"] button.on { color: #fff; border-bottom-color: #4a9eff }
  [data-panel="library bar"] .place { color: #7d8792; margin-left: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  [data-panel="library bar"] .status { margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; color: #ff8a80 }
  [data-panel="library bar"] .status.running { color: #8fd18f }
  [data-panel="library"] { background: #15171bee; color: #e8e8e8; font: 12px system-ui; overflow-y: auto; box-sizing: border-box; padding: 8px }
  [data-panel="library"] h3 { margin: 12px 0 4px; font-size: 13px }
  [data-panel="library"] p { margin: 2px 0 6px; color: #9aa3ad }
  [data-panel="library"] label { display: block; margin: 6px 0 2px }
  [data-panel="library"] select, [data-panel="library"] input, [data-panel="library"] button { font: inherit; width: 100%; box-sizing: border-box }
  [data-panel="library"] input[type=checkbox] { width: auto }
  [data-panel="library"] .changed { outline: 1px solid #f5a623 }
  [data-panel="library"] .views { display: flex; gap: 2px }
  [data-panel="library"] .views button { flex: 1; padding: 3px 0 }
  [data-panel="library"] .views button.on { background: #2d5d8f; color: #fff }
  [data-panel="library"] button.thing { text-align: left; margin: 1px 0 }
  [data-panel="library stats"] { color: #e8e8e8; font: 12px monospace; white-space: pre-wrap; pointer-events: none }
  [data-panel="library stats"] div { background: #000a; padding: 3px 6px; margin-top: 2px; width: fit-content }
  [data-panel="library stats"] .spot:empty { display: none }
`

export function library() {
  const view = { framed: false, at: [0, 0, 0], dist: 10, yaw: 0, pitch: 0.4, reach: 1 }
  const tools = { scene: scene(), kit: kit(), material: material() }
  let tool: Tool | undefined
  let mesh: THREE.Mesh | undefined
  // the camera on a point, `reach` metres round it filling the view
  const look = (fov: number, fill: number) => (middle: number[], reach: number) => {
    view.at = [...middle]
    view.dist = Math.max(reach, 0.05) / Math.sin((fov * Math.PI) / 360) * fill
    view.reach = Math.max(reach, 0.05)
    view.framed = true
  }
  // the camera at `eye`, looking at `at`
  const put = (eye: number[], at: number[]) => {
    const way = [eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]]
    view.at = [...at]
    view.dist = Math.hypot(way[0], way[1], way[2])
    view.yaw = Math.atan2(way[0], way[2])
    view.pitch = Math.asin(way[1] / view.dist)
    view.framed = true
  }
  const held = new Set<string>()
  let drag: { x: number; y: number; shift: boolean } | undefined
  let last: number | undefined
  // the build this page waits on, and the place it goes to once it is done
  let waiting = 0
  let going: string | undefined
  let seen: number | undefined
  // the addon's own build of the place shown that this page shows (`rebuilt`)
  let shown: number | undefined
  // the last line of the build this page waited on, when it failed
  let failed = ''

  const libraryRow = (plugins: Plugins): Row | undefined => plugins.wire.rows.find((r: Row) => r.kind === 'library')

  const order = (plugins: Plugins, what: string, name: string, keys: Record<string, unknown> | string[], to: string) => {
    const lib = libraryRow(plugins)
    if (!lib) return
    waiting = lib.data.asked + 1
    going = to
    failed = ''
    plugins.wire.send(lib.id, 'build', what, name, JSON.stringify(keys))
  }
  // The page goes to a build while it runs, with no reload: the build written into the scene this client was made
  // from (`place`, a new version of every url), the address written so a reload comes back to it, the tool up and the
  // camera (when the place is the one drawn now) kept in the link's store, and the seat sent to its own scene, so the
  // next frame closes this client and makes one from the scene as it now is: every plugin made again on the build.
  const swap = async (plugins: Plugins, d: any, to: string) => {
    const scene = plugins.wire.scene as unknown as { world: Record<string, any> }
    const here = scene.world.world3d.place as string | undefined
    plugins.scenemanager.link.store[KEPT] = { tool, view: to === here ? view : undefined }
    await place(scene, to, !new URL(location.href).searchParams.has('noeffects'), Date.now())
    const url = new URL(location.href)
    url.searchParams.set(d.address, to)
    if (to !== here) url.searchParams.delete(d.material.address)
    history.replaceState(null, '', url.href)
    plugins.scenemanager.go(d.scene)
  }

  // the tool that holds the place drawn, if any
  const holding = (plugins: Plugins): Tool | undefined =>
    tools.material.holds(plugins) ? 'material' : tools.kit.holds(plugins) ? 'kit' : tools.scene.holds(plugins) ? 'scene' : undefined

  // world3d's mesh of the place shown or hidden
  const placeShown = (plugins: Plugins, on: boolean) => {
    plugins.render3d.scene.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.geometry?.getAttribute('lookId') && !m.userData.library) m.visible = on
    })
  }

  const camera = (plugins: Plugins, d: any, seconds: number) => {
    const r3 = plugins.render3d
    if (!r3?.camera) return
    if (!mesh) r3.scene.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.getAttribute('lookId') && !o.userData.library) mesh = o as THREE.Mesh })
    if (!view.framed) {
      if (!mesh) return
      mesh.geometry.computeBoundingSphere()
      const s = mesh.geometry.boundingSphere!
      view.reach = s.radius
      const asked = worldOf(plugins).library
      if (asked?.eye && asked?.look) put(asked.eye, asked.look)
      else {
        view.at = [s.center.x, s.center.y, s.center.z]
        view.dist = (s.radius / Math.sin((r3.camera.fov * Math.PI) / 360)) * d.frame.fill
        view.yaw = d.frame.yaw
        view.pitch = d.frame.pitch
      }
      view.framed = true
    }
    const speed = Math.max(view.reach * d.fly, d.flyLeast) * (held.has('ShiftLeft') || held.has('ShiftRight') ? d.fast : 1) * seconds
    const sin = Math.sin(view.yaw), cos = Math.cos(view.yaw)
    for (const code of held) {
      const way = FLY[code]
      if (!way) continue
      // x across the view, z along it, y up: turned by the camera's yaw onto the ground
      view.at[0] += (way[0] * cos + way[2] * sin) * speed
      view.at[1] += way[1] * speed
      view.at[2] += (-way[0] * sin + way[2] * cos) * speed
    }
    if (!r3.claim(OWNER)) return
    // the material tool's view centred on the game between its list and its knobs, so what it frames is not under them
    const W = plugins.wire.scene.prefabs.engine.width, H = plugins.wire.scene.prefabs.engine.height
    if (tool === 'material' && holding(plugins) === 'material') {
      const [lx, , lw] = d.material.list, [kx] = d.material.knobs
      const shift = W / 2 - (lx + lw + kx) / 2
      if (r3.camera.view?.offsetX !== shift) r3.camera.setViewOffset(W, H, shift, 0, W, H)
    } else if (r3.camera.view?.enabled) r3.camera.clearViewOffset()
    const c = Math.cos(view.pitch)
    r3.camera.position.set(view.at[0] + sin * c * view.dist, view.at[1] + Math.sin(view.pitch) * view.dist, view.at[2] + cos * c * view.dist)
    r3.camera.up.set(0, 1, 0)
    r3.camera.lookAt(view.at[0], view.at[1], view.at[2])
  }

  // the bar across the top: the three tools, the place drawn, and the server's building
  const bar = (plugins: Plugins, d: any) => {
    const dom = plugins.renderdom
    dom.panel('library bar', d.bar)
    for (const [t, text] of TOOLS) {
      const b = dom.show('library bar', `tool ${t}`, () => {
        const b = Object.assign(document.createElement('button'), { textContent: text })
        b.addEventListener('click', () => pickTool(plugins, d, t))
        return b
      }) as HTMLButtonElement
      b.classList.toggle('on', tool === t)
    }
    const place = dom.show('library bar', 'place', () => Object.assign(document.createElement('span'), { className: 'place' })) as HTMLElement
    place.textContent = holding(plugins) === tool ? worldOf(plugins).world3d.place : ''
    const lib = libraryRow(plugins)?.data
    const status = dom.show('library bar', 'status', () => Object.assign(document.createElement('span'), { className: 'status' })) as HTMLElement
    status.className = lib?.running ? 'status running' : 'status'
    status.textContent = lib?.running ? `building ${lib.running}…` : failed ? failed.trim().split('\n').at(-1)! : ''
    status.title = lib?.running ? '' : failed
  }

  const pickTool = (plugins: Plugins, d: any, t: Tool) => {
    if (t === tool) return
    // the material tool's own meshes taken away and the place given back, when it is left
    if (tool === 'material') tools.material.close(plugins)
    tool = t
    if (t !== 'material' || holding(plugins) === 'material') return
    // the catalogue: gone to where it is built, else built
    jsonAt(`${CATALOGUE}.looks`, `${BUILDS}${CATALOGUE}/${CATALOGUE}.looks.json?v=${Date.now()}`).then(
      () => swap(plugins, d, CATALOGUE),
      () => order(plugins, 'materials', '', [], CATALOGUE),
    )
  }

  const panel = (plugins: Plugins, d: any) => {
    const dom = plugins.renderdom
    dom.style(STYLE)
    dom.style(EFFECTS_STYLE)
    dom.style(MATERIAL_STYLE)
    bar(plugins, d)
    const holds = holding(plugins) === tool
    // the material tool hides the place itself and draws the one material picked
    if (!(tool === 'material' && holds)) placeShown(plugins, holds)
    const fov = plugins.render3d?.camera?.fov ?? 50
    const frame = look(fov, tool === 'material' ? d.material.fill : d.frame.fill)
    if (tool === 'material') {
      if (holds) tools.material.panel(plugins, d, frame)
      else {
        dom.panel('library', d.panel)
        dom.show('library', 'waiting', () => Object.assign(document.createElement('p'), { textContent: 'the catalogue of materials is being built: every material of pro-ng/materials.json on its swatch.' }))
      }
      return
    }
    dom.panel('library', d.panel)
    const show = (key: string, make: () => HTMLElement) => dom.show('library', key, make) as HTMLElement
    if (tool === 'kit') {
      tools.kit.panel(plugins, show, (kind, keys) => order(plugins, 'kit', kind, keys, kind.replace(/\//g, '--')))
      if (holds) tools.scene.views(plugins, show)
    } else tools.scene.panel(plugins, d, show, frame, mesh, landmark => order(plugins, 'scene', landmark, {}, landmark.split('/').pop()!))
  }

  // the stats line and the check spot's words, over the game's bottom left (`stats`, Material's `material.stats`)
  const readouts = (plugins: Plugins, d: any) => {
    const dom = plugins.renderdom
    dom.panel('library stats', tool === 'material' ? d.material.stats : d.stats)
    const line = dom.show('library stats', 'line', () => Object.assign(document.createElement('div'), { className: 'line' })) as HTMLElement
    const spot = dom.show('library stats', 'spot', () => Object.assign(document.createElement('div'), { className: 'spot' })) as HTMLElement
    return { line, spot }
  }

  // frames drawn, and the frames a shot waits after the place is ready or the camera put (`proof`)
  let drawn = 0
  let readyAt: number | undefined
  const frames = (n: number) => new Promise<void>(done => {
    const from = drawn
    const wait = () => (drawn - from >= n ? done() : requestAnimationFrame(wait))
    wait()
  })
  return {
    // What a shot drives (`assets/shoot.ts`, through `dev.html`'s `window.proof`): `ready()`, true once the place is
    // framed, supershader3d's pictures have landed and `settle` frames more are drawn; `view(eye, at)`, the camera put
    // at `eye` looking at `at` (three's axes), resolved `settle` frames later.
    proof: {
      ready: (plugins: Plugins) => {
        if (!view.framed || !plugins.supershader3d?.ready?.()) return false
        readyAt ??= drawn
        return drawn - readyAt >= def(plugins.wire, 'library').settle
      },
      view: (plugins: Plugins, eye: number[], at: number[]) => { put(eye, at); return frames(def(plugins.wire, 'library').settle) },
    },
    tick(plugins: Plugins) {
      const d = def(plugins.wire, 'library')
      const now = performance.now()
      const seconds = last === undefined ? 0 : Math.min((now - last) / 1000, d.longestFrame)
      last = now
      const dom = plugins.renderdom
      const W = plugins.wire.scene.prefabs.engine.width, H = plugins.wire.scene.prefabs.engine.height
      // what the last client kept as it went to this build (`swap`): its tool, and its camera on the same place
      if (tool === undefined) {
        const store = plugins.scenemanager.link.store
        const kept = store[KEPT] as { tool: Tool; view?: typeof view } | undefined
        delete store[KEPT]
        if (kept) {
          tool = kept.tool
          if (kept.view) Object.assign(view, kept.view)
        }
      }
      tool ??= holding(plugins) ?? 'scene'

      // the game, under the panels: the camera's drags and wheel
      dom.panel('library view', [0, 0, W, H])
      dom.surface('library view', 'eye', [0, 0, W, H], {
        down: (x: number, y: number, mods: { shift: boolean }) => { drag = { x, y, shift: mods.shift } },
        move: (x: number, y: number) => {
          if (!drag) return
          const dx = x - drag.x, dy = y - drag.y
          drag.x = x; drag.y = y
          if (!drag.shift) {
            view.yaw -= dx * d.turn
            view.pitch = Math.min(d.pitchMost, Math.max(-d.pitchMost, view.pitch + dy * d.turn))
          } else {
            const s = view.dist * d.pan
            view.at[0] -= Math.cos(view.yaw) * dx * s
            view.at[2] += Math.sin(view.yaw) * dx * s
            view.at[1] += dy * s
          }
        },
        up: () => { drag = undefined },
        wheel: (_x: number, _y: number, _m: unknown, _dx: number, dy: number) => { view.dist = Math.max(d.nearest, view.dist * Math.exp(dy * d.zoom)) },
      })
      // a shot (`world.library.proof`): the place alone, no bar, panel, stats line or keys
      const shooting = !!worldOf(plugins).library?.proof
      if (!shooting) {
        const { line, spot } = readouts(plugins, d)
        dom.keys((k: { code: string; mod: boolean; repeat: boolean }) => {
          if (k.mod) return false
          if (tool === 'scene' && tools.scene.keys.includes(k.code)) { if (!k.repeat) tools.scene.key(plugins, k.code, put, spot); return true }
          if (tool === 'material' && tools.material.keys.includes(k.code)) { tools.material.key(plugins, d, k.code); return true }
          if (!(k.code in FLY || k.code.startsWith('Shift'))) return false
          held.add(k.code)
          return true
        })
        dom.keyups((k: { code: string }) => { held.delete(k.code); return false })
        panel(plugins, d)
        camera(plugins, d, seconds)
        tools.scene.tick(plugins, d, line)
      } else {
        if (tools.material.holds(plugins)) tools.material.proof(plugins)
        camera(plugins, d, seconds)
        tools.scene.tick(plugins, d)
      }
      drawn++

      // building: the page goes to a build once it is done; the place is built again when pro-ng changes
      const lib = libraryRow(plugins)?.data
      if (!lib) return
      seen ??= lib.changed as number
      if (lib.changed > seen) {
        seen = lib.changed as number
        const world = worldOf(plugins)
        const has = (name: string) => name in world.loader.assets
        if (!waiting && has('library.kit')) {
          const k: Kit = json(plugins.wire, 'library.kit')
          order(plugins, 'kit', k.kind, tools.kit.values(k), world.world3d.place)
        } else if (!waiting && has('library.made')) {
          // a catalogue is built again by the addon itself (`rebuilt`, below); a scene's build is asked for here
          const made = json(plugins.wire, 'library.made')
          if (!made.materials) order(plugins, 'scene', made.scene, {}, world.world3d.place)
        }
      }
      // the place shown built again by the addon: gone to once that build is done; a build of it already done when the
      // page loaded is the one it shows, one still to come is gone to when it is done
      const place = worldOf(plugins).world3d.place as string
      const rebuilt = (lib.rebuilt as Record<string, number>)[place] ?? 0
      shown ??= lib.done >= rebuilt ? rebuilt : 0
      if (!waiting && rebuilt > shown && lib.done >= rebuilt) {
        shown = rebuilt
        failed = lib.error
        if (!failed) void swap(plugins, d, place)
      }
      if (waiting && lib.done >= waiting) {
        waiting = 0
        failed = lib.error
        if (failed) return
        void swap(plugins, d, going!)
      }
    },
    close(plugins: Plugins) {
      plugins.render3d?.camera?.clearViewOffset()
      plugins.render3d?.release(OWNER)
      tools.scene.close(plugins)
      tools.material.close(plugins)
      held.clear()
    },
  }
}
