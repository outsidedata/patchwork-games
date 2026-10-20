// The simulator's extension on games/flight, its files edited in memory and the Runs panel on the
// page. The simulator's `run` route answers here as `simulator.route.ts` answers it (its own test
// runs it for real, on node): asked by a plain request, outside any change, it plays the config in
// this process by `simulate` and writes the recording through the server's files, which are this
// test's in memory, answering its summary and the recording's path. A run is no change: nothing of it
// is in the history, and no undo takes it back. What the panel shows is read off the page.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, expectTypeOf, onTestFinished, test, vi } from 'vitest'
import type { z } from 'zod'
import type { Scene, Sim } from '#engine/engine.ts'
import { EditorContext } from '#editor/context.ts'
import type { FilesApi } from '#editor/files.ts'
import { answer, editor, repo } from '#editor/test/editor.ts'
import { histogram, parse, report, RUNS, simulate, summary, type FrameRecord, type Run } from '#addons/simulator/simulator.addon.ts'
import { CONFIG, simulator, type Config } from '#addons/simulator/simulator.extension.tsx'

vi.setConfig({ testTimeout: 120_000 })

// The `run` route, as the editor's server answers a plain request of it: the config played in this
// process and its recording written through the server's files, `server`, the test's in memory, and
// never the files a plain request is handed here, which are the repo's on the disk. A refusal set is
// what the next run answers instead, as the command line's stopping is, writing nothing. Each call is
// kept.
function routes(server: FilesApi) {
  const fake: { refusal?: string } = {}
  const calls = answer('simulator', r => r.post('run', async ({ body }) => {
    const { name, config } = body as { name: string; config: Config }
    const refusal = fake.refusal
    delete fake.refusal
    if (refusal) throw new Error(refusal)
    const rel = `${RUNS}/${name}.jsonl`
    const file = JSON.parse(await server.read(config.game)) as Scene
    const sim = (await import(pathToFileURL(path.join(repo, config.game.replace(/\.scene\.json$/, '.sim.ts'))).href)).sim as Sim
    const lines: string[] = []
    const { game: _, ...knobs } = config
    await simulate({ ...knobs, file, sim, base: pathToFileURL(path.join(repo, path.dirname(config.game)) + '/').href, write: l => lines.push(l) } as Run)
    const text = lines.join('\n') + '\n'
    await server.write(rel, text)
    return { name, report: report(summary(parse(text))), files: [rel] }
  })) as { route: string; body: any }[]
  return { calls, fake }
}

async function open() {
  const made = await editor('flight', { simulator: async () => ({ simulator }) })
  const { ed, files, texts } = made
  onTestFinished(() => ed.close())
  // The recordings are this test's alone: whatever this machine has kept in the folder is not listed.
  const list = files.list
  files.list = async dir => (dir === RUNS ? [...texts.keys()].filter(p => p.startsWith(`${RUNS}/`)).sort() : list(dir))
  await ed.open()
  const { calls, fake } = routes(files)
  const Panel = ed.panels.get('simulator')!.component
  render(<EditorContext.Provider value={ed}><Panel /></EditorContext.Provider>)
  await screen.findByRole('toolbar', { name: 'runs' })
  return { ...made, calls, fake, user: userEvent.setup() }
}

test('with no recordings the panel offers a run of the open game, two pages to start from', async () => {
  await open()
  expect(screen.getByText('no recordings')).toBeTruthy()
  const config = JSON.parse((screen.getByRole('textbox', { name: 'run config' }) as HTMLInputElement).value)
  expect(config).toMatchObject({ game: 'games/flight/flight.scene.json', seed: 1, ms: 10000 })
  expect(config.pages.map((p: { display: { hz: number } }) => p.display.hz)).toEqual([60, 120])
})

test('Play plays the config and shows the recording: its summary, a timeline, charts and the frame picked; it is no change, so nothing is in the history and undo leaves it', async () => {
  const { ed, calls, user, read } = await open()
  const name = screen.getByRole('textbox', { name: 'run name' })
  await user.clear(name)
  await user.type(name, 'flown{Enter}')
  const config = screen.getByRole('textbox', { name: 'run config' })
  const knobs = { game: 'games/flight/flight.scene.json', seed: 3, ms: 2000, pages: [{ display: { hz: 60 }, up: { delay: 50 }, down: { delay: 50 } }, { display: { hz: 120 }, up: { delay: 50 }, down: { delay: 50 } }], watch: { kinds: ['flight3d'], fields: ['pos'], own: 'plane' } }
  await user.clear(config)
  await user.click(config)
  await user.paste(JSON.stringify(knobs))
  await user.keyboard('{Enter}')
  await user.click(screen.getByRole('button', { name: 'Play' }))
  await screen.findByRole('table', { name: 'pages' }, { timeout: 60_000 })
  expect(calls.map(c => c.route)).toEqual(['run'])
  expect(calls[0].body).toEqual({ name: 'flown', config: knobs })
  const records = parse(await read(`${RUNS}/flown.jsonl`))
  expect(screen.getByLabelText('run report').textContent).toBe(report(summary(records)))
  expect((screen.getByRole('combobox', { name: 'recording' }) as HTMLSelectElement).value).toBe('flown')
  // A row a page, its steps a frame as the summary counts them.
  const rows = within(screen.getByRole('table', { name: 'pages' })).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(2)
  const counts = Object.entries(histogram(records, 0).counts).map(([k, v]) => `${k}:${v}`).join(' ')
  expect(rows[0].textContent).toContain(counts)
  expect(screen.getByText('page 1 off a step')).toBeTruthy()
  expect(screen.getByText('server steps')).toBeTruthy()
  for (const chart of ['steps a frame', 'standoff']) expect(screen.getByRole('img', { name: chart })).toBeTruthy()
  // The frame picked: page 0's first, until the playhead or a page moves it.
  const field = (name: string) => within(screen.getByRole('table', { name: 'frame' })).getAllByRole('row').find(r => r.firstChild?.textContent === name)?.lastChild?.textContent
  const first = records.find((r): r is FrameRecord => r.type === 'frame' && r.page === 0)!
  expect(field('t')).toBe(`${+first.t.toFixed(3)} ms`)
  await user.click(within(screen.getByRole('table', { name: 'pages' })).getAllByRole('row')[2])
  const second = records.find((r): r is FrameRecord => r.type === 'frame' && r.page === 1)!
  expect(field('t')).toBe(`${+second.t.toFixed(3)} ms`)
  // The run is no change: nothing is in the history, Undo takes nothing back, running no route, and
  // the panel still lists the recording.
  expect(ed.undos).toEqual([])
  const text = await read(`${RUNS}/flown.jsonl`)
  await act(async () => { await ed.undo() })
  expect(calls.map(c => c.route)).toEqual(['run'])
  expect(await read(`${RUNS}/flown.jsonl`)).toBe(text)
  expect((screen.getByRole('combobox', { name: 'recording' }) as HTMLSelectElement).value).toBe('flown')
})

test('a config the route refuses says why, in the panel and the console, and keeps nothing', async () => {
  const { ed, calls, fake, user, read } = await open()
  fake.refusal = 'the simulator stopped with 1'
  await user.click(screen.getByRole('button', { name: 'Play' }))
  await vi.waitFor(() => expect(screen.getByLabelText('run report').textContent).toBe('the simulator stopped with 1'))
  expect(ed.log.at(-1)).toMatchObject({ level: 'error', message: 'simulator run: the simulator stopped with 1' })
  expect(calls.map(c => c.route)).toEqual(['run'])
  expect(ed.undos).toEqual([])
  await expect(read(`${RUNS}/run.jsonl`)).rejects.toThrow('ENOENT')
  expect(screen.getByText('no recordings')).toBeTruthy()
})

test('a config no run plays, a game not the editor\'s, or a name no recording may have leaves Play off, saying why, as sim.run refuses it', async () => {
  const { ed, calls, user } = await open()
  const config = screen.getByRole('textbox', { name: 'run config' })
  const put = async (v: unknown) => {
    await user.clear(config)
    await user.click(config)
    await user.paste(JSON.stringify(v))
    await user.keyboard('{Enter}')
  }
  const play = screen.getByRole('button', { name: 'Play' })
  expect(play).toBeEnabled()
  await put({ seed: 1 })
  expect(play).toBeDisabled()
  expect(screen.getByText(/^Not played: the config is not one a run plays: .*game/s)).toBeInTheDocument()
  await expect(ed.call('sim.run', { name: 'run', config: { seed: 1 } })).rejects.toThrow(/^the config is not one a run plays: .*game/s)
  const other = { game: 'games/rooms/rooms.scene.json', seed: 1, ms: 100, pages: [{ display: { hz: 60 }, up: { delay: 10 }, down: { delay: 10 } }] }
  await put(other)
  expect(screen.getByText('Not played: the config\'s game is games/rooms/rooms.scene.json, not the editor\'s game\'s manager scene file, games/flight/flight.scene.json')).toBeInTheDocument()
  await expect(ed.call('sim.run', { name: 'run', config: other })).rejects.toThrow('the config\'s game is games/rooms/rooms.scene.json, not the editor\'s game\'s manager scene file, games/flight/flight.scene.json')
  const name = screen.getByRole('textbox', { name: 'run name' })
  await user.clear(name)
  await user.type(name, 'a run{Enter}')
  expect(screen.getByText('Not played: a recording is named with letters, digits, _, . and - only, not "a run"')).toBeInTheDocument()
  await expect(ed.call('sim.run', { name: 'a run', config: {} })).rejects.toThrow('a recording is named with letters, digits, _, . and - only, not "a run"')
  expect(calls).toEqual([])
})

test('sim.run plays a config as Play does, no change and nothing in the history; sim.runs lists it and sim.read reads it as the panel shows it; run again over it, the page takes the new recording in', async () => {
  const { ed, calls, read } = await open()
  const knobs = { game: 'games/flight/flight.scene.json', seed: 2, ms: 300, pages: [{ display: { hz: 60 }, up: { delay: 20 }, down: { delay: 20 } }], watch: { kinds: ['flight3d'], fields: ['pos'], own: 'plane' } }
  let got: any
  await act(async () => { got = await ed.call('sim.run', { name: 'short', config: knobs }) })
  expect(calls.map(c => c.route)).toEqual(['run'])
  expect(calls[0].body).toEqual({ name: 'short', config: knobs })
  const rel = `${RUNS}/short.jsonl`
  const records = parse(await read(rel))
  expect(got).toEqual({ name: 'short', report: report(summary(records)), files: [rel] })
  expect(ed.undos).toEqual([])
  expect(await ed.call('sim.runs', {})).toEqual({ recordings: ['short'] })
  // The panel shows the recording the call made.
  await vi.waitFor(() => expect((screen.getByRole('combobox', { name: 'recording' }) as HTMLSelectElement).value).toBe('short'))

  const first = records.find((r): r is FrameRecord => r.type === 'frame' && r.page === 0)!
  const shown = await ed.call('sim.read', { name: 'short' }) as any
  expect(shown).toMatchObject({ name: 'short', summary: summary(records), page: 0, frame: first })
  expect(shown.lanes.map((l: { lane: string }) => l.lane)).toEqual(['server steps', 'page 0 frames', 'page 0 off a step', 'page 0 envelopes', 'page 0 presses'])
  expect(shown.lanes[1].at).toEqual(records.filter((r): r is FrameRecord => r.type === 'frame').map(f => f.t))
  // Steps a frame: each frame after the first that drew a packet, and how far it moved the step drawn.
  const drew = records.filter((r): r is FrameRecord => r.type === 'frame' && r.n !== null)
  expect(shown.series.steps).toEqual(drew.slice(1).map((f, i) => [f.t, f.n! - drew[i].n!]))
  const later = records.filter((r): r is FrameRecord => r.type === 'frame')[5]
  expect((await ed.call('sim.read', { name: 'short', at: later.t }) as any).frame).toEqual(later)
  const field = (name: string) => within(screen.getByRole('table', { name: 'frame' })).getAllByRole('row').find(r => r.firstChild?.textContent === name)?.lastChild?.textContent
  expect(field('t')).toBe(`${+first.t.toFixed(3)} ms`)
  await expect(ed.call('sim.read', { name: 'long' })).rejects.toThrow('no recording long: the recordings are short')
  await expect(ed.call('sim.read', { name: 'short', page: 3 })).rejects.toThrow('short has no page 3: its pages are 0')

  // Undo takes nothing back, and runs no route.
  await act(async () => { await ed.undo() })
  expect(calls.map(c => c.route)).toEqual(['run'])
  expect(parse(await read(rel))).toEqual(records)
  expect(await ed.call('sim.runs', {})).toEqual({ recordings: ['short'] })

  // Run again over it: a change on the disk no change made, which the server tells every page, this
  // one too, which takes the new recording in, so sim.read, and the panel, read it as it now is.
  await act(async () => { await ed.call('sim.run', { name: 'short', config: { ...knobs, seed: 5, ms: 200 } }) })
  const again = parse(await read(rel))
  expect(again).not.toEqual(records)
  expect(await ed.call('sim.read', { name: 'short' })).toMatchObject({ summary: summary(records) })
  await act(async () => { await ed.disk({ path: rel, added: false, gone: false }) })
  await vi.waitFor(async () => expect(await ed.call('sim.read', { name: 'short' })).toMatchObject({ summary: summary(again) }))
  expect(again.length).not.toBe(records.length)
  await vi.waitFor(() => expect(screen.getByText(`${again.length} records`)).toBeTruthy())
  expect(ed.undos).toEqual([])
})

test('a config Play and sim.run take is a Run\'s knobs as JSON carries them, every one, and a recording that is not JSON is named in the refusal', async () => {
  expectTypeOf<z.infer<typeof CONFIG>>().toEqualTypeOf<Config>()
  const { ed, texts } = await open()
  texts.set(`${RUNS}/torn.jsonl`, '{"type": "run"\n')
  await expect(ed.call('sim.read', { name: 'torn' })).rejects.toThrow(/^torn: /)
})
