// The `library` row: the builds of the truth it is in, as every seat sees them. On its first step it asks the game's
// addon (`addons/library/library.addon.ts`) to write pro-ng's list, every kit kind and landmark there is, into
// `builds/library.json`, starts it watching the library's pro-ng (`watch`), and marks itself `listed`. Its `build` act, open to every seat, asks the addon for a build:
// `build('kit', kind, values)` for one kit kind with `values`, a JSON object of keys, over its studio defaults,
// `build('scene', scene)` for a scene of pro-ng's, `build('effects', kind, file)` for a kit kind's effects saved
// into pro-ng's `kit/<kind>.effects.json` (`file` its JSON), `build('materials', '', names)` for every material on
// its swatch (`names` a JSON list: only those, when it names any), or `build('list')` for the list again. Each step it copies what the
// truth's builds have come to onto its fields: `asked`, `done`, `running` and `error`, and `changed` and `file`, how
// many times the library's pro-ng has changed and its last file to (the addon's `State`). A page
// reloads onto a build once `done` reaches the number it asked for.
import type { Kind } from '#engine/engine.ts'
import { start, state, watch, type Ask } from './addons/library/library.addon.ts'

const ask = (what: string, name: string, values: string): Ask =>
  what === 'kit' ? { kit: name, values: JSON.parse(values) } : what === 'scene' ? { scene: name }
    : what === 'effects' ? { effects: name, file: JSON.parse(values) }
      : what === 'materials' ? { materials: JSON.parse(values) as string[] } : { list: true }

export const library: Kind = {
  tick(me, _dt, w) {
    if (!me.data.listed) {
      me.data.listed = true
      start(w.world, { list: true })
      watch(w.world)
    }
    Object.assign(me.data, state(w.world))
  },
  acts: {
    build(me, w, _seat, what: string, name = '', values = '{}') {
      start(w.world, ask(what, name, values))
      Object.assign(me.data, state(w.world))
    },
  },
  open: ['build'],
}
