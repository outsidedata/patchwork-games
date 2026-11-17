// paddock's browser half, loaded by `shipped` and listed before chasecamera3d: each frame it holds the
// camera on the animal at the station the seat's own `keeper` row is on (the row whose `at` is the
// keeper's `station`), so stepping a station moves the camera the same frame.
import type { Plugins } from '#engine/browser.ts'
import { possessed } from '#plugins/player/player.plugin.ts'

export function paddock() {
  return {
    tick(plugins: Plugins) {
      const mine = possessed(plugins.wire.rows)
      if (!mine) return
      const shown = plugins.wire.rows.find(r => r.data.at === mine.data.station)
      if (shown) plugins.chasecamera3d.follow(shown.id)
    },
  }
}
