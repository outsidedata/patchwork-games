// demo_imprint3d's bake, `yarn bake demo_imprint3d` (core's `scripts/bake.ts`): every built file the scene's
// catalogue names, written where the catalogue reads it. The ground's maps are cut from `cc0-textures.json`
// before this runs.
//   xbot.glb   Mixamo's X Bot (the library's `characters/xbot/xbot.fbx`) with every clip of `xbot.rig.json`
//              baked onto it by anim's export (`plugins/anim/anim.export.py`), which packs it with gltfpack;
//              the rig's measured `table` and `ends` are then written back into `xbot.rig.json` by the mixamo
//              skill's `merge-table.mjs`
import { execFile } from 'node:child_process'
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')

const node = (args: string[]) =>
  new Promise<string>((done, fail) => execFile(process.execPath, args, (e, stdout, stderr) =>
    e ? fail(new Error(`node ${args.join(' ')} failed:\n${stdout}${stderr}`)) : done(`${stdout}${stderr}`)))

export default async ({ blender, scratch }: Tools) => {
  const rig = path.join(here, 'xbot.rig.json')
  const table = scratch('xbot.table.json')
  const glb = path.join(here, 'xbot.glb')
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.export.py'), '--', rig, table, `xbot=${glb}`]))
  console.log(await node([path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs'), rig, table, rig]))
  console.log('wrote', path.relative(root, glb))
}
