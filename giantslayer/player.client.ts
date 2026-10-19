// The hero's keys and camera, for the seat's own row alone; anim draws the body of every seat's.
// w a s d are the stick, sent as `move`; shift held runs; space jumps. A click takes the pointer, and
// the mouse moved under it turns the camera (`look`), which chasecamera3d sits on.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds } from '#plugins/player/player.plugin.ts'

let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  plugins.chasecamera3d.follow(row.id)
  plugins.player.bind({
    stick: [{ keys: ['a', 'd', 'w', 's'], send: (x, y) => ['move', x, y] }],
    hold: [{ keys: ['Shift'], send: v => ['run', v] }],
    press: { ' ': ['jump'] },
    pointer: (dx, dy) => ['look', dx, dy],
  } satisfies Binds)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
