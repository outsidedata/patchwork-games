// The browser half of the fortress, the game's own plugin, loaded by `shipped` (`world.shipped.plugins`).
// It ticks nothing: what it knows reaches other plugins through its mods, the visitors' tour to npc3d
// (`fortress.npc3d.ts`) and the buildings' boxes to lod3d (`fortress.lod3d.ts`), and lod3d asks a page's
// mod only of a plugin the page lists.
export function fortress() {
  return {}
}
