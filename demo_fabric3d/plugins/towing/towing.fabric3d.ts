// towing's mod for fabric3d (`world.fabric3d.mods.sources: ['towing']`, with `towing` in
// `world.shipped.plugins`), the page's: what the banner is held to.
//
// `sources(plugins)` is asked once a frame: every `tug` row solids has drawn is a thing, its `key` the row's
// id and its `of` `tug`, and its one point `tail`: the object solids draws the tug by (solids' `group`),
// which fabric3d reads where the frame draws it, between the steps. The banner's pin reaches behind it by its
// `at` (`assets/fabrics.json`).
import type { Plugins } from '#engine/browser.ts'
import type { Thing } from '#plugins/fabric3d/fabric3d.plugin.ts'

export function sources(plugins: Plugins): Thing[] {
  const out: Thing[] = []
  for (const r of plugins.wire.rows) {
    if (r.kind !== 'tug') continue
    const drawn = plugins.solids.group(r.id)
    if (drawn) out.push({ key: `${r.id}`, of: 'tug', point: (on: string) => (on === 'tail' ? drawn : undefined) })
  }
  return out
}
