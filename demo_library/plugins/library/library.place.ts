// A build of pro-ng's made the place a scene draws, before the scene boots: what `dev.html?place=<name>` does to its
// own copy of the entered scene's file. `place(scene, name)`, handed the scene file's object and the place's name (a folder of
// `assets/builds/`, which `assets/build.ts` writes into the system's temp folder and `assets/builds` links to):
//   - every catalogue entry of a build is taken out of the scene's copy, and the build's own written in: each part of
//     world3d's the scene reads (`glb`, `looks`, `clips`, `effects`, a kit kind's build having no nav or crowd) by the
//     name world3d reads it, and each picture its looks file names, a colour picture in sRGB and every other linear;
//   - `world.world3d.place` names it;
//   - the library plugin's own entries are written where their files are there: `library`, what pro-ng has to build
//     (`builds/library.json`), `library.kit`, the keys a kit kind's build was made from (`<place>.kit.json`),
//     `library.made`, the scene a scene's build was made from (`<place>.scene.json`), `library.knobs`, each material's
//     settings' ranges (`<place>.knobs.json`), `library.proof`, the scene's check spots (`<place>.proof.json`), and
//     `library.shapes` and `library.nav`, its walk shapes and nav graph (`<place>.shapes3d.json`, `<place>.nav.json`),
//     `library.studio`, a catalogue build's families and swatches (`<place>.studio.json`, `assets/build.ts`'s
//     `buildMaterials`), and `library.sidecars`, its looks' own meshes (`<place>.sidecars.json`)
//     (`library.plugin.ts`, `library.scene.ts`, `library.kit.ts`, `library.material.ts`);
//   - the game's effects file is handed, in this process alone (`written`), a copy holding the build's effects too,
//     so particle3d holds them as its own file's: the effects editor (`library.effects.ts`) writes that copy again
//     with each change, and particle3d takes it as a written file. With `effectsOn` false it holds none of them, so no
//     effect of the build is thrown (world3d throws a spawn once particle3d holds its effect).
// `place` is also how a page goes to a build while it runs (`library.plugin.ts`'s `swap`): handed the scene its client
// was made from, whose `world.loader` and `world.world3d` are the scene file's own objects, and a `version`, so every
// url of the build carries `?v=<version>` and a build made again is read anew; the seat is then sent to its own scene,
// and the next client is made from it.
// `listed(scene)` writes the `library` entry alone, for a page with no place. Both read files with the loader's
// `jsonAt`, so they are awaited before the boot: `chosen(scene, name)`, below, picks between them from the page's
// address and is awaited by each scene's sim module (`scene.sim.ts`, `kit.sim.ts`, `materials.sim.ts`) as it is
// imported.
//
// A place with no build there (`<place>.looks.json` not found) is drawn as no place at all (`bare`): world3d, which
// draws a place, and supershader3d, which reads its looks file, taken out of the scene's plugins, so the scene boots
// with nothing of a build in it and its tool shows its picker alone. `place` puts them back as they were, so a build
// gone to later is drawn.
import { jsonAt, written } from '#plugins/loader/loader.sim.ts'

export const BUILDS = '/games/demo_library/assets/builds/'

type SceneFile = { world: Record<string, any>; plugins: string[]; prefabs: Record<string, any> }

// each bare scene's plugins as its file gave them, put back by `place`
const bared = new WeakMap<SceneFile, string[]>()
// the plugins a scene with no place is drawn without
const PLACED = ['world3d', 'supershader3d']

// Whether a build of that name is there: its looks file read, or none.
export const built = async (name: string, version?: number): Promise<boolean> =>
  !!(await there(`${name}.looks`, `${BUILDS}${name}/${name}.looks.json${version === undefined ? '' : `?v=${version}`}`))

// The scene drawn with no place: world3d and supershader3d out, every build's entries out.
export function bare(scene: SceneFile): void {
  if (bared.has(scene)) return
  bared.set(scene, [...scene.plugins])
  scene.plugins = scene.plugins.filter(p => !PLACED.includes(p))
  const assets: Record<string, { url: string }> = scene.world.loader.assets
  for (const [key, a] of Object.entries(assets)) if (a.url.startsWith(BUILDS)) delete assets[key]
}

// Whether a file of the builds is there: a json file read, or none.
const there = (name: string, url: string): Promise<any> => jsonAt(name, url).catch(() => undefined)

export async function listed(scene: SceneFile, version?: number): Promise<void> {
  const url = `${BUILDS}library.json${version === undefined ? '' : `?v=${version}`}`
  if (await there('library', url)) scene.world.loader.assets.library = { type: 'json', url, preload: true }
}

// What a page's address asks a scene to draw, written into that scene's file before anything boots it: run by each
// scene's sim module as it is imported, so the truth in a tab, the server's truth and every page's client (`dev.html`,
// `client.html`, `index.html`) read the one scene. `name` is the scene's own name in the manager's table. In a tab, the
// scene the address enters (`?scene=`, else the manager's `entry`, `entered`) draws `?place=<name>`, and every scene
// draws its own file's `world.world3d.place` otherwise: that build (`place`, its effects left out with `?noeffects`),
// or no place where it is not built (`bare`); and the entered scene's `world.library` takes the address's
// (`?eye=x,y,z&look=x,y,z`, `?clip`, `?at`, `?view`, `?flat`, `?proof`, `?shapes`, `?nav`; `library.plugin.ts`,
// `library.scene.ts`) over its file's own (`tool`). `?ssr=0` takes render3d's `ssr` off every scene; `?glow=1` gives every scene with a place lights3d's
// area lights and the glow (`place`). On node, which
// has no address, `listed`.
export async function chosen(scene: SceneFile, name: string, entered: string): Promise<void> {
  if (typeof location === 'undefined') return listed(scene)
  const ask = new URLSearchParams(location.search)
  const here = (ask.get('scene') ?? entered) === name
  const want = (here ? ask.get('place') : null) ?? scene.world.world3d.place as string
  if (await built(want)) await place(scene, want, !ask.has('noeffects'))
  else {
    bare(scene)
    scene.world.world3d.place = want
    await listed(scene)
  }
  // `?ssr=0`: every scene drawn without render3d's screen-space reflections, read as the renderer is made
  if (ask.get('ssr') === '0') delete scene.prefabs.render3d.ssr
  if (!here) return
  const point = (key: string) => ask.get(key)!.split(',').map(Number)
  scene.world.library = {
    ...scene.world.library,
    ...(ask.has('eye') && ask.has('look') ? { eye: point('eye'), look: point('look') } : {}),
    ...(ask.has('clip') ? { clip: ask.get('clip') } : {}),
    ...(ask.has('at') ? { at: Number(ask.get('at')) } : {}),
    ...(ask.has('view') ? { view: ask.get('view') } : {}),
    flat: ask.has('flat'),
    proof: ask.has('proof'),
    shapes: ask.has('shapes'),
    nav: ask.has('nav'),
  }
}

export async function place(scene: SceneFile, name: string, effectsOn = true, version?: number): Promise<void> {
  const was = bared.get(scene)
  if (was) {
    scene.plugins = was
    bared.delete(scene)
  }
  // `?glow=1`: lights3d's area lights, lit by what glows in supershader3d's glowmap, as the definition's `glow` gives
  // them; off otherwise, since they take three more of a shader's sixteen textures
  if (new URLSearchParams(location.search).get('glow') === '1') {
    const defs = await jsonAt(scene.world.defs, scene.world.loader.assets[scene.world.defs].url)
    const g = defs.library.glow
    scene.world.lights3d.areas = structuredClone(g.areas)
    scene.world.lights3d.mods = { ...scene.world.lights3d.mods, glow: 'supershader3d' }
    scene.world.supershader3d.glowmap = structuredClone(g.glowmap)
  }
  const folder = `${BUILDS}${name}/`
  // every file of the build at its url, with `?v=<version>` when one is given: the loader keeps a file by its url, so
  // a build made again since the last time it was read is read anew under a version it has not seen
  const at = (file: string) => `${folder}${file}${version === undefined ? '' : `?v=${version}`}`
  const assets: Record<string, { url: string } & Record<string, unknown>> = scene.world.loader.assets
  for (const [key, a] of Object.entries(assets)) if (a.url.startsWith(BUILDS)) delete assets[key]
  for (const part of ['glb', 'looks', 'clips', 'effects']) {
    const glb = part === 'glb'
    assets[`${name}.${part}`] = { type: glb ? 'binary' : 'json', url: at(`${name}${glb ? '.glb' : `.${part}.json`}`), preload: true }
  }
  const looks = await jsonAt(`${name}.looks`, at(`${name}.looks.json`))
  for (const p of looks.pictures) assets[p.asset] = { type: 'texture', url: at(`looks/${p.file}`), ...(p.colour ? {} : { space: 'linear' }), wrap: 'repeat', preload: true }
  scene.world.world3d.place = name
  await listed(scene, version)
  for (const [key, file] of [
    ['library.kit', `${name}.kit.json`], ['library.made', `${name}.scene.json`], ['library.knobs', `${name}.knobs.json`],
    ['library.proof', `${name}.proof.json`], ['library.shapes', `${name}.shapes3d.json`], ['library.nav', `${name}.nav.json`],
    ['library.studio', `${name}.studio.json`], ['library.sidecars', `${name}.sidecars.json`],
  ]) {
    const url = at(file)
    if (await there(key, url)) assets[key] = { type: 'json', url, preload: true }
  }
  const effectsUrl = assets[scene.world.particle3d.effects].url
  const effects = await jsonAt(scene.world.particle3d.effects, effectsUrl)
  const built = await jsonAt(`${name}.effects`, at(`${name}.effects.json`))
  written(effectsUrl, JSON.stringify({ ...effects, effects: effectsOn ? { ...effects.effects, ...built.effects } : effects.effects }))
}
