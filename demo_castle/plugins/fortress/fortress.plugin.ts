// The browser half of the fortress, the game's own plugin, loaded by `shipped` (`world.shipped.plugins`).
// It ticks only the town's clips (below): what it knows reaches other plugins through its mods, the visitors' tour to npc3d
// (`fortress.npc3d.ts`), the buildings' boxes to lod3d (`fortress.lod3d.ts`) and the buildings' course table to
// supershader3d (`fortress.supershader3d.ts`), and a page's plugin asks a mod only of a plugin the page lists.
//
// The course table: the wall looks read each row's course feet (its courses' heights off the ground) and its thing's
// walls' thickness from `csCourses`, a float texture of COURSES + 1 columns, a row for each thing and look that
// courses it, the row the vertex's slot `s2` names (its fourth number, % 256). `courses(three)` hands out the one
// table, made on its first call, ROWS rows so every row a vertex can name is there; `town(rows)` writes the town's
// rows into it, as the town's glb lists them (its extras' `courses`, pro-ng's procedural.py). `close` disposes it.
//
// The town's clips: every kit thing that moves (`assets/smallville.town.clips.json`) plays on the town's one mesh, by
// one mixer, which the town's look hands over with each clip's action (`animate(mixer, clips)`, `castle.client.ts`).
// Each clip whose `start` is on plays from then, looping where its `loop` says, and a clip that does not loop holds
// its last frame. Each frame the mixer goes on by the time since the frame before (`tick`, the page's clock), or by
// `advance(seconds)`. The game starts and stops a clip by its thing's and its own name: `clip('tavern/tavern fan',
// 'spin', true)` when the player pulls the chain, `false` to stop it. Stopped, the thing stands where it was; started
// again, it goes on from there, and a clip that ran to its end starts again from its beginning. `still()` lets go of the mixer, as the town is taken away.
import type * as THREE from 'three'

export const COURSES = 256
export const ROWS = 256

// a row of the course table as the town's glb lists it
export type CourseRow = { thing: string; look: string; feet: number[]; wallDepth: number }

// a clip the town hands over: its thing's name, its own, whether it plays from the start, whether it loops, its action
export type Played = { thing: string; clip: string; start: boolean; loop: boolean; action: THREE.AnimationAction }

export function fortress() {
  let table: THREE.DataTexture | undefined
  let data: Float32Array | undefined
  let mixer: THREE.AnimationMixer | undefined
  let actions = new Map<string, Played>()
  let last: number | undefined
  const find = (thing: string, clip: string) => {
    if (!mixer) throw new Error(`fortress: no town is animated, so no clip ${clip} of ${thing}`)
    const p = actions.get(`${thing}\n${clip}`)
    if (!p) throw new Error(`fortress: the town has no clip ${clip} of ${thing}; it has ${[...actions.values()].map(a => `${a.clip} of ${a.thing}`).join(', ') || 'none'}`)
    return p
  }
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
    town(three: typeof THREE, rows: CourseRow[]) {
      if (rows.length > ROWS) throw new Error(`fortress: the town has ${rows.length} course rows, and the course table ${ROWS}`)
      const t = this.courses(three)
      const width = COURSES + 1
      rows.forEach((r, row) => {
        for (let c = 0; c < COURSES; c++) data![row * width + c] = c < r.feet.length ? r.feet[c] : 1e4 + c
        data![row * width + COURSES] = r.wallDepth
      })
      t.needsUpdate = true
    },
    animate(three: typeof THREE, m: THREE.AnimationMixer, clips: Played[]) {
      this.still()
      mixer = m
      for (const p of clips) {
        const key = `${p.thing}\n${p.clip}`
        if (actions.has(key)) throw new Error(`fortress: the town hands over the clip ${p.clip} of ${p.thing} twice`)
        actions.set(key, p)
        p.action.setLoop(p.loop ? three.LoopRepeat : three.LoopOnce, Infinity)
        p.action.clampWhenFinished = !p.loop
        if (p.start) p.action.play()
      }
    },
    clip(thing: string, clip: string, on: boolean) {
      const { action } = find(thing, clip)
      if (!on) { action.paused = true; return }
      if (action.paused) action.paused = false
      if (!action.isRunning()) action.reset().play()
    },
    advance(seconds: number) {
      mixer?.update(seconds)
    },
    tick() {
      const now = performance.now()
      if (last !== undefined) this.advance((now - last) / 1000)
      last = now
    },
    still() {
      mixer?.stopAllAction()
      mixer = undefined
      actions = new Map()
    },
    close() {
      this.still()
      table?.dispose()
      table = undefined
      data = undefined
    },
  }
}
