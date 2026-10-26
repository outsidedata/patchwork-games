// Draws the ground's checkerboard, `checker.png` beside this file, from nothing: `node
// games/demo_npc3d/assets/checker.mjs`, which the bake runs too. Two squares a side, each SQUARE
// pixels, LIGHT and DARK, so the field's one ground layer at a `scale` of 2 metres lays a square a
// metre. Written as an 8-bit RGB PNG by hand: one IDAT of the rows, each row's filter byte 0.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const SQUARE = 256
const LIGHT = [0xc8, 0xc8, 0xc8], DARK = [0x6e, 0x6e, 0x6e]
const SIDE = SQUARE * 2

const rows = Buffer.alloc(SIDE * (1 + SIDE * 3))
for (let y = 0; y < SIDE; y++) {
  const at = y * (1 + SIDE * 3)
  rows[at] = 0
  for (let x = 0; x < SIDE; x++) {
    const c = (Math.floor(x / SQUARE) + Math.floor(y / SQUARE)) % 2 === 0 ? LIGHT : DARK
    rows.set(c, at + 1 + x * 3)
  }
}

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = buf => {
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc(body))
  return Buffer.concat([head, body, tail])
}

const header = Buffer.alloc(13)
header.writeUInt32BE(SIDE, 0)
header.writeUInt32BE(SIDE, 4)
header[8] = 8
header[9] = 2
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(rows)),
  chunk('IEND', Buffer.alloc(0)),
])
const out = path.join(import.meta.dirname, 'checker.png')
fs.writeFileSync(out, png)
console.log('wrote', out)
