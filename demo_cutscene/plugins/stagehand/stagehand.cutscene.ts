// stagehand's mod for the cutscene (`addons/scenemanager`'s mods): the steps of demo_cutscene's own
// words, which its cue file (`assets/intro.json`) uses beside the cutscene's own `shot`, `bars` and
// `fade`. A scene with `world.cutscene.mods: { behaviors: ['stagehand'] }` and `stagehand` in
// `world.shipped.plugins` plays them (`plugins/cutscene/cutscene.sim.ts`, Steps a game brings).
//
//   open   who, over          the gate cast as `who` opens over `over` seconds, through its own
//                             closed act `open` (`gate.sim.ts`). A wait `on: "open"` holds the cue
//                             clock until that gate stands open, and at most the longest `over` of
//                             the file. It keeps the gate's row id under its word, `steps.open.gate`.
//   spawn  kind, name, where  a row of `kind` named `name` standing at `where`, a cast name, a mark's
//                             or a point on the ground; on a skip too, so the scene behind the menu
//                             has it.
//
// It is a mod only: stagehand has no row, no browser half and no numbers of its own. Every number the
// steps use is the cue's.
import type { Steps } from '#plugins/cutscene/cutscene.sim.ts'

export const behaviors = (): Steps => ({
  open: {
    fields: { who: 'who', over: 'positive' },
    fire({ w, who, cue, state }) {
      state.gate = who!.id
      w.call(who!, 'open', -1, cue.over)
    },
    wait: {
      holds: (d, w) => d.steps.open !== undefined && w.get(d.steps.open.gate).data.open < 1,
      longest: file => Math.max(0, ...file.cues.filter(c => c.do === 'open').map(c => c.over)),
    },
  },
  spawn: {
    fields: { kind: 'text', name: 'text', where: 'target' },
    fire({ w, cue, where }) {
      const at = where(cue.where)
      if (at) w.spawn(cue.kind, { name: cue.name, pos: at })
    },
  },
})
