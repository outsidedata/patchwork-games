# demo_item3d

Kit items of the library's pro-ng in the hands of every kind of body core draws, through the item3d plugin
(`plugins/item3d/`). Three people stand in a row on a cobbled ground, and a wrench lies on it in front of them.

- **The worker** is walked by walker and drawn by anim. It holds a wrench of item3d's in its right hand and a
  plain glb sword in its left (`world.anim.kinds.worker.props`).
- **The villager** is a crowd3d person. It wears a skullcap of item3d's and holds the plain glb sword in its
  right hand (`world.crowd3d.items`, the row's `holding`).
- **The runner** is moved by kinematics3d and drawn by motion3d. It holds a wrench of item3d's in its right hand
  (`world.motion3d.kinds.xbot.props`).
- **The loose wrench** is a row item3d draws where it lies (`world.item3d.kinds.wrench`).

The sword is a glb with glTF materials of its own, held as a loader `model`, to show that a glb from anywhere
goes in a hand beside an item.

## Keys

W and S fly forward and back, A and D turn, Q and E tilt, Shift climbs, Control sinks, the wheel paces. F has
the villager take the loose wrench in its left hand, or put it back.

## Files

- `assets/demo_item3d.items.json`: the items sheet, each item a kit kind and its keys.
- `assets/demo_item3d.bake.ts`: the bake (`yarn bake demo_item3d`): the bodies, the items, and the scene's one
  looks file, the ground's material and the items' together.
- `main.scene.json`: `world.item3d`, and each holding plugin's `mods` naming item3d.
- `plugins/stance/`: the state words the X Bot's motion3d file asks of kinematics3d.

## Pages

`yarn dev`, then `localhost:5173/games/demo_item3d/index.html`, or `dev.html` for the testbed.
