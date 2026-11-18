// demo_puppet3d's bake, `yarn bake demo_puppet3d` (core's `scripts/bake.ts`):
//   cues     each cue sheet of `SHEETS`, copied from the library's `cues/` into `cues/` beside this file,
//            where the scenes' catalogues read it (`<sheet>.cues.json`, the entry `<sheet>`);
//   wings    the pegasus's wings, built by `wings/wings.py` in Blender, packed by gltfpack into
//            `wings/wings.glb`, with their rest skeleton `wings/wings.skeleton.json`;
//   clips    each animal of `CLIPS`, posed by puppet3d's own code from its definition in main's scene and
//            written with a `walk` and an `idle` into `awol/<animal>.clips.glb` by
//            `plugins/puppet3d/puppet3d.clips.ts`, for the herd scene's crowd3d to bake and play.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')

// The library's sheets the game plays.
const SHEETS = ['wag', 'ears', 'look', 'roar', 'graze', 'nod', 'wave', 'flap']
// Each animal's clips: its kind in main's scene, its walk's speed in metres a second, the sense whose
// coming round is a stride, the seconds it walks before its stride is taken, and its idle's seconds.
const CLIPS: Record<string, { kind: string; walk: number; stride: string; settle: number; idle: number }> = {
  horse_1: { kind: 'horse', walk: 1.6, stride: 'stride', settle: 3, idle: 10 },
  tiger_1: { kind: 'tiger', walk: 1.4, stride: 'stride', settle: 3, idle: 10 },
  male_lion_1: { kind: 'lion', walk: 1.4, stride: 'stride', settle: 3, idle: 10 },
  cheetah_1: { kind: 'cheetah', walk: 1.6, stride: 'stride', settle: 3, idle: 10 },
}
const RATE = 30

export default async ({ blender, pack, scratch, library }: Tools) => {
  fs.mkdirSync(path.join(here, 'cues'), { recursive: true })
  for (const s of SHEETS) {
    fs.copyFileSync(path.join(library, 'cues', `${s}.cues.json`), path.join(here, 'cues', `${s}.cues.json`))
    console.log('wrote', path.relative(root, path.join(here, 'cues', `${s}.cues.json`)))
  }

  const raw = scratch('wings.glb')
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(here, 'wings', 'wings.py'), '--', raw, path.join(here, 'wings', 'wings.skeleton.json')])
  await pack(raw, path.join(here, 'wings', 'wings.glb'))
  console.log('wrote', path.relative(root, path.join(here, 'wings', 'wings.glb')))

  for (const [animal, c] of Object.entries(CLIPS)) {
    const out = path.join(here, 'awol', `${animal}.clips.glb`)
    execFileSync('node', ['--experimental-strip-types', path.join(root, 'plugins', 'puppet3d', 'puppet3d.clips.ts'), path.join(here, '..', 'main.scene.json'), c.kind, out,
      `rate=${RATE}`, `walk=${c.walk},${c.stride},${c.settle}`, `idle=${c.idle}`], { stdio: 'inherit' })
  }
}
