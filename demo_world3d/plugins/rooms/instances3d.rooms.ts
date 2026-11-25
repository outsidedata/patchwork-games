// instances3d's mod for rooms (`addons/scenemanager`'s mods), the page's. A scene with `world.rooms.mods: { outdoors:
// ['instances3d'] }` hands rooms every InstancedMesh instances3d draws (`drawn()`: lod3d's grass, trees and stones, and
// its kinds'), which rooms does not draw while the camera stands in a room and no opening of it is seen.
//   outdoors  `(plugins) → Object3D[]`
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'

export function outdoors(plugins: Plugins): THREE.Object3D[] {
  return plugins.instances3d.drawn()
}
