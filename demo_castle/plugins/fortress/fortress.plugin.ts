// The browser half of the fortress, the game's own plugin, loaded by `shipped` (`world.shipped.plugins`).
// It ticks nothing: what it knows reaches other plugins through its mods, the visitors' tour to npc3d
// (`fortress.npc3d.ts`), the buildings' boxes to lod3d (`fortress.lod3d.ts`) and the buildings' course table to
// supershader3d (`fortress.supershader3d.ts`), and a page's plugin asks a mod only of a plugin the page lists.
//
// The course table: the wall looks read each building's course feet (its courses' heights off the ground) and its
// walls' thickness from `csCourses`, a float texture of COURSES + 1 columns, a building a row, the row the vertex's
// `wall` names (its fourth number, % 256). `courses(three)` hands out the one table, made on its first call, ROWS
// rows so every row a vertex can name is there; `town(buildings)` writes the town's buildings into it, as the town's
// glb lists them. `close` disposes it.
import type * as THREE from 'three'

export const COURSES = 256
export const ROWS = 256

export function fortress() {
  let table: THREE.DataTexture | undefined
  let data: Float32Array | undefined
  return {
    courses(three: typeof THREE) {
      if (!table) {
        data = new Float32Array((COURSES + 1) * ROWS)
        table = new three.DataTexture(data, COURSES + 1, ROWS, three.RedFormat, three.FloatType)
        table.minFilter = table.magFilter = three.NearestFilter
        table.needsUpdate = true
      }
      return table
    },
    town(three: typeof THREE, buildings: { courses: number[]; wallDepth: number }[]) {
      if (buildings.length > ROWS) throw new Error(`fortress: the town has ${buildings.length} buildings, and the course table ${ROWS} rows`)
      const t = this.courses(three)
      const width = COURSES + 1
      buildings.forEach((b, row) => {
        for (let c = 0; c < COURSES; c++) data![row * width + c] = c < b.courses.length ? b.courses[c] : 1e4 + c
        data![row * width + COURSES] = b.wallDepth
      })
      t.needsUpdate = true
    },
    close() {
      table?.dispose()
      table = undefined
      data = undefined
    },
  }
}
