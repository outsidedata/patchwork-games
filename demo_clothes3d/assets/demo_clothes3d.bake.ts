// demo_clothes3d's bake, `yarn bake demo_clothes3d` (core's `scripts/bake.ts`): every built file the
// scene's catalogue names, written where the catalogue reads it.
//   robed_person_bare.glb      the bare robed person (the library's
//                              `characters/robed_person/robed_person_bare.fbx`)
//   robed_person_garments.glb  the robed person's garments, rigged on the same skeleton
//                              (`characters/robed_person/robed_person_garments.fbx`)
// Both are baked in one run of anim's export (`plugins/anim/anim.export.py`), every clip of
// `robed_person.rig.json` onto each, packed with gltfpack; the rig's measured `table` and the rest are
// then written back into `robed_person.rig.json` by the mixamo skill's `merge-table.mjs`.
import { execFile } from 'node:child_process'
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')

const node = (args: string[]) =>
  new Promise<string>((done, fail) => execFile(process.execPath, args, (e, stdout, stderr) =>
    e ? fail(new Error(`node ${args.join(' ')} failed:\n${stdout}${stderr}`)) : done(`${stdout}${stderr}`)))

export default async ({ blender, scratch }: Tools) => {
  const rig = path.join(here, 'robed_person.rig.json')
  const table = scratch('robed_person.table.json')
  const bare = path.join(here, 'robed_person_bare.glb')
  const garments = path.join(here, 'robed_person_garments.glb')
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.export.py'), '--', rig, table, `robed_person_bare=${bare}`, `robed_person_garments=${garments}`]))
  console.log(await node([path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs'), rig, table, rig]))
  console.log('wrote', path.relative(root, bare))
  console.log('wrote', path.relative(root, garments))
}
