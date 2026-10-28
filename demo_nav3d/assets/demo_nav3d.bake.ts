// demo_nav3d's bake, `yarn bake demo_nav3d` (core's `scripts/bake.ts`): every file the scene's catalogue
// names but the definitions, written beside this file.
//   cube.nav.json  the cube's graph, by `cube.nav.ts` from the `cube` definition's numbers.
//   web.nav.json   the web's graph, and ribbons.json the ribbons it lies on, by `web.nav.ts` from the
//                  `ribbons` definition's numbers (`web.json`).
//   farmer_man.glb the one body of `crowd.rig.json`, a Mixamo character of the library, with every clip of
//                  the rig baked onto it by anim's export (`plugins/anim/anim.export.py`), drawn by
//                  crowd3d. The export measures the rig's table too; crowd3d reads none of it, so it is
//                  written to the bake's scratch folder and dropped.
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'
import { write } from './cube.nav.ts'
import fs from 'node:fs'
import { graph, shape } from './web.nav.ts'
import defs from './web.json' with { type: 'json' }
import rig from './crowd.rig.json' with { type: 'json' }

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')

export default async ({ blender, scratch }: Tools) => {
  console.log('wrote', path.relative(root, write()))
  for (const [file, text] of [['web.nav.json', JSON.stringify(graph(defs.ribbons), null, 1)], ['ribbons.json', JSON.stringify(shape(defs.ribbons))]]) {
    fs.writeFileSync(path.join(here, file), text + '\n')
    console.log('wrote', path.relative(root, path.join(here, file)))
  }
  const outs = Object.keys(rig.bodies).map(body => `${body}=${path.join(here, `${body}.glb`)}`)
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.export.py'), '--', path.join(here, 'crowd.rig.json'), scratch('table.json'), ...outs])
  for (const body of Object.keys(rig.bodies)) console.log('wrote', path.relative(root, path.join(here, `${body}.glb`)))
}
