# demo_npc3d

NPCs that see, notice, remember, hear and choose what to do, built on core's `npc3d` plugin
(`plugins/npc3d/`). Each NPC's senses and choices are said once, in its kind's definition
in `assets/demo_npc3d.json`. Every order it gives goes to its body, which is either a walker (drawn by
anim) or a crowd3d person. Each body does what it can of an order and drops the rest, so one
definition works on either body.

The whole contract is core's `plugins/npc3d/README.md` and the header of `plugins/npc3d/npc3d.sim.ts`,
and `demo_npc3d.sim.test.ts` proves it on this game's scenes.

## Scenes

The manager, `demo_npc3d.scene.json`, enters `town`. `dev.html?scene=<name>` opens any of them, with
npc3d's debug views drawn: sight cones, what each NPC knows, the sounds made, the shots fired, and a
card over each NPC.

- `sight`: what a sentry's cone and its edge take in, and what a pillar hides.
- `notice`: noticing, which rises faster for a target that is near and in the middle of the cone,
  and memory, which keeps a noticed row where it was last seen.
- `hearing`: two guards between pillars. A noise carries its `loud` metres, and a guard that hears
  it walks over to investigate.
- `moving`: five walkers and four crowd3d people, sent to a beacon by the same order. The walkers
  walk round the pillars, and the people walk straight through.
- `town`: guards, townspeople and intruders among pillars. Guards chase and shoot intruders, people
  chat by the pillars and flee from threats and shots, and intruders run from guards. Every walk
  goes round the pillars along a nav3d route over the town's graph.
- `wall`: a wall of shapes3d blocks, and a walker and a crowd3d person sent from one side to a place on
  the other. Each walks round the wall along a nav3d route, one leg at a time. `dev.html` draws the
  graph and each NPC's route.

## What it stands on

- Bodies: `walker` and `anim` for walkers, `crowd3d` for people.
- Sight and shots: `hitscan3d` (`hitscan3d.npc3d.ts` hands npc3d its `sees`, and `npc3d.hitscan3d.ts`
  hands hitscan3d the NPCs as bodies).
- Pillars: `shapes3d` cylinders, which stop walkers, sight and shots, and which `solids` draws.
  Blocks: `shapes3d` boxes, the same.
- Going to see a sound and running from one, each once: the game's own plugin `checked`
  (`plugins/checked/checked.npc3d.ts`), which hands npc3d `investigate` and `panic` and keeps what each
  NPC has dealt with on its row's `checked`, `{ <type>: <time> }`.
- Routes: `nav3d` (`nav3d.npc3d.ts` hands npc3d its `route`, over the scene's graph). The wall and
  town scenes' graphs, `assets/wall.nav.json` and `assets/town.nav.json`, are made by the game's bake
  (`yarn bake demo_npc3d`) from each scene's shapes and the ground.
- Ground: `terrain3d` on a flat field (`assets/flat.json`) with a checkerboard (`assets/checker.png`,
  drawn by `assets/checker.mjs`).

## Running it

From core's root:

```
node --experimental-strip-types games/demo_npc3d/demo_npc3d.server.ts
```

then open `games/demo_npc3d/client.html` against it. `index.html` plays it in one tab.

Its tests: `yarn vitest run games/demo_npc3d/demo_npc3d.sim.test.ts`.
