// The gate: two leaves that swing open. `open` runs from 0, shut, to 1, open, at `rate` a second
// once its closed act `open(over)` sets `rate` to 1 / `over`; nothing else moves it. It is a cast kind
// of the cutscene (`plugins/cutscene/cutscene.sim.ts`, the contract of a cast kind): it carries `name`
// and `direct`, which it takes and ignores, since nothing about a gate is walked or played, and
// `advance(dt)` runs exactly its own step, so a skip opens it as a played scene does.
import type { Kind, Row } from '#engine/engine.ts'

const step = (me: Row, dt: number) => {
  const d = me.data
  if (d.rate > 0) d.open = Math.min(1, d.open + d.rate * dt)
}

export const gate: Kind = {
  tick(me, dt) { step(me, dt) },
  acts: {
    open(me, _w, _seat, over: number) { me.data.rate = 1 / over },
    advance(me, _w, _seat, dt: number) { step(me, dt) },
  },
}
