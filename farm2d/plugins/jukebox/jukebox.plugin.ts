// farm2d's music and sounds on the page, all of them synthaudio's: the browser half of a plugin of
// the game's own, loaded by `shipped`, listed after `synthaudio` and `store`, whose calls it makes.
// Every number is the `audio` definition's (`assets/farm2d.json`):
//   project  the synthaudio project, a `json` entry of the catalogue and one of
//            `world.synthaudio.projects`, that holds the song and the sounds alike.
//   music    the tracks that are the song; every other track of the project is a sound, placed by
//            no clip, so the song never plays it.
//   sounds   each sound a rule raises (`sound` in `plugins/audio/audio.sim.ts`, by its cue's name) to
//            the track that plays it.
//   levels   the store keys of the music's level, the sounds' level and the mute.
//
// The song. The first frame the project has landed, this page's own copy of it is handed to
// synthaudio to play round and round (`audition`), so every scene of the page starts it from its top.
// Each frame the store's levels set each track's level on that copy: a track of the song at its own
// level times `music`, a sound's at its own times `effects`, and every track at 0 while muted; and the
// copy is handed back to synthaudio (`use`), which sets the levels on the instruments it built and
// builds nothing again. So the music and the sounds turn up and down on their own, at once.
//
// The sounds. The ledger row's entries and every `player` row's own (`voiced`), as audio plays them:
// each once, the first frame it is seen, but those a list already held the first frame the page saw
// it. Each plays its track's one pattern through, its notes held from their sixteenth for their
// length at the project's tempo, timed by the page's clock, on the track the copy holds, so its
// level is the sounds'. The field is drawn whole on the canvas, so a sound is never off the view and
// plays unplaced. An entry seen while synthaudio's context is locked is let go without playing, as
// audio lets one go; a sound named by no entry of `sounds` throws, naming it.
//
// Node has no Web Audio: synthaudio makes no context there, so the song is used and not played,
// and every entry is let go.
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { sixteenth, type Project } from '#plugins/synthaudio/synthaudio.sim.ts'

type Entry = { id: number; cue: string }
type Levels = { music: number; effects: number; muted: boolean }
// A note of a sound waiting to start or to end, in the page's seconds.
type Held = { track: string; note: string; vel: number; on: number; off: number; started: boolean }

export function jukebox() {
  let song: Project | undefined // this page's copy of the project
  let gains: Record<string, number> = {} // each track's own level, as the file gives it
  let was = '' // the levels last set, as text
  let heard = new Set<string>()
  let lists = new Set<string>()
  const held: Held[] = []
  const now = () => performance.now() / 1000

  // Each track's level set from the store's, and the copy handed back to synthaudio.
  function mix(p: Plugins, k: any) {
    const levels: Levels = { music: p.store.get(k.levels.music), effects: p.store.get(k.levels.effects), muted: p.store.get(k.levels.muted) === true }
    const text = JSON.stringify(levels)
    if (text === was) return
    was = text
    for (const [name, t] of Object.entries(song!.tracks)) {
      t.instrument.params.gain = levels.muted ? 0 : gains[name] * (k.music.includes(name) ? levels.music : levels.effects)
    }
    p.synthaudio.use(song, k.project)
  }

  // A sound's notes queued from now.
  function queue(track: string) {
    const step = sixteenth(song!.bpm), at = now()
    for (const [from, note, len, vel] of song!.tracks[track].patterns.fx.notes) held.push({ track, note, vel, on: at + from * step, off: at + (from + len) * step, started: false })
  }

  // Every note due to start started, and every note due to end released.
  function sound(p: Plugins) {
    const t = now()
    for (let i = held.length - 1; i >= 0; i--) {
      const h = held[i]
      if (!h.started && h.on <= t) {
        p.synthaudio.attack(h.track, h.note, h.vel)
        h.started = true
      }
      if (h.started && h.off <= t) {
        p.synthaudio.release(h.track, h.note)
        held.splice(i, 1)
      }
    }
  }

  return {
    tick(p: Plugins) {
      const k = def(p.wire, 'audio')
      if (!song) {
        const file = p.loader.get(k.project)
        if (!file) return void p.loader.load(k.project)
        song = structuredClone(file) as Project
        gains = Object.fromEntries(Object.entries(song.tracks).map(([name, t]) => [name, t.instrument.params.gain as number]))
        p.synthaudio.audition(song, k.project)
      }
      mix(p, k)
      const running = p.synthaudio.context?.state === 'running'
      const seen = new Set<string>(), present = new Set<string>()
      for (const row of p.wire.rows) {
        if (row.kind !== 'audio' && row.kind !== 'player') continue
        const where = `${row.id}`
        present.add(where)
        const list = row.kind === 'audio' ? row.data.live : row.data.voiced
        if (!Array.isArray(list)) continue
        for (const e of list as Entry[]) {
          const key = `${where}/${e.id}`
          seen.add(key)
          if (heard.has(key) || !lists.has(where)) continue
          const track = k.sounds[e.cue]
          if (!track) throw new Error(`jukebox has no track for the sound ${e.cue}`)
          if (running) queue(track)
        }
      }
      heard = seen
      lists = present
      sound(p)
    },
    close(p: Plugins) {
      for (const h of held) if (h.started) p.synthaudio.release(h.track, h.note)
      held.length = 0
    },
  }
}
