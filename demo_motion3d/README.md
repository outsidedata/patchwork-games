# demo_motion3d

The demo of motion3d (`plugins/motion3d`): an X Bot on a checkerboard yard, and spaces where the use
key does what each offers.

## Playing it

`yarn dev`, then `localhost:5173/games/demo_motion3d/index.html`, or `dev.html` for the testbed, whose
readout shows the activity and motion the body is in and what the space it stands in offers. Against
its server: `yarn serve demo_motion3d`, then `localhost:5173/games/demo_motion3d/client.html`.

- W A S D walk, Shift run, Space jump, right drag look, wheel zoom.
- E is use. In the pink zone it plays a backflip, in the blue zone it picks something up, and on open
  ground it does nothing.
- Under the orange wall's lip, E jumps up and hangs from it. Hanging, A and D shimmy along the lip until
  the hands would leave it, W + E climbs up onto the wall's top, S + E drops back down.
- In front of the chair, E sits down in it; E again stands up.
- Gamepad: left stick walk, right stick look, RT or L3 run, A jump, X use, d-pad up and down zoom.

## How it is made

- The seat's `player` row is the X Bot. Each step its rule asks walker to go the way the stick points
  and calls motion3d's `step`; its `press` act hands motion3d a motion's name, `jump` or `use`.
- motion3d's numbers are `world.motion3d` in `main.scene.json`: the X Bot's `anywhere` is `walk`, its
  spaces are shapes3d's (`shapes3d.motion3d.ts`), and its activities come from the game's own `zones`
  plugin (`plugins/zones/zones.motion3d.ts`), which delivers `walk` too, on shapes3d's ground, so the
  body walks round the wall and the chair and stands on the wall's top.
- The spaces are shapes3d kinds that name the activity they offer and stand in nothing's way:
  `partyzone` (`party`), `sadzone` (`sad`), `ledgezone` (`ledge`, held to its `Lip` line) and
  `chairzone` (`chair`, held to its `Seat` point). The `wall`, `chair` and `chairback` are solid
  shapes of their own.
- The sizes come from the clips' measures in the rig: the lip is where `bracedjump` ends the wrists,
  2.154 m up; the wall's top is 0.218 m over it, where `bracedclimb` ends the feet; the seat is where
  `seated` holds the hips, 0.61 m up.
- The X Bot and its clips are baked by `yarn bake demo_motion3d` (`assets/demo_motion3d.bake.ts`):
  the clips of `assets/xbot.rig.json` onto the library's `characters/xbot/xbot.fbx` as
  `assets/xbot.glb`, and the checkerboard `assets/checker-1024.webp`.

## Credit

The X Bot and its clips are Mixamo's (Adobe), from the library's `characters/xbot` and
`~/troupe-collection/packs`.

## Tests

`yarn vitest run games/demo_motion3d/demo_motion3d.sim.test.ts`: a seat walks into each zone and
presses use; hangs from the lip, its wrists on it, shimmies to its end, climbs onto the top; drops
back down; sits in the chair, its hips on the seat, and stands up.
