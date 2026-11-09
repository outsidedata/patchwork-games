// pro-ng builds written into the game's builds folder, from the repo's root:
//
//   node --experimental-strip-types games/demo_library/assets/build.ts list
//     what pro-ng has to build, live from pro-ng, into `builds/library.json` (`writeList`);
//   node --experimental-strip-types games/demo_library/assets/build.ts materials [<material> ...]
//     every material on its swatch, the looks studio's catalogue, into `builds/materials/` (`buildMaterials`);
//
//   node --experimental-strip-types games/demo_library/assets/build.ts <scene>
//     a scene of pro-ng's (`castle/smallville/rooms/tavern.art`), made by pro-ng's own build (`pro-ng/build.mjs`), into
//     `builds/<its last name>/`;
//   node --experimental-strip-types games/demo_library/assets/build.ts kit <kind> [<Key>=<value> ...]
//     one kit kind alone at the world's zero, as the kit studio builds it (`pro-ng/kit_studio.mjs`): its numbers its
//     `kit/<kind>.studio.defaults.json`, each `<Key>=<value>` laid over them (the value read as JSON, else as text),
//     written as a one-thing scene file, cut by `procedural.py` and packed by `pack.mjs`, into `builds/<kind>/` (a
//     crawled kind's slashes written `--`), the place named the same.
//
// `builds/` is `<system temp>/demo_library/`, which the game's `assets/builds` links to; `dev.html?place=<name>` draws
// what is there. Beside every build: `<name>.knobs.json`, each material's settings' ranges (`knobs`); beside a scene's,
// `<name>.scene.json` (the scene it was made from) and `<name>.proof.json` (its check spots, where pro-ng has them);
// beside a kit kind's, `<name>.kit.json` (`kitOf`). Either way the looks file is then made supershader3d's, its settings moved out of uniforms into the
// settings table (`packLooks`, `scripts/pack-looks.ts`). The library (PATCHWORK_LIBRARY) is read and never written;
// it and Blender (BLENDER) are found as every bake finds them, the shell's, else `.env`'s (`resolve`,
// `scripts/health.ts`), and pro-ng's own build is handed both.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolve } from '#scripts/health.ts'
import { packLooks } from '#scripts/pack-looks.ts'

// the library and Blender as every bake finds them: the shell's PATCHWORK_LIBRARY and BLENDER, else `.env`'s at the
// repo's root, else their defaults (`resolve`, `scripts/health.ts`)
const { library: LIBRARY, blender: BLENDER, env: ENV } = resolve(process.cwd(), process.env)
const PRONG = path.join(LIBRARY, 'pro-ng')
export const BUILDS = path.join(os.tmpdir(), 'demo_library')

// The build's looks file made supershader3d's, and its knobs written beside it (`knobs`).
const pack = async (out: string, name: string) => {
  const looksFile = path.join(out, `${name}.looks.json`)
  const looks = packLooks(JSON.parse(fs.readFileSync(looksFile, 'utf8')))
  fs.writeFileSync(looksFile, JSON.stringify(looks, null, 1) + '\n')
  fs.writeFileSync(path.join(out, `${name}.knobs.json`), JSON.stringify(await knobs(looks), null, 1) + '\n')
}

// Each material's settings as the looks' studio shows them (`pro-ng/material/install.js`'s panel, from
// `compose.js`'s knobs): by material, each setting of the looks file by its name, `{ label, min, max, step }` from its
// look's `params` (`pro-ng/material/looks/<look>.js`) where the look gives it a range, `{ label, colour: true }` for a
// colour, and `{ label }` for a number its look gives no range.
async function knobs(looks: { materials: { name: string; look: string }[]; settings: { materials: { name: string; type: string }[][] } }) {
  const out: Record<string, Record<string, { label: string; min?: number; max?: number; step?: number; colour?: boolean }>> = {}
  for (const [id, m] of looks.materials.entries()) {
    const look = (await import(pathToFileURL(path.join(PRONG, 'material', 'looks', `${m.look}.js`)).href)).default
    const params: Record<string, unknown> = look.params ?? {}
    out[m.name] = {}
    for (const s of looks.settings.materials[id] ?? []) {
      const p = params[s.name]
      if (p && typeof p === 'object' && !Array.isArray(p)) out[m.name][s.name] = { label: s.name, ...(p as object) }
      else out[m.name][s.name] = s.type === 'vec3' ? { label: s.name, colour: true } : { label: s.name }
    }
  }
  return out
}

// A scene of pro-ng's built into `builds/<its last name>/`, which is handed back.
export async function buildScene(scene: string): Promise<string> {
  const name = path.basename(scene)
  const out = path.join(BUILDS, name)
  const { build } = await import(pathToFileURL(path.join(PRONG, 'build.mjs')).href)
  await build(scene, out, (args: string[]) => { execFileSync(BLENDER, ['--background', ...args], { stdio: 'inherit', env: { ...ENV, PATCHWORK_LIBRARY: LIBRARY } }) })
  await pack(out, name)
  // what it was made from, for a page that builds it again (`<name>.scene.json` beside it: `{ scene }`)
  fs.writeFileSync(path.join(out, `${name}.scene.json`), JSON.stringify({ scene }) + '\n')
  // its check spots, pro-ng's `proof/<scene>.json`, copied beside it as `<name>.proof.json` where it has them
  const proof = path.join(PRONG, 'proof', `${scene}.json`)
  if (fs.existsSync(proof)) fs.copyFileSync(proof, path.join(out, `${name}.proof.json`))
  return out
}

// One kit kind built into `builds/<kind>/`, its studio defaults with `values` over them; the folder is handed back.
export async function buildKit(kind: string, values: Record<string, unknown> = {}): Promise<string> {
  const defaults = path.join(PRONG, 'kit', `${kind}.studio.defaults.json`)
  if (!fs.existsSync(defaults)) throw new Error(`pro-ng has no kit kind ${kind}: no ${defaults}`)
  const name = kind.replace(/\//g, '--')
  const out = path.join(BUILDS, name)
  const { fetchAll } = await import(pathToFileURL(path.join(PRONG, 'textures.mjs')).href)
  await fetchAll()
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  const file = path.join(out, `${name}.json`)
  const thing = { kind, name: kind, ...JSON.parse(fs.readFileSync(defaults, 'utf8')), ...values }
  fs.writeFileSync(file, JSON.stringify({ buildings: [thing] }, null, 1))
  execFileSync(BLENDER, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', path.join(PRONG, 'procedural.py'), '--', 'file', file, out], { stdio: 'inherit', env: { ...ENV, PATCHWORK_LIBRARY: LIBRARY } })
  execFileSync(process.execPath, [path.join(PRONG, 'pack.mjs'), path.join(out, `${name}.glb`)], { stdio: 'inherit' })
  await pack(out, name)
  fs.writeFileSync(path.join(out, `${name}.kit.json`), JSON.stringify(kitOf(kind, values), null, 1) + '\n')
  return out
}

// What a kit build was made from, `<name>.kit.json` beside it, for the page's key table: `kind`; `defaults`, its studio
// defaults file; `values`, the keys laid over them; and its header (`kit/<kind>.py`'s leading `#` lines, the kind's
// only documentation) as `about`, the lines before its example; `keys`, each row of its key table `{ keys, type, does }`
// (one row may name several keys, `A`, `B`); and `notes`, the lines after the table.
function kitOf(kind: string, values: Record<string, unknown>) {
  const head: string[] = []
  for (const line of fs.readFileSync(path.join(PRONG, 'kit', `${kind}.py`), 'utf8').split('\n')) {
    if (!line.startsWith('#')) break
    head.push(line.replace(/^# ?/, ''))
  }
  const fence = head.findIndex(l => l.startsWith('```'))
  const rows = head.filter(l => l.startsWith('|') && !/^\|\s*-/.test(l) && !/^\|\s*key\s*\|/.test(l))
  let last = -1
  head.forEach((l, i) => { if (l.startsWith('|')) last = i })
  const effects = path.join(PRONG, 'kit', `${kind}.effects.json`)
  return {
    kind,
    // its own effects file, `kit/<kind>.effects.json`, by its own names, where it has one (the effects editor's)
    ...(fs.existsSync(effects) ? { effects: JSON.parse(fs.readFileSync(effects, 'utf8')) } : {}),
    defaults: JSON.parse(fs.readFileSync(path.join(PRONG, 'kit', `${kind}.studio.defaults.json`), 'utf8')),
    values,
    about: head.slice(0, fence < 0 ? head.length : fence).join(' ').trim(),
    keys: rows.map(r => {
      const [keys, type, does] = r.split('|').slice(1, 4).map(c => c.trim())
      return { keys: keys.split(',').map(k => k.replace(/`/g, '').trim()), type, does }
    }),
    notes: last < 0 ? [] : head.slice(last + 1).filter(l => l.trim()),
  }
}

// What pro-ng has to build, live from pro-ng, written as `builds/library.json`: `prong`, pro-ng's folder, which the
// server watches (`addons/library`); `kinds`, every kit kind by pro-ng's own
// list (`kit_kinds.mjs`, the kit studio's), each `{ kind, about }`, its description from its header; and `landmarks`,
// every `.art.json` scene under `pro-ng/scenes/`, by its path there without `.json`. The file is handed back.
export async function writeList(): Promise<string> {
  const { kinds, about } = await import(pathToFileURL(path.join(PRONG, 'kit_kinds.mjs')).href)
  const scenes = path.join(PRONG, 'scenes')
  const landmarks: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.art.json')) landmarks.push(path.relative(scenes, p).slice(0, -'.json'.length))
    }
  }
  walk(scenes)
  const file = path.join(BUILDS, 'library.json')
  fs.mkdirSync(BUILDS, { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ prong: PRONG, kinds: (kinds() as string[]).map(kind => ({ kind, about: about(kind) })), landmarks: landmarks.sort() }, null, 1) + '\n')
  return file
}

// pro-ng's looks studio (`pro-ng/studio.mjs`) and its catalogue (`pro-ng/catalogue_materials.mjs`) as a build: every
// material of `pro-ng/materials.json` but the buildings' walls and roofs (or only `picked`, in that order), each on a
// `swatch` kit thing (a sphere, a block and a column), a row per family, the kit's first, swatches `SPACING` apart along
// x and rows `ROWS` apart southward, as the catalogue lays them out. Written into `builds/materials/` (`picked`:
// `builds/materials-pick/`), never into the library: the scene file beside the build, cut by `procedural.py`, packed
// by `pack.mjs`; and beside it `<name>.studio.json` (`{ families: [{ name, materials: [{ name, look, at }] }] }`, each
// swatch's place in three's axes), `<name>.sidecars.json` (each look's own mesh, `material/looks/<look>.json`, by its
// look, for each look drawn that has one: its material's swatch is cut `UNDER` metres down and the game draws the
// mesh in its place, as the looks studio does), `<name>.proof.json` (the catalogue's views: each row in pieces of seven from 11 m
// south, then each swatch close) and `<name>.scene.json` (`{ materials: picked }`, what a page builds it again from).
const SPACING = 2.4, ROWS = 12.0, HALF = 7, UNDER = 1000
export async function buildMaterials(picked: string[] = []): Promise<string> {
  const json = JSON.parse(fs.readFileSync(path.join(PRONG, 'materials.json'), 'utf8')) as { materials: Record<string, { look: string; family: string }> }
  const unknown = picked.filter(n => !json.materials[n])
  if (unknown.length) throw new Error(`no material ${unknown.join(', ')} in pro-ng/materials.json`)
  const families: { name: string; materials: string[] }[] = []
  if (picked.length) families.push({ name: 'picked', materials: picked })
  else for (const [name, m] of Object.entries(json.materials)) {
    if (m.family === 'buildings') continue
    let f = families.find(q => q.name === m.family)
    if (!f) families.push(f = { name: m.family, materials: [] })
    f.materials.push(name)
  }
  families.sort((a, b) => (a.name === 'kit' ? -1 : b.name === 'kit' ? 1 : 0))
  const name = picked.length ? 'materials-pick' : 'materials'
  const out = path.join(BUILDS, name)
  const { fetchAll } = await import(pathToFileURL(path.join(PRONG, 'textures.mjs')).href)
  await fetchAll()
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  const things: unknown[] = [], views: unknown[] = [], rows: unknown[] = []
  const studio = families.map((f, row) => {
    const y = -row * ROWS
    for (let s = 0, part = 1; s < f.materials.length; s += HALF, part++) {
      const piece = f.materials.slice(s, s + HALF)
      const mid = (s + (piece.length - 1) / 2) * SPACING
      rows.push({ name: `row ${f.name} ${part}`, eye: [mid, y - 11.0, 3.5], at: [mid, y, 0.35], expect: `the ${f.name} row: ${piece.join(', ')}.` })
    }
    return {
      name: f.name,
      materials: f.materials.map((m, i) => {
        const x = i * SPACING
        // a look with its own mesh (a sidecar, `material/looks/<look>.json`) is drawn on that mesh, by the game
        // (`library.viewer.ts`); its swatch is cut out of sight, `UNDER` metres down, so the looks file still holds it
        const own = fs.existsSync(path.join(PRONG, 'material', 'looks', `${json.materials[m].look}.json`))
        things.push({ kind: 'swatch', name: m, place: [x, y], ...(own ? { elevation: -UNDER } : {}), Material: m })
        views.push({ name: m, eye: [x - 0.35, y - 2.1, 1.05], at: [x, y, 0.3], expect: `${m} (${json.materials[m].family}): a sphere, a block and a column.` })
        // the scene's x east, y north, z up, made three's: x, z, -y
        return { name: m, look: json.materials[m].look, at: [x, 0.3, -y] }
      }),
    }
  })
  const file = path.join(out, `${name}.json`)
  fs.writeFileSync(file, JSON.stringify({ buildings: things }, null, 1))
  execFileSync(BLENDER, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', path.join(PRONG, 'procedural.py'), '--', 'file', file, out], { stdio: 'inherit', env: { ...ENV, PATCHWORK_LIBRARY: LIBRARY } })
  execFileSync(process.execPath, [path.join(PRONG, 'pack.mjs'), path.join(out, `${name}.glb`)], { stdio: 'inherit' })
  await pack(out, name)
  fs.writeFileSync(path.join(out, `${name}.studio.json`), JSON.stringify({ families: studio }, null, 1) + '\n')
  // each look's own mesh, by its look, of the looks the catalogue draws that have one
  const sidecars: Record<string, unknown> = {}
  for (const look of new Set(studio.flatMap(f => f.materials.map(m => m.look)))) {
    const file = path.join(PRONG, 'material', 'looks', `${look}.json`)
    if (fs.existsSync(file)) sidecars[look] = JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  fs.writeFileSync(path.join(out, `${name}.sidecars.json`), JSON.stringify(sidecars) + '\n')
  fs.writeFileSync(path.join(out, `${name}.proof.json`), JSON.stringify({ about: 'Every material on its swatch, each row whole, then each swatch close, from the south.', views: [...rows, ...views] }, null, 1) + '\n')
  fs.writeFileSync(path.join(out, `${name}.scene.json`), JSON.stringify({ materials: picked }) + '\n')
  return out
}

// `<Key>=<value>`, the value read as JSON, else as text.
const pair = (arg: string): [string, unknown] => {
  const at = arg.indexOf('=')
  if (at < 1) throw new Error(`a kit key is <Key>=<value>, not ${arg}`)
  const text = arg.slice(at + 1)
  try { return [arg.slice(0, at), JSON.parse(text)] } catch { return [arg.slice(0, at), text] }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [first, ...rest] = process.argv.slice(2)
  if (first === 'list' && !rest.length) console.log('wrote', await writeList())
  else if (first === 'materials') console.log('built', await buildMaterials(rest))
  else if (first === 'kit' && rest.length) console.log('built', await buildKit(rest[0], Object.fromEntries(rest.slice(1).map(pair))))
  else if (first && first !== 'kit' && !rest.length) console.log('built', await buildScene(first))
  else throw new Error('build.ts list | build.ts materials [<material> ...] | build.ts <scene> | build.ts kit <kind> [<Key>=<value> ...]')
}
