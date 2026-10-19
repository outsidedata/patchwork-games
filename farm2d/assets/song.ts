// Writes farm2d's song, `farmtune.json`, a synthaudio project (`plugins/synthaudio/synthaudio.sim.ts`),
// and checks it as the plugin will before anything plays it:
// `node --experimental-strip-types games/farm2d/assets/song.ts`, from the repo's root.
//
// A bright two-step in G at 116 bpm, eight bars round and round: a plucked lead singing the tune, a
// soft triangle playing the chords off the beat, a round bass on the one and the three, and a kit of
// kick, snare and hat. Bars 1–4 go G C D G, bars 5–8 G Em C D, and the tune answers itself.
// Beside the song's tracks are the game's sounds, each a track no clip places, played when a rule
// raises it: `pick` two bright square blips a fifth apart, a thing picked up; `put` a soft low triangle
// thump falling a fourth, a thing put down; `cluck` an FM squawk falling a fourth; `moo` a long low
// sawtooth lowing that slides down; `plop` a round sine drop falling an octave; `peck` a short sharp
// FM tick; `nibble` two tiny high square crunches; `fart` a cow's long sputtering one, timed to the
// gas of the effect of that name.
import { writeFileSync } from 'node:fs'
import { check, type Instrument, type Note, type Params, type Project } from '#plugins/synthaudio/synthaudio.sim.ts'

const BAR = 16
const BARS = 8

const instrument = (is: Instrument['is'], params: Params): Instrument => ({ is, params, presets: { farm: params }, loaded: 'farm' })

// The chords, a bar each: the notes the chord track plays and the bass's root.
const CHORDS: [string[], string][] = [
  [['G3', 'B3', 'D4'], 'G2'],
  [['C4', 'E4', 'G4'], 'C3'],
  [['D4', 'F#4', 'A4'], 'D3'],
  [['G3', 'B3', 'D4'], 'G2'],
  [['G3', 'B3', 'D4'], 'G2'],
  [['E3', 'G3', 'B3'], 'E2'],
  [['C4', 'E4', 'G4'], 'C3'],
  [['D4', 'F#4', 'A4'], 'D3'],
]

// The tune, a bar a line: [sixteenth in the bar, note, sixteenths long].
const TUNE: [number, string, number][][] = [
  [[0, 'D5', 2], [2, 'B4', 2], [4, 'G4', 2], [6, 'B4', 2], [8, 'D5', 4], [12, 'E5', 2], [14, 'D5', 2]],
  [[0, 'C5', 2], [2, 'E5', 2], [4, 'G5', 4], [8, 'E5', 2], [10, 'C5', 2], [12, 'E5', 4]],
  [[0, 'D5', 2], [2, 'F#5', 2], [4, 'A5', 2], [6, 'F#5', 2], [8, 'D5', 2], [10, 'E5', 2], [12, 'F#5', 4]],
  [[0, 'G5', 6], [6, 'D5', 2], [8, 'B4', 2], [10, 'A4', 2], [12, 'G4', 4]],
  [[0, 'B4', 2], [2, 'D5', 2], [4, 'G5', 2], [6, 'D5', 2], [8, 'B4', 2], [10, 'C5', 2], [12, 'D5', 4]],
  [[0, 'E5', 2], [2, 'G5', 2], [4, 'B5', 4], [8, 'G5', 2], [10, 'E5', 2], [12, 'D5', 4]],
  [[0, 'C5', 2], [2, 'E5', 2], [4, 'G5', 2], [6, 'E5', 2], [8, 'C5', 2], [10, 'D5', 2], [12, 'E5', 4]],
  [[0, 'F#5', 4], [4, 'E5', 2], [6, 'D5', 2], [8, 'A4', 2], [10, 'B4', 2], [12, 'C5', 2], [14, 'A4', 2]],
]

const lead: Note[] = TUNE.flatMap((bar, b) => bar.map(([at, note, len]): Note => [b * BAR + at, note, len, at % 4 === 0 ? 0.85 : 0.7]))
const chords: Note[] = CHORDS.flatMap(([notes], b) => [2, 6, 10, 14].flatMap(at => notes.map((n): Note => [b * BAR + at, n, 2, 0.45])))
const bass: Note[] = CHORDS.flatMap(([, root], b) => {
  const fifth = { G2: 'D3', C3: 'G3', D3: 'A3', E2: 'B2' }[root]!
  return [[b * BAR, root, 3, 0.9], [b * BAR + 8, fifth, 3, 0.8]] as Note[]
})
const drums: Note[] = Array.from({ length: BARS }, (_, b) => [
  [b * BAR, 'kick', 1, 1], [b * BAR + 8, 'kick', 1, 0.9],
  [b * BAR + 4, 'snare', 1, 0.7], [b * BAR + 12, 'snare', 1, 0.7],
  ...[2, 6, 10, 14].map(at => [b * BAR + at, 'hat', 1, 0.5]),
] as Note[]).flat()

const track = (inst: Instrument, notes: Note[]) => ({ instrument: inst, patterns: { song: { length: BAR * BARS, notes } }, clips: [[0, 'song', 1] as [number, string, number]] })
// A sound, not a part of the song: its one pattern, `fx`, placed by no clip, so the song never plays
// it; the game plays it when a rule raises its sound (`plugins/jukebox`).
const sound = (inst: Instrument, notes: Note[]) => ({ instrument: inst, patterns: { fx: { length: Math.max(...notes.map(([at, , len]) => at + len)), notes } }, clips: [] })

const project: Project = {
  bpm: 116,
  length: BAR * BARS,
  master: {
    compressor: { threshold: -18, ratio: 3, attack: 0.01, release: 0.2 },
    limiter: -1,
    echo: { time: '8n', feedback: 0.25 },
    room: { decay: 1.8 },
  },
  tracks: {
    lead: track(instrument('pluck', { brightness: 5200, resonance: 0.92, release: 0.6, echo: 0.2, room: 0.25, gain: 0.75, pan: 0.1 }), lead),
    chords: track(instrument('synth', { wave: 'triangle', attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.12, echo: 0, room: 0.2, gain: 0.22, pan: -0.15 }), chords),
    bass: track(instrument('monosynth', { wave: 'triangle', attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.15, cutoff: 900, resonance: 1, echo: 0, room: 0.05, gain: 0.55, pan: 0 }), bass),
    drums: track(instrument('drumkit', {
      pads: {
        kick: { voice: 'membrane', pitch: 'C1', decay: 0.3, gain: 0.8 },
        snare: { voice: 'noise', decay: 0.12, gain: 0.3 },
        hat: { voice: 'metal', pitch: 'C6', decay: 0.04, gain: 0.08 },
      },
      echo: 0, room: 0.1, gain: 0.6, pan: 0,
    }), drums),
    // The sounds: picked up, put down, a hen clucking, a cow lowing, manure dropping, a peck, a bug
    // nibbling.
    pick: sound(instrument('synth', { wave: 'square', attack: 0.002, decay: 0.07, sustain: 0, release: 0.05, echo: 0, room: 0, gain: 0.35, pan: 0 }), [
      [0, 'E6', 1, 0.9],
      [1, 'B6', 1, 0.9],
    ]),
    put: sound(instrument('synth', { wave: 'triangle', attack: 0.002, decay: 0.09, sustain: 0, release: 0.06, echo: 0, room: 0.1, gain: 0.5, pan: 0 }), [
      [0, 'G3', 1, 0.9],
      [1, 'D3', 1, 0.8],
    ]),
    cluck: sound(instrument('fmsynth', { wave: 'square', attack: 0.004, decay: 0.06, sustain: 0.1, release: 0.04, harmonicity: 3.5, modulation: 14, echo: 0, room: 0, gain: 0.3, pan: 0 }), [
      [0, 'D5', 1, 0.9],
      [1, 'A4', 1, 0.7],
    ]),
    moo: sound(instrument('monosynth', { wave: 'sawtooth', attack: 0.08, decay: 0.3, sustain: 0.7, release: 0.35, cutoff: 700, resonance: 2, echo: 0, room: 0.2, gain: 0.32, pan: 0 }), [
      [0, 'A2', 3, 0.8],
      [3, 'F2', 4, 0.7],
    ]),
    plop: sound(instrument('synth', { wave: 'sine', attack: 0.002, decay: 0.12, sustain: 0, release: 0.08, echo: 0, room: 0.05, gain: 0.5, pan: 0 }), [
      [0, 'C4', 1, 0.9],
      [1, 'C3', 1, 0.8],
    ]),
    peck: sound(instrument('fmsynth', { wave: 'square', attack: 0.001, decay: 0.03, sustain: 0, release: 0.02, harmonicity: 5, modulation: 20, echo: 0, room: 0, gain: 0.22, pan: 0 }), [
      [0, 'A6', 1, 0.9],
    ]),
    nibble: sound(instrument('synth', { wave: 'square', attack: 0.001, decay: 0.025, sustain: 0, release: 0.02, echo: 0, room: 0, gain: 0.12, pan: 0 }), [
      [0, 'F7', 1, 0.7],
      [1, 'D7', 1, 0.6],
    ]),
    // A cow's long fart: after a held breath, a low raspy FM sputter wobbling about D2 and sagging, a
    // long low blat, and a last squeak.
    fart: sound(instrument('fmsynth', { wave: 'square', attack: 0.01, decay: 0.08, sustain: 0.85, release: 0.05, harmonicity: 0.5, modulation: 9, echo: 0, room: 0.05, gain: 0.42, pan: 0 }), [
      ...(['D2', 'C#2', 'D#2', 'D2', 'C2', 'D2', 'B1', 'C#2', 'C2', 'A#1', 'C2', 'A1'] as const).map((note, i): Note => [5 + i, note, 1, i % 2 ? 0.7 : 0.95]),
      [17, 'G#1', 3, 0.9],
      [20, 'E3', 1, 0.6],
    ]),
  },
}

check(project)
writeFileSync(new URL('./farmtune.json', import.meta.url), JSON.stringify(project, null, 1) + '\n')
