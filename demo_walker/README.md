# demo_walker

Run, jump, climb and parkour your way around a checkerboard playground as an X Bot.

Climb the stairs and the ramps, wade into the pond, slide off the steep hill, weave through the
trees and dodge the other walkers strolling about. Climb the ladder onto the big block and jump
off. In the yard, sit on a chair, hide behind a wall and sneak along it, vault the low wall, run up
the platform, and roll, slide and flip.

## Writing your own walker plugin

The point of this demo: walker handles walking, running, jumping, falling, steps, slopes, water and
bumping into things, and you add any other move as a plugin of your own game, without touching
walker. The ladder (`plugins/climber`) and the yard's moves (`plugins/moves`) are written that way.
Copy either one to start.

A walker plugin is a folder `plugins/<name>/` in your game holding `<name>.sim.ts`, a file of plain
functions your player's rule calls on its own row. Every step the rule asks your plugin first whether
it has the body this step; if it does, your plugin moves the body and walker leaves it alone; if not,
walker walks it as usual, and then your plugin gets a chance to start its move:

```ts
// player.sim.ts, each step
if (climb(me, w, dt) || moves.held(me, w, dt, k.moves)) {
  animate(me, w, dt)                  // a plugin has the body: anim just plays the clip it chose
  return
}
// ...the stick's way into d.want, as usual...
const ground = stride(me, w, dt)      // walker walks it, anim plays the walk
if (!d.crouch && !d.move) grab(me, w, ground)   // the ladder decides whether to take over
```

Inside your plugin, while it has the body:

1. **Play a clip held still and drive it yourself.** `play(me, 'mount', { holds: true, rate: 0 })`
   from anim, then write `me.data.clipT` every step, so the clip goes exactly as far as you say:
   forward, backward, or stopped where the stick stops.
2. **Move the body along the clip's own path.** anim's `at(clip.measure, t)` gives how far the clip
   has carried the hips forward and sideways, and how far it has turned, at time `t`. Put
   `me.data.pos` and `me.data.yaw` there, and the feet stay planted.
3. **Hand it back to walker** when the move ends: stand the body on the ground (`stand` from
   walker), set `grounded`, and call anim's `stop`. The next step walker has it again.

What your move needs to remember goes in fields on the player's row, and every number it uses goes in
the player's definition in `assets/demo_walker.json`, so it can be tuned. A new clip is a line in
`assets/xbot.rig.json` and a `yarn bake demo_walker`. A new key is a line in `player.client.ts`, and
an act of the same name in `player.sim.ts` that calls your plugin.

## Controls

| Keyboard | Gamepad | Does |
|---|---|---|
| W A S D or the arrows | left stick | walk |
| Shift | RT or L3 | run |
| Space | A | jump; running at a low wall vaults it, at a high one runs up it |
| E | X | sit on a chair, take cover at a wall, get up, leave cover |
| C | B | crouch and creep |
| Q | LB | dodge roll |
| X | RB | slide, while running |
| F | Y | front flip while running, backflip standing still |
| right mouse drag | right stick | look around |
| mouse wheel | d-pad up and down | zoom |

Walk into the ladder to climb it; W and S climb, Space leaps off, and walking out over its top climbs
back down. Behind a wall, A and D sneak along it.

## Playing it

From the root of core, `yarn vite`, then open `/games/demo_walker/index.html`.
`/games/demo_walker/dev.html` is the same game with a panel for tuning how the body moves.

Against its server: `node --experimental-strip-types games/demo_walker/demo_walker.server.ts`, then
`/games/demo_walker/client.html`.

## Remaking the art

`yarn bake demo_walker` draws the checkerboard and bakes the X Bot with all its animations, from the
library's `characters/xbot` and the clips in `~/troupe-collection`.

## Credit

The X Bot and its animations are from Adobe Mixamo (mixamo.com).
