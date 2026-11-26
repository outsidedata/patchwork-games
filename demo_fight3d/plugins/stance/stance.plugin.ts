// stance's browser half. It draws nothing. It is here so `world.shipped.plugins` can list stance, which is how its
// mod for kinematics3d (`stance.kinematics3d.ts`, the game's `fast` and `guard` states) is found.
export function stance() {
  return {}
}
