// Throwaway probe of the combat scene's light chain; deleted once it has answered.
import { test } from 'vitest'
import { boot, type Arg, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { blowOf, clipOf, realSeconds, rigOf } from '#plugins/motion3d/motion3d.play.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import { sim } from './demo_motion3d.sim.ts'
import file from './demo_motion3d.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

async function scene() {
  const top = structuredClone(file) as any
  top.prefabs.scenemanager.entry = 'combat'
  const truth = boot(top as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('combat')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  let seq = 0
  const send = (action: string, ...args: Arg[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: possessed(last.packet.rows)!.id, action, args } })
  }
  const me = () => room.rows.find(r => r.kind === 'player')!
  const foe = () => room.rows.find(r => r.kind === 'foe')!
  const w: any = { world: room.world, all: (k: string) => room.rows.filter(r => r.kind === k), get: (id: number) => room.rows.find(r => r.id === id), find: (k: string) => room.rows.find(r => r.kind === k) }
  for (let i = 0; i < 120; i++) truth.step(DT)
  return { truth, send, me, foe, w }
}

test('probe', async () => {
  const { truth, send, me, foe, w } = await scene()
  const rig = rigOf(w, 'xbot')
  for (const c of ['ssslash1', 'ssjumpattack', 'ssslash3']) {
    const clip = clipOf(rig, c)
    const s = blowOf(w, me(), c).t
    console.log(c, 'clip', clip.dur.toFixed(2), 's, strike at', s.toFixed(2), '| real: to strike', realSeconds(w, me(), clip, 0, s).toFixed(3), 's, whole', realSeconds(w, me(), clip, 0, clip.dur).toFixed(3), 's')
  }
  // The chain: light pressed, then again each time the foe is hit.
  const log: string[] = []
  let hits = 0, step = 0, pressedAt = 0, most = 0
  send('press', 'light')
  const seen: string[] = []
  for (; step < 400; step++) {
    truth.step(DT)
    const d = me().data, f = foe().data
    const line = `${d.motion} ${d.clip} blow ${d.windows?.includes('blow')} swing ${d.swing} target ${d.target ? 'yes' : 'no'} apart ${Math.hypot(d.pos[0] - f.pos[0], d.pos[2] - f.pos[2]).toFixed(2)}`
    if (seen[seen.length - 1] !== line && step < 120) seen.push(line)
    most = Math.max(most, Math.hypot(f.pos[0] - f.at[0], f.pos[2] - f.at[1]))
    if (f.hits > hits) {
      hits = f.hits
      const apart = Math.hypot(d.pos[0] - f.pos[0], d.pos[2] - f.pos[2])
      const blood = w.find('particle3d').data.live.filter((e: any) => e.effect === 'blood').length
      log.push(`hit ${hits} at ${((step + 1) * DT).toFixed(3)} s (${((step + 1 - pressedAt) * DT).toFixed(3)} after its press) by ${d.clip}, bodies ${apart.toFixed(2)} m apart, foe plays ${f.clip}, frozen ${d.stop.toFixed(3)} / ${f.stop.toFixed(3)}, blood bursts ${blood}`)
      if (hits < 3) { send('press', 'light'); pressedAt = step + 1 }
    }
    if (hits === 3 && d.state !== 'act') { log.push(`chain over at ${((step + 1) * DT).toFixed(3)} s, now ${d.motion}`); break }
  }
  const off = () => Math.hypot(foe().data.pos[0] - foe().data.at[0], foe().data.pos[2] - foe().data.at[1])
  log.push(`foe ${off().toFixed(2)} m from its spot as the chain ends, at most ${most.toFixed(2)} m during it, shove now ${foe().data.shove.map((v: number) => v.toFixed(2))}`)
  let back = -1
  for (let i = 0; i < 600; i++) {
    truth.step(DT)
    if (back < 0 && off() <= 0.1 && foe().data.state !== 'act') back = i
  }
  log.push(`foe back within 0.1 m of its spot ${back < 0 ? 'never in 10 s' : `${((back + 1) * DT).toFixed(2)} s later`}, facing ${foe().data.yaw.toFixed(2)} (its facing ${foe().data.facing.toFixed(2)}), ${foe().data.clip}`)
  console.log(seen.join('\n'))
  console.log(log.join('\n'))
  const onExit: (() => void)[] = []
  // The first hit's warp `short` swept: which values land ssslash3 from where the scene starts.
  for (const short of [0.9, 0.7, 0.5, 0.3, 0.1]) {
    const run = await scene()
    const motion = json(run.w, 'xbot-motion3d').activities.swordshield.motions.swordshieldlight1
    const was = motion.warp.short
    motion.warp.short = short
    onExit.push(() => { motion.warp.short = was })
    run.send('press', 'light')
    let landed = -1, apart = 0
    for (let i = 0; i < 120 && landed < 0; i++) {
      run.truth.step(DT)
      if (run.foe().data.hits > 0) { landed = i; const d = run.me().data, f = run.foe().data; apart = Math.hypot(d.pos[0] - f.pos[0], d.pos[2] - f.pos[2]) }
    }
    console.log(`short ${short}: ${landed < 0 ? 'misses' : `lands at ${((landed + 1) * DT).toFixed(3)} s, bodies ${apart.toFixed(2)} m apart`}`)
    for (const undo of onExit.splice(0)) undo()
  }
  // Each pickable clip as hit 2 and as hit 3, the chain pressed as it lands: which hits land.
  const PICKS = ['ssslash3', 'ssslash4', 'gscombo', 'axdownward', 'axhorizontal', 'osoutward', 'osinward']
  // Light mashed every tenth of a second for three seconds, as a player does: each hit of the chain that plays,
  // and whether it lands.
  const chain = async (two: string, three: string) => {
    const run = await scene()
    const motions = json(run.w, 'xbot-motion3d').activities.swordshield.motions
    const was = [motions.swordshieldlight2.clips, motions.swordshieldlight3.clips]
    motions.swordshieldlight2.clips = [two]
    motions.swordshieldlight3.clips = [three]
    const played: { motion: string; clip: string; landed: boolean }[] = []
    let hits = 0
    for (let i = 0; i < 180; i++) {
      if (i % 6 === 0) run.send('press', 'light')
      run.truth.step(DT)
      const d = run.me().data
      if (/^swordshieldlight\d$/.test(d.motion) && played[played.length - 1]?.motion !== d.motion) played.push({ motion: d.motion, clip: d.clip, landed: false })
      if (run.foe().data.hits > hits) { hits = run.foe().data.hits; played[played.length - 1].landed = true }
    }
    motions.swordshieldlight2.clips = was[0]
    motions.swordshieldlight3.clips = was[1]
    return played.slice(0, 3).map(p => `${p.clip} ${p.landed ? 'LANDS' : 'misses'}`).join(' → ')
  }
  for (const two of PICKS) for (const three of PICKS) console.log(`${two} / ${three}: ${await chain(two, three)}`)
  // The stick cutting slash 1's recovery.
  const two = await scene()
  two.send('press', 'light')
  let cut = -1
  for (let i = 0; i < 200; i++) {
    two.truth.step(DT)
    if (two.me().data.windows?.includes('blow.end') || (two.me().data.markers ?? []).some((m: any) => m.name === 'blow.end')) { two.send('stick', 0, -1); }
    if (cut < 0 && two.me().data.motion !== 'swordshieldlight1' && i > 5) { cut = i; break }
  }
  console.log('slash 1 with the stick pushed from its blow closing: over at', ((cut + 1) * DT).toFixed(3), 's, now', two.me().data.motion)
}, 120_000)
