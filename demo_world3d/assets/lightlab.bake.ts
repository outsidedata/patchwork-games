// The light lab's bake alone, run by hand from core's root:
//   node --experimental-strip-types games/demo_world3d/assets/lightlab.bake.ts
// It builds the library's stronghold solver `lightlab` and writes the place `lightlab.art` into `assets/lightlab/`,
// names it in `lightlab.scene.json`'s catalogue and lays its flatten into `assets/lightlab/lightlab.field.json`, by the
// same steps as the game's whole bake (`demo_world3d.bake.ts`, `bakePlace`), with none of its other places, no cc0
// maps and no bodies. The tools are core's bake's (`scripts/bake.ts`), found from the shell and `.env` as `yarn bake`
// finds them.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { tools } from '#scripts/bake.ts'
import { PLACES, bakePlace } from './demo_world3d.bake.ts'

const root = path.join(import.meta.dirname, '..', '..', '..')
const place = PLACES.find(p => p.scene === 'lightlab.scene.json')!
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'bake-lightlab-'))
try {
  await bakePlace(place, tools(root, process.env, work))
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}
