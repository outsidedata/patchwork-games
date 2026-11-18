// demo_puppet3d's bake, `yarn bake demo_puppet3d` (core's `scripts/bake.ts`). Every number and name it
// uses is `demo_puppet3d.bake.json`'s, beside this file:
//   cues     each cue sheet of its `sheets`, copied from the library's `cues/` into `cues/` beside this
//            file, where the scenes' catalogues read it (`<sheet>.cues.json`, the entry `<sheet>`);
//   wings    the pegasus's wings, built in Blender by `wings/wings.py` from `wings/wings.json`, packed by
//            gltfpack into `wings/wings.glb`, with their rest skeleton `wings/wings.skeleton.json`;
//   clips    each animal of its `clips`, `{ kind, walk, stride, settle, idle }`: its kind in main's scene,
//            posed by puppet3d's own code from its definition and written with a `walk` (at `walk` metres a
//            second, a stride being `stride` coming round, after `settle` seconds) and an `idle` (`idle`
//            seconds), at `rate` frames a second, its solvers delivered by the mod files of its `mods`
//            (paths from the repo's root, in main's `world.puppet3d.mods.behaviors` order), into `awol/<animal>.clips.glb` by
//            `plugins/puppet3d/puppet3d.clips.ts`, for the herd scene's crowd3d to bake and play.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')

type Bake = { sheets: string[]; rate: number; mods: string[]; clips: Record<string, { kind: string; walk: number; stride: string; settle: number; idle: number }> }

export default async ({ blender, pack, scratch, library }: Tools) => {
  const bake = JSON.parse(fs.readFileSync(path.join(here, 'demo_puppet3d.bake.json'), 'utf8')) as Bake

  fs.mkdirSync(path.join(here, 'cues'), { recursive: true })
  for (const s of bake.sheets) {
    fs.copyFileSync(path.join(library, 'cues', `${s}.cues.json`), path.join(here, 'cues', `${s}.cues.json`))
    console.log('wrote', path.relative(root, path.join(here, 'cues', `${s}.cues.json`)))
  }

  const raw = scratch('wings.glb')
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(here, 'wings', 'wings.py'), '--', path.join(here, 'wings', 'wings.json'), raw, path.join(here, 'wings', 'wings.skeleton.json')])
  await pack(raw, path.join(here, 'wings', 'wings.glb'))
  console.log('wrote', path.relative(root, path.join(here, 'wings', 'wings.glb')))

  for (const [animal, c] of Object.entries(bake.clips)) {
    const out = path.join(here, 'awol', `${animal}.clips.glb`)
    execFileSync('node', ['--experimental-strip-types', path.join(root, 'plugins', 'puppet3d', 'puppet3d.clips.ts'), path.join(here, '..', 'main.scene.json'), c.kind, out,
      `rate=${bake.rate}`, `walk=${c.walk},${c.stride},${c.settle}`, `idle=${c.idle}`, `mods=${bake.mods.map(m => path.join(root, m)).join(',')}`], { stdio: 'inherit' })
  }
}
