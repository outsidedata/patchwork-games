import type { File } from './mmo3d.sim.ts'

export function create_overrides(file: File): Record<string, string> {
  const overrides: Record<string, string> = {}
  for (const p of file.placements) {
    overrides[`${p.at}.class`] = p.kind
    if (p.record !== undefined) overrides[`${p.at}.record`] = p.record
  }
  return overrides
}
