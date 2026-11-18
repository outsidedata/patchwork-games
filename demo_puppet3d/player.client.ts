// One seat's keys. The seat's row is paddock's `keeper`, which is no body: 1 to 5 set the pace
// everything goes at, from a stand to the fastest; t stands every animal upright or puts it back on its
// feet; j makes them leap; q and e turn the camera round what it looks at; p takes the controls of the body
// at the station, and gives them back. Watching, w or the up arrow shifts the pace up and s or the down
// arrow one down, and [ and ] step back and on a station. Steering a body, a and d or the left and right
// arrows turn it; w and s or the up and down arrows shift its pace, or for a body that flies (one whose row
// has a `climb`) climb and dive it. The table changes the frame the keeper's hold does (`holding`). Only the
// seat's own row binds them (`mine`); this file is a fresh copy for each row.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { holding, type Binds } from '#plugins/player/player.plugin.ts'

let ours = false
// the table bound: for watching, for steering a body on the land, or for one that flies
let bound: 'watch' | 'steer' | 'fly' | undefined

const tableOf = (rows: Row[]) => {
  const held = holding(rows)
  return !held ? 'watch' : 'climb' in held.data ? 'fly' : 'steer'
}

const shared = { 1: ['gait', 0], 2: ['gait', 1], 3: ['gait', 2], 4: ['gait', 3], 5: ['gait', 4], p: ['pilot'], j: ['leap'], t: ['upright'] } satisfies Binds['press']
const pace = { w: ['shift', 1], ArrowUp: ['shift', 1], s: ['shift', -1], ArrowDown: ['shift', -1] } satisfies Binds['press']
const orbit: NonNullable<Binds['axis']>[number] = { keys: ['q', 'e'], send: v => ['orbit', v] }
const turn: NonNullable<Binds['axis']>[number] = { keys: [['a', 'ArrowLeft'], ['d', 'ArrowRight']], send: v => ['steer', v] }
const climb: NonNullable<Binds['axis']>[number] = { keys: [['s', 'ArrowDown'], ['w', 'ArrowUp']], send: v => ['climb', v] }

const TABLES: Record<NonNullable<typeof bound>, Binds> = {
  watch: { press: { ...shared, ...pace, '[': ['station', -1], ']': ['station', 1], f: ['aloft'] }, axis: [orbit] },
  steer: { press: { ...shared, ...pace }, axis: [orbit, turn] },
  fly: { press: shared, axis: [orbit, turn, climb] },
}

function bind(plugins: Plugins) {
  const now = tableOf(plugins.wire.rows)
  if (now === bound) return
  bound = now
  plugins.player.bind(TABLES[now])
}

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (ours) bind(plugins)
}

export function tick(_row: Row, plugins: Plugins) {
  if (ours) bind(plugins)
}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
