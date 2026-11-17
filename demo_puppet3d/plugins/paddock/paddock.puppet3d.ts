// paddock's mod for puppet3d: the word `upright`, a body that walks on its two hind legs, its trunk
// reared up over them. A scene names `paddock` in `world.puppet3d.mods.behaviors` to have it.
//
// It places the bones that touch the world: the hind legs, each foot put down on the land where it
// lands and never let under the land it swings over, and the back from the rump up to the breast,
// reared `rear` radians up from level over the hip joints, which ride the land under the feet on a
// spring the legs' load pushes. The hips sway over the foot that bears. Everything above the back
// (forelegs, neck, head, tail) is the puppet's cues', carried as the back stands. It senses `stride`,
// how far round its stride the body is, 0 to 1.
//
// Its numbers, metres, seconds and radians. Along the body `u` is metres ahead of the hip joint, `y`
// metres up, and a side of 1 is the body's +x as its skeleton faces +z:
//   centre   the row's `pos` ahead of the hip joint.
//   hip      the hip joint over the ground standing.
//   rear     how far the back is reared up from level, standing; `lean` how much less for each metre
//            a second it goes, so it leans into its walk.
//   home     where its feet stand under a still body, ahead of the hip joint; `top` and `foot` how far
//            to each side the legs' tops and the feet are; `hoof` the bottom of the pastern over the
//            ground; `sway` how far the hips move across toward a foot bearing all the load.
//   leg      its legs (`Leg`, puppet3d's header); `legs` each `{ side, bones }`, in the order of
//            `fall`, `bones` the four bones from the leg's top to its foot.
//   gait, spring   `Gait` and `Spring` (puppet3d's header); `ride` the hips ride the land as it lies
//            this far each way.
//   spine    `{ points, bones }`: the back's points from the rump to the breast, each [u, y] as the
//            body stands level, y over the hip joint, reared up about the hip joint; `bones` each
//            `[name, from, to]`.
import type { Bounce, Feet, Gait, Height, Leg, Placed, Ridden, Solver, Spring, V2, V3 } from '#plugins/puppet3d/puppet3d.plugin.ts'
import { bounce, feetAt, push, stand, walkFeet } from '#plugins/puppet3d/puppet3d.plugin.ts'

type Upright = {
  centre: number; hip: number; rear: number; lean: number
  home: number; top: number; foot: number; hoof: number; sway: number
  leg: Leg; legs: { side: number; bones: string[] }[]
  gait: Gait; spring: Spring; ride: number
  spine: { points: V2[]; bones: [string, number, number][] }
}
type Trunk = { world(q: V3): V3; local(q: V3): V3; at(u: number, y: number): V2; across: V3; shift: number }
type Standing = { at: Ridden; feet: Feet; rise: Bounce; trunk: Trunk; legs: { pts: V3[]; over: number }[] }

function homeOf(U: Upright) {
  return (j: number, x: number, z: number, yaw: number): V2 => {
    const u = U.home - U.centre, s = U.legs[j].side * U.foot, sin = Math.sin(yaw), cos = Math.cos(yaw)
    return [x + sin * u + cos * s, z + cos * u - sin * s]
  }
}

// The hips over the ground under the feet, reared, swayed over the bearing foot.
function trunkOf(U: Upright, g: Standing, land: Height): Trunk {
  const sin = Math.sin(g.at.yaw), cos = Math.cos(g.at.yaw)
  const forward: V3 = [sin, 0, cos], across: V3 = [cos, 0, -sin]
  const ox = g.at.pos[0] - sin * U.centre, oz = g.at.pos[2] - cos * U.centre
  const ride = [-1, -0.5, 0, 0.5, 1].reduce((sum, o) => sum + land(ox + sin * (U.home + o * U.ride), oz + cos * (U.home + o * U.ride)), 0) / 5
  const hipY = ride + U.hip - g.feet.stride.crouch + g.rise.y
  const pitch = U.rear - U.lean * Math.hypot(g.at.vel[0], g.at.vel[2]), c = Math.cos(pitch), s = Math.sin(pitch)
  const shift = U.sway * U.legs.reduce((sum, L, j) => sum + L.side * g.feet.loads[j], 0) / U.legs.length
  return {
    world: q => [ox + forward[0] * q[0] + across[0] * q[2], q[1], oz + forward[2] * q[0] + across[2] * q[2]],
    local: q => { const dx = q[0] - ox, dz = q[2] - oz; return [dx * forward[0] + dz * forward[2], q[1], dx * across[0] + dz * across[2]] },
    at: (u, y) => [u * c - y * s, hipY + u * s + y * c],
    across, shift,
  }
}

// The trunk and both legs stood on the feet, the hips riding higher than the standing legs reach held
// down to them, no lower than `give` under their rest.
function settle(U: Upright, g: Standing, land: Height) {
  const place = () => {
    g.trunk = trunkOf(U, g, land)
    const top = g.trunk.at(0, 0)
    g.legs = U.legs.map((L, j) => {
      const f = g.trunk.local(g.feet.feet[j])
      return stand(U.leg, [top[0], top[1], L.side * U.top + g.trunk.shift], [f[0], f[1] + U.hoof, f[2]], L.side, g.feet.loads[j], g.feet.arcs[j], g.feet.up[j], U.spring.taut)
    })
  }
  place()
  for (let i = 0; i < 6; i++) {
    const over = Math.max(0, ...g.legs.map(l => l.over))
    if (over < 1e-4) break
    const was = g.rise.y
    g.rise.y = Math.max(g.rise.y - over, Math.min(g.rise.y, -U.spring.give))
    g.rise.v = Math.min(g.rise.v, 0)
    if (g.rise.y === was) break
    place()
  }
}

export const upright: Solver<Upright, Standing> = {
  make(U, at, land) {
    const g: Standing = {
      at: { pos: [...at.pos], yaw: at.yaw, vel: [0, 0, 0] }, feet: feetAt(U.gait, U.legs.length, at, land, homeOf(U)),
      rise: { y: 0, v: 0 }, trunk: undefined as unknown as Trunk, legs: [],
    }
    settle(U, g, land)
    return g
  },
  step(U, g, at, dt, land) {
    g.at = { pos: [...at.pos], yaw: at.yaw, vel: [...at.vel] }
    walkFeet(U.gait, g.feet, at, dt, land, homeOf(U))
    bounce(U.spring, g.rise, push(U.spring, g.feet, U.legs.map((_, j) => j)), dt)
    settle(U, g, land)
  },
  senses: (_U, g) => ({ stride: g.feet.cycle }),
  pose(U, g) {
    const t = g.trunk
    const spine = U.spine.points.map(([u, y]): V3 => { const q = t.at(u, y); return t.world([q[0], q[1], t.shift]) })
    const out: Record<string, Placed> = {}
    for (const [name, a, b] of U.spine.bones) out[name] = { head: spine[a], tail: spine[b], across: t.across }
    U.legs.forEach((L, j) => {
      const pts = g.legs[j].pts.map(q => t.world(q))
      L.bones.forEach((name, k) => { out[name] = { head: pts[k], tail: pts[k + 1], across: t.across } })
    })
    return out
  },
}

export const behaviors = () => ({ upright })
