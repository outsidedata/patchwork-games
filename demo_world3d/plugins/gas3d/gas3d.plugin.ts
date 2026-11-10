// gas3d's page half (`gas3d.sim.ts` is the plugin, its header the whole of it): the cues. Every row the page holds
// that carries `gas` is drawn, for each of its tags the file's `cues` names, with that particle3d effect, thrown once
// the tag comes on and carried each frame at the row's `pos`, `world.gas3d.cueUp` metres over its feet; it is stopped,
// its life set to its age, the frame the tag is gone or the row is. It draws in its `afterTick`, listed as `shipped`
// (with `gas3d` in `world.shipped.plugins`) before particle3d, which draws the effects after it.
import type { Plugins } from '#engine/browser.ts'
import type { Effect } from '#plugins/particle3d/particle3d.plugin.ts'
import { fileOf, tags } from './gas3d.sim.ts'

export function gas3d() {
  // each cue thrown, by the row's id and the tag
  const thrown = new Map<string, Effect>()
  return {
    afterTick(plugins: Plugins) {
      if (!plugins.particle3d) return
      const cues = fileOf(plugins.wire).cues
      const up: number = plugins.wire.scene.world!.gas3d.cueUp
      const seen = new Set<string>()
      for (const r of plugins.wire.rows) {
        if (!r.data.gas) continue
        for (const tag of tags(plugins.wire, r)) {
          const effect = cues[tag]
          if (effect === undefined) continue
          const key = `${r.id} ${tag}`
          seen.add(key)
          const at = [r.data.pos[0], r.data.pos[1] + up, r.data.pos[2]]
          const fx = thrown.get(key)
          if (fx) fx.at = at
          else thrown.set(key, plugins.particle3d.emit(effect, at, { life: Infinity }) as Effect)
        }
      }
      for (const [key, fx] of thrown) {
        if (seen.has(key)) continue
        fx.life = fx.age
        thrown.delete(key)
      }
    },
    close() {
      for (const fx of thrown.values()) fx.life = fx.age
      thrown.clear()
    },
  }
}
