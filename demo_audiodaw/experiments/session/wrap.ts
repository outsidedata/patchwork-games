// A slot of audiodaw's session launched inside the song's loop, heard through the wraps, at two
// look-aheads: does the note on the loop's first tick sound after each wrap? Onsets in seconds of the
// song (120 bpm, a beat 0.5 s); the loop is the first second, the slot a note each beat launched on
// the second beat, so a note is due at 0.5, 1, 1.5, 2 and 2.5.
//
// Run from the repo root: node_modules/.bin/vite-node games/demo_audiodaw/experiments/session/wrap.ts
import { run } from '../automation/live.ts'
import * as Tone from 'tone'
import { audiodaw } from '#plugins/audiodaw/audiodaw.plugin.ts'
import type { Project } from '#plugins/audiodaw/audiodaw.sim.ts'

const beat = 192
const project: Project = {
  bpm: 120, timeSignature: 4, swing: 0, swingSubdivision: '8n', ppq: 192,
  rack: [{ name: 'a', instrument: { is: 'Synth', options: { oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0, sustain: 1, release: 0.001 } } }, effects: [], channel: { volume: 0, pan: 0, mute: false, solo: false }, sends: {} }],
  tracks: [{ kind: 'notes', name: 't', color: '#fff', target: 0, patterns: { x: { length: beat, notes: [{ time: 0, note: 'A4', duration: 24, velocity: 1 }] } }, slots: ['x'], mute: false, solo: false }],
  buses: {}, master: { volume: 0, effects: [] }, clips: [], scenes: [{ name: 'one' }], launch: beat, loop: { start: 0, end: 2 * beat },
}

function onsets(x: Float32Array, rate: number): number[] {
  const quiet = Math.floor(0.03 * rate)
  const out: number[] = []
  let last = -quiet
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]!) < 0.05) continue
    if (i - last >= quiet) out.push(Math.round((i / rate) * 1000) / 1000)
    last = i
  }
  return out
}

for (const lookAhead of [0.5, 0.1]) {
  const { samples, rate } = await run(2.8, (tr) => {
    Tone.getContext().lookAhead = lookAhead
    const daw = audiodaw()
    daw.load(project)
    daw.cycle(true)
    // The transport starts 0.6 s after setup; the press is 0.1 s into the song.
    setTimeout(() => daw.launch(0, 0), 700)
    void tr
  })
  console.log(`look-ahead ${lookAhead}: ${onsets(samples, rate).join(' ')}`)
}

process.exit(0)
