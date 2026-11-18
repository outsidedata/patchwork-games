# demo_fabric3d

A yard that shows fabric3d (`plugins/fabric3d`): every fabric of `assets/fabrics.json`, each held or draped
a different way.

- **The flag** is pinned along the top of the mast, a shapes3d cylinder, and flies in the wind.
- **The cloths** are laid over the table, the drum, the ramp and the slope (shapes3d's box, cylinder,
  hyperplane and tilted plane) and fall onto them.
- **The capes** are pinned at the neck of the X Bot you walk and of each wanderer, and drape on the capsules
  `world.anim.kinds.<kind>.capsules` makes of their bones, which gpgpu3d holds on the GPU with the yard's
  shapes (`world.gpgpu3d`), and every fabric meets there.
- **The ribbon** trails from the stick in your X Bot's left hand.
- **The colours** fly from the pole each wanderer carries.
- **The banner** is towed behind the tug, which flies a circle over the yard. The game's own plugin,
  `plugins/towing`, hands fabric3d the tug's tail.

## Playing it

`yarn dev`, then `games/demo_fabric3d/index.html`. Walk with W A S D or the arrows, hold Shift to run, drag
with the right mouse button to look round, and turn the wheel to zoom.

Against its server: `yarn serve demo_fabric3d`, then `games/demo_fabric3d/client.html`.

`dev.html` has a panel for the wind, the turbulence, gravity, the substep and the passes, and for every
fabric's numbers, all changed while it runs. `?cam=x,y,z,tx,ty,tz` stands the camera somewhere, and
`?hold=<n>` pauses at step n.

## Remaking the art

`yarn bake demo_fabric3d` writes:

- `assets/xbot.glb` and the measures in `assets/xbot.rig.json`: Mixamo's X Bot from the library
  (`characters/xbot/xbot.fbx`) with the rig's clips from the clip collection, baked by anim's export.
- `assets/checker-1024.webp`: the ground's checkerboard, drawn by the bake from nothing.
- `assets/pole.glb` and `assets/stick.glb`: built by `assets/props.mjs` from nothing and packed by gltfpack.

## Credit

The X Bot and its clips are Adobe Mixamo's.

## Its files

- `main.scene.json`: the yard, and `world.fabric3d`: which fabric goes on what, and the wind; `world.gpgpu3d`:
  what the fabrics meet; `world.anim`: each body's capsules.
- `assets/fabrics.json`: the fabrics.
- `assets/props.mjs`: builds the pole and the stick, which the bake packs.
- `tug.sim.ts`, `plugins/towing`: the tug and its tail.
- `player.sim.ts`, `wanderer.sim.ts`, `plugins/gait`: the X Bots, walked by walker and played by anim.
