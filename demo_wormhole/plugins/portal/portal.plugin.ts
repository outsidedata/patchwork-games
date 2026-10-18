// The browser half of portal: no state of its own, and listed nowhere, since it draws nothing by
// itself. `seen(plugins, geometry, colour)` is the look of a body the portals take, for that body's own
// `<kind>.client.ts`: `{ tick(row), remove() }`, the geometry drawn in `colour`, dressed and lit, where
// the row's `pos` and `rot` put it every frame.
//
// Through a portal. While the row is `inside` a portal P (`portal.sim.ts`) it is drawn twice: where it
// is, cut at P's plane so only the part in front of P shows, and carried through to the portal P leads
// to, Q, cut at Q's plane so only the part in front of Q shows (`point`, `turned`). So a body halfway
// in shows its front half coming out of Q and its back half going into P. Each cut is a piece of shader
// of the body's own, laid on its material through render3d's `dress`: a fragment whose world point
// (`vDressWorld`) lies behind the plane is not drawn. Out of a portal, one copy and no cut.
//
// On the frame the row's `jumps` changes it went through, and on the frame the second copy first shows,
// each copy's `userData.teleport` is up, so render3d draws it where it is put that frame, never sliding
// there from where it last stood (`guide-to-smooth-gameplay`).
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { point, turned } from './portal.sim.ts'

type Copy = { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; plane: { value: THREE.Vector4 }; cut: { value: number } }

export function seen(plugins: Plugins, geometry: THREE.BufferGeometry, colour: string, jumps: number) {
  const three = plugins.render3d.THREE as typeof THREE
  const make = (): Copy => {
    const plane = { value: new three.Vector4() }, cut = { value: 0 }
    const surface = {
      uniforms: { portalPlane: plane, portalCut: cut },
      fragment: {
        common: 'uniform vec4 portalPlane;\nuniform float portalCut;',
        clipping_planes_fragment: 'if (portalCut > 0.5 && dot(vDressWorld, portalPlane.xyz) < portalPlane.w) discard;',
      },
    }
    const material = plugins.render3d.dress(new three.MeshStandardMaterial({ color: colour, roughness: 0.6 }), { surface })
    const mesh = new three.Mesh(geometry, material)
    plugins.render3d.scene.add(mesh)
    return { mesh, plane, cut }
  }
  const [real, ghost] = [make(), make()]
  ghost.mesh.visible = false
  // Cut a copy at portal p's plane, keeping what stands in front of it.
  const cutAt = (c: Copy, p: Row) => {
    const [nx, ny, nz] = p.data.normal
    c.plane.value.set(nx, ny, nz, nx * p.data.pos[0] + ny * p.data.pos[1] + nz * p.data.pos[2])
    c.cut.value = 1
  }
  return {
    tick(row: Row) {
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
    },
    remove() {
      for (const { mesh } of [real, ghost]) {
        plugins.render3d.scene.remove(mesh)
        mesh.material.dispose()
      }
      geometry.dispose()
    },
  }
}
