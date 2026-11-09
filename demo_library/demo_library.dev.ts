// The dev panel of demo_library's two dev pages, `dev.html` (the truth in the tab, or `?server`) and `client.html`
// (the game's server), the same panel on both: lil-gui at the page's top right. Nothing in the game imports it, and it
// writes no file. `panel(page, file)` builds it once, handed the page's `view` and the manager's scene file; `tick()`,
// called after each frame, lays the panel's numbers into the client the seat is on now, so a client made on another
// scene or another build takes them too.
//
//   scene            the three scenes (art, kit, materials); a pick loads the page again on it, its place taken off.
//   reflections      render3d's `ssr`: on or off (`?ssr=0`, a reload, since the composer is made once), and its steps,
//                    distance, thickness and roughness live, render3d reading them every frame.
//   render3d         the exposure and the tone (neutral or none; never ACES), live.
//   lights3d area lights  lights3d's area lights and the glow off or on (`?glow=1`, a reload; off by default, since
//                    they take three more of a shader's sixteen textures, `library.place.ts`), and, on, the gain of
//                    the glow supershader3d's glowmap lights the scene with (`areas.glow.gain`), live.
//   copy changed values  every control moved since the page opened, under the file and the keys it is kept at, as JSON
//                    on the clipboard, to be pasted by hand: the scene's file for `ssr`, the tone and the exposure
//                    (each scene file holds the same numbers, so the copy names the scene the seat is on), and the
//                    definitions' `library.glow` for the gain.
//
// The panel stops a press, a key and the wheel at itself, so the game never takes them as its own; a release goes on,
// so a drag let go over it still ends. After a click the focus goes back to the page, but into a number being typed or
// a list being picked from.
import GUI from 'lil-gui'

type Ssr = { steps: number; distance: number; thickness: number; roughness: number }
type Page = { readonly client: { plugins: Record<string, any> } | undefined; readonly name: string | undefined }
type ManagerFile = { prefabs: { scenemanager: { entry: string; scenes: Record<string, unknown> } } }

// the numbers the panel starts on, before a client is up to read them from
const SSR: Ssr = { steps: 32, distance: 6, thickness: 0.3, roughness: 0.4 }

export function panel(page: Page, file: ManagerFile) {
  const ask = new URLSearchParams(location.search)
  const gui = new GUI({ title: 'demo_library dev' })
  for (const type of ['keydown', 'keyup', 'click', 'mousedown', 'contextmenu', 'wheel'])
    gui.domElement.addEventListener(type, e => e.stopPropagation())
  gui.domElement.addEventListener('pointerup', () => requestAnimationFrame(() => {
    const at = document.activeElement as HTMLElement | null
    if (!at || !gui.domElement.contains(at)) return
    const typing = at.tagName === 'INPUT' && ((at as HTMLInputElement).type === 'text' || (at as HTMLInputElement).type === 'number')
    if (at.tagName !== 'SELECT' && !typing) at.blur()
  }))
  addEventListener('change', e => { if (gui.domElement.contains(e.target as Node)) (e.target as HTMLElement).blur() })
  const style = document.createElement('style')
  style.textContent = '.lil-gui.root { max-height: 100vh; overflow-y: auto }'
  document.head.append(style)

  // The page loaded again with the address changed.
  const reload = (set: Record<string, string | undefined>) => {
    const url = new URL(location.href)
    for (const [k, v] of Object.entries(set)) if (v === undefined) url.searchParams.delete(k); else url.searchParams.set(k, v)
    location.href = url.href
  }

  const chosen = { scene: ask.get('scene') ?? file.prefabs.scenemanager.entry }
  gui.add(chosen, 'scene', Object.keys(file.prefabs.scenemanager.scenes)).name('scene').onChange((s: string) => reload({ scene: s, place: undefined, material: undefined }))

  // The panel's own numbers, laid into each client the seat is on (`tick`); read from the first client's scene.
  const on = ask.get('ssr') !== '0'
  const own = { ssr: { ...SSR }, exposure: 1, tone: 'neutral', gain: 8 }
  let read = false

  const reflections = gui.addFolder('reflections (ssr)')
  reflections.add({ on }, 'on').name('on (reloads)').onChange((v: boolean) => reload({ ssr: v ? undefined : '0' }))
  const knobs = [
    reflections.add(own.ssr, 'steps', 4, 256, 1).name('steps a ray'),
    reflections.add(own.ssr, 'distance', 0.5, 60, 0.5).name('distance (m a ray goes)'),
    reflections.add(own.ssr, 'thickness', 0.05, 5, 0.05).name('thickness (m behind the depth)'),
    reflections.add(own.ssr, 'roughness', 0.05, 1, 0.01).name('roughness (rougher reflects nothing)'),
  ]
  if (!on) for (const k of knobs) k.disable()

  const r3f = gui.addFolder('render3d')
  r3f.add(own, 'exposure', 0.1, 4, 0.01).name('exposure')
  r3f.add(own, 'tone', ['neutral', 'none']).name('tone')

  const glowing = ask.get('glow') === '1'
  const lf = gui.addFolder('lights3d area lights')
  lf.add({ on: glowing }, 'on').name('area lights + glow (reloads)').onChange((v: boolean) => reload({ glow: v ? '1' : undefined }))
  const gain = lf.add(own, 'gain', 0, 40, 0.1).name('glow gain (× the glow)')
  if (!glowing) gain.disable()

  // Every control moved since the page opened, by the file and keys it is kept at in the scene the seat is on.
  const touched = new Set<string>()
  gui.onChange((e: { property: string; object: object; value: unknown }) => {
    if (typeof e.value === 'function') return
    if (e.object === own.ssr) touched.add(`ssr.${e.property}`)
    else if (e.object === own) touched.add(e.property)
  })
  gui.add({ copy: () => {
    const scene = page.name ?? chosen.scene
    const at = `games/demo_library/${scene}.scene.json`
    const out: Record<string, any> = {}
    const defs: Record<string, any> = {}
    for (const t of touched) {
      if (t.startsWith('ssr.')) ((out.prefabs ??= {}).render3d ??= {}).ssr = { ...own.ssr }
      else if (t === 'exposure' || t === 'tone') ((out.prefabs ??= {}).render3d ??= {})[t] = own[t]
      else if (t === 'gain') defs.library = { glow: { areas: { glow: { gain: own.gain } } } }
    }
    const copied: Record<string, any> = {}
    if (Object.keys(out).length) copied[at] = out
    if (Object.keys(defs).length) copied['games/demo_library/assets/demo_library.json'] = defs
    void navigator.clipboard?.writeText(JSON.stringify(copied, null, 2))
  } }, 'copy').name('copy changed values')

  return {
    tick() {
      const plugins = page.client?.plugins
      const r3 = plugins?.render3d
      const scene = plugins?.wire?.scene
      if (!r3?.renderer || !scene) return
      const prefab = scene.prefabs.render3d
      const glow = scene.world?.lights3d?.areas?.glow
      // the first client's own numbers are where the panel starts
      if (!read) {
        read = true
        if (prefab.ssr) Object.assign(own.ssr, prefab.ssr)
        if (prefab.exposure !== undefined) own.exposure = prefab.exposure
        if (prefab.tone !== undefined) own.tone = prefab.tone
        if (glow) own.gain = glow.gain
        gui.controllersRecursive().forEach(c => c.updateDisplay())
      }
      if (prefab.ssr) Object.assign(prefab.ssr, own.ssr)
      r3.renderer.toneMappingExposure = own.exposure
      prefab.exposure = own.exposure
      // the tone set on this client's renderer whenever it is not the panel's, a new client's included
      const tone = own.tone === 'neutral' ? r3.THREE.NeutralToneMapping : r3.THREE.NoToneMapping
      if (r3.renderer.toneMapping !== tone) {
        prefab.tone = own.tone
        r3.renderer.toneMapping = tone
        // three builds a material's shader with its tone mapping
        r3.scene.traverse((o: any) => { for (const m of [o.material ?? []].flat()) m.needsUpdate = true })
      }
      if (glow) glow.gain = own.gain
    },
  }
}
