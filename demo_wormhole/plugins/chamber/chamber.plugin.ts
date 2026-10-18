// The browser half of chamber: draws the `chamber` row's pieces on render3d's scene, the first frame
// the row is there. Each box a box of its `colour`, its top lined every `lines` metres in `line` when it
// gives one; each ramp a wedge of its `colour`. Every material is dressed and lit by the scene's lights.
// `close` takes them off and disposes them.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

type Piece = { min: number[]; max: number[]; colour: string; lines?: number; line?: string; toward?: [number, number] }

export function chamber() {
  let made: THREE.Object3D[] | undefined
  let scene: THREE.Scene | undefined
  return {
    tick(plugins: Plugins) {
      if (made) return
      const row = plugins.wire.rows.find(r => r.kind === 'chamber')
      if (!row) return
      const { boxes, ramps } = def(plugins.wire, row.kind) as { boxes: Piece[]; ramps: Piece[] }
      const three = plugins.render3d.THREE as typeof THREE
      const lit = (colour: string) => plugins.render3d.dress(new three.MeshStandardMaterial({ color: colour, roughness: 0.8 }))
      made = []
      for (const b of boxes) {
        const size = [0, 1, 2].map(i => b.max[i] - b.min[i])
        const mesh = new three.Mesh(new three.BoxGeometry(size[0], size[1], size[2]), lit(b.colour))
        mesh.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2)
        made.push(mesh)
        if (!b.lines) continue
        const points: number[] = []
        const y = b.max[1] + 0.002
        for (let x = b.min[0]; x <= b.max[0] + 1e-9; x += b.lines) points.push(x, y, b.min[2], x, y, b.max[2])
        for (let z = b.min[2]; z <= b.max[2] + 1e-9; z += b.lines) points.push(b.min[0], y, z, b.max[0], y, z)
        const geometry = new three.BufferGeometry().setAttribute('position', new three.Float32BufferAttribute(points, 3))
        made.push(new three.LineSegments(geometry, new three.LineBasicMaterial({ color: b.line })))
      }
      for (const r of ramps) {
        // The wedge's six corners: the low edge on the base, the high edge at the top, and below it.
        const [tx, tz] = r.toward!
        const [x0, y0, z0] = r.min, [x1, y1, z1] = r.max
        const corner = (x: number, z: number, high: boolean) => [x, high ? y1 : y0, z]
        const highAt = (x: number, z: number) => (x - (tx + tz > 0 ? x0 : x1)) * tx + (z - (tx + tz > 0 ? z0 : z1)) * tz > 0
        const quad = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
        const top = quad.map(([x, z]) => corner(x, z, highAt(x, z)))
        const base = quad.map(([x, z]) => corner(x, z, false))
        const faces = [
          [top[0], top[1], top[2]], [top[0], top[2], top[3]],
          [base[0], base[2], base[1]], [base[0], base[3], base[2]],
          ...[0, 1, 2, 3].flatMap(i => {
            const j = (i + 1) % 4
            return [[base[i], base[j], top[j]], [base[i], top[j], top[i]]]
          }),
        ]
        const geometry = new three.BufferGeometry().setAttribute('position', new three.Float32BufferAttribute(faces.flat(2), 3))
        geometry.computeVertexNormals()
        made.push(new three.Mesh(geometry, Object.assign(lit(r.colour), { side: three.DoubleSide })))
      }
      scene = plugins.render3d.scene
      scene!.add(...made)
    },
    close() {
      if (!made) return
      scene?.remove(...made)
      for (const o of made as (THREE.Mesh | THREE.LineSegments)[]) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    },
  }
}
