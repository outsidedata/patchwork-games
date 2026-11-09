// The game's builds, run where the truth is. A `library` row's `build` act asks for one (`library.sim.ts`), and this
// addon runs it: `assets/build.ts` on node, a child process of the server, `kit <kind> <Key>=<value> ...` for a kit
// kind, `<scene>` for a scene of pro-ng's or `list` for what pro-ng has to build (`builds/library.json`); or a kit
// kind's effects saved into pro-ng's own effects file (`saveEffects`), the one write into the library it makes, as the
// kit studio's Save makes it; the builds writing into `<system temp>/demo_library/`, which the game's
// `assets/builds` links to. One build runs at a time per truth; a build asked for while one runs waits for it.
//
// A truth is known by its `world`, the one object each truth holds for its life, which a rule reaches as `w.world`.
// `start(world, ask)` starts one and hands back its number; `state(world)` is what the truth's builds have come to:
// `asked`, the number of the newest build asked for, `done`, the newest that finished, `running`, what runs now ('' for
// nothing), `error`, the last failed build's last lines ('' after one that worked), and `materials`, every material of
// pro-ng's `materials.json` the catalogue builds (`{ name, look, family }`, in the file's order, all but the buildings'
// walls and roofs, family `buildings`, as `assets/build.ts materials` leaves them out), read when the watch starts and
// again whenever `materials.json` changes, and `rebuilt`, by place, the number of the newest build of a catalogue this
// addon started itself (`catalogues`, below), which a page showing that place goes to once `done` reaches it. A truth
// in a tab has no node to run Blender on or read the library with, so a build asked for there fails, saying so, and its
// `materials` stays empty.
export type Ask = { kit: string; values: Record<string, unknown> } | { scene: string } | { list: true } | { effects: string; file: Record<string, unknown> }
  | { materials: string[] }
export type Material = { name: string; look: string; family: string }
export type State = { asked: number; done: number; running: string; error: string; changed: number; file: string; materials: Material[]; rebuilt: Record<string, number> }
type Held = State & { queue: Promise<void>; watching: boolean }

const states = new WeakMap<object, Held>()

const of = (truth: object) => {
  let s = states.get(truth)
  if (!s) states.set(truth, s = { asked: 0, done: 0, running: '', error: '', changed: 0, file: '', materials: [], rebuilt: {}, queue: Promise.resolve(), watching: false })
  return s
}

// pro-ng's files every build reads, which the watch follows: these folders, all through, and these files
const DIRS = ['kit', 'scenes', 'material']
const FILES = ['procedural.py', 'pack.mjs', 'materials.json']
// the places the catalogue is built as (`assets/build.ts materials`): every material, and only those picked
const CATALOGUES = ['materials', 'materials-pick']

// The library's pro-ng watched as the kit studio and the looks studio watch it (`pro-ng/kit_studio.mjs`,
// `pro-ng/studio.mjs`): every file under `kit/`, `scenes/` and `material/` (no `__pycache__`), `procedural.py`,
// `pack.mjs` and `materials.json`. A change, once 150 ms have passed with no other, counts one more on `changed` and
// names the file in `file`, so a page showing a scene's or a kit kind's build builds it again; `materials.json` is read
// again; and each catalogue there is is built again here, by its own `<place>.scene.json` (`{ materials }`, the ones
// picked). When the watch starts, a catalogue is built again where pro-ng is newer than it: a file pro-ng's builds read
// changed after its `<place>.studio.json` was written, or (the whole catalogue) its materials not `materials.json`'s.
// On node alone, once the list is written: pro-ng's folder is the list's `prong` (`builds/library.json`,
// `assets/build.ts`), where the builds find the library.
export function watch(world: object) {
  const s = of(world)
  if (s.watching || typeof process === 'undefined' || !process.versions?.node) return
  s.watching = true
  s.queue = s.queue.then(() => watching(s))
}

async function watching(s: Held) {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const builds = path.join(os.tmpdir(), 'demo_library')
  const list = path.join(builds, 'library.json')
  if (!fs.existsSync(list)) return
  const prong: string = JSON.parse(fs.readFileSync(list, 'utf8')).prong
  // every material the catalogue builds, live from pro-ng's materials.json
  const read = () => {
    const file = JSON.parse(fs.readFileSync(path.join(prong, 'materials.json'), 'utf8')) as { materials: Record<string, { look: string; family: string }> }
    s.materials = Object.entries(file.materials).filter(([, m]) => m.family !== 'buildings').map(([name, m]) => ({ name, look: m.look, family: m.family }))
  }
  // the milliseconds pro-ng's newest file its builds read was written at
  const newest = () => {
    let at = 0
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '__pycache__') continue
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else at = Math.max(at, fs.statSync(p).mtimeMs)
      }
    }
    for (const d of DIRS) walk(path.join(prong, d))
    for (const f of FILES) at = Math.max(at, fs.statSync(path.join(prong, f)).mtimeMs)
    return at
  }
  // each catalogue built, by its place: the materials picked for it and when it was written
  const catalogues = () => CATALOGUES.flatMap(place => {
    const studio = path.join(builds, place, `${place}.studio.json`)
    const made = path.join(builds, place, `${place}.scene.json`)
    if (!fs.existsSync(studio) || !fs.existsSync(made)) return []
    const families = (JSON.parse(fs.readFileSync(studio, 'utf8')) as { families: { materials: { name: string }[] }[] }).families
    return [{ place, picked: JSON.parse(fs.readFileSync(made, 'utf8')).materials as string[], at: fs.statSync(studio).mtimeMs, names: families.flatMap(f => f.materials.map(m => m.name)) }]
  })
  const rebuild = (place: string, picked: string[]) => { s.rebuilt[place] = queue(s, { materials: picked }) }

  read()
  const since = newest()
  const all = s.materials.map(m => m.name).sort().join('\n')
  for (const c of catalogues()) {
    if (c.at < since || (!c.picked.length && [...c.names].sort().join('\n') !== all)) rebuild(c.place, c.picked)
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const changed = (file: string) => {
    if (file.includes('__pycache__')) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      // a materials.json caught half written is read again on its next change, the list kept as it was until then
      if (file === 'materials.json') try { read() } catch {}
      s.changed++
      s.file = file
      for (const c of catalogues()) rebuild(c.place, c.picked)
    }, 150)
  }
  for (const dir of DIRS) fs.watch(path.join(prong, dir), { recursive: true }, (_e, f) => f && changed(path.join(dir, String(f))))
  for (const f of FILES) fs.watch(path.join(prong, f), () => changed(f))
}

const said = (ask: Ask) => ('kit' in ask ? `kit ${ask.kit}` : 'scene' in ask ? ask.scene : 'effects' in ask ? `${ask.effects}.effects.json`
  : 'materials' in ask ? `the materials${ask.materials.length ? ` ${ask.materials.join(', ')}` : ''}` : "pro-ng's list")

// A kind's effects file written as the kit studio writes it (`pro-ng/kit_studio.mjs`, `POST /effects/<kind>`): JSON two
// spaces deep, each list of numbers on one line; only a file pro-ng already has, `kit/<kind>.effects.json`, under the
// list's `prong` (`builds/library.json`). Hands back '' when written, else why not.
async function saveEffects(kind: string, file: Record<string, unknown>): Promise<string> {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const list = path.join(os.tmpdir(), 'demo_library', 'library.json')
  if (!fs.existsSync(list)) return `library: ${kind}.effects.json: pro-ng's list is not written yet`
  const to = path.join(JSON.parse(fs.readFileSync(list, 'utf8')).prong, 'kit', `${kind}.effects.json`)
  if (!fs.existsSync(to)) return `library: pro-ng has no ${to} to save into`
  const text = JSON.stringify(file, null, 2).replace(/\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g, (_, nums: string) => `[${nums.split(/,\s*/).join(', ')}]`)
  fs.writeFileSync(to, text + '\n')
  return ''
}

const args = (ask: Ask) =>
  'kit' in ask ? ['kit', ask.kit, ...Object.entries(ask.values).map(([k, v]) => `${k}=${JSON.stringify(v)}`)] : 'scene' in ask ? [ask.scene]
    : 'materials' in ask ? ['materials', ...ask.materials] : ['list']

// The build run as a child process, its output kept; the last 40 lines of it handed back when it fails.
async function run(ask: Ask): Promise<string> {
  if (typeof process === 'undefined' || !process.versions?.node) return `library: ${said(ask)} was asked for in a tab, which cannot run Blender; play against the server (yarn serve demo_library)`
  if ('effects' in ask) return saveEffects(ask.effects, ask.file)
  const { spawn } = await import('node:child_process')
  const path = await import('node:path')
  const script = path.join(process.cwd(), 'games', 'demo_library', 'assets', 'build.ts')
  return new Promise(done => {
    const p = spawn(process.execPath, ['--experimental-strip-types', script, ...args(ask)], { stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    p.stdout.on('data', d => { log += d; process.stdout.write(d) })
    p.stderr.on('data', d => { log += d; process.stderr.write(d) })
    p.on('close', code => done(code === 0 ? '' : `library: ${said(ask)} failed (exit ${code})\n${log.split('\n').slice(-40).join('\n')}`))
  })
}

// A build put behind every one asked before it; its number handed back.
function queue(s: Held, ask: Ask): number {
  const n = ++s.asked
  s.queue = s.queue.then(async () => {
    s.running = said(ask)
    s.error = await run(ask)
    s.running = ''
    s.done = n
  })
  return n
}

export const start = (world: object, ask: Ask): number => queue(of(world), ask)

export function state(world: object): State {
  const { asked, done, running, error, changed, file, materials, rebuilt } = of(world)
  return { asked, done, running, error, changed, file, materials, rebuilt }
}
