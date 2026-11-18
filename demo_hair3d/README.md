# demo_hair3d

An X Bot with long hair walked round a yard among X Bots in fur. The hair and the fur are hair3d's: grown
on the bald models from the hairs file `assets/hairs.json`, which `world.hair3d.hairs` names, hanging, swinging as the bodies walk and
blowing in the wind.

- `yarn dev`, then `localhost:5173/games/demo_hair3d/index.html` to walk it: w a s d or the left stick
  walk, shift runs, space jumps, right drag or the right stick looks, the wheel zooms.
- `dev.html` has every number of each hair and of the wind on a panel, changed as it draws.
- `yarn serve demo_hair3d` and `client.html` walks it against the game's server.

`yarn bake demo_hair3d` bakes the X Bot and its clips (`assets/xbot.rig.json`) and draws the ground's
checkerboard.
