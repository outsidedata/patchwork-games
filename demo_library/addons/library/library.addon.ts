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
// nothing), and `error`, the last failed build's last lines ('' after one that worked). A truth in a tab has no node to
// run Blender on, so a build asked for there fails, saying so.
export type Ask = { kit: string; values: Record<string, unknown> } | { scene: string } | { list: true } | { effects: string; file: Record<string, unknown> }
  | { materials: string[] }
export type State = { asked: number; done: number; running: string; error: string; changed: number; file: string }

const states = new WeakMap<object, State & { queue: Promise<void>; watching: boolean }>()

const of = (truth: object) => {
  let s = states.get(truth)
  if (!s) states.set(truth, s = { asked: 0, done: 0, running: '', error: '', changed: 0, file: '', queue: Promise.resolve(), watching: false })
  return s
}

// The library's pro-ng watched as the kit studio and the looks studio watch it (`pro-ng/kit_studio.mjs`,
// `pro-ng/studio.mjs`): every file under `kit/`, `scenes/` and `material/` (no `__pycache__`), `procedural.py`,
// `pack.mjs` and `materials.json`. A change, once 150 ms have passed with no other,
// counts one more on `changed` and names the file in `file`, so a page showing a build of it builds it again. On node
// alone, once the list is written: pro-ng's folder is the list's `prong` (`builds/library.json`, `assets/build.ts`),
// where the builds find the library.
export function watch(world: object) {
  const s = of(world)
  if (s.watching || typeof process === 'undefined' || !process.versions?.node) return
  s.watching = true
  s.queue = s.queue.then(() => watching(s))
}

async function watching(s: State) {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const list = path.join(os.tmpdir(), 'demo_library', 'library.json')
  if (!fs.existsSync(list)) return
  const prong: string = JSON.parse(fs.readFileSync(list, 'utf8')).prong
  let timer: ReturnType<typeof setTimeout> | undefined
  const changed = (file: string) => {
    if (file.includes('__pycache__')) return
    clearTimeout(timer)
    timer = setTimeout(() => { s.changed++; s.file = file }, 150)
  }
  for (const dir of ['kit', 'scenes', 'material']) fs.watch(path.join(prong, dir), { recursive: true }, (_e, f) => f && changed(path.join(dir, String(f))))
  for (const f of ['procedural.py', 'pack.mjs', 'materials.json']) fs.watch(path.join(prong, f), () => changed(f))
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

export function start(world: object, ask: Ask): number {
  const s = of(world)
  const n = ++s.asked
  s.queue = s.queue.then(async () => {
    s.running = said(ask)
    s.error = await run(ask)
    s.running = ''
    s.done = n
  })
  return n
}

export function state(world: object): State {
  const { asked, done, running, error, changed, file } = of(world)
  return { asked, done, running, error, changed, file }
}
