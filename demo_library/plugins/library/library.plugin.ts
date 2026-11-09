// demo_library's own plugin, loaded through `shipped`: the page's side of pro-ng's viewers, played in the engine. It
// has no row; it reads the `library` row (`library.sim.ts`), what the game's addon has built on the server, and the
// catalogue entries `library.place.ts` writes before the boot. Every number it uses is the `library` definition's
// (`assets/demo_library.json`). It is listed after render3d and renderdom, and draws through them.
//
// The place. world3d draws the scene's place, `world.world3d.place`, a build of pro-ng's in `assets/builds/`.
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
// The panel, down the game's right (`panel`, [x, y, width, height] in the game's units, renderdom's):
//   kit, landmark   every kit kind and landmark pro-ng has (the `library` entry, `builds/library.json`, which the
//                   server writes from pro-ng's own list as it starts); picking one asks the `library` row to build
//                   it, and the page goes to it once it is built.
//   the kit's keys  for a place that is a kit kind's build (the `library.kit` entry): what its header says it is, then
//                   each key of its studio defaults with a box holding the value it was built with, its type and what
//                   it does beside it, marked when it is not the default; `build` builds it again with every key that
//                   is not its default, `reset` puts every box back to its default. Its header's notes under them,
//                   and, for a kind with its own effects file, the effects editor (`library.effects.ts`).
//   status          what the server builds now, and the last failed build's last lines.
// A place built from a scene (the `library.made` entry) is built again from that scene, a kit kind with the keys its
// boxes hold, whenever the library's pro-ng changes (the row's `changed`), as pro-ng's kit studio does.
//
// Going to a build: the page loads again with the definition's `address` key of its address set to the place, once
// the row's `done` reaches the build it asked for; on a failed one it stays, the build's lines in the status.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def, json, written } from '#plugins/loader/loader.sim.ts'
import { effectsEditor, EFFECTS_STYLE } from './library.effects.ts'
import { viewer } from './library.viewer.ts'

type Kit = {
  kind: string
  defaults: Record<string, unknown>
  values: Record<string, unknown>
  about: string
  keys: { keys: string[]; type: string; does: string }[]
  notes: string[]
  effects?: Record<string, Record<string, unknown>[]>
}
type List = { kinds: { kind: string; about: string }[]; landmarks: string[] }

const OWNER = 'library'

// main's world: every scene this plugin is listed in has one
const worldOf = (plugins: Plugins): Record<string, any> => plugins.wire.scene.world!
const FLY: Record<string, [number, number, number]> = { KeyW: [0, 0, -1], KeyS: [0, 0, 1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], KeyE: [0, 1, 0], KeyQ: [0, -1, 0] }

const STYLE = `
  [data-panel="library"] { background: #15171bee; color: #e8e8e8; font: 12px system-ui; overflow-y: auto; box-sizing: border-box; padding: 8px }
  [data-panel="library"] h3 { margin: 10px 0 4px; font-size: 13px }
  [data-panel="library"] p { margin: 2px 0 6px; color: #9aa3ad }
  [data-panel="library"] label { display: block; margin: 6px 0 2px }
  [data-panel="library"] select, [data-panel="library"] input, [data-panel="library"] button { font: inherit; width: 100%; box-sizing: border-box }
  [data-panel="library"] input[type=checkbox] { width: auto }
  [data-panel="library"] .changed { outline: 1px solid #f5a623 }
  [data-panel="library"] .status { white-space: pre-wrap; color: #ff8a80 }
  [data-panel="library"] .running { color: #8fd18f }
  [data-panel="library"] button.half { width: 20%; padding: 2px 0 }
  [data-panel="library"] button.thing { text-align: left; margin: 1px 0 }
  [data-panel="library"] details { margin: 2px 0 }
  [data-panel="library"] details label { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 4px; align-items: center }
  [data-panel="library stats"] { color: #e8e8e8; font: 12px monospace; white-space: pre-wrap; pointer-events: none }
  [data-panel="library stats"] div { background: #000a; padding: 3px 6px; margin-top: 2px; width: fit-content }
  [data-panel="library stats"] .spot:empty { display: none }
`

export function library() {
  const view = { framed: false, at: [0, 0, 0], dist: 10, yaw: 0, pitch: 0.4, reach: 1 }
  const scene = viewer()
  let mesh: THREE.Mesh | undefined
  // the camera on a point, `reach` metres round it filling the view
  const look = (fov: number, fill: number) => (middle: number[], reach: number) => {
    view.at = [...middle]
    view.dist = Math.max(reach, 0.05) / Math.sin((fov * Math.PI) / 360) * fill
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
  let values: Record<string, unknown> | undefined
  // the last lines of the build this page waited on, when it failed
  let failed = ''

  const libraryRow = (plugins: Plugins): Row | undefined => plugins.wire.rows.find((r: Row) => r.kind === 'library')

  const order = (plugins: Plugins, what: string, name: string, keys: Record<string, unknown> | string[], to: string) => {
    const lib = libraryRow(plugins)
    if (!lib) return
    waiting = lib.data.asked + 1
    going = to
    plugins.wire.send(lib.id, 'build', what, name, JSON.stringify(keys))
  }

  const differing = (kit: Kit) =>
    Object.fromEntries(Object.entries(values ?? {}).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(kit.defaults[k])))

  const camera = (plugins: Plugins, d: any, seconds: number) => {
    const r3 = plugins.render3d
    if (!r3?.camera) return
    if (!mesh) r3.scene.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.getAttribute('lookId')) mesh = o as THREE.Mesh })
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
    const c = Math.cos(view.pitch)
    r3.camera.position.set(view.at[0] + sin * c * view.dist, view.at[1] + Math.sin(view.pitch) * view.dist, view.at[2] + cos * c * view.dist)
    r3.camera.up.set(0, 1, 0)
    r3.camera.lookAt(view.at[0], view.at[1], view.at[2])
  }

  const panel = (plugins: Plugins, d: any) => {
    const dom = plugins.renderdom
    const world = worldOf(plugins)
    const has = (name: string) => name in world.loader.assets
    const [, , width, height] = d.panel
    dom.style(STYLE)
    dom.style(EFFECTS_STYLE)
    dom.panel('library', d.panel)
    const show = (key: string, make: () => HTMLElement) => dom.show('library', key, make) as HTMLElement
    const lib = libraryRow(plugins)?.data

    const list: List | undefined = has('library') ? json(plugins.wire, 'library') : undefined
    show('title', () => Object.assign(document.createElement('h3'), { textContent: `pro-ng: ${world.world3d.place}` }))
    if (list) {
      for (const [what, names] of [['kit', list.kinds.map(k => k.kind)], ['landmark', list.landmarks]] as const) {
        show(`${what} label`, () => Object.assign(document.createElement('label'), { textContent: `${what} (${names.length})` }))
        show(`${what} pick`, () => {
          const select = document.createElement('select')
          select.add(new Option('', ''))
          for (const n of names) select.add(new Option(n, n))
          select.addEventListener('change', () => {
            const n = select.value
            if (!n) return
            if (what === 'kit') order(plugins, 'kit', n, {}, n.replace(/\//g, '--'))
            else order(plugins, 'scene', n, {}, n.split('/').pop()!)
          })
          return select
        })
      }
      show('materials build', () => {
        const b = Object.assign(document.createElement('button'), { textContent: 'every material on its swatch (the looks studio)' })
        b.addEventListener('click', () => order(plugins, 'materials', '', [], 'materials'))
        return b
      })
    } else show('no list', () => Object.assign(document.createElement('p'), { textContent: 'pro-ng\'s list is not written yet: the server writes it as it starts (yarn serve demo_library).' }))

    const kit: Kit | undefined = has('library.kit') ? json(plugins.wire, 'library.kit') : undefined
    if (kit) {
      values ??= { ...kit.defaults, ...kit.values }
      show('kit title', () => Object.assign(document.createElement('h3'), { textContent: `kit ${kit.kind}` }))
      show('kit about', () => Object.assign(document.createElement('p'), { textContent: kit.about }))
      for (const key of Object.keys(kit.defaults)) {
        const row = kit.keys.find(r => r.keys.includes(key))
        show(`key ${key} label`, () => Object.assign(document.createElement('label'), { textContent: key }))
        const box = show(`key ${key}`, () => {
          const input = document.createElement('input')
          const v = values![key]
          if (typeof v === 'boolean') { input.type = 'checkbox'; input.checked = v }
          else if (typeof v === 'number') { input.type = 'number'; input.step = 'any'; input.value = String(v) }
          else input.value = typeof v === 'string' ? v : JSON.stringify(v)
          input.addEventListener('change', () => {
            const was = kit.defaults[key]
            values![key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : typeof was === 'string' ? input.value : JSON.parse(input.value)
          })
          return input
        }) as HTMLInputElement
        box.classList.toggle('changed', JSON.stringify(values[key]) !== JSON.stringify(kit.defaults[key]))
        if (row) show(`key ${key} type`, () => Object.assign(document.createElement('p'), { textContent: `${row.type}: ${row.does}` }))
      }
      show('build', () => {
        const b = Object.assign(document.createElement('button'), { textContent: 'build' })
        b.addEventListener('click', () => order(plugins, 'kit', kit.kind, differing(kit), world.world3d.place))
        return b
      })
      show('reset', () => {
        const b = Object.assign(document.createElement('button'), { textContent: `reset to ${kit.kind}.studio.defaults.json` })
        b.addEventListener('click', () => {
          values = { ...kit.defaults }
          for (const key of Object.keys(kit.defaults)) {
            const input = dom.show('library', `key ${key}`, () => document.createElement('input')) as HTMLInputElement
            const v = kit.defaults[key]
            if (input.type === 'checkbox') input.checked = !!v
            else input.value = typeof v === 'string' ? v : JSON.stringify(v)
          }
        })
        return b
      })
      kit.notes.forEach((n, i) => show(`note ${i}`, () => Object.assign(document.createElement('p'), { textContent: n })))
      if (kit.effects) {
        show('effects title', () => Object.assign(document.createElement('h3'), { textContent: `effects: ${kit.kind}.effects.json` }))
        show('effects', () => {
          const host = document.createElement('div')
          const name = world.particle3d.effects
          const url = world.loader.assets[name].url
          // the kind's effects by their full names written into the game's effects file as this page's loader holds
          // it, which particle3d takes as a written file
          const write = (effects: Record<string, unknown[]>) => {
            const base = json(plugins.wire, name)
            written(url, JSON.stringify({ ...base, effects: { ...base.effects, ...effects } }))
            void plugins.loader.written(url)
          }
          const save = (file: Record<string, unknown>) => {
            const lib = libraryRow(plugins)
            if (lib) plugins.wire.send(lib.id, 'build', 'effects', kit.kind, JSON.stringify(file))
          }
          effectsEditor(host, kit.kind, kit.effects!, write, save)
          return host
        })
      }
    }

    const fov = plugins.render3d?.camera?.fov ?? 50
    scene.panel(plugins, d, show, look(fov, d.frame.fill), mesh)

    const status = show('status', () => Object.assign(document.createElement('p'), { className: 'status' }))
    status.className = lib?.running ? 'status running' : 'status'
    status.textContent = lib?.running ? `building ${lib.running}` : failed
    return [width, height]
  }

  // the stats line and the check spot's words, over the game's bottom left (`stats`)
  const readouts = (plugins: Plugins, d: any) => {
    const dom = plugins.renderdom
    dom.panel('library stats', d.stats)
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

      // the game, under the panel: the camera's drags and wheel
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
      // a shot (`world.library.proof`): the place alone, no panel, no stats line and no keys
      const shooting = !!worldOf(plugins).library?.proof
      if (!shooting) {
        const { line, spot } = readouts(plugins, d)
        dom.keys((k: { code: string; mod: boolean; repeat: boolean }) => {
          if (k.mod) return false
          if (scene.keys.includes(k.code)) { if (!k.repeat) scene.key(plugins, k.code, put, spot); return true }
          if (!(k.code in FLY || k.code.startsWith('Shift'))) return false
          held.add(k.code)
          return true
        })
        dom.keyups((k: { code: string }) => { held.delete(k.code); return false })
        panel(plugins, d)
        camera(plugins, d, seconds)
        scene.tick(plugins, d, line)
      } else {
        camera(plugins, d, seconds)
        scene.tick(plugins, d)
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
          const kit: Kit = json(plugins.wire, 'library.kit')
          order(plugins, 'kit', kit.kind, differing(kit), world.world3d.place)
        } else if (!waiting && has('library.made')) {
          const made = json(plugins.wire, 'library.made')
          if (made.materials) order(plugins, 'materials', '', made.materials, world.world3d.place)
          else order(plugins, 'scene', made.scene, {}, world.world3d.place)
        }
      }
      if (waiting && lib.done >= waiting) {
        waiting = 0
        failed = lib.error
        if (failed) return
        const url = new URL(location.href)
        url.searchParams.set(d.address, going!)
        if (url.href === location.href) location.reload()
        else location.href = url.href
      }
    },
    close(plugins: Plugins) {
      plugins.render3d?.release(OWNER)
      scene.close(plugins)
      held.clear()
    },
  }
}
