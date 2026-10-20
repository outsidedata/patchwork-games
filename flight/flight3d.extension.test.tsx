// flight3d's extension on games/flight, booted under the recorder with its files edited in memory and
// the Flight panel on the page. What the panel did is read off the live rows, the recorder's journal
// and the files.
// Each command is driven beside the panel's control it shares a function with, and held to the same
// journal entries or the same bytes, one undo, and the panel's refusals.
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, expect, onTestFinished, test, vi } from 'vitest'
import { EditorContext } from '#editor/context.ts'
import type { FieldProps } from '#editor/editor.ts'
import { TextField } from '#editor/ui/fields.tsx'
import { editor, repo } from '#editor/test/editor.ts'
import { scene as skyScene } from '#games/flight/sky.sim.ts'
import { refill } from '#plugins/loader/loader.sim.ts'
import { rotate } from '#plugins/flight3d/flight3d.sim.ts'
import { flight3d, pricedText } from '#plugins/flight3d/flight3d.extension.tsx'

const SCENE = 'games/flight/sky.scene.json'
// A write refills the scene's file in memory, which the next test boots from: each test ends with it
// as the disk has it.
afterEach(() => { refill(skyScene as Record<string, unknown>, JSON.parse(readFileSync(path.join(repo, SCENE), 'utf8'))) })
vi.setConfig({ testTimeout: 60_000 })

async function open() {
  const made = await editor('flight', { flight3d: async () => ({ flight3d }) })
  const { ed } = made
  onTestFinished(() => ed.close())
  await ed.open()
  for (let i = 0; i < 10; i++) await ed.session!.step()
  act(() => ed.select({ scene: 'sky' }))
  const Panel = ed.panels.get('flight3d')!.component
  render(<EditorContext.Provider value={ed}><Panel /></EditorContext.Provider>)
  await screen.findByRole('toolbar', { name: 'flight' })
  const sky = () => ed.session!.scene('sky')
  return { ...made, sky }
}

// The grid's fold of the Cessna's sheet opened, as a person opens it to reach a value in it.
async function openCessna(user: ReturnType<typeof userEvent.setup>) {
  for (const name of ['cessna', 'airframe']) {
    const fold = screen.getAllByRole('button', { name }).find(b => b.getAttribute('aria-expanded') === 'false')
    if (fold) await user.click(fold)
  }
}

test('editing one value of world.flight3d changes exactly that value in the scene file', async () => {
  const { ed, edits, read } = await open()
  const before = JSON.parse(await read(SCENE))
  const user = userEvent.setup()
  await openCessna(user)
  await user.click(screen.getByRole('spinbutton', { name: 'planes.cessna.airframe.maxThrust' }))
  await user.clear(screen.getByRole('textbox', { name: 'planes.cessna.airframe.maxThrust' }))
  await user.type(screen.getByRole('textbox', { name: 'planes.cessna.airframe.maxThrust' }), '5000{Enter}')
  await vi.waitFor(() => expect(ed.undos).toHaveLength(1))
  await act(() => ed.idle())
  expect(edits.at(-1)).toMatchObject({ path: SCENE, at: ['world', 'flight3d', 'planes', 'cessna', 'airframe', 'maxThrust'], value: 5000 })
  expect(edits).toHaveLength(1)
  const after = JSON.parse(await read(SCENE))
  expect(after.world.flight3d.planes.cessna.airframe.maxThrust).toBe(5000)
  after.world.flight3d.planes.cessna.airframe.maxThrust = before.world.flight3d.planes.cessna.airframe.maxThrust
  expect(after).toEqual(before)
})

test('setting the throttle on a parked plane rolls it off its start through the recorder, the way its nose points', async () => {
  const { ed, sky } = await open()
  const plane = sky().rows.find(r => r.kind === 'flight3d')!
  const from = [...plane.data.pos]
  const n = ed.session!.n
  const slider = screen.getByRole('slider', { name: 'plane throttle' })
  fireEvent.change(slider, { target: { value: '1' } })
  fireEvent.pointerUp(slider)
  expect(ed.session!.rec.journal.at(-1)).toMatchObject({ at: n, set: { scene: 'sky', id: plane.id, path: ['throttle'], value: 1 } })
  for (let i = 0; i < 240; i++) await ed.session!.step()
  const now = sky().rows.find(r => r.id === plane.id)!.data
  const moved = now.pos.map((c: number, i: number) => c - from[i])
  expect(Math.hypot(moved[0], moved[2])).toBeGreaterThan(3)
  const nose = rotate(now.rot, [0, 0, -1])
  expect(moved[0] * nose[0] + moved[2] * nose[2]).toBeGreaterThan(0)
})

// ---------------------------------------------------------------- the commands

// What a call answered, run as React is told of every change it makes.
async function call(ed: Awaited<ReturnType<typeof open>>['ed'], id: string, args: unknown) {
  let got: unknown
  await act(async () => { got = await ed.call(id, args) })
  return got as Record<string, unknown>
}

test('flight.state reads what the panel shows: every plane\'s stick and the airframe, or what one plane is doing', async () => {
  const { ed, sky } = await open()
  const planes = sky().rows.filter(r => r.kind === 'flight3d' && r.data.pos)
  const all = await call(ed, 'flight.state', { scene: 'sky' })
  expect((all.planes as { id: number; type: string }[]).map(p => [p.id, p.type])).toEqual(planes.map(r => [r.id, r.data.type]))
  const airframes = all.airframes as Record<string, { mass: number; topSpeed: number; stallSpeed: number }>
  for (const [type, a] of Object.entries(airframes)) expect(screen.getByLabelText(`airframe ${type}`).textContent).toBe(pricedText(a))

  const one = await call(ed, 'flight.state', { scene: 'sky', id: planes[0].id })
  const now = one.now as { speed: number; height: number; aoa: number; slip: number; stall: number; crashed: boolean }
  expect(screen.getByLabelText('plane state').textContent).toBe(`${now.speed.toFixed(1)} m/s · ${now.height.toFixed(0)} m · α ${now.aoa.toFixed(1)}° · β ${now.slip.toFixed(1)}°`)
  expect(Number(screen.getByRole('meter', { name: 'plane stall' }).getAttribute('aria-valuenow'))).toBe(now.stall)
  expect(now.crashed).toBe(false)
  expect(one).toMatchObject({ scene: 'sky', id: planes[0].id, pitch: planes[0].data.pitch ?? 0, throttle: planes[0].data.throttle ?? 0 })

  await expect(ed.call('flight.state', { scene: 'sky', id: 999 })).rejects.toThrow(`row 999 of sky is no plane: its planes are ${planes.map(r => r.id).join(', ')}`)
})

test('flight.stick sets a plane\'s stick as the slider does, through the recorder from the step shown, one undo', async () => {
  const { ed, sky } = await open()
  const plane = sky().rows.find(r => r.kind === 'flight3d' && r.data.pos)!
  const was = { pitch: plane.data.pitch, airbrake: plane.data.airbrake }
  const n = ed.session!.n
  const slider = screen.getByRole('slider', { name: 'plane pitch' })
  fireEvent.change(slider, { target: { value: '1' } })
  fireEvent.pointerUp(slider)
  const byPanel = ed.session!.rec.journal.at(-1)
  await act(() => ed.undo())

  const got = await call(ed, 'flight.stick', { scene: 'sky', id: plane.id, pitch: 1, airbrake: 0.5 })
  expect(ed.session!.rec.journal.slice(-2)).toEqual([byPanel, { at: n, set: { scene: 'sky', id: plane.id, path: ['airbrake'], value: 0.5 } }])
  expect(got).toMatchObject({ scene: 'sky', id: plane.id, pitch: 1, airbrake: 0.5 })
  expect(ed.undos).toHaveLength(1)
  await act(() => ed.undo())
  expect(sky().rows.find(r => r.id === plane.id)!.data).toMatchObject(was)

  await expect(ed.call('flight.stick', { scene: 'sky', id: plane.id, throttle: -1 })).rejects.toThrow(/throttle/)
  await expect(ed.call('flight.stick', { scene: 'sky', id: plane.id })).rejects.toThrow('hand one of pitch, roll, yaw, throttle, airbrake, brake to set')
})

test('flight.design writes a value of world.flight3d as the grid does, the same bytes, one undo; a field the grid has not got or a value not of its shape is refused', async () => {
  const { ed, read } = await open()
  const before = await read(SCENE)
  const user = userEvent.setup()
  await openCessna(user)
  await user.click(screen.getByRole('spinbutton', { name: 'planes.cessna.airframe.maxThrust' }))
  await user.clear(screen.getByRole('textbox', { name: 'planes.cessna.airframe.maxThrust' }))
  await user.type(screen.getByRole('textbox', { name: 'planes.cessna.airframe.maxThrust' }), '5000{Enter}')
  await vi.waitFor(() => expect(ed.undos).toHaveLength(1))
  await act(() => ed.idle())
  expect(JSON.parse(ed.texts.get(SCENE) ?? before).world.flight3d.planes.cessna.airframe.maxThrust).toBe(5000)
  const byPanel = await read(SCENE)
  await act(() => ed.undo())
  expect(await read(SCENE)).toBe(before)

  const got = await call(ed, 'flight.design', { scene: 'sky', values: { 'planes.cessna.airframe.maxThrust': 5000 } })
  expect(await read(SCENE)).toBe(byPanel)
  const cessna = (got.airframes as Record<string, { mass: number; topSpeed: number; stallSpeed: number }>).cessna
  expect(cessna).toMatchObject({ mass: expect.any(Number), topSpeed: expect.any(Number), stallSpeed: expect.any(Number) })
  expect(screen.getByLabelText('airframe cessna').textContent).toBe(pricedText(cessna))
  await act(() => ed.undo())
  expect(await read(SCENE)).toBe(before)

  await expect(ed.call('flight.design', { scene: 'sky', values: { 'planes.cessna.airframe.thrust': 1 } })).rejects.toThrow(/world\.flight3d has no field planes\.cessna\.airframe\.thrust: its fields are .*planes\.cessna\.airframe\.maxThrust/)
  await expect(ed.call('flight.design', { scene: 'sky', values: { 'air.density': true } })).rejects.toThrow(/air\.density is [\d.]+, and true is not of its shape/)
  await expect(ed.call('flight.design', { scene: 'sky', values: {} })).rejects.toThrow(/hand a value of world\.flight3d to set, by its path: its fields are .*airframe\.maxThrust/)
  expect(await read(SCENE)).toBe(before)
})

// A field bound to a type whose component writes another shape than the file's, as a text field
// writes a number as its text, and shows what it writes on the scene's world before it writes it,
// as a person's drag does.
function Text({ value, onChange, label }: FieldProps) {
  return <TextField label={label} value={String(value)} onChange={(v, done) => {
    onChange(v, false)
    if (done) onChange(v, true)
  }} />
}

test('a value the grid hands that is not of the shape there is refused in the console as the command refuses it, and the scene\'s world, which showed it, is its file\'s again', async () => {
  const { ed, edits, sky } = await open()
  const world = () => sky().world.flight3d
  const was = world().planes.cessna.airframe.maxThrust
  act(() => {
    ed.field('test.text', Text)
    ed.bind('flight3d', { 'planes.cessna.airframe.maxThrust': 'test.text' })
  })
  const shown = vi.spyOn(ed.session!, 'previewWorld')
  const user = userEvent.setup()
  await openCessna(user)
  await user.clear(screen.getByRole('textbox', { name: 'planes.cessna.airframe.maxThrust' }))
  await user.type(screen.getByRole('textbox', { name: 'planes.cessna.airframe.maxThrust' }), '70{Enter}')
  const why = `world.flight3d planes.cessna.airframe.maxThrust is ${was}, and "70" is not of its shape`
  await vi.waitFor(() => expect(ed.log.at(-1)).toMatchObject({ level: 'error', message: expect.stringContaining(`flight3d: refused: ${why}`) }))
  // Shown, then put back when refused.
  expect(shown.mock.calls).toEqual([['sky', ['flight3d', 'planes', 'cessna', 'airframe', 'maxThrust'], '70'], ['sky', ['flight3d', 'planes', 'cessna', 'airframe', 'maxThrust'], was]])
  expect(world().planes.cessna.airframe.maxThrust).toBe(was)
  await expect(ed.call('flight.design', { scene: 'sky', values: { 'planes.cessna.airframe.maxThrust': '70' } })).rejects.toThrow(why)
  expect(edits).toEqual([])
})
