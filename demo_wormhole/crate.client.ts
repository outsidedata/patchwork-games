// A crate, drawn: a box of its definition's `size` and `colour`, dressed and lit, standing where its
// row's `pos` and `rot` put it every frame.
//
// Through a portal. While its row is `inside` a portal P (`crate.sim.ts`) it is drawn twice: where it
// is, cut at P's plane so only the part in front of P shows, and carried through to the portal P leads
// to, Q, cut at Q's plane so only the part in front of Q shows (`plugins/portal`'s `point` and
// `turned`). So a crate halfway in shows its front half coming out of Q and its back half going into
// P. Each cut is a piece of shader of the crate's own, laid on its material through render3d's `dress`:
// a fragment whose world point (`vDressWorld`) lies behind the plane is not drawn. Out of a portal, one
// box and no cut.
//
// On the frame `jumps` changes the crate went through, and on the frame the second box first shows,
// each box's `userData.teleport` is up, so render3d draws it where it is put that frame, never sliding
// there from where it last stood (`guide-to-smooth-gameplay`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { point, turned } from './plugins/portal/portal.sim.ts'

type Box = { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>; plane: { value: THREE.Vector4 }; cut: { value: number } }

let boxes: [Box, Box]
let jumps = 0

export function setup(row: Row, plugins: Plugins) {
  const { size, colour } = def(plugins.wire, row.kind)
  const three = plugins.render3d.THREE as typeof THREE
  const make = (): Box => {
    const plane = { value: new three.Vector4() }, cut = { value: 0 }
    const surface = {
      uniforms: { cratePlane: plane, crateCut: cut },
      fragment: {
        common: 'uniform vec4 cratePlane;\nuniform float crateCut;',
        clipping_planes_fragment: 'if (crateCut > 0.5 && dot(vDressWorld, cratePlane.xyz) < cratePlane.w) discard;',
      },
    }
    const material = plugins.render3d.dress(new three.MeshStandardMaterial({ color: colour, roughness: 0.7 }), { surface })
    const mesh = new three.Mesh(new three.BoxGeometry(size, size, size), material)
    plugins.render3d.scene.add(mesh)
    return { mesh, plane, cut }
  }
  boxes = [make(), make()]
  boxes[1].mesh.visible = false
  jumps = row.data.jumps
  tick(row, plugins)
}

// Cut `box` at portal p's plane, keeping what stands in front of it.
const cutAt = (box: Box, p: Row) => {
  const [nx, ny, nz] = p.data.normal
  box.plane.value.set(nx, ny, nz, nx * p.data.pos[0] + ny * p.data.pos[1] + nz * p.data.pos[2])
  box.cut.value = 1
}

export function tick(row: Row, plugins: Plugins) {
  const [real, ghost] = boxes
  const went = row.data.jumps !== jumps
  jumps = row.data.jumps
  real.mesh.userData.teleport = went
  real.mesh.position.fromArray(row.data.pos)
  real.mesh.quaternion.fromArray(row.data.rot)
  const p = row.data.inside === null ? undefined : plugins.wire.rows.find(r => r.kind === 'portal' && r.data.name === row.data.inside)
  const q = p && plugins.wire.rows.find(r => r.kind === 'portal' && r.data.name === p.data.to)
  if (!p || !q) {
    real.cut.value = 0
    ghost.mesh.visible = false
    return
  }
  cutAt(real, p)
  cutAt(ghost, q)
  ghost.mesh.userData.teleport = went || !ghost.mesh.visible
  ghost.mesh.visible = true
  ghost.mesh.position.fromArray(point(p, q, row.data.pos))
  ghost.mesh.quaternion.fromArray(turned(p, q, row.data.rot))
}

export function remove(plugins: Plugins) {
  for (const { mesh } of boxes) {
    plugins.render3d.scene.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
  }
}
