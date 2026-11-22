// An automation slot of audiodaw's session on a device's volume, heard live: the loudest of each 50 ms,
// to see each pass of its line. The device holds a note at −12 dB; the slot, a beat long (0.5 s at 120
// bpm), dips the volume to −60 dB for the first half of each beat from the beat it comes in on (0.5 s).
// It logs every call made on the song's Params with the audio time it was sent at, and the channel's
// gain read from Web Audio every 20 ms.
//
// Measured: at a look-ahead of 0.1 s the first pass never let go of the dip, in a slot and in an
// arrangement clip alike, though its set back was sent on time. The note's end, the time Tone hands
// its event, came a hair before the line's last ramp, worked out from ticks, so Web Audio ramped from
// the set back down to the line's last value and held it there. `restore` now sets a note's end no
// earlier than its line's last ramp ends, and every pass dips and lets go.
//
// Run from the repo root: node_modules/.bin/vite-node games/demo_audiodaw/experiments/session/dip.ts
import { run } from '../automation/live.ts'
import * as Tone from 'tone'
import { audiodaw } from '#plugins/audiodaw/audiodaw.plugin.ts'
import { automationNote, type Project } from '#plugins/audiodaw/audiodaw.sim.ts'

const beat = 192
const project: Project = {
  bpm: 120, timeSignature: 4, swing: 0, swingSubdivision: '8n', ppq: 192,
  rack: [{ name: 'a', instrument: { is: 'Synth', options: { oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0, sustain: 1, release: 0.001 } } }, effects: [], channel: { volume: -12, pan: 0, mute: false, solo: false }, sends: {} }],
  tracks: [
    { kind: 'notes', name: 't', color: '#fff', target: 0, patterns: { a: { length: 8 * 384, notes: [{ time: 0, note: 'A4', duration: 8 * 384, velocity: 1 }] } }, mute: false, solo: false },
    { kind: 'automation', name: 'dip', color: '#0af', target: { part: 'volume', strip: { device: 0 } }, patterns: { d: { length: beat, notes: [automationNote(0, beat / 2, 0, 0)] } }, slots: ['d'], mute: false },
  ],
  buses: {}, master: { volume: 0, effects: [] }, clips: [{ track: 0, pattern: 'a', start: 0 }], scenes: [{ name: 'one' }], launch: beat,
}

// Every set, ramp and cancel on a decibel Param, with its audio time from the transport's start.
const log: string[] = []
let zero = 0
const ids = new Map<object, number>()
for (const name of ['setValueAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime', 'cancelScheduledValues', 'setTargetAtTime', 'cancelAndHoldAtTime', 'setValueCurveAtTime', 'rampTo', 'targetRampTo', 'exponentialRampTo', 'linearRampTo', 'setRampPoint'] as const) {
  const was = Tone.Param.prototype[name] as (...a: unknown[]) => unknown
  ;(Tone.Param.prototype as unknown as Record<string, unknown>)[name] = function (this: Tone.Param, ...a: unknown[]) {
    if (this.units !== 'frequency' && this.units !== 'cents') {
      const time = name === 'cancelScheduledValues' ? a[0] : a[1]
      log.push(`${name.replace('ValueAtTime', '').replace('ScheduledValues', '')}(${name === 'cancelScheduledValues' ? '' : Number(a[0]).toFixed(1) + ', '}${(Number(time) - zero).toFixed(3)}) sent at ${(Tone.getContext().currentTime - zero).toFixed(3)} on ${this.units} ${(this as unknown as { name: string; _id?: number }).name}#${ids.get(this) ?? ids.set(this, ids.size).get(this)}`)
    }
    return was.apply(this, a)
  }
}

// `node dip.ts <look-ahead> [arranged]`: with `arranged`, the same line is an arrangement clip of four
// beats from 0.5 s, not a slot.
const looks = process.argv.slice(2).filter(a => a !== 'arranged').map(Number)
const arranged = process.argv.includes('arranged')
const song: Project = arranged ? { ...project, clips: [...project.clips, { track: 1, pattern: 'd', start: beat, length: 4 * beat }] } : project
for (const lookAhead of looks.length ? looks : [0.5, 0.1]) {
  log.length = 0
  const { samples, rate } = await run(2.4, () => {
    Tone.getContext().lookAhead = lookAhead
    const daw = audiodaw()
    daw.load(song, () => ({ min: -60, max: 0 }))
    zero = Tone.getContext().currentTime + 0.6
    if (!arranged) setTimeout(() => daw.launch(1, 0), 700)
    // The channel's volume as Web Audio holds it, every 20 ms from 0.4 s to 1.3 s of the song.
    const vol = [...ids.keys()].find(p => (p as Tone.Param).units === 'decibels' && ids.get(p) === 5) as Tone.Param<'decibels'> | undefined
    const raw = (vol as unknown as { _param: AudioParam } | undefined)?._param
    const seen: string[] = []
    const poll = setInterval(() => {
      const t = Tone.getContext().currentTime - zero
      if (t < 0.4 || t > 1.3 || !raw) return
      seen.push(`${t.toFixed(2)}:${raw.value.toFixed(3)}`)
    }, 20)
    setTimeout(() => { clearInterval(poll); console.log(`gain heard: ${seen.join(' ')}`) }, 2200)
  }, 120)
  console.log(log.join('\n'))
  const windows: string[] = []
  for (let t = 0; t < 2.4; t += 0.05) {
    let most = 0
    for (let i = Math.floor(t * rate); i < Math.floor((t + 0.05) * rate); i++) most = Math.max(most, Math.abs(samples[i]!))
    windows.push(`${t.toFixed(2)}:${most.toFixed(3)}`)
  }
  console.log(`look-ahead ${lookAhead}\n${windows.join(' ')}`)
}

process.exit(0)
