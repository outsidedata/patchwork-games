// climb's mod for ik3d (`addons/scenemanager`'s mods). A scene with `world.ik3d.mods: { limbs: 'climb' }`
// has the hands and feet of a body holding a net reach the points they touch on it.
//
// `limbs(plugins, row)` is the row's limbs this frame as climb's browser half places them
// (`climb.plugin.ts`), or undefined for a row that holds no net.
import type { Plugins } from '#engine/browser.ts'
import type { Row } from '#engine/engine.ts'
import type { Handed } from '#plugins/ik3d/ik3d.plugin.ts'

export function limbs(plugins: Plugins, row: Row): Handed[] | undefined {
  return plugins.climb.limbs(row)
}
