// Makes farm2d's art and its field from the Farm RPG FREE 16x16 pack by maevedevs
// (https://maevedevs.itch.io/farm-rpg), whose licence lets a game ship it and nobody hand it on: the
// pack is kept in the library, `vendor/maevedevs-farm-rpg/` under `PATCHWORK_LIBRARY` (else
// `~/patchwork-library`), and never in the game; every picture made here is sealed into `farm2d.wad`
// (`seal`, core's `plugins/loader/loader.sim.ts`), which the scene's `world.loader.wads` names, so none
// is in the repo as itself, and the loader hands each one out at its own path, `farmer.png` say, from the
// wad. The sheets, the tilesets and the field are written beside it as they are.
// `node games/farm2d/assets/make.mjs`, from the repo's root (ImageMagick's `magick` on the path).
//
// - `farmer.png` and `farmer.json`: the pack's Walk (6 frames) and Idle (4 frames) sheets side by
//   side, each frame 32 pixels square, as one TexturePacker sheet. Each sheet's rows are the farmer
//   facing down, up, and right; the clips `walk` and `idle` each have three runs, down, right and
//   up, which the catalogue entry's `facing` turns to a quarter turn apart from facing down, left
//   drawn as right mirrored. Every frame stands on the farmer's feet.
// - `cow.png` and `cow.json`, `bull.png` and `bull.json`: the pack's Female and Male Cow Brown, 32 ×
//   32 frames of four, laid out as the farmer is: a row facing down (the pack's front row), one facing
//   right (its side row, which faces left, each frame flopped) and one facing up (its back row). The
//   clips: `walk`, every frame; `stand`, the first; `eat`, the second and the fourth, the head down.
// - `chicken.png` and `chicken.json`, `hen.png` and `hen.json`: the pack's Chicken Red and Chicken
//   Blonde Green, four 16-pixel frames facing left over four facing right; each clip has two runs,
//   right and left, half a turn apart: `walk`, every frame; `stand`, the first; `peck`, the first and
//   the fourth, the head down.
// - `crops.png` and `crops.json`: the pack's Spring Crops, cells 16 across and 32 down; the clips
//   `strawberry`, `leek`, `potato` and `onion` are each row's stages from seed to ripe, untimed, so
//   the crop's rule picks the stage. Each frame stands on the plant's root.
// - `produce.png` and `produce.json`: the crops' ripe produce (column 8 of Spring Crops, its lower
//   16 pixels), one still clip per crop named as the crop, standing on its middle: the pop of a pick,
//   what the farmer carries and what lies on the harvest pile.
// - `tree.png` and `tree.json`: the pack's Maple Tree, five 32 × 48 frames from stump-seedling to
//   felled, one untimed clip `maple`, each frame standing on its trunk.
// - `house.png` and `house.json`: the pack's House, the one with a chimney and a door, 72 × 95, one
//   still clip `house` standing on the foot of its wall.
// - `grass.png` and `grass.json`: the pasture's grass, drawn here, four 16-pixel stages of one
//   untimed clip `grass`: eaten bare to a patch of dirt, sprouting, short, and grown tall. Each frame
//   stands on its middle, as a cell's patch.
// - `bits.png` and `bits.json`: what the pack has none of, drawn here: `manure`, a little brown
//   pile, standing on its foot, and `bug`, one dark pixel.
// - `motes.png` and `motes.json`: particle2d's motes, 4-pixel squares cut in code: `leaf`, `dirt`,
//   `dust`, `petal`, `crumb`, `feather`.
// - `spring.png` and `spring.tsj`: the pack's Spring tileset, 16-pixel tiles, as a Tiled tileset;
//   the tilled soil's tiles have the Tiled type `soil`, which is where the farmer's manure grows a
//   crop.
// - `fence.png` and `fence.tsj`: the pack's fence, a three-by-three of 16-pixel tiles round an empty
//   middle, and a gate's stub; each fence tile has the Tiled type `fence` and a collision rectangle
//   the size of its cell, and the empty middle has the type `solid` and one too, which the hidden
//   layer `solid` lays under the house and the trees' trunks.
// - `field.tmj` and `field.actors.json`: the field, below.
// The game's sounds are synthaudio projects, not files: the song and the effects are `song.ts`'s.
//
// The field, `FIELD` cells: grass everywhere, the tilled plot `PLOT` in the middle, the cows'
// pasture fenced at the bottom left and the chickens' yard at the right, each with one gap in its
// fence, the gate, for the farmer to walk through. The fences are on the Tiled layer `sprites`, so
// each is drawn in order with the things standing round it, the ground on `ground`, and the cells the
// house and the trees stand on on the hidden layer `solid`. Its actors, everything of the level that
// is a row: the house, the trees, a grass patch on each cell inside the pasture's fence, the harvest
// pile inside the yard's gate, the cast living there from the start (one farmer, two cows and four
// chickens), and a `start` for each role and each of the field's `seats` slots, where a new one of
// that role comes in for a seat that finds every one of it played by people: the farmers along the
// house's front, the cows on the pasture, the chickens in the yard.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seal } from '../../../plugins/loader/loader.sim.ts'

const here = dirname(fileURLToPath(import.meta.url))
const pack = join(process.env.PATCHWORK_LIBRARY || join(homedir(), 'patchwork-library'), 'vendor', 'maevedevs-farm-rpg')
// Every picture is made in a folder of this run's own, sealed into the wad at the end, and the folder
// removed; every other file is written beside the wad.
const pictures = mkdtempSync(join(tmpdir(), 'farm2d-'))
process.on('exit', () => rmSync(pictures, { recursive: true, force: true }))
const out = name => join(/\.png$/.test(name) ? pictures : here, name)
const json = (name, value) => writeFileSync(out(name), JSON.stringify(value, null, 1) + '\n')

// One TexturePacker frame of a page, `w` × `h` at (x, y), standing on `pivot`, a fraction of it.
const frame = (filename, x, y, w, h, pivot, duration) => ({
  filename,
  frame: { x, y, w, h },
  rotated: false,
  trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w, h },
  sourceSize: { w, h },
  pivot: { x: pivot[0], y: pivot[1] },
  ...(duration !== undefined && { duration }),
})

const meta = (image, size, frameTags) => ({ app: 'games/farm2d/assets/make.mjs', image, format: 'RGBA8888', size: { w: size[0], h: size[1] }, scale: '1', frameTags })

// A sheet of runs cut from a page: `runs` lists each clip's runs, each run a list of [x, y] cells,
// written as the frames of `<clip>@<k>` in order and tagged so.
function sheet(name, image, size, cell, pivot, clips) {
  const frames = [], frameTags = []
  for (const [clip, { runs, duration }] of Object.entries(clips)) {
    runs.forEach((cells, k) => {
      const tag = runs.length > 1 ? `${clip}@${k}` : clip
      const from = frames.length
      cells.forEach(([c, r], i) => frames.push(frame(`${tag}/${i}`, c * cell[0], r * cell[1], cell[0], cell[1], pivot, duration)))
      frameTags.push({ name: tag, from, to: frames.length - 1, direction: 'forward' })
    })
  }
  json(`${name}.json`, { frames, meta: meta(image, size, frameTags) })
}

// A row of `n` cells from column `c0`, on row `r`; and the cells of columns `cs` on row `r`.
const row = (r, n, c0 = 0) => Array.from({ length: n }, (_, i) => [c0 + i, r])
const cols = (r, cs) => cs.map(c => [c, r])

// A picture of `w` × `h` drawn pixel by pixel: each [x, y, colour] of `points` on a clear page.
const draw = (file, w, h, points) =>
  execFileSync('magick', ['-size', `${w}x${h}`, 'xc:none', ...points.flatMap(([x, y, c]) => ['-fill', c, '-draw', `point ${x},${y}`]), out(file)])

// A picture from lines of characters, each a pixel, `.` clear and any other the colour `key` gives.
const art = (lines, key, dx = 0, dy = 0) =>
  lines.flatMap((line, y) => [...line].flatMap((ch, x) => (ch === '.' ? [] : [[x + dx, y + dy, key[ch]]])))

// The same little generator every run, so the art is the same every time it is made.
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- characters

// The farmer: Walk.png at x 0 and Idle.png beside it at x 192, so Idle's columns start at 6.
execFileSync('magick', [join(pack, 'Character/Walk.png'), join(pack, 'Character/Idle.png'), '+append', out('farmer.png')])
const DOWN = 0, UP = 1, RIGHT = 2
sheet('farmer', 'farmer.png', [320, 96], [32, 32], [0.5, 26 / 32], {
  walk: { duration: 100, runs: [row(DOWN, 6), row(RIGHT, 6), row(UP, 6)] },
  idle: { duration: 200, runs: [row(DOWN, 4, 6), row(RIGHT, 4, 6), row(UP, 4, 6)] },
})

// A cow: the pack's rows are side (facing left), front and back; written front, side flopped frame by
// frame to face right, and back, so the rows face down, right and up as the farmer's do.
for (const [name, file] of [['cow', 'Female Cow Brown.png'], ['bull', 'Male Cow Brown.png']]) {
  execFileSync('magick', [
    join(pack, 'Farm Animals', file), '-write', 'mpr:cow', '+delete',
    '(', 'mpr:cow', '-crop', '128x32+0+32', '+repage', ')',
    '(', 'mpr:cow', '-crop', '128x32+0+0', '+repage', '-crop', '32x32', '+repage', '-flop', '+append', ')',
    '(', 'mpr:cow', '-crop', '128x32+0+64', '+repage', ')',
    '-append', out(`${name}.png`),
  ])
  const runs = cs => [cols(0, cs), cols(1, cs), cols(2, cs)]
  sheet(name, `${name}.png`, [128, 96], [32, 32], [0.5, 30 / 32], {
    walk: { duration: 160, runs: runs([0, 1, 2, 3]) },
    stand: { duration: 1000, runs: runs([0]) },
    eat: { duration: 300, runs: runs([1, 3]) },
  })
}

// A chicken: four frames facing left over four facing right.
for (const [name, file] of [['chicken', 'Chicken Red.png'], ['hen', 'Chicken Blonde  Green.png']]) {
  copyFileSync(join(pack, 'Farm Animals', file), out(`${name}.png`))
  const runs = cs => [cols(1, cs), cols(0, cs)]
  sheet(name, `${name}.png`, [64, 32], [16, 16], [0.5, 15 / 16], {
    walk: { duration: 120, runs: runs([0, 1, 2, 3]) },
    stand: { duration: 1000, runs: runs([0]) },
    peck: { duration: 90, runs: runs([0, 3]) },
  })
}

// ---------------------------------------------------------------- things

copyFileSync(join(pack, 'Objects/Spring Crops.png'), out('crops.png'))
sheet('crops', 'crops.png', [224, 128], [16, 32], [0.5, 30 / 32], {
  strawberry: { runs: [row(0, 6)] },
  leek: { runs: [row(1, 6)] },
  potato: { runs: [row(2, 7)] },
  onion: { runs: [row(3, 6)] },
})

// The produce: the crops sheet's column 8, the lower 16 pixels of each 32-pixel row, side by side.
const CROPS = ['strawberry', 'leek', 'potato', 'onion']
execFileSync('magick', [
  ...CROPS.map((_, r) => `${join(pack, 'Objects/Spring Crops.png')}[16x16+128+${r * 32 + 16}]`),
  '+append', '+repage', out('produce.png'),
])
sheet('produce', 'produce.png', [16 * CROPS.length, 16], [16, 16], [0.5, 0.5], Object.fromEntries(CROPS.map((c, i) => [c, { runs: [[[i, 0]]] }])))

copyFileSync(join(pack, 'Objects/Maple Tree.png'), out('tree.png'))
sheet('tree', 'tree.png', [160, 48], [32, 48], [0.5, 44 / 48], {
  maple: { runs: [row(0, 5)] },
})

// The house with the chimney and the door, cut from the right of House.png, standing on the foot of
// its wall, 86 pixels down, with its doorstep before it.
const HOUSE = { at: [148, 3], size: [72, 95], foot: 86 }
execFileSync('magick', [join(pack, 'Objects/House.png'), '-crop', `${HOUSE.size[0]}x${HOUSE.size[1]}+${HOUSE.at[0]}+${HOUSE.at[1]}`, '+repage', out('house.png')])
json('house.json', {
  frames: [frame('house/0', 0, 0, HOUSE.size[0], HOUSE.size[1], [0.5, HOUSE.foot / HOUSE.size[1]])],
  meta: meta('house.png', HOUSE.size, [{ name: 'house', from: 0, to: 0, direction: 'forward' }]),
})

// The grass: four stages of a patch, eaten bare to its dirt, sprouting, short, and grown, each a cell.
// The dirt is a blotch round the cell's middle, smaller at each stage. The grass is tufts of three
// blades, the middle one tallest and the outer two fanning out above their second pixel, dark at the
// root and light at the tip; each stage stands its tufts on some of the points of a three-by-three
// lattice across the cell, each nudged a pixel or so, more of them and taller at each stage. A fanned
// blade reaches two pixels either side of its tuft's middle, so every point stands three in from the
// cell's sides and no blade reaches into the next stage's frame.
const GREEN = { root: '#3f7f35', blade: '#5ea845', tip: '#a6e07c' }
const DIRT = ['#b39b62', '#9c844f']
const LATTICE = [[4, 6], [8, 5], [12, 6], [4, 10], [8, 10], [12, 11], [4, 14], [8, 14], [12, 15]]
const STAGES = [
  { dirt: 6.5, tufts: [], tall: 0 },
  { dirt: 5, tufts: [1, 3, 5, 7], tall: 2 },
  { dirt: 3.5, tufts: [0, 2, 4, 6, 8], tall: 3 },
  { dirt: 0, tufts: [0, 1, 2, 3, 4, 5, 6, 7, 8], tall: 5 },
]
const grass = []
STAGES.forEach((s, k) => {
  const roll = seeded(17 + k), x0 = k * 16
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x - 7.5) / 1.15, y - 8)
      if (d < s.dirt - 0.7 || (d < s.dirt && roll() < 0.5)) grass.push([x0 + x, y, roll() < 0.18 ? DIRT[1] : DIRT[0]])
    }
  }
  for (const t of s.tufts) {
    const bx = LATTICE[t][0] + Math.round(roll() * 2 - 1), by = LATTICE[t][1] - Math.round(roll())
    for (const [dx, h] of [[-1, s.tall - 1], [0, s.tall], [1, s.tall - 1]]) {
      for (let i = 0; i < h; i++) {
        const colour = i === h - 1 ? GREEN.tip : i === 0 ? GREEN.root : GREEN.blade
        grass.push([x0 + bx + dx + (i >= 2 ? dx : 0), by - i, colour])
      }
    }
  }
})
draw('grass.png', 16 * STAGES.length, 16, grass)
sheet('grass', 'grass.png', [16 * STAGES.length, 16], [16, 16], [0.5, 0.5], { grass: { runs: [row(0, STAGES.length)] } })

// The manure, 12 × 8, and the bug, one pixel beside it.
const MANURE = [
  '.....oo.....',
  '....oMMo....',
  '...oMhMMo...',
  '..oMMMMhMo..',
  '.oMMhMMMMMo.',
  'oMMMMMMMMMMo',
  '.oooooooooo.',
]
const BUG = '#1d1712'
draw('bits.png', 13, 8, [...art(MANURE, { o: '#4a2e16', M: '#75502c', h: '#9b6c3c' }), [12, 0, BUG]])
json('bits.json', {
  frames: [frame('manure/0', 0, 0, 12, 8, [0.5, 7 / 8]), frame('bug/0', 12, 0, 1, 1, [0.5, 0.5])],
  meta: meta('bits.png', [13, 8], [{ name: 'manure', from: 0, to: 0, direction: 'forward' }, { name: 'bug', from: 1, to: 1, direction: 'forward' }]),
})

// The motes: 4-pixel squares, a leaf green, a clod of soil, a puff of dust, a pink petal, a crumb of
// produce and a feather.
const MOTES = { leaf: '#5aa84a', dirt: '#8a5a32', dust: '#e8d4b0', petal: '#f4a6c4', crumb: '#e9c46a', feather: '#fff1d6' }
execFileSync('magick', [...Object.values(MOTES).flatMap(c => ['-size', '4x4', `xc:${c}`]), '+append', out('motes.png')])
sheet('motes', 'motes.png', [4 * Object.keys(MOTES).length, 4], [4, 4], [0.5, 0.5], Object.fromEntries(Object.keys(MOTES).map((m, i) => [m, { runs: [[[i, 0]]] }])))

// ---------------------------------------------------------------- tilesets

// The Spring tileset: 12 columns of 16-pixel tiles, 20 rows; the tilled soil's nine tiles typed `soil`.
copyFileSync(join(pack, 'Tileset/Tileset Spring.png'), out('spring.png'))
const COLUMNS = 12
const id = (c, r) => r * COLUMNS + c
const SOIL = [
  [id(8, 8), id(10, 8), id(11, 8)],
  [id(8, 9), id(9, 10), id(11, 10)],
  [id(8, 11), id(9, 11), id(11, 11)],
]
json('spring.tsj', {
  type: 'tileset', version: '1.10', tiledversion: '1.11.2', name: 'spring', image: 'spring.png',
  imagewidth: 192, imageheight: 320, tilewidth: 16, tileheight: 16, tilecount: COLUMNS * 20, columns: COLUMNS, margin: 0, spacing: 0,
  tiles: SOIL.flat().map(t => ({ id: t, type: 'soil' })),
})

// The fence: the pack's 48 × 80, three columns of 16-pixel tiles. The three-by-three at its top left
// is a fence round an empty middle: corners, sides, and the bottom's rail between two posts, which is
// the top's too.
copyFileSync(join(pack, "Objects/Fence's copiar.png"), out('fence.png'))
const FENCE = { tl: 0, tr: 2, left: 3, right: 5, bl: 6, rail: 7, br: 8 }
const SOLID = 4
const whole = { type: 'objectgroup', draworder: 'index', objects: [{ id: 1, x: 0, y: 0, width: 16, height: 16, rotation: 0, visible: true }] }
json('fence.tsj', {
  type: 'tileset', version: '1.10', tiledversion: '1.11.2', name: 'fence', image: 'fence.png',
  imagewidth: 48, imageheight: 80, tilewidth: 16, tileheight: 16, tilecount: 15, columns: 3, margin: 0, spacing: 0,
  tiles: [...Object.values(FENCE).map(t => ({ id: t, type: 'fence', objectgroup: whole })), { id: SOLID, type: 'solid', objectgroup: whole }],
})

// ---------------------------------------------------------------- the field

const FIELD = [24, 15]
const PLOT = { from: [11, 2], to: [16, 8] }
// Each pen's fence, its corners, and the one cell of it left open, the gate.
const PASTURE = { from: [0, 8], to: [9, 14], gate: [7, 8] }
const YARD = { from: [17, 7], to: [23, 14], gate: [17, 10] }
// The house's foot, and the cells its wall stands on; each tree's trunk, and the cell it stands on.
const HOME = { pos: [3.5, 5.6], cells: { from: [1, 3], to: [5, 5] } }
const TREES = [[8, 2.7], [20.2, 2.9], [22.6, 4.6], [13.6, 13.6]]
const PILE = [19.2, 10.5]
const CAST = {
  farmer: [{ pos: [6.2, 6.8] }],
  cow: [{ pos: [3, 11], sheet: 'cow' }, { pos: [6.5, 12.4], sheet: 'bull' }],
  chicken: [{ pos: [19.6, 12.4], sheet: 'chicken' }, { pos: [21.2, 9.2], sheet: 'hen' }, { pos: [22.2, 12.8], sheet: 'chicken' }, { pos: [20.8, 11.2], sheet: 'hen' }],
}
// Where a new one of each role comes in for slot k.
const STARTS = {
  farmer: k => [4.4 + 0.85 * k, 6.6],
  cow: k => [1.8 + 2 * (k % 4), 10.2 + 2.2 * Math.floor(k / 4)],
  chicken: k => [18.7 + 1.2 * (k % 4), 8.9 + 2.8 * Math.floor(k / 4)],
}
const SEATS = JSON.parse(readFileSync(join(here, '..', 'field.scene.json'), 'utf8')).seats

const inside = ({ from, to }, c, r) => c >= from[0] && c <= to[0] && r >= from[1] && r <= to[1]
const side = (v, lo, hi) => (v === lo ? 0 : v === hi ? 2 : 1)
// The gid of a tile of the spring tileset, and of the fence's, whose first gid is after spring's.
const SPRING = 1, FENCES = SPRING + COLUMNS * 20
const GRASS = SPRING + id(9, 2)

const ground = [], fences = [], solid = []
for (let r = 0; r < FIELD[1]; r++) {
  for (let c = 0; c < FIELD[0]; c++) {
    ground.push(inside(PLOT, c, r) ? SPRING + SOIL[side(r, PLOT.from[1], PLOT.to[1])][side(c, PLOT.from[0], PLOT.to[0])] : GRASS)
    let fence = 0
    for (const pen of [PASTURE, YARD]) {
      const { from: [c0, r0], to: [c1, r1], gate } = pen
      if (!inside(pen, c, r) || (c !== c0 && c !== c1 && r !== r0 && r !== r1) || (c === gate[0] && r === gate[1])) continue
      const t = r === r0 ? (c === c0 ? FENCE.tl : c === c1 ? FENCE.tr : FENCE.rail)
        : r === r1 ? (c === c0 ? FENCE.bl : c === c1 ? FENCE.br : FENCE.rail)
          : c === c0 ? FENCE.left : FENCE.right
      fence = FENCES + t
    }
    fences.push(fence)
    const trunk = TREES.some(([x, y]) => Math.floor(x) === c && Math.floor(y) === r)
    solid.push(inside(HOME.cells, c, r) || trunk ? FENCES + SOLID : 0)
  }
}
const layer = (lid, name, data, visible = true) => ({ id: lid, name, type: 'tilelayer', x: 0, y: 0, width: FIELD[0], height: FIELD[1], opacity: 1, visible, data })
json('field.tmj', {
  type: 'map', version: '1.10', tiledversion: '1.11.2', orientation: 'orthogonal', renderorder: 'right-down',
  width: FIELD[0], height: FIELD[1], tilewidth: 16, tileheight: 16, infinite: false, compressionlevel: -1,
  nextlayerid: 4, nextobjectid: 1, backgroundcolor: '#7bc35a',
  tilesets: [{ firstgid: SPRING, source: 'spring.tsj' }, { firstgid: FENCES, source: 'fence.tsj' }],
  layers: [layer(1, 'ground', ground), layer(2, 'sprites', fences), layer(3, 'solid', solid, false)],
})

const round = v => Math.round(v * 100) / 100
const actors = [
  { is: 'house', pos: HOME.pos },
  ...TREES.map(pos => ({ is: 'tree', pos })),
  ...Array.from({ length: (PASTURE.to[1] - PASTURE.from[1] - 1) * (PASTURE.to[0] - PASTURE.from[0] - 1) }, (_, i) => {
    const across = PASTURE.to[0] - PASTURE.from[0] - 1
    return { is: 'grass', pos: [PASTURE.from[0] + 1 + (i % across) + 0.5, PASTURE.from[1] + 1 + Math.floor(i / across) + 0.5] }
  }),
  { is: 'pile', pos: PILE },
  ...Object.entries(CAST).flatMap(([is, list]) => list.map(a => ({ is, ...a }))),
  ...Object.entries(STARTS).flatMap(([role, at]) => Array.from({ length: SEATS }, (_, slot) => ({ is: 'start', role, slot, pos: at(slot).map(round) }))),
]
writeFileSync(out('field.actors.json'), '[\n' + actors.map(a => ' ' + JSON.stringify(a)).join(',\n') + '\n]\n')

// ---------------------------------------------------------------- the wad

writeFileSync(out('farm2d.wad'), await seal(Object.fromEntries(readdirSync(pictures).sort().map(name => [name, readFileSync(join(pictures, name))]))))
