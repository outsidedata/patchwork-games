# demo_hair3d

An X Bot with long hair walked round a yard among X Bots in fur and in every way of tying hair: a ponytail,
pigtails, a long braid with a tie at its end, braided pigtails tied at their ends, and a head of braids. The
hair and the fur are hair3d's: grown on the bald models from the hairs file `assets/hairs.json`, which
`world.hair3d.hairs` names, hanging, swinging as the bodies walk and blowing in the wind. A wanderer wears
the hair its `as` names in the scene's actors (`ponytail`, `pigtails`, `braid`, `braided_pigtails`,
`coolio`); each is a kind of `world.anim.kinds` and of `world.walker.kinds`, a copy of the wanderer's.

- `yarn dev`, then `localhost:5173/games/demo_hair3d/index.html` to walk it: w a s d or the left stick
  walk, shift runs, space jumps, right drag or the right stick looks, the wheel zooms.
- `dev.html` has every number of each hair and of the wind on a panel, changed as it draws.
- `yarn workshop hair3d demo_hair3d` grows each hair on a test head that nods, shakes and runs, every number
  a slider, a tie's among them: `&hair=braid&subject=head&motion=shake` opens on one.
- The tied hairs were laid in `assets/hairs.json` by `assets/hairs.styles.mjs` and are tuned in the workshop
  from there; run the script again only to start them over.
- `yarn serve demo_hair3d` and `client.html` walks it against the game's server.

`yarn bake demo_hair3d` bakes the X Bot and its clips (`assets/xbot.rig.json`) and draws the ground's
checkerboard.
