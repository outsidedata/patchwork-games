// The browser half of the fortress, the game's own plugin, loaded by `shipped` (`world.shipped.plugins`). The
// fortress is the visitors' going about the place, its `tour`, which reaches npc3d through its mod
// (`fortress.npc3d.ts`) and runs on the server; it has nothing to do on the page. It is listed in
// `world.shipped.plugins` so the scenemanager finds that mod in the game's folder, and shipped imports a browser half
// for every name it lists, so this one hands back nothing.
export function fortress() {
  return {}
}
