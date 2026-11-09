// demo_library's own plugin, loaded through `shipped`: pro-ng's content shown in the engine, by three tools, each the
// tool of a scene of its own. It has no row; it reads the `library` row (`library.sim.ts`), what the game's addon has
// built for the scene's truth, and the catalogue entries `library.place.ts` writes before the boot. Every number it uses
// is the `library` definition's (`assets/demo_library.json`). It is listed after render3d and renderdom, and draws
// through them.
//
// The place. world3d draws the scene's place, `world.world3d.place`, a build of pro-ng's in `assets/builds/`; a scene
// whose place is not built draws none (`library.place.ts`'s `bare`).
//
// The tools, each a part of its own, and the scene each is up in (the definition's `scenes`, by tool; the scene's own
// `world.library.tool` says which it is):
//   Art       (`library.scene.ts`, its tool `scene`, the `art` scene) a landmark or town flown round: its overlays, views, things and
//             check spots.
//   Kit       (`library.kit.ts`, the `kit` scene) one kit item: its keys, built again with them, and its effects.
//   Material  (`library.material.ts`, the `materials` scene) one material drawn alone, picked from a list, its settings
//             beside it.
// The bar across the game's top (`bar`, [x, y, width, height] in the game's units, renderdom's) names the three; a
// press on another loads the page again on its scene: the address's `scene` key set to it and its `address` key taken
// off, so that scene opens on its own place. The tool's panel: Art and Kit down the right (`panel`),
// Material its list down the left and its knobs down the right (its own boxes, `material`). A tool whose scene draws a
// place it does not hold (no build there, or one of another tool's) hides it and shows its picker alone; the Material
// scene with no catalogue built asks for it once (`materials`) and goes to it when it is done. The bar's right end says
// what the scene's truth builds now, and the last failed build's last line.
//
// The camera, the page's (render3d's `claim`): once world3d's mesh is in render3d's scene (the one mesh whose geometry
// carries `lookId`), it stands round the middle of the place's bounding sphere, `frame.yaw` and `frame.pitch` round
// it, far enough back that the sphere fills the view `frame.fill` times over. Every control moves the camera's goal
// (`view`), and the camera eases onto it, `smooth` of the way a second (1 - e^(-smooth·seconds) a frame); a shot
// (`proof`) and a client's first frame put it on the goal at once.
//   drag                 turns it round the point it looks at (`turn` radians a pixel, its pitch held within
//                        `pitchMost`).
//   Alt / Ctrl / ⌘ drag  turns it where it stands, looking round: the eye stays, the point looked at swings.
//   Shift drag           moves the view with the pointer, the point under it staying under it at the depth looked at.
//   wheel                nearer or further, toward or away from the point under the pointer (`zoom` a pixel); at
//                        `nearest` metres from the point looked at, the wheel on in carries the point forward with it.
//   double click         looks at the thing under the pointer, from where it stands: the point looked at put on it.
//   F                    frames the whole place again, from the direction it looks now.
//   W A S D              forward (where it looks, up or down), left, back, right; E up and Q down, straight; `fly`
//                        times the place's reach a second (at least `flyLeast` metres), Shift `fast` times as fast.
// A double click is two presses within `twice` seconds and `still` pixels of each other, neither dragged further than
// `still`. A frame is taken as no longer than `longestFrame` seconds. A scene whose `world.library` gives `eye` and
// `look` ([x, y, z] metres, y up) starts it there instead. Each scene keeps its own camera: as its client closes, or a
// tool is picked and the page loads again, the camera is kept in the session's storage under the scene's name with the
// place it looked at (`KEPT`), and the scene's next client on that same place starts from it, so going to Kit and back
// to Art comes back to where it stood.
//
// Building. A place built from a scene (the `library.made` entry) is built again from it, a kit kind with the keys its
// boxes hold, whenever the library's pro-ng changes (the row's `changed`), as pro-ng's kit studio does. A catalogue the
// addon builds again itself; the page goes to it once that build is done (the row's `rebuilt`). Going to a build, once
// the row's `done` reaches the build asked for, is no reload (`swap`): the build is written into the scene this client
// was made from, every url of it at a new version, the address's `address` key set to it, the camera kept as the
// client closes, and the seat sent to its own scene again, so the next client is made on the build. On a failed build it
// stays, the build's last line on the bar. Each scene's truth builds for itself: a build asked for in one is followed
// by that scene alone.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'
import { EFFECTS_STYLE } from './library.effects.ts'
import { kit, type Kit } from './library.kit.ts'
import { material, MATERIAL_STYLE } from './library.material.ts'
import { place } from './library.place.ts'
import { scene } from './library.scene.ts'

type Tool = 'scene' | 'kit' | 'material'
const TOOLS: [Tool, string][] = [['scene', 'Art'], ['kit', 'Kit'], ['material', 'Material']]
const OWNER = 'library'
// the place the catalogue of materials is built as (`assets/build.ts materials`)
const CATALOGUE = 'materials'
// the session storage key, with the scene's name after it, its camera is kept under from one client to the next and
// through the page's reload when a tool is picked; a browser that keeps nothing starts each scene framed
const KEPT = 'demo_library.kept.'
type Kept = { place: string; view: { framed: boolean; at: number[]; dist: number; yaw: number; pitch: number; reach: number } }
const keptOf = (scene: string): Kept | undefined => {
  try { return JSON.parse(sessionStorage.getItem(`${KEPT}${scene}`) ?? 'null') ?? undefined } catch { return undefined }
}
const keepAs = (scene: string, kept: Kept) => {
  try { sessionStorage.setItem(`${KEPT}${scene}`, JSON.stringify(kept)) } catch {}
}

// the scene's world: every scene this plugin is listed in has one
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
  // where the camera stands now, easing onto `view`; undefined until a client's first frame puts it there
  let cur: typeof view | undefined
  // the camera put on its goal at once on the next frame, not eased (a shot's `view`)
  let snap = false
  const held = new Set<string>()
  // a drag: how it began (`turn`, `look` or `pan`), where the pointer is, where it was pressed and how far it went
  let drag: { how: 'turn' | 'look' | 'pan'; x: number; y: number; from: [number, number]; far: number } | undefined
  // the last press let go without a drag: when and where, for a double click
  let tapped: { at: number; x: number; y: number } | undefined
  let last: number | undefined

  // The camera's axes at a yaw and pitch, three's: it stands at `at + back·dist`, `forward` is -back, `right` across the
  // view and `up` the view's up.
  const axes = (yaw: number, pitch: number) => {
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch)
    return {
      back: [sy * cp, sp, cy * cp],
      forward: [-sy * cp, -sp, -cy * cp],
      right: [cy, 0, -sy],
      up: [-sy * sp, cp, -cy * sp],
    }
  }
  const eyeOf = (v: typeof view) => {
    const { back } = axes(v.yaw, v.pitch)
    return [v.at[0] + back[0] * v.dist, v.at[1] + back[1] * v.dist, v.at[2] + back[2] * v.dist]
  }
  // The point under the game's (x, y) at the depth the camera looks at: on the plane through `cur.at` facing it, found
  // through the camera's own projection, so the material tool's view offset is counted.
  const underAtDepth = (plugins: Plugins, x: number, y: number): number[] | undefined => {
    const r3 = plugins.render3d
    if (!r3?.camera || !cur) return undefined
    const W = plugins.wire.scene.prefabs.engine.width, H = plugins.wire.scene.prefabs.engine.height
    const p = new r3.THREE.Vector3((x / W) * 2 - 1, 1 - (y / H) * 2, 0.5).unproject(r3.camera)
    const eye = r3.camera.position
    const ray = [p.x - eye.x, p.y - eye.y, p.z - eye.z]
    const { forward } = axes(cur.yaw, cur.pitch)
    const along = ray[0] * forward[0] + ray[1] * forward[1] + ray[2] * forward[2]
    if (along <= 0) return undefined
    const t = cur.dist / along
    return [eye.x + ray[0] * t, eye.y + ray[1] * t, eye.z + ray[2] * t]
  }
  // The nearest drawn mesh under the game's (x, y), every one of its parents shown too; undefined over the sky.
  const hit = (plugins: Plugins, x: number, y: number): number[] | undefined => {
    const r3 = plugins.render3d
    if (!r3?.camera) return undefined
    const W = plugins.wire.scene.prefabs.engine.width, H = plugins.wire.scene.prefabs.engine.height
    const ray = new r3.THREE.Raycaster()
    ray.setFromCamera(new r3.THREE.Vector2((x / W) * 2 - 1, 1 - (y / H) * 2), r3.camera)
    const shown = (o: THREE.Object3D | null): boolean => { for (; o; o = o.parent) if (!o.visible) return false; return true }
    const found = ray.intersectObject(r3.scene, true).find((h: THREE.Intersection) => (h.object as THREE.Mesh).isMesh && shown(h.object))
    return found ? [found.point.x, found.point.y, found.point.z] : undefined
  }
  // the whole place in view, from the direction the camera looks now
  const frameAll = (plugins: Plugins, d: any) => {
    const r3 = plugins.render3d
    if (!mesh || !r3?.camera) return
    mesh.geometry.computeBoundingSphere()
    const s = mesh.geometry.boundingSphere!
    view.at = [s.center.x, s.center.y, s.center.z]
    view.dist = (s.radius / Math.sin((r3.camera.fov * Math.PI) / 360)) * d.frame.fill
    view.reach = s.radius
  }
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
  // this scene's name in the manager's table: the scene the definition's `scenes` gives its tool
  const sceneOf = (d: any, t: Tool): string => d.scenes[t]
  // the place this client was made on, read on its first frame: what its camera is kept with as it closes
  let drawing: string | undefined
  // the camera kept under this scene's name with the place this client was made on, for its next client there
  const keep = (d: any) => {
    if (tool && drawing !== undefined && view.framed) keepAs(sceneOf(d, tool), { place: drawing, view: { ...view, at: [...view.at] } })
  }
  // The page goes to a build while it runs, with no reload: the build written into the scene this client was made
  // from (`place`, a new version of every url), the address written so a reload comes back to it, and the seat sent to
  // its own scene again, so the next frame closes this client (its camera kept, `close`) and makes one from the scene
  // as it now is: every plugin made again on the build, the camera where it was when the build is of the same place.
  const swap = async (plugins: Plugins, d: any, to: string) => {
    const scene = plugins.wire.scene as unknown as { world: Record<string, any>; plugins: string[]; prefabs: Record<string, any> }
    const here = scene.world.world3d.place as string
    await place(scene, to, !new URL(location.href).searchParams.has('noeffects'), Date.now())
    const url = new URL(location.href)
    url.searchParams.set('scene', sceneOf(d, tool!))
    url.searchParams.set(d.address, to)
    if (to !== here) url.searchParams.delete(d.material.address)
    history.replaceState(null, '', url.href)
    plugins.scenemanager.go(sceneOf(d, tool!))
  }
  // The page loaded again on another tool's scene: the address's `scene` key set to it and its `address` key and the
  // material picked taken off, since each is this scene's, so that scene opens on its own place.
  const goTool = (d: any, t: Tool) => {
    if (t === tool) return
    keep(d)
    const url = new URL(location.href)
    url.searchParams.set('scene', sceneOf(d, t))
    url.searchParams.delete(d.address)
    url.searchParams.delete(d.material.address)
    location.href = url.href
  }

  // whether this scene's tool holds the place drawn
  const holds = (plugins: Plugins): boolean => !!tool && tools[tool].holds(plugins)

  // world3d's mesh of the place shown or hidden
  const placeShown = (plugins: Plugins, on: boolean) => {
    plugins.render3d.scene.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.geometry?.getAttribute('lookId') && !m.userData.library) m.visible = on
    })
  }

  const camera = (plugins: Plugins, d: any, seconds: number, shooting: boolean) => {
    const r3 = plugins.render3d
    if (!r3?.camera) return
    if (!mesh) r3.scene.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.getAttribute('lookId') && !o.userData.library) mesh = o as THREE.Mesh })
    if (!view.framed) {
      if (!mesh) return
      frameAll(plugins, d)
      const asked = worldOf(plugins).library
      if (asked?.eye && asked?.look) put(asked.eye, asked.look)
      else {
        view.yaw = d.frame.yaw
        view.pitch = d.frame.pitch
      }
      view.framed = true
    }
    const speed = Math.max(view.reach * d.fly, d.flyLeast) * (held.has('ShiftLeft') || held.has('ShiftRight') ? d.fast : 1) * seconds
    const { right, back } = axes(view.yaw, view.pitch)
    for (const code of held) {
      const way = FLY[code]
      if (!way) continue
      // x across the view, z along where it looks (back is +z), y straight up
      for (let i = 0; i < 3; i++) view.at[i] += (way[0] * right[i] + way[2] * back[i] + (i === 1 ? way[1] : 0)) * speed
    }
    // eased onto the goal; a yaw is eased the short way round
    if (!cur || snap || shooting) {
      cur = { ...view, at: [...view.at] }
      snap = false
    } else {
      const k = 1 - Math.exp(-d.smooth * seconds)
      const turn = Math.atan2(Math.sin(view.yaw - cur.yaw), Math.cos(view.yaw - cur.yaw))
      cur.yaw += turn * k
      // the goal kept within half a turn of the camera, so the two never drift whole turns apart
      view.yaw = cur.yaw + turn * (1 - k)
      cur.pitch += (view.pitch - cur.pitch) * k
      // the distance eased on its logarithm, so a long zoom out is as smooth as a short one in
      cur.dist *= Math.exp(Math.log(view.dist / cur.dist) * k)
      for (let i = 0; i < 3; i++) cur.at[i] += (view.at[i] - cur.at[i]) * k
      cur.reach = view.reach
      cur.framed = view.framed
    }
    if (!r3.claim(OWNER)) return
    // the material tool's view centred on the game between its list and its knobs, so what it frames is not under them
    const W = plugins.wire.scene.prefabs.engine.width, H = plugins.wire.scene.prefabs.engine.height
    if (tool === 'material' && holds(plugins)) {
      const [lx, , lw] = d.material.list, [kx] = d.material.knobs
      const shift = W / 2 - (lx + lw + kx) / 2
      if (r3.camera.view?.offsetX !== shift) r3.camera.setViewOffset(W, H, shift, 0, W, H)
    } else if (r3.camera.view?.enabled) r3.camera.clearViewOffset()
    const eye = eyeOf(cur)
    r3.camera.position.set(eye[0], eye[1], eye[2])
    r3.camera.up.set(0, 1, 0)
    r3.camera.lookAt(cur.at[0], cur.at[1], cur.at[2])
    r3.camera.updateMatrixWorld()
  }

  // the bar across the top: the three tools, the place drawn, and the server's building
  const bar = (plugins: Plugins, d: any) => {
    const dom = plugins.renderdom
    dom.panel('library bar', d.bar)
    for (const [t, text] of TOOLS) {
      const b = dom.show('library bar', `tool ${t}`, () => {
        const b = Object.assign(document.createElement('button'), { textContent: text })
        b.addEventListener('click', () => goTool(d, t))
        return b
      }) as HTMLButtonElement
      b.classList.toggle('on', tool === t)
    }
    const place = dom.show('library bar', 'place', () => Object.assign(document.createElement('span'), { className: 'place' })) as HTMLElement
    place.textContent = holds(plugins) ? worldOf(plugins).world3d.place : ''
    const lib = libraryRow(plugins)?.data
    const status = dom.show('library bar', 'status', () => Object.assign(document.createElement('span'), { className: 'status' })) as HTMLElement
    status.className = lib?.running ? 'status running' : 'status'
    status.textContent = lib?.running ? `building ${lib.running}…` : failed ? failed.trim().split('\n').at(-1)! : ''
    status.title = lib?.running ? '' : failed
  }

  // the Material scene with no catalogue drawn asks for it once, and goes to it when it is done
  let askedCatalogue = false

  const panel = (plugins: Plugins, d: any) => {
    const dom = plugins.renderdom
    dom.style(STYLE)
    dom.style(EFFECTS_STYLE)
    dom.style(MATERIAL_STYLE)
    bar(plugins, d)
    const holding = holds(plugins)
    // the material tool hides the place itself and draws the one material picked
    if (!(tool === 'material' && holding)) placeShown(plugins, holding)
    const fov = plugins.render3d?.camera?.fov ?? 50
    const frame = look(fov, tool === 'material' ? d.material.fill : d.frame.fill)
    if (tool === 'material') {
      if (holding) tools.material.panel(plugins, d, frame)
      else {
        if (!askedCatalogue && !waiting && libraryRow(plugins)) {
          askedCatalogue = true
          order(plugins, 'materials', '', [], CATALOGUE)
        }
        dom.panel('library', d.panel)
        dom.show('library', 'waiting', () => Object.assign(document.createElement('p'), { textContent: 'the catalogue of materials is being built: every material of pro-ng/materials.json on its swatch.' }))
      }
      return
    }
    dom.panel('library', d.panel)
    const show = (key: string, make: () => HTMLElement) => dom.show('library', key, make) as HTMLElement
    if (tool === 'kit') {
      tools.kit.panel(plugins, show, (kind, keys) => order(plugins, 'kit', kind, keys, kind.replace(/\//g, '--')))
      if (holding) tools.scene.views(plugins, show)
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
      view: (plugins: Plugins, eye: number[], at: number[]) => { put(eye, at); snap = true; return frames(def(plugins.wire, 'library').settle) },
    },
    tick(plugins: Plugins) {
      const d = def(plugins.wire, 'library')
      const now = performance.now()
      const seconds = last === undefined ? 0 : Math.min((now - last) / 1000, d.longestFrame)
      last = now
      const dom = plugins.renderdom
      const W = plugins.wire.scene.prefabs.engine.width, H = plugins.wire.scene.prefabs.engine.height
      // this scene's tool, and the camera its last client kept on the same place
      if (tool === undefined) {
        tool = worldOf(plugins).library.tool as Tool
        drawing = worldOf(plugins).world3d.place
        const kept = keptOf(sceneOf(d, tool))
        if (kept && kept.place === drawing) Object.assign(view, kept.view, { at: [...kept.view.at] })
      }

      // the game, under the panels: the camera's drags and wheel
      dom.panel('library view', [0, 0, W, H])
      dom.surface('library view', 'eye', [0, 0, W, H], {
        down: (x: number, y: number, mods: { shift: boolean; alt: boolean; mod: boolean }) => {
          drag = { how: mods.shift ? 'pan' : mods.alt || mods.mod ? 'look' : 'turn', x, y, from: [x, y], far: 0 }
        },
        move: (x: number, y: number) => {
          if (!drag) return
          const dx = x - drag.x, dy = y - drag.y
          drag.x = x; drag.y = y
          drag.far = Math.max(drag.far, Math.hypot(x - drag.from[0], y - drag.from[1]))
          if (drag.how === 'pan') {
            // a game pixel at the depth looked at, in metres: the view's height there over the game's height
            const fov = plugins.render3d?.camera?.fov ?? 50
            const s = (2 * view.dist * Math.tan((fov * Math.PI) / 360)) / H
            const { right, up } = axes(view.yaw, view.pitch)
            for (let i = 0; i < 3; i++) view.at[i] += (-right[i] * dx + up[i] * dy) * s
            return
          }
          const eye = eyeOf(view)
          view.yaw -= dx * d.turn
          view.pitch = Math.min(d.pitchMost, Math.max(-d.pitchMost, view.pitch + dy * d.turn))
          if (drag.how === 'look') {
            // the eye kept where it stood, the point looked at swung round it
            const { forward } = axes(view.yaw, view.pitch)
            view.at = [eye[0] + forward[0] * view.dist, eye[1] + forward[1] * view.dist, eye[2] + forward[2] * view.dist]
          }
        },
        up: (x: number, y: number) => {
          const was = drag
          drag = undefined
          if (!was || was.far > d.still) { tapped = undefined; return }
          const now = performance.now() / 1000
          if (tapped && now - tapped.at <= d.twice && Math.hypot(x - tapped.x, y - tapped.y) <= d.still) {
            tapped = undefined
            const p = hit(plugins, x, y)
            if (p) put(eyeOf(view), p)
            return
          }
          tapped = { at: now, x, y }
        },
        wheel: (x: number, y: number, _m: unknown, _dx: number, dy: number) => {
          const k = Math.exp(dy * d.zoom)
          const p = underAtDepth(plugins, x, y)
          if (k < 1 && view.dist * k < d.nearest) {
            // at the nearest: the point looked at carried forward, the camera with it
            const { forward } = axes(view.yaw, view.pitch)
            const step = view.dist * (1 - k)
            for (let i = 0; i < 3; i++) view.at[i] += forward[i] * step
            view.dist = Math.max(view.dist, d.nearest)
            return
          }
          // toward or away from the point under the pointer: it stays under the pointer
          if (p && cur) for (let i = 0; i < 3; i++) view.at[i] += (p[i] - cur.at[i]) * (1 - k)
          view.dist *= k
        },
      })
      dom.cursor('library view', 'eye', drag ? (drag.how === 'pan' ? 'grabbing' : drag.how === 'look' ? 'crosshair' : 'move') : 'grab')
      // a shot (`world.library.proof`): the place alone, no bar, panel, stats line or keys
      const shooting = !!worldOf(plugins).library?.proof
      if (!shooting) {
        const { line, spot } = readouts(plugins, d)
        dom.keys((k: { code: string; mod: boolean; repeat: boolean }) => {
          if (k.mod) return false
          if (tool === 'scene' && tools.scene.keys.includes(k.code)) { if (!k.repeat) tools.scene.key(plugins, k.code, put, spot); return true }
          if (tool === 'material' && tools.material.keys.includes(k.code)) { tools.material.key(plugins, d, k.code); return true }
          if (k.code === 'KeyF' && tool !== 'material') { if (!k.repeat) frameAll(plugins, d); return true }
          if (!(k.code in FLY || k.code.startsWith('Shift'))) return false
          held.add(k.code)
          return true
        })
        dom.keyups((k: { code: string }) => { held.delete(k.code); return false })
        panel(plugins, d)
        camera(plugins, d, seconds, false)
        tools.scene.tick(plugins, d, line)
      } else {
        if (tools.material.holds(plugins)) tools.material.proof(plugins)
        camera(plugins, d, seconds, true)
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
      keep(def(plugins.wire, 'library'))
      plugins.render3d?.camera?.clearViewOffset()
      plugins.render3d?.release(OWNER)
      tools.scene.close(plugins)
      tools.material.close(plugins)
      held.clear()
    },
  }
}
