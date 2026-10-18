// The browser half of portal, loaded through `shipped` (`world.shipped.plugins`). It holds the portals'
// lights: on its first tick, one point light for each portal its definition's `rims` names, in that
// rim's `glow`, out to `light.distance` with `light.decay`, dark. `lamp(name)` is that portal's light,
// which the portal's look (`portal.client.ts`) stands in front of it and turns up to `light.power` while
// it stands, and down again when it goes. So the scene holds the same lights from its first frame to
// its last, and placing a portal never changes how many lights three's programs are built for, which
// would rebuild every lit material's program on the frame it lands. `close` takes them off the scene.
//
// `seen(plugins, geometry, surface, jumps)` is the look of a body the portals take, for that
// body's own `<kind>.client.ts`: `{ tick(row), remove() }`, the geometry drawn in the chamber's surface
// of that name (`surfaced`, `plugins/chamber/chamber.plugin.ts`), dressed and lit, casting and taking
// shadows, where the row's `pos` and `rot` put it every frame.
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
import { def } from '#plugins/loader/loader.sim.ts'
import { surfaced } from '../chamber/chamber.plugin.ts'
import { point, turned } from './portal.sim.ts'

export function portal() {
  let lamps: Map<string, THREE.PointLight> | undefined
  let scene: THREE.Scene | undefined
  return {
    tick(plugins: Plugins) {
      if (lamps) return
      const three = plugins.render3d.THREE as typeof THREE
      const { rims, light } = def(plugins.wire, 'portal')
      scene = plugins.render3d.scene
      lamps = new Map(Object.entries(rims as Record<string, { glow: string }>).map(([name, rim]) => {
        const lamp = new three.PointLight(rim.glow, 0, light.distance, light.decay)
        scene!.add(lamp)
        return [name, lamp]
      }))
    },
    lamp(name: string) {
      const lamp = lamps?.get(name)
      if (!lamp) throw new Error(`portal has no lamp for ${name}: its definition's rims name ${[...(lamps?.keys() ?? [])].join(', ')}`)
      return lamp
    },
    close() {
      for (const lamp of lamps?.values() ?? []) {
        scene?.remove(lamp)
        lamp.dispose()
      }
    },
  }
}

type Copy = { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; plane: { value: THREE.Vector4 }; cut: { value: number } }

export function seen(plugins: Plugins, geometry: THREE.BufferGeometry, surfaceName: string, jumps: number) {
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
    const material = surfaced(plugins, surfaceName, surface)
    const mesh = new three.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
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
