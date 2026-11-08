// supershader3d's mod for arealight (`addons/scenemanager`'s mods), beside arealight since arealight is the game's.
// A scene with `world.arealight.mods: { glow: 'supershader3d' }` lights the room from what glows.
//
// `glow(plugins)` is supershader3d's glowmap as this frame drew it (`plugins/supershader3d/supershader3d.glowmap.ts`),
// undefined where the scene gives no `world.supershader3d.glowmap` or before it is first drawn.
import type { Plugins } from '#engine/browser.ts'
import type { Glowmap } from '#plugins/supershader3d/supershader3d.plugin.ts'

export const glow = (plugins: Plugins): Glowmap | undefined => plugins.supershader3d.glowmap()
