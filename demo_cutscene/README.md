# demo_cutscene

A scaffold for building on: a cutscene whose cue file speaks the game's own language. The intro cuts
to a gate, dollies in, **opens** it, waits until it stands open, **spawns** a guard beyond it, and
looks through. `open` and `spawn` are not cutscene's words. They are the game's, delivered by the
game's own plugin, the same way demo_walker's `floors` extends walker.

## Playing it

`yarn dev`, then `localhost:5173/games/demo_cutscene/index.html` (or `dev.html`, the testbed). Against
its server: `yarn serve demo_cutscene`, then `/games/demo_cutscene/client.html`. Any key or click
skips the intro.

## Remaking the art

There is none to remake: every mesh is a box or a plane its look builds from the sizes and colours in
`assets/demo_cutscene.json`, and nothing is read from the library.

## How the game's words get into the cue file

- `plugins/stagehand/stagehand.cutscene.ts` exports `behaviors()`, `{ open, spawn }`. Each is a step:
  its `fields` (rules from cutscene's `RULES`), `fire`, and for `open` a `wait` so the file can hold
  on it.
- `main.scene.json` lists `stagehand` in `world.shipped.plugins` and names it in
  `world.cutscene.mods.behaviors: ["stagehand"]`.
- `assets/intro.json` uses the words beside cutscene's own:
  `{ "at": 3, "do": "open", "who": "gate", "over": 2 }`, `{ "at": 3, "do": "wait", "on": "open" }`,
  `{ "at": 3, "do": "spawn", "kind": "guard", "name": "warden", "where": "beyond" }`.
- `open` acts through the gate's own closed act, `open(over)` (`gate.sim.ts`); the rule of what opening
  is stays in the gate. The gate is cast, so a skip advances it and lands it open.

The whole contract is the header of `plugins/cutscene/cutscene.sim.ts` (Steps a game brings) and the
cutscene README.

## The files

| File | What it is |
| --- | --- |
| `main.scene.json`, `main.sim.ts` | the one scene: the yard, the gate, the `beyond` mark, the cutscene |
| `gate.sim.ts`, `gate.client.ts` | two leaves that swing open over the time `open` gives them |
| `guard.sim.ts`, `guard.client.ts` | what `spawn` makes; no rule yet |
| `yard.sim.ts`, `yard.client.ts` | the flat ground at height 0 |
| `player.sim.ts`, `player.client.ts` | the seat; any key or click skips the intro |
| `assets/demo_cutscene.json` | every kind's sizes and colours |
| `assets/intro.json` | the cue file |
| `plugins/stagehand/stagehand.cutscene.ts` | the game's words for the cutscene |
| `demo_cutscene.sim.test.ts` | the intro played and skipped, read off the rows |
