// towing: demo_fabric3d's own plugin, which hands fabric3d the tug's tail for the banner to be held to
// (`towing.fabric3d.ts`). `shipped` loads this half so the scenemanager finds that mod in the game; it draws
// nothing and keeps nothing.
export function towing() {
  return {}
}
