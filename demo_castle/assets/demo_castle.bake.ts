// demo_castle's bake, `yarn bake demo_castle` (core's `scripts/bake.ts`): every file main's catalogue names
// but the definitions, written beside this file.
//   fortress.glb, fortress.partial_scene.json, fortress.nav.json
//                 castle-plus's fortress (the library's `castle-plus/castle.py`, its scene
//                 `castle-plus/scenes/fortress.json`), laid in Blender: the castle as a glb, each piece its
//                 colour, packed by gltfpack; its shapes as a partial scene of shapes3d's, which main
//                 extends; and its ways as nav3d's graph, worked out for a body of the player's walker
//                 numbers in main's scene (`step`, `height`, `radius`). Change the fortress in the
//                 library, or those numbers, and bake again.
//   farmer_man.glb, farmer_woman.glb, farmhand.glb, mechworker.glb
//                 the visitors, every clip of `crowd.rig.json` baked onto each of its bodies by anim's
//                 export (`plugins/anim/anim.export.py`), drawn by crowd3d. The export measures the rig's
//                 table too; crowd3d reads none of it, so it is written to the bake's scratch folder and
//                 dropped.
//   hero.glb      the player, every clip of `player.rig.json` baked onto its body the same way, drawn by
//                 anim, which plays by the table the export measures: written back into the rig in the
//                 rig's own layout (`.claude/skills/using-mixamo-assets/scripts/merge-table.mjs`).
// Each rig's clips are read from ~/troupe-collection, its bodies from the library.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Tools } from '#scripts/bake.ts'
import main from '../main.scene.json' with { type: 'json' }
import crowd from './crowd.rig.json' with { type: 'json' }
import hero from './player.rig.json' with { type: 'json' }

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const exporter = path.join(root, 'plugins', 'anim', 'anim.export.py')
const merge = path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs')

export default async ({ blender, pack, scratch, library }: Tools) => {
  const out = scratch('fortress')
  const { step, height, radius } = main.world.walker.kinds.player
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(library, 'castle-plus', 'castle.py'), '--',
    'scene', 'fortress', 'game', out, String(step), String(height), String(radius)]))
  await pack(path.join(out, 'fortress.glb'), path.join(here, 'fortress.glb'))
  console.log('wrote', path.relative(root, path.join(here, 'fortress.glb')))
  for (const name of ['fortress.partial_scene.json', 'fortress.nav.json']) {
    fs.copyFileSync(path.join(out, name), path.join(here, name))
    console.log('wrote', path.relative(root, path.join(here, name)))
  }
  for (const [name, rig] of [['crowd', crowd], ['player', hero]] as const) {
    const file = path.join(here, `${name}.rig.json`), table = scratch(`${name}.table.json`)
    const bodies = Object.keys(rig.bodies).map(body => `${body}=${path.join(here, `${body}.glb`)}`)
    await blender(['--factory-startup', '--python-exit-code', '1', '--python', exporter, '--', file, table, ...bodies])
    for (const body of Object.keys(rig.bodies)) console.log('wrote', path.relative(root, path.join(here, `${body}.glb`)))
    if (name === 'player') {
      execFileSync(process.execPath, [merge, file, table, file], { stdio: 'inherit' })
      console.log('wrote', path.relative(root, file), 'its table')
    }
  }
}
