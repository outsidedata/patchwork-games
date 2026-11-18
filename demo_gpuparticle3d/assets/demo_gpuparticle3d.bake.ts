// demo_gpuparticle3d's bake (`yarn bake demo_gpuparticle3d`): every built file the scenes' catalogues
// name, written where they read it. It reads nothing from the library.
//   particles/           the particles' sheet, which `particles/particles.draw.ts` draws from nothing
//   checker-1024.webp    bounce's land's checkerboard, drawn here from nothing: `squares` squares a side
//                        in two greys, `light` and `dark`, each with a `line` pixel rim of `rim` grey, so
//                        a repeat of the map is `squares` squares across
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import type { Tools } from '#scripts/bake.ts'
import { draw } from './particles/particles.draw.ts'

const SIZE = 1024
const CHECKER = { squares: 2, light: 0xd4, dark: 0xa8, rim: 0x86, line: 3 }

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

export default async ({ webp, scratch }: Tools) => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  for (const out of draw(path.join(here, 'particles'))) console.log('wrote', path.relative(process.cwd(), out))

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
  console.log('wrote', path.relative(process.cwd(), checker))
}
