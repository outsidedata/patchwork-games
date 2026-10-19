// farm2d's own piece for a look that keeps a particle2d effect going for as long as something it draws
// is so: smoke from the chimney, leaves off a tree, the stink of a pile of manure, a ripe crop's glint,
// dust at the feet of whatever walks, grass falling from a chewing cow's mouth. Each look makes one in
// its `setup` for each effect it keeps, and is handed it back each frame:
//   keep(particle2d, effect, at, spawn)   the effect `effect` running from the world point `at`, emitted
//                                         on this page (particle2d's `emit`) the first frame the effects
//                                         file has it, with `spawn`'s fields (its `layer` or `scale`,
//                                         say), and moved to `at` every frame it is kept after, so it
//                                         throws from where a walker's feet are now; how often it
//                                         throws is the effect's own `every`.
//   end()                                 the effect stopped, its particles left to live out their lives;
//                                         `keep` starts it again.
// A look keeps it each frame it holds and ends it in the frame it does not, and in its `remove`, so the
// effect goes the frame its row does.
import type { Plugins } from '#engine/browser.ts'

type Running = { at: number[]; life: number; age: number }

export function lasting() {
  let running: Running | undefined
  return {
    keep(particle2d: Plugins['particle2d'], effect: string, at: number[], spawn: Record<string, unknown> = {}) {
      if (running) running.at = at
      else if (particle2d.has(effect)) running = particle2d.emit(effect, at, { ...spawn, life: Number.MAX_SAFE_INTEGER })
    },
    end() {
      if (!running) return
      running.life = running.age
      running = undefined
    },
  }
}
