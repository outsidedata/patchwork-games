// fortress's mod for supershader3d (`addons/scenemanager`'s mods), the page's. A scene with
// `world.supershader3d.mods: { behaviors: ['fortress'] }` has supershader3d bind the fortress's course table
// (`fortress.plugin.ts`, The course table) as the shared texture `courses`, which the wall looks read.
import type { Plugins } from '#engine/browser.ts'
import type { Shared } from '#plugins/supershader3d/supershader3d.plugin.ts'

export function behaviors(_plugins: Plugins): Record<string, Shared> {
  return { courses: plugins => plugins.fortress.courses(plugins.render3d.THREE) }
}
