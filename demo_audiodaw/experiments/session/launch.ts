// What Tone.Part does when a page starts and stops it while the transport plays, in a live context
// (`../automation/live.ts`), since Tone.Offline runs every transport callback before it renders
// (part.ts's cases 6 and 10 printed nothing offline). A press on a page is a call from outside the
// transport, so each case here calls from a setTimeout, at a wall time into the song. Onsets are in
// ticks of the song (120 bpm, 192 a beat, 384 ticks a second, a bar 768).
//
//   A. A looping Part whose start is behind the transport when it is made (a clip added under the
//      playhead): does it play from where the song is?
//   B. The same, started at the next tick the transport has not handed over yet, with its offset into
//      its pass.
//   C. A looping Part started at "@1m" and stopped at "@1m".
//   C2, D. As C, the bar worked out from Tone's ticks; one Part stopped and another started there.
//   E. A press within the look-ahead of a bar.
//   F, G, H. A Part started on the song loop's start while the transport cycles, three ways.
//   I, I2. A Part launched inside the song's loop, over the wrap, left alone and anchored again.
//   J. As A, from inside a transport callback.
//
// Measured (Tone 15.1.22, look-ahead 0.5 s): A, B, C2, D, E, H, I2 and J print OK. C, F, G and I
// print FAIL, and are the faults audiodaw works around: "@1m" from a press lands off the bar (C); a
// Part started on the loop's start before the wrap reads as started already and plays at once (F);
// one started from a one-off event on the loop's start plays its first note and no pass after (G);
// one launched inside the loop is silent after the wrap until its own start comes round (I). So
// audiodaw works out the bar from Tone's ticks (C2), starts a launch that waits for the wrap from
// the transport's 'loop' event (H), and anchors every playing slot again on each wrap (I2).
//
// Run from the repo root: node_modules/.bin/vite-node games/demo_audiodaw/experiments/session/launch.ts
import { run } from '../automation/live.ts'
import * as Tone from 'tone'

const PPQ = 192
const RATE = 384
const BAR = 768
const t = (n: number) => `${n}i`
type Note = { time: string; note: string }

function onsets(x: Float32Array, rate: number): number[] {
  const quiet = Math.floor(0.03 * rate)
  const out: number[] = []
  let last = -quiet
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]!) < 0.05) continue
    if (i - last >= quiet) out.push(Math.round((i / rate) * RATE))
    last = i
  }
  return out
}

const synth = () => new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0, sustain: 1, release: 0.001 } }).toDestination()
const looping = (s: Tone.Synth, notes: number[], length: number, pitch = 'A4') => {
  const p = new Tone.Part<Note>((time, n) => s.triggerAttackRelease(n.note, t(24), time), notes.map(n => ({ time: t(n), note: pitch })))
  p.loop = true
  p.loopEnd = t(length)
  return p
}
// A press at `seconds` of the song: the transport starts 0.6 s after setup.
const press = (seconds: number, f: () => void) => setTimeout(f, (0.6 + seconds) * 1000)

async function check(name: string, seconds: number, expected: number[], setup: (tr: ReturnType<typeof Tone.getTransport>) => void) {
  const { samples, rate } = await run(seconds, (tr) => {
    tr.PPQ = PPQ
    // A click at tick 0 on a synth of its own: where the capture puts tick 0, taken off every onset.
    const ref = synth()
    tr.schedule((time) => ref.triggerAttackRelease('C3', t(12), time), t(0))
    setup(tr)
  }, 120)
  const all = onsets(samples, rate)
  const zero = all[0]!
  const got = all.slice(1).map(g => g - zero)
  if (expected[0] === 0) expected = expected.slice(1)
  const ok = got.length === expected.length && got.every((g, i) => Math.abs(g - expected[i]!) <= 2)
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}\n     got      ${got.join(' ')}\n     expected ${expected.join(' ')}`)
}

// A. At 2.4 s (tick 922) a one-bar looping Part of notes 0 and 384 is made, started at tick 0.
await check('A. a Part made behind the transport', 5.5, [1152, 1536, 1920], () => {
  const s = synth()
  press(2.4, () => {
    const p = looping(s, [0, 384], BAR)
    p.start(t(0))
    p.stop(t(2 * BAR + 500))
  })
})

// B. The same, started at the first tick the transport has not handed over (its ticks at the
// context's now(), which is the look-ahead past what is heard), with its offset into the pass.
await check('B. a Part made behind the transport, started past the look-ahead with its offset', 5.5, [1152, 1536, 1920], () => {
  const s = synth()
  press(2.4, () => {
    const tr = Tone.getTransport()
    const next = Math.floor(tr.getTicksAtTime(Tone.now())) + 1
    const p = looping(s, [0, 384], BAR)
    p.start(t(next), t(next % BAR))
    p.stop(t(2 * BAR + 500))
  })
})

// C. At 0.9 s (tick 346) a one-beat Part is started at "@1m" (768); at 2.9 s (tick 1114) stopped at
// "@1m" (1536).
await check('C. started and stopped at "@1m" from a press', 4.5, [768, 960, 1152, 1344], () => {
  const s = synth()
  const p = looping(s, [0], PPQ)
  press(0.9, () => p.start('@1m'))
  press(2.9, () => p.stop('@1m'))
})

// The next bar the transport has not handed over: its ticks at the context's now() (the look-ahead
// past what is heard), up to the bar.
const nextBar = () => Math.ceil(Tone.getTransport().getTicksAtTime(Tone.now()) / BAR) * BAR

// C2. As C, the bar worked out from Tone's ticks.
await check('C2. started and stopped on the next bar of the transport\'s ticks', 4.5, [768, 960, 1152, 1344], () => {
  const s = synth()
  const p = looping(s, [0], PPQ)
  press(0.9, () => p.start(t(nextBar())))
  press(2.9, () => p.stop(t(nextBar())))
})

// D. A one-beat Part (A4) plays from 0; at 2.9 s (tick 1114) it is stopped on the next bar and a
// half-beat Part (E5) started there: A4 at 0 192 … 1344, then E5 from 1536 every 96.
await check('D. one stopped and another started on the next bar at one press', 4.6, [0, 192, 384, 576, 768, 960, 1152, 1344, 1536, 1632, 1728], () => {
  const s = synth()
  const a = looping(s, [0], PPQ)
  a.start(t(0))
  const b = looping(s, [0], PPQ / 2, 'E5')
  press(2.9, () => {
    const q = nextBar()
    a.stop(t(q))
    b.start(t(q))
  })
})

// E. A press within the look-ahead of a bar: at 1.85 s (tick 710) the bar at 768 is 0.15 s away, less
// than the 0.5 s Tone has already handed over, so the next bar is 1536.
await check('E. a press within the look-ahead of a bar goes to the bar after', 4.6, [1536, 1728], () => {
  const s = synth()
  const p = looping(s, [0], PPQ)
  press(1.85, () => p.start(t(nextBar())))
})

// F. The transport cycling over the first two bars; at 2.9 s (tick 1114) a one-beat Part started on
// the next bar, which is the loop's end: Tone wraps there, so the Part starts at the loop's start
// (heard at 1536 of the render's clock, tick 0 of the song). The onsets below are the render's
// clock: 1536, 1728, 1920, 2112, 2304.
await check('F. the next bar at the loop\'s end, while cycling, starts on the loop\'s start', 6.1, [1536, 1728, 1920, 2112, 2304], (tr) => {
  tr.setLoopPoints(t(0), t(2 * BAR))
  tr.loop = true
  const s = synth()
  const p = looping(s, [0], PPQ)
  press(2.9, () => {
    const q = nextBar()
    p.start(t(q >= 2 * BAR ? 0 : q))
  })
})

// G. As F, the Part started from a one-off transport event on the loop's start, at the time the
// event is handed (`time`), so it starts on the wrap and not before.
await check('G. while cycling, started from a one-off event on the loop\'s start', 6.1, [1536, 1728, 1920, 2112, 2304], (tr) => {
  tr.setLoopPoints(t(0), t(2 * BAR))
  tr.loop = true
  const s = synth()
  const p = looping(s, [0], PPQ)
  press(2.9, () => {
    const id = tr.scheduleOnce((time) => {
      tr.clear(id)
      p.start(time)
    }, t(0))
  })
})

// H. As F, the Part started from the transport's 'loop' event, which Tone emits on the wrap before it
// hands over the loop's first tick, so a note there is still to come.
await check('H. while cycling, started from the transport\'s loop event', 6.1, [1536, 1728, 1920, 2112, 2304], (tr) => {
  tr.setLoopPoints(t(0), t(2 * BAR))
  tr.loop = true
  const s = synth()
  const p = looping(s, [0], PPQ)
  press(2.9, () => {
    const wrap = () => {
      tr.off('loop', wrap)
      p.start(t(0))
    }
    tr.on('loop', wrap)
  })
})

// J. As A, the Part made from inside a transport callback at tick 922 rather than a press.
await check('J. a Part made behind the transport inside a transport callback', 5.5, [1152, 1536, 1920], (tr) => {
  const s = synth()
  tr.schedule(() => {
    const p = looping(s, [0, 384], BAR)
    p.start(t(0))
    p.stop(t(2 * BAR + 500))
  }, t(922))
})

// I. The transport cycling over two bars; a one-beat Part started on the next bar (768) from a press
// at tick 346. On the render's clock: 768 960 1152 1344, then past the wrap 1536 (tick 0 of the song)
// 1728 1920 2112 2304 2496 2688 2880.
const cycled = [768, 960, 1152, 1344, 1536, 1728, 1920, 2112, 2304, 2496, 2688, 2880]
await check('I. launched inside the loop, left alone over the wrap', 7.6, cycled, (tr) => {
  tr.setLoopPoints(t(0), t(2 * BAR))
  tr.loop = true
  const s = synth()
  const p = looping(s, [0], PPQ)
  press(0.9, () => p.start(t(nextBar())))
})

// I2. As I, and on every wrap the Part is anchored again on the loop's start: stopped there and started
// there with its offset, the ticks it has played since it was launched, round its pass.
await check('I2. launched inside the loop, anchored again on the loop\'s start at each wrap', 7.6, cycled, (tr) => {
  tr.setLoopPoints(t(0), t(2 * BAR))
  tr.loop = true
  const s = synth()
  const p = looping(s, [0], PPQ)
  let anchor = 0
  press(0.9, () => {
    anchor = nextBar()
    p.start(t(anchor))
  })
  tr.on('loop', () => {
    // The song's ticks since the launch at the wrap: from the anchor to the loop's end.
    const since = 2 * BAR - anchor
    anchor = -since
    p.stop(t(0))
    p.start(t(0), t(((since % PPQ) + PPQ) % PPQ))
  })
})

process.exit(0)
