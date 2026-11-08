// Draws `panel.png` beside this file, the picture the panel scene's glowing panel shows and lights the
// room with: 512 × 256, its left half a warm sunset (deep red at the bottom to orange, a yellow sun),
// its right half a cool night (deep blue to cyan, a white moon), a green band along the bottom of both,
// so a wall lit by its left half and one lit by its right are told apart by colour. Run it again with
// `node games/demo_lights3d/assets/panel.png.mjs`. Written with node's own zlib: no package.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const width = 512, height = 256

// A colour mixed `t` of the way from `a` to `b`, each [r, g, b] from 0 to 255.
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

// The colour of pixel x, y (y down from the top).
const colourAt = (x, y) => {
  const up = 1 - y / (height - 1)
  if (y > height * 0.86) return [40, 170, 70]
  if (x < width / 2) {
    const dx = x - width * 0.22, dy = y - height * 0.38
    if (dx * dx + dy * dy < 34 * 34) return [255, 230, 90]
    return mix([200, 30, 20], [255, 150, 40], up)
  }
  const dx = x - width * 0.78, dy = y - height * 0.3
  if (dx * dx + dy * dy < 22 * 22) return [245, 245, 255]
  return mix([10, 30, 160], [40, 200, 230], up)
}

// The raw rows, each led by filter byte 0 (none).
const raw = Buffer.alloc((width * 3 + 1) * height)
for (let y = 0; y < height; y++) {
  const row = y * (width * 3 + 1)
  raw[row] = 0
  for (let x = 0; x < width; x++) raw.set(colourAt(x, y), row + 1 + x * 3)
}

// CRC-32 of a buffer, as PNG's chunks are checked.
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

// One chunk: its length, its type, its data and the CRC of the type and data.
const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(typed))
  return Buffer.concat([length, typed, sum])
}

const header = Buffer.alloc(13)
header.writeUInt32BE(width, 0)
header.writeUInt32BE(height, 4)
header[8] = 8 // bits a channel
header[9] = 2 // RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(fileURLToPath(new URL('./panel.png', import.meta.url)), png)
