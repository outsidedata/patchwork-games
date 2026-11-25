// grass3d's mod for rooms (`addons/scenemanager`'s mods), the page's. A scene with `world.rooms.mods: { outdoors:
// ['grass3d'] }` hands rooms every chunk of grass3d's blades (`drawn()`), which rooms does not draw while the camera
// stands in a room and no opening of it is seen. grass3d sets each chunk's `visible` in its own `afterTick`, so it is
// listed before `shipped`, which runs rooms after it.
//   outdoors  `(plugins) → Object3D[]`
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'

export function outdoors(plugins: Plugins): THREE.Object3D[] {
  return plugins.grass3d.drawn()
}
