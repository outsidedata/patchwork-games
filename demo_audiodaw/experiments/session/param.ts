// A Tone Volume and a Tone Channel handed exactly the calls `dip.ts` logged for audiodaw's automation
// slot at a look-ahead of 0.1 s, each sent at the audio time it was sent there: is the first set back,
// at 0.747, heard? The loudest of each 50 ms from 0.4 s to 1.6 s.
//
// Measured: both hear it. The logged times are rounded to the millisecond, which hides what `dip.ts`
// found: in audiodaw the set back's time fell a hair before the ramp's end.
//
// Run from the repo root: node_modules/.bin/vite-node games/demo_audiodaw/experiments/session/param.ts
import { run } from '../automation/live.ts'
import * as Tone from 'tone'

// [sent at, call, value, time], in seconds of the song.
type Call = [number, 'cancel' | 'set' | 'ramp', number, number]
const calls: Call[] = [
  [-0.099, 'cancel', 0, -0.003],
  [-0.099, 'set', -12, -0.003],
  [0.411, 'cancel', 0, 0.497],
  [0.411, 'set', -60, 0.497],
  [0.411, 'ramp', -60, 0.747],
  [0.664, 'set', -12, 0.747],
  [0.920, 'cancel', 0, 0.997],
  [0.920, 'set', -60, 0.997],
  [0.920, 'ramp', -60, 1.247],
  [1.171, 'set', -12, 1.247],
]

for (const [lookAhead, kind] of [[0.1, 'Volume'], [0.1, 'Channel']] as const) {
  const { samples, rate } = await run(1.6, (tr) => {
    Tone.getContext().lookAhead = lookAhead
    const synth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0, sustain: 1, release: 0.001 } })
    const vol = kind === 'Volume' ? new Tone.Volume(-12).toDestination() : new Tone.Channel({ volume: -12, pan: 0, mute: false, solo: false }).toDestination()
    synth.connect(vol)
    tr.schedule((time) => synth.triggerAttack('A4', time), 0)
    const zero = Tone.getContext().currentTime + 0.6
    for (const [sent, call, value, time] of calls) {
      setTimeout(() => {
        if (call === 'cancel') vol.volume.cancelScheduledValues(zero + time)
        else if (call === 'set') vol.volume.setValueAtTime(value, zero + time)
        else vol.volume.exponentialRampToValueAtTime(value, zero + time)
      }, Math.max(0, (0.6 + sent) * 1000))
    }
  }, 120)
  const windows: string[] = []
  for (let t = 0.4; t < 1.6; t += 0.05) {
    let most = 0
    for (let i = Math.floor(t * rate); i < Math.floor((t + 0.05) * rate); i++) most = Math.max(most, Math.abs(samples[i]!))
    windows.push(`${t.toFixed(2)}:${most.toFixed(3)}`)
  }
  console.log(`${kind}, look-ahead ${lookAhead}: ${windows.join(' ')}`)
}

process.exit(0)
