// stance: the game's own plugin that gives kinematics3d the state words the X Bot's motion3d file asks
// (`stance.kinematics3d.ts`). Its browser half draws nothing and holds nothing: it is here so `shipped`
// loads the plugin by its name, which is how the scenemanager finds its mod in the game's folder.
export function stance() {
  return {}
}
