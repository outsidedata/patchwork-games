import { describe, expect, it } from 'vitest'
import { passes, type Project } from '#plugins/audiodaw/audiodaw.sim.ts'
import { BAR, BEAT, resizeClip } from './edits.ts'

// One track of a bar's pattern, a note on each beat, and a clip of it at bar 2 and another at bar 5.
function song(): Project {
  return {
    bpm: 120, timeSignature: 4, swing: 0, swingSubdivision: '8n', ppq: 192,
    rack: [],
    tracks: [{ kind: 'notes', name: 't', color: '#fff', patterns: { a: { length: BAR, notes: [0, 1, 2, 3].map(b => ({ time: b * BEAT, note: 'C4', duration: 48, velocity: 1 })) } }, mute: false, solo: false }],
    buses: {},
    master: { volume: 0, effects: [] },
    clips: [{ track: 0, pattern: 'a', start: BAR }, { track: 0, pattern: 'a', start: 4 * BAR }],
  }
}

// The song's ticks a clip's notes fall on, pass by pass.
const heard = (p: Project, i: number) => passes(p, p.clips[i]!).flatMap(q => p.tracks[0]!.patterns.a!.notes.map(n => q.base + n.time).filter(t => t >= q.start && t < q.end))

describe("the arrangement's clip edges", () => {
  it('repeats the pattern when a clip is dragged longer by its right edge, and leaves the pattern and its other clip as they were', () => {
    const p = resizeClip(song(), 0, 'right', BAR + 3 * BAR)
    expect(p.tracks[0]!.patterns.a!.length).toBe(BAR)
    expect(heard(p, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(b => BAR + b * BEAT))
    expect(heard(p, 1)).toEqual([0, 1, 2, 3].map(b => 4 * BAR + b * BEAT))
  })

  it('keeps every note it still plays where it was in the song when its front is trimmed by the left edge', () => {
    const long = resizeClip(song(), 0, 'right', 4 * BAR)
    const trimmed = resizeClip(long, 0, 'left', BAR + BEAT)
    expect(trimmed.clips[0]).toMatchObject({ start: BAR + BEAT })
    expect(heard(trimmed, 0)).toEqual(heard(long, 0).slice(1))
  })
})
