// What Tone.Part does on its own, for clips that loop and clips launched on the bar: each case is
// rendered offline and the onsets of its notes printed in ticks (120 bpm, 192 a beat, 384 ticks a
// second, a bar 768), beside the ticks a DAW would play them at.
//
//   1. A looping Part started on a whole bar far into the song (7680): does the note on each pass's
//      first tick sound (the "a hair off the whole tick" fault audiodaw met with transport.schedule)?
//   2. A looping Part with a loop region (`loopStart`, `loopEnd`) and a start offset into it.
//   3. The transport cycling over a looping Part: does the note on the transport loop's first tick
//      sound on every wrap?
//   4. A Part started and stopped at "@1m" from inside a transport callback while playing.
//   5. A note added to a playing looping Part: heard from its next pass.
//   6. A Part whose start is behind the transport when it is made: does it play from where the song is?
//   7. A locate (transport.ticks = t) while a looping Part plays.
//   8. Swing on a looping Part.
//
// Measured (Tone 15.1.22): every case prints OK but 6 and 10, which print no notes at all. Those make
// a Part from inside a transport callback, which Tone.Offline runs before it renders; played live
// (`launch.ts` A and J) both play from where the song is. Onsets land within a tick or two of the
// whole tick (the onset is read where the square wave first crosses its level).
//
// Run from the repo root: node_modules/.bin/vite-node games/demo_audiodaw/experiments/session/part.ts
import '#plugins/audiodaw/nodeaudio.ts'
import * as Tone from 'tone'

const PPQ = 192
const RATE = 384 // ticks a second at 120 bpm
const BAR = 768
const t = (n: number) => `${n}i`

type Note = { time: string; note: string }

// The ticks the notes of a render start at: every sample above a level after 30 ms of quiet.
function onsets(buffer: Tone.ToneAudioBuffer): number[] {
  const data = buffer.toArray(0) as Float32Array
  const rate = buffer.sampleRate
  const quiet = Math.floor(0.03 * rate)
  const out: number[] = []
  let last = -quiet
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]!) < 0.05) continue
    if (i - last >= quiet) out.push(Math.round((i / rate) * RATE))
    last = i
  }
  return out
}

async function run(name: string, seconds: number, expected: number[], setup: (transport: ReturnType<typeof Tone.getTransport>, synth: Tone.Synth) => void) {
  const buffer = await Tone.Offline(({ transport }) => {
    transport.PPQ = PPQ
    transport.bpm.value = 120
    const synth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0, sustain: 1, release: 0.001 } }).toDestination()
    setup(transport, synth)
    transport.start()
  }, seconds)
  const got = onsets(buffer)
  const ok = got.length === expected.length && got.every((g, i) => Math.abs(g - expected[i]!) <= 2)
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}\n     got      ${got.join(' ')}\n     expected ${expected.join(' ')}`)
}

const part = (synth: Tone.Synth, notes: Note[]) => new Tone.Part<Note>((time, n) => synth.triggerAttackRelease(n.note, t(24), time), notes)

// 1. Loops a one-beat pattern (a note on its first tick) from tick 7680, four passes.
await run('1. a looping Part from tick 7680 sounds the note on every pass\'s first tick', 22, [7680, 7872, 8064, 8256], (_tr, synth) => {
  const p = part(synth, [{ time: t(0), note: 'A4' }])
  p.loop = true
  p.loopEnd = t(PPQ)
  p.start(t(7680))
  p.stop(t(7680 + 4 * PPQ))
})

// 2. A pattern of two beats with notes at 0, 96, 192 and 288; its loop region from 96 to 288; started
// at tick 768 with an offset of 96 into the region (so at tick 192 of the pattern).
await run('2. a loop region and a start offset', 5, [768, 864, 960, 1056, 1152, 1248], (_tr, synth) => {
  const p = part(synth, [0, 96, 192, 288].map(n => ({ time: t(n), note: 'A4' })))
  p.loop = true
  p.loopStart = t(96)
  p.loopEnd = t(288)
  p.start(t(768), t(96 + 96))
  p.stop(t(768 + 6 * 96))
})

// 3. The transport cycles 0 to one bar; the Part loops a beat with a note on its first tick.
await run('3. the transport cycling over a looping Part sounds the note on its loop\'s first tick each wrap', 4.1, [0, 192, 384, 576, 768, 960, 1152, 1344, 1536], (tr, synth) => {
  tr.setLoopPoints(t(0), t(BAR))
  tr.loop = true
  const p = part(synth, [{ time: t(0), note: 'A4' }])
  p.loop = true
  p.loopEnd = t(PPQ)
  p.start(t(0))
})

// 4. At tick 900 a callback starts a looping one-beat Part at "@1m" (tick 1536) and at tick 1800
// stops it at "@1m" (tick 2304).
await run('4. started and stopped at "@1m" from a callback', 7, [1536, 1728, 1920, 2112], (tr, synth) => {
  const p = part(synth, [{ time: t(0), note: 'A4' }])
  p.loop = true
  p.loopEnd = t(PPQ)
  tr.schedule(() => p.start('@1m'), t(900))
  tr.schedule(() => p.stop('@1m'), t(1800))
})

// 5. A looping bar with a note at 0; a note at 384 added at tick 1100, in its second pass, whose 384
// (1152) is still to come: heard there already, and on every pass after.
await run('5. a note added to a playing Part is heard from its next tick to come', 6, [0, 768, 1152, 1536, 1920], (tr, synth) => {
  const p = part(synth, [{ time: t(0), note: 'A4' }])
  p.loop = true
  p.loopEnd = t(BAR)
  p.start(t(0))
  p.stop(t(3 * BAR))
  tr.schedule(() => p.add({ time: t(384), note: 'A4' }), t(1100))
})

// 6. At tick 900 a one-bar looping Part is made that starts at tick 0, notes at 0 and 384: it plays
// from where the song is, so 1152 (pass 1's 384), 1536, 1920.
await run('6. a Part made behind the transport plays from where the song is', 5.5, [1152, 1536, 1920], (tr, synth) => {
  tr.schedule(() => {
    const p = part(synth, [0, 384].map(n => ({ time: t(n), note: 'A4' })))
    p.loop = true
    p.loopEnd = t(BAR)
    p.start(t(0))
    p.stop(t(2 * BAR + 500))
  }, t(900))
})

// 7. A one-beat looping Part from 0; at tick 500 the transport is located to tick 1000: the next
// note is at 1152 of the song, heard 500 ticks after the locate... the onset ticks below are the
// render's own clock, so the locate shows as the gap from 384 to 652 (1152 - 1000 + 500).
await run('7. a locate while a looping Part plays', 3, [0, 192, 384, 652, 844, 1036], (tr, synth) => {
  const p = part(synth, [{ time: t(0), note: 'A4' }])
  p.loop = true
  p.loopEnd = t(PPQ)
  p.start(t(0))
  tr.schedule(() => { tr.ticks = 1000 }, t(500))
})

// 8. Swing 0.5 on 8ths over a looping beat with notes on both 8ths: the off-beat 8th is late. The
// render's last moment holds the downbeat at 768.
await run('8. swing on a looping Part (off-beat 8ths late, by Tone\'s swing)', 2.1, [0, 128, 192, 320, 384, 512, 576, 704, 768], (tr, synth) => {
  tr.swing = 0.5
  tr.swingSubdivision = '8n'
  const p = part(synth, [0, 96].map(n => ({ time: t(n), note: 'A4' })))
  p.loop = true
  p.loopEnd = t(PPQ)
  p.start(t(0))
})

// 9. A one-bar looping Part from tick 0 (notes at 0 and 384), the transport started at tick 1000:
// it plays from where it is, 1152 of the song first, heard 152 ticks in.
await run('9. play started in the middle of a looping Part', 3, [152, 536, 920], (tr, synth) => {
  const p = part(synth, [0, 384].map(n => ({ time: t(n), note: 'A4' })))
  p.loop = true
  p.loopEnd = t(BAR)
  p.start(t(0))
  tr.stop()
  tr.start(undefined, t(1000))
})

// 10. At tick 900 a one-bar looping Part of a clip that began at tick 0 (notes at 0 and 384) is made,
// started at the next tick with its offset into the clip's pass: 1152, 1536, 1920.
await run('10. a Part made behind the transport, started now with its offset into the pass', 5.5, [1152, 1536, 1920], (tr, synth) => {
  tr.schedule((time) => {
    const now = Math.floor(tr.getTicksAtTime(time)) + 1
    const p = part(synth, [0, 384].map(n => ({ time: t(n), note: 'A4' })))
    p.loop = true
    p.loopEnd = t(BAR)
    p.start(t(now), t((now - 0) % BAR))
    p.stop(t(2 * BAR + 500))
  }, t(900))
})

// 11. The transport cycling from tick 7680 to 9216, over a one-bar looping Part started at 7680 with
// a note on its first tick: it sounds on every wrap. Onsets are the render's clock: the transport
// starts at 7680.
await run('11. a song loop starting where a looping Part starts', 8.1, [0, 768, 1536, 2304, 3072], (tr, synth) => {
  tr.setLoopPoints(t(7680), t(9216))
  tr.loop = true
  const p = part(synth, [{ time: t(0), note: 'A4' }])
  p.loop = true
  p.loopEnd = t(BAR)
  p.start(t(7680))
  tr.stop()
  tr.start(undefined, t(7680))
})

process.exit(0)
