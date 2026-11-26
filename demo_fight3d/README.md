# demo_fight3d

A hand-to-hand fight, and its one question: does a hit feel right. On a level checkerboard, an X Bot (played by
motion3d, unarmed) faces a foe 1.4 metres ahead (an X Bot played by anim on walker). Every strike lands through
fight3d (`plugins/fight3d`): both bodies freeze, the foe is shoved the way the strike went, bleeds where it was met,
and is jolted, the joints about the blow bent at once and springing back onto the clip it stands in. Once it has
recovered it walks back to its spot.

## Playing it

`yarn dev`, then `localhost:5173/games/demo_fight3d/index.html`, or `dev.html` for the testbed.

- W A S D or the left stick: walk. Right drag or the right stick: look. Wheel: zoom.
- J: the jab, cross and hook, pressed again as each strikes.
- K: the roundhouse, or after a light the uppercut, then the hurricane kick.
- L: the MMA kick, or the flying kick while running.

`dev.html` adds panels for the fight's numbers (hitstop, frozen pace, knockback, walking home), the jolt (its springs,
how far a blow turns a joint, and whether the foe takes the jolt, the reaction clips, or both), and the combo's three
hits. `pause on a blow` stops the clock on the step a blow lands; ` pauses and . steps.

`yarn workshop fight3d demo_fight3d` opens the fight3d workshop on this game: each strike played into it, its time,
ramp, blow window, warp and fight3d's numbers tuned and saved in place.

## Files

- `main.scene.json`, `main.sim.ts`: the fight. `world.fight3d` holds every fight number: each strike's damage, knock
  and hitstop, and the foe's freeze, shove, blood, jolt and walk home.
- `player.sim.ts`, `player.client.ts`: the seat's X Bot, its keys and its camera.
- `foe.sim.ts`: the foe.
- `plugins/stance`: the game's `fast` and `guard` states for the motion3d file's `when`.
- `assets/xbot.rig.json`: the fight's clips (the locomotion, the unarmed strikes, guards, dodges and rolls, and the
  Mixamo reactions), baked onto the X Bot with `yarn bake demo_fight3d` (`assets/demo_fight3d.bake.ts`).
- `assets/xbot.motion3d.json`: the moves (walk, roll, fight, hurt).
- `assets/xbot.anim.json`: the foe's clips.
- `assets/demo_fight3d.json`: the player's keys, camera and lock-on.
