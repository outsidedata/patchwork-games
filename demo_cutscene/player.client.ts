// One seat's keys: any key or click skips the intro, through the cutscene's open act `skip`, while
// it runs.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'

let skip: (() => void) | undefined

export function setup(_row: Row, plugins: Plugins) {
  skip = () => {
    const cutscene = plugins.wire.rows.find(r => r.kind === 'cutscene')
    if (cutscene?.data.running && !cutscene.data.skip) plugins.wire.send(cutscene.id, 'skip')
  }
  addEventListener('keydown', skip)
  addEventListener('pointerdown', skip)
}

export function tick() {}

export function remove() {
  if (!skip) return
  removeEventListener('keydown', skip)
  removeEventListener('pointerdown', skip)
  skip = undefined
}
