// One seat's keys. The seat's row is paddock's `keeper`, which is no animal: 1 to 5 set the pace every
// animal goes at, from a stand to the fastest; t poses every animal as its next puppet (on four legs,
// upright); [ and ] step back and on a station; q and e turn the camera round what it looks at. Only the
// seat's own row binds them (`mine`); this file is a fresh copy for each row.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds } from '#plugins/player/player.plugin.ts'

let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  plugins.player.bind({
    press: {
      1: ['gait', 0], 2: ['gait', 1], 3: ['gait', 2], 4: ['gait', 3], 5: ['gait', 4],
      t: ['puppet'], '[': ['station', -1], ']': ['station', 1],
    },
    axis: [{ keys: ['q', 'e'], send: v => ['orbit', v] }],
  } satisfies Binds)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
