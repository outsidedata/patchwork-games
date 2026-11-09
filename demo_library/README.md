# demo_library

The library's pro-ng viewers, played in the engine: a place pro-ng builds (a landmark, a town, one kit kind, every
material on its swatch) drawn by world3d, supershader3d, particle3d and lights3d exactly as a game draws it, with the
kit studio's key table and effects editor, the scene viewer's overlays and views, the looks studio's catalogue and
sliders, and pro-ng's shots.

Every build is made by pro-ng itself, from the library (`PATCHWORK_LIBRARY`, else `~/patchwork-library`), into
`<system temp>/demo_library/<place>/`, which `assets/builds` links to (make the link once:
`ln -s <system temp>/demo_library games/demo_library/assets/builds`). Nothing of a build is copied into the game, and
the library is read and never written, but for the effects editor's Save, which writes a kit kind's own
`kit/<kind>.effects.json` as the kit studio's Save does.

## Playing it

`yarn serve demo_library`, then `/games/demo_library/client.html?scene=<scene>&place=<place>` on the address it prints
(the dev page on the server: the readout, the errors, the frame rate, every address key below; `dev.html?server` is
the same). The
server builds what the page asks for (Blender runs on node), writes pro-ng's list of every kit kind and landmark as it
starts, and watches pro-ng: a change to its `kit/`, `scenes/`, `material/`, `materials.json`, `procedural.py` or
`pack.mjs` builds the place on the page again, and the page reloads onto it.

The address (`dev.html`):

| key | what it does |
| --- | --- |
| `scene=<scene>` | the scene entered: `art` (the first), `kit` or `materials` |
| `place=<place>` | the build the scene entered draws: a folder of `assets/builds/` |
| `server` | play against `yarn serve demo_library`, which builds |
| `eye=x,y,z&look=x,y,z` | where the camera stands and looks, metres, y up |
| `shapes`, `nav` | the walk shapes and the nav graph drawn from the start |
| `view=<view>`, `flat` | supershader3d's view (shaded, pieces, height, normal, solids), every material in its flat colour |
| `clip=<clip>`, `at=<seconds>` | a clip played on every moving thing that has it; the clips and the looks' clock held at that moment |
| `noeffects` | none of the build's effects thrown |
| `ssr=0` | every scene drawn without the screen-space reflections |
| `glow=1` | lights3d's area lights, the room lit by what glows (`library.glow` in `assets/demo_library.json`); off without it |

Both dev pages (`dev.html`, `client.html`) have a panel at the top right (`demo_library.dev.ts`): the scene, the
screen-space reflections (on or off, and their numbers live), the exposure and tone, the area lights and glow (on or off, and the glow's gain), and `copy
changed values`, which puts every number moved on the clipboard under the scene file it goes in.
| `proof` | the place alone, for a shot |
| `material=<name>` | in the materials scene, the material drawn alone; written as one is picked |

Three scenes, each one tool, gone between on the bar across the top. Each scene draws its own place, `tavern.art`,
`barrel` and `materials` unless the address names another, and keeps its own camera, so going to Kit and back to Art
comes back to where it stood. A scene whose place is not built draws none and shows its picker alone; the materials
scene builds its catalogue then. Each scene builds for itself, and the bar's right end shows what it is building and its
last failed build's last line.

| scene | tool | what it is |
| --- | --- | --- |
| `art` | Art | a landmark or town flown round. Down the right: the landmark picker (a landmark picked is built and opened), the walk shapes, the nav graph and a ground, the views, every building and kit thing (pressed to put the camera on it), and the check spots, which `]` and `[` step through |
| `kit` | Kit | one kit item. Down the right: the kit picker (a kind picked is built and opened), what its header says it is, each key of its studio defaults with its type and what it does, `build` and `reset`, its notes, its effects editor where it has its own effects, and the views |
| `materials` | Material | one material, drawn alone on its swatch, out of the catalogue (`materials`, built first when it is not there). Down the left: every material by its family, as text, under a filter box (each word typed found in the name, look or family); a press picks one, ↑ and ↓ the one above or below. Down the right: its name, look and family, then each setting, a slider and a number box or a colour and its hex, each change drawn at once, a setting moved off its built value marked, and `reset to the built values` |

| control | what it does |
| --- | --- |
| drag | turn round the point looked at |
| Alt, Ctrl or ⌘ drag | look round from where the camera stands |
| Shift drag | move the view with the pointer |
| wheel | nearer or further, toward the point under the pointer; at the nearest, on through |
| double click | look at the thing under the pointer |
| F | frame the whole place again |
| W A S D, E, Q | forward (where it looks), left, back, right, up, down; Shift five times as fast |

The camera eases onto every move.

## Building and shooting from the command line

From the repo's root:

| command | what it does |
| --- | --- |
| `node --experimental-strip-types games/demo_library/assets/build.ts <scene>` | a scene of pro-ng's (`castle/smallville/rooms/tavern.art`) into `builds/<its last name>/` |
| `... build.ts kit <kind> [<Key>=<value> ...]` | one kit kind from its studio defaults, each key laid over them |
| `... build.ts materials [<material> ...]` | every material on its swatch, or only those named (`builds/materials/`, `builds/materials-pick/`) |
| `... build.ts list` | pro-ng's list of every kit kind and landmark (`builds/library.json`) |
| `... games/demo_library/assets/shoot.ts <place> [<flags>]` | the build shot view by view in headless Chrome; the flags are its header's (`--views`, `--thing`, `--mode`, `--clip`, `--at`, `--effects`, `--prefill`, `--url`) |

`index.html` and `client.html` start in the `art` scene, on the tavern (`build.ts castle/smallville/rooms/tavern.art`
first); `kit` draws `barrel` (`build.ts kit barrel`) and `materials` the catalogue (`build.ts materials`).

## How it is made

- `plugins/library/`: the game's plugin, loaded through `shipped`. `library.plugin.ts` the camera, the tool bar and the
  builds; `library.scene.ts`, `library.kit.ts` and `library.material.ts` the three tools; `library.effects.ts` the
  effects editor;
  `library.things.ts` the place's things off its glb; `library.place.ts` a build made a scene's place before the boot.
- `art.scene.json`, `kit.scene.json`, `materials.scene.json` and their `.sim.ts`: the three scenes, each naming its
  tool (`world.library.tool`) and its own place (`world.world3d.place`).
- `addons/library/`: the builds, run where the truth is: `assets/build.ts` as a child process of the server, pro-ng's
  effects files saved, pro-ng watched.
- `library.sim.ts`: the `library` row, which every seat sees: what the server builds, has built and last failed.
- `assets/demo_library.json`: every number the plugin uses (the camera's, the panel's, the overlays' colours).

## Tests

`yarn vitest run games/demo_library/plugins/library/library.effects.test.tsx`: a brightness typed into a layer plays
at once under the effect's full name, and Save hands back the file by its own names.
