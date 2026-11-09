// pro-ng's shots (`pro-ng/proof.mjs`, `yarn thing:view`, `yarn kitbash:view`, `catalogue_materials.mjs --shoot`), taken
// of the game: a build of `assets/builds/` drawn by the game's own engine on its dev page and shot view by view in
// headless Chrome, as pro-ng's `headless.mjs` shoots its viewer. From the repo's root, with the game's pages served
// (`yarn serve demo_library` for a build's rebuilds, or `yarn dev`):
//
//   node --experimental-strip-types games/demo_library/assets/shoot.ts <place> [<flags>]
//
//   <place>             the build to shoot, a folder of `assets/builds/` (`assets/build.ts` makes it)
//   --views=<file>      the views: a views file `{ views: [{ name, eye, at, expect }] }` (a kit kind's
//                       `kit/<kind>.views.json` in the library, say); without it, the build's own check spots
//                       (`<place>.proof.json`, the scene's `proof/<scene>.json` or the catalogue's)
//   --thing=<scene>:<name>  the views pro-ng works out for one thing or door of a scene (`pro-ng/thing_views.py`)
//   --mode=material|normals|flat   each surface in its material (the default), its normal's colour, or its flat colour
//   --clip=<clip>       that clip played on every moving thing that has it; needs --at
//   --at=<seconds>      the clips and the looks' clock held at that moment
//   --effects=on|off    the build's effects thrown (the default) or none of them
//   --prefill=<seconds> the effects run that long before the first shot; needs them on
//   --url=<origin>      where the pages are served, `http://localhost:5173` when left out
//
// Each view's `eye` and `at` are in the scene's axes (x east, y north, z up, metres), made three's (x, z, −y). The shots,
// WIDTH × HEIGHT, land in `<system temp>/demo_library-shots/<place>-<mode>[-noeffects][-<clip>][-at-<s>]/`, each `<view's name>.png`
// (lower case, every run of other characters a `-`), with `index.html` beside them: each shot, its name, what should be
// seen, its eye and point. Chrome is CHROME, else /Applications/Google Chrome.app/Contents/MacOS/Google Chrome, run
// headless with a profile of its own. The library's files are read and never written.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolve } from '#scripts/health.ts'

const WIDTH = 1280, HEIGHT = 720
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
type View = { name: string; eye: number[]; at: number[]; expect?: string }

const pause = (ms: number) => new Promise(r => setTimeout(r, ms))
const fileOf = (name: string) => `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
const three = (p: number[]) => [p[0], p[2], -p[1]]

export async function shoot(place: string, flags: Record<string, string>): Promise<string> {
  const mode = flags.mode ?? 'material'
  if (!['material', 'normals', 'flat'].includes(mode)) throw new Error(`shoot: --mode is material, normals or flat, not ${mode}`)
  if (flags.clip !== undefined && flags.at === undefined) throw new Error('shoot: --clip needs --at')
  const builds = path.join(os.tmpdir(), 'demo_library', place)
  if (!fs.existsSync(builds)) throw new Error(`shoot: no build ${builds}; make it with assets/build.ts`)
  let views: View[]
  if (flags.views) views = JSON.parse(fs.readFileSync(flags.views, 'utf8')).views
  else if (flags.thing) {
    const at = flags.thing.lastIndexOf(':')
    const prong = path.join(resolve(process.cwd(), process.env).library, 'pro-ng')
    views = JSON.parse(execFileSync('python3', [path.join(prong, 'thing_views.py'), flags.thing.slice(0, at), flags.thing.slice(at + 1)], { encoding: 'utf8' })).views
  } else {
    const proof = path.join(builds, `${place}.proof.json`)
    if (!fs.existsSync(proof)) throw new Error(`shoot: the build ${place} has no check spots (${proof}); name the views with --views or --thing`)
    views = JSON.parse(fs.readFileSync(proof, 'utf8')).views
  }
  const query = new URLSearchParams({ server: '', place, proof: '' })
  if (mode === 'normals') query.set('view', 'normal')
  if (mode === 'flat') query.set('flat', '')
  if (flags.clip !== undefined) query.set('clip', flags.clip)
  if (flags.at !== undefined) query.set('at', flags.at)
  const effects = flags.effects ?? 'on'
  if (!['on', 'off'].includes(effects)) throw new Error(`shoot: --effects is on or off, not ${effects}`)
  if (effects === 'off') query.set('noeffects', '')
  if (flags.prefill !== undefined && effects === 'off') throw new Error('shoot: --prefill needs the effects on')
  const prefill = flags.prefill === undefined ? 0 : Number(flags.prefill)
  if (!(Number.isFinite(prefill) && prefill >= 0)) throw new Error(`shoot: --prefill is a number of seconds, 0 or more, not ${flags.prefill}`)
  const url = `${flags.url ?? 'http://localhost:5173'}/games/demo_library/dev.html?${query}`
  const out = path.join(os.tmpdir(), 'demo_library-shots', `${place}-${mode}${effects === 'off' ? '-noeffects' : ''}${flags.clip ? `-${flags.clip}` : ''}${flags.at !== undefined ? `-at-${flags.at}` : ''}`)

  const profile = path.join(os.tmpdir(), 'demo_library-shots', 'chrome')
  fs.rmSync(profile, { recursive: true, force: true })
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, `--window-size=${WIDTH},${HEIGHT}`,
    '--hide-scrollbars', '--mute-audio', '--use-angle=metal', 'about:blank'], { stdio: 'ignore' })
  try {
    let page: { webSocketDebuggerUrl: string } | undefined
    for (let i = 0; i < 100 && !page; i++) {
      await pause(200)
      try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t: { type: string }) => t.type === 'page') } catch {}
    }
    if (!page) throw new Error('shoot: Chrome never opened its debugging port')
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise(open => ws.addEventListener('open', open))
    let next = 0
    const waiting = new Map<number, (m: any) => void>()
    ws.addEventListener('message', e => {
      const m = JSON.parse(String(e.data))
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)!(m); waiting.delete(m.id) }
    })
    const send = (method: string, params: object = {}) => new Promise<any>((answer, fail) => {
      const id = ++next
      waiting.set(id, m => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : answer(m.result)))
      ws.send(JSON.stringify({ id, method, params }))
    })
    const run = async (expression: string) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(`${expression}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`)
      return r.result.value
    }
    await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url })
    let ready = false
    for (let i = 0; i < 600 && !ready; i++) {
      await pause(200)
      ready = await run('!!(window.proof && window.proof.ready)').catch(() => false)
    }
    if (!ready) throw new Error(`shoot: ${url} never got ready: ${await run("document.getElementById('readout').textContent").catch(() => '')}`)
    // the effects run `prefill` seconds before the first shot, as kitbash's `--prefill` runs them
    await pause(prefill * 1000)
    fs.rmSync(out, { recursive: true, force: true })
    fs.mkdirSync(out, { recursive: true })
    const rows: (View & { file: string })[] = []
    for (const v of views) {
      await run(`window.proof.view(${JSON.stringify(three(v.eye))}, ${JSON.stringify(three(v.at))})`)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const file = fileOf(v.name)
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'))
      console.log(`${path.join(out, file)}${v.expect ? `\n  expect: ${v.expect}` : ''}`)
      rows.push({ ...v, file })
    }
    const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const title = `${place}, ${mode}${flags.clip ? `, ${flags.clip}` : ''}${flags.at !== undefined ? ` at ${flags.at} s` : ''}`
    fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font:15px system-ui;margin:16px;background:#1d1f22;color:#e8e8e8}section{margin:0 0 28px}img{width:100%;max-width:1600px;display:block}
h2{margin:0 0 4px;font-size:17px}p{margin:4px 0 8px;max-width:1100px}code{color:#9ab}</style>
<h1>${esc(title)}: ${rows.length} views</h1>
${rows.map(r => `<section><h2>${esc(r.name)}</h2><p>${esc(r.expect ?? '')}</p><p><code>eye ${esc(r.eye.join(', '))} · at ${esc(r.at.join(', '))}</code></p><img src="${esc(r.file)}"></section>`).join('\n')}
`)
    console.log(`${rows.length} views shot: ${path.join(out, 'index.html')}`)
    ws.close()
    return out
  } finally {
    chrome.kill()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [place, ...rest] = process.argv.slice(2)
  if (!place || place.startsWith('--')) throw new Error('shoot.ts <place> [--views=<file> | --thing=<scene>:<name>] [--mode=material|normals|flat] [--clip=<clip> --at=<s>] [--effects=on|off] [--prefill=<s>] [--url=<origin>]')
  const flags = Object.fromEntries(rest.map(a => {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(a)
    if (!m) throw new Error(`shoot: no flag ${a}`)
    return [m[1], m[2] ?? '']
  }))
  for (const k of Object.keys(flags)) if (!['views', 'thing', 'mode', 'clip', 'at', 'effects', 'prefill', 'url'].includes(k)) throw new Error(`shoot: no flag --${k}`)
  await shoot(place, flags)
}
