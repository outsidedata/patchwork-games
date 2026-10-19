// farm2d's own plugin for what each role's one verb would do, and to what: the farmer's, the cow's and
// the chicken's rules ask it when the verb is used, and the HUD (`plugins/hud`) asks it each frame to
// say what Space would do now and where the role's work is, so the two never disagree. Every function
// is handed `all`, the rows of a kind (`w.all` in a rule, the page's rows of that kind on the page),
// and every number is a definition's, handed in by the caller.
//
//   cellOf(pos), middle(cell), same(a, b)   a point's cell of the field, a cell's middle, and whether
//                                           two cells are one.
//   free(map, soil, all, cell)              whether a cell is tilled soil, its tile on the `soil.layer`
//                                           layer of the field's map of the Tiled type `soil.type`, with
//                                           no crop growing in it: where the farmer's manure grows one.
//   things(all)                             what the farmer can pick up: the ripe crops, the produce
//                                           lying loose and the manure, in that order.
//   within(pos, rows, reach)                of `rows`, those within `reach` of `pos`.
//   closest(pos, rows)                      of `rows`, the one nearest `pos`, or undefined; of two as near,
//                                           the first.
//   pileWithin(all, pos, reach)             the harvest pile within `reach` of `pos`, or undefined.
//   grazing(all, pos, reach)                the grass grown tall within `reach` of `pos` a cow eats, the
//                                           nearest.
//   prey(all, pos, reach)                   the bug within `reach` of `pos` a chicken eats, the nearest.
//   inYard(bounds, reach, pos)              whether a point is in a chicken's yard: inside its `bounds`,
//                                           or within its `reach` of them.
import type { Row } from '#engine/engine.ts'
import type { Tiled } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { tileAt } from '#plugins/tilemap/tilemap.sim.ts'

export type Cell = [number, number]
export type All = (kind: string) => Row[]

const apart = (a: readonly number[], b: readonly number[]) => math.hypot(b[0] - a[0], b[1] - a[1])

export const cellOf = (pos: readonly number[]): Cell => [Math.floor(pos[0]), Math.floor(pos[1])]
export const middle = ([c, r]: Cell) => [c + 0.5, r + 0.5]
export const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1]

export function free(map: Tiled, soil: { layer: string; type: string }, all: All, cell: Cell): boolean {
  const gid = tileAt(map, undefined, soil.layer, cell[0], cell[1])
  return map.tiles[gid]?.type === soil.type && !all('crop').some(c => same(cellOf(c.data.pos), cell))
}

export const things = (all: All) => [...all('crop').filter(c => c.data.ripe), ...all('produce'), ...all('manure')]

export const within = (pos: readonly number[], rows: Row[], reach: number) => rows.filter(r => apart(r.data.pos, pos) <= reach)

export function closest(pos: readonly number[], rows: Row[]): Row | undefined {
  let best: Row | undefined, gap = Infinity
  for (const r of rows) {
    const d = apart(pos, r.data.pos)
    if (d < gap) { gap = d; best = r }
  }
  return best
}

export const pileWithin = (all: All, pos: readonly number[], reach: number) => all('pile').find(p => apart(p.data.pos, pos) <= reach)

export const grazing = (all: All, pos: readonly number[], reach: number) => closest(pos, within(pos, all('grass').filter(g => g.data.grown), reach))

export const prey = (all: All, pos: readonly number[], reach: number) => closest(pos, within(pos, all('bug'), reach))

export function inYard(bounds: number[][], reach: number, pos: readonly number[]): boolean {
  const [[left, top], [right, bottom]] = bounds
  return pos[0] >= left - reach && pos[0] <= right + reach && pos[1] >= top - reach && pos[1] <= bottom + reach
}
