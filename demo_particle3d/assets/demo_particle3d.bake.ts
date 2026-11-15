// demo_particle3d's bake, `yarn bake demo_particle3d` (core's `scripts/bake.ts`): every built file the
// scene's catalogue names, written where the catalogue reads it.
//   checker-1024.webp    the room's floor, drawn here from nothing: `squares` squares a side in two
//                        greys, `light` and `dark`, each with a `line` pixel rim of `rim` grey, so a
//                        repeat of the map is `squares` squares across
//   xbot.glb             Mixamo's X Bot (the library's `characters/xbot/xbot.fbx`) with every clip of
//                        `xbot.rig.json` baked onto it by anim's export (`plugins/anim/anim.export.py`),
//                        which packs it with gltfpack; the rig's measured `table` and `ends` are then
//                        written back into `xbot.rig.json` by the mixamo skill's `merge-table.mjs`
//   effects/<name>/      each flipbook effect's sheets: `flipbooks` renders every flipbook its
//                        `<name>Config.json` lists, from the node tree the entry writes out, into the
//                        pictures (`.png`) and sheets (`.json`) beside it (`tools/workshop/flipbooks.py`
//                        says what an entry holds), in Blender, reading nothing from the library
// The other effects are data files written by hand (`effects.json`, and the files under `effects/` it
// lists), drawn with particle3d's own shapes, so nothing is baked for them.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')

// The flipbook effects, each `effects/<name>/<name>Config.json`.
const FLIPBOOKS = ['smoke', 'embers', 'campfire', 'flame', 'column', 'fireball', 'shockwave', 'swirl', 'steam', 'dust', 'splash', 'bolt', 'arc']

const SIZE = 1024
const CHECKER = { squares: 2, light: 0xd8, dark: 0x9c, rim: 0x80, line: 3 }

const node = (args: string[]) =>
  new Promise<string>((done, fail) => execFile(process.execPath, args, (e, stdout, stderr) =>
    e ? fail(new Error(`node ${args.join(' ')} failed:\n${stdout}${stderr}`)) : done(`${stdout}${stderr}`)))

// A PNG of grey pixels, `size` a side: its signature, IHDR, one IDAT of the filtered rows, IEND.
function png(size: number, grey: (x: number, y: number) => number): Buffer {
  const table = new Uint32Array(256).map((_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const v of b) c = table[(c ^ v) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc(body))
    return Buffer.concat([head, body, tail])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits a sample
  ihdr[9] = 0 // greyscale
  const rows = Buffer.alloc(size * (size + 1))
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) rows[y * (size + 1) + 1 + x] = grey(x, y)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export default async ({ blender, webp, flipbooks, scratch }: Tools) => {
  // the flipbooks
  for (const name of FLIPBOOKS) console.log(await flipbooks(path.join(here, 'effects', name, `${name}Config.json`)))

  // the checkerboard
  const cell = SIZE / CHECKER.squares
  const raw = scratch('checker.png')
  fs.writeFileSync(raw, png(SIZE, (x, y) => {
    const i = Math.floor(x / cell), j = Math.floor(y / cell)
    const u = x - i * cell, v = y - j * cell
    const edge = Math.min(u, v, cell - 1 - u, cell - 1 - v) < CHECKER.line
    return edge ? CHECKER.rim : (i + j) % 2 ? CHECKER.dark : CHECKER.light
  }))
  const checker = path.join(here, `checker-${SIZE}.webp`)
  await webp(raw, checker, SIZE)
  console.log('wrote', path.relative(root, checker))

  // the X Bot and its clips, and the rig's measures
  const rig = path.join(here, 'xbot.rig.json')
  const table = scratch('xbot.table.json')
  const glb = path.join(here, 'xbot.glb')
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(root, 'plugins', 'anim', 'anim.export.py'), '--', rig, table, `xbot=${glb}`]))
  console.log(await node([path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs'), rig, table, rig]))
  console.log('wrote', path.relative(root, glb))
}
