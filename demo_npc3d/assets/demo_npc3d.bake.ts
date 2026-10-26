// demo_npc3d's bake, `yarn bake demo_npc3d` (core's `scripts/bake.ts`), every body baked by anim's
// export (`plugins/anim/anim.export.py`), which bakes every clip of a rig onto each body its `bodies`
// names, packs it by gltfpack and writes it as `<body>.glb` beside this file, where the scene's
// catalogue reads it:
//   crowd.rig.json    the people's four library bodies and their clips, drawn by crowd3d. The export
//                     measures the rig's table too; crowd3d reads none of it, so it is written to the
//                     bake's scratch folder and dropped.
//   swat.rig.json     the library's soldier and female soldier on the shooter's rifle clips, the guards'
//                     bodies, drawn by anim. Its table is measured on its bodies and written back into
//                     the rig in the rig's own layout (`.claude/skills/using-mixamo-assets/scripts/merge-table.mjs`),
//                     since anim plays by it.
// Then the rifle the guards carry, made by `rifle.py`, written as `rifle.glb`, the ground's
// checkerboard, drawn by `checker.mjs`, written as `checker.png`, and the graphs of the wall and town
// scenes, `wall` and `town`, made by nav3d's bake from each scene's shapes and ground and written as
// `wall.nav.json` and `town.nav.json`.
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Tools } from '#scripts/bake.ts'
import { bake } from '#plugins/nav3d/nav3d.bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const exporter = path.join(root, 'plugins', 'anim', 'anim.export.py')
const merge = path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs')

// Every body of a rig baked; hands back where the export wrote the table it measured.
async function bodies({ blender, scratch }: Tools, name: string): Promise<{ rig: string; table: string }> {
  const rig = path.join(here, `${name}.rig.json`), table = scratch(`${name}.table.json`)
  const { bodies } = (await import(rig, { with: { type: 'json' } })).default as { bodies: Record<string, string> }
  const outs = Object.keys(bodies).map(body => `${body}=${path.join(here, `${body}.glb`)}`)
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', exporter, '--', rig, table, ...outs])
  for (const body of Object.keys(bodies)) console.log('wrote', path.relative(root, path.join(here, `${body}.glb`)))
  return { rig, table }
}

export default async (tools: Tools) => {
  await bodies(tools, 'crowd')
  const { rig, table } = await bodies(tools, 'swat')
  execFileSync(process.execPath, [merge, rig, table, rig], { stdio: 'inherit' })
  console.log('wrote', path.relative(root, rig), 'its table')
  await tools.blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(here, 'rifle.py'), '--', path.join(here, 'rifle.glb')])
  console.log('wrote', path.relative(root, path.join(here, 'rifle.glb')))
  execFileSync(process.execPath, [path.join(here, 'checker.mjs')], { stdio: 'inherit' })
  for (const scene of ['town', 'wall']) for (const name of await bake(new URL('../demo_npc3d.scene.json', import.meta.url), scene)) console.log('wrote graph', name)
}
