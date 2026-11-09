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

`yarn serve demo_library`, then `/games/demo_library/dev.html?server&place=<place>` on the address it prints. The
server builds what the page asks for (Blender runs on node), writes pro-ng's list of every kit kind and landmark as it
starts, and watches pro-ng: a change to its `kit/`, `scenes/`, `material/`, `materials.json`, `procedural.py` or
`pack.mjs` builds the place on the page again, and the page reloads onto it.

The address (`dev.html`):

| key | what it does |
| --- | --- |
| `place=<place>` | the build drawn: a folder of `assets/builds/` |
| `server` | play against `yarn serve demo_library`, which builds |
| `eye=x,y,z&look=x,y,z` | where the camera stands and looks, metres, y up |
| `shapes`, `nav` | the walk shapes and the nav graph drawn from the start |
| `view=<view>`, `flat` | supershader3d's view (shaded, pieces, height, normal, solids), every material in its flat colour |
| `clip=<clip>`, `at=<seconds>` | a clip played on every moving thing that has it; the clips and the looks' clock held at that moment |
| `noeffects` | none of the build's effects thrown |
| `proof` | the place alone, for a shot |
| `material=<name>` | on the catalogue (`place=materials`), the material drawn alone; written as one is picked |

Three tools, one up at a time, picked on the bar across the top. The tool up at first is the one that holds the place
drawn; a tool picked that does not hide the place and shows its picker alone. The bar's right end shows what the
server is building and the last failed build's last line.

| tool | what it is |
| --- | --- |
| Scene | a landmark or town flown round. Down the right: the landmark picker (a landmark picked is built and opened), the walk shapes, the nav graph and a ground, the views, every building and kit thing (pressed to put the camera on it), and the check spots, which `]` and `[` step through |
| Kit | one kit item. Down the right: the kit picker (a kind picked is built and opened), what its header says it is, each key of its studio defaults with its type and what it does, `build` and `reset`, its notes, its effects editor where it has its own effects, and the views |
| Material | one material, drawn alone on its swatch, out of the catalogue (`place=materials`, built first when it is not there). Down the left: every material by its family, as text, under a filter box (each word typed found in the name, look or family); a press picks one, ↑ and ↓ the one above or below. Down the right: its name, look and family, then each setting, a slider and a number box or a colour and its hex, each change drawn at once, a setting moved off its built value marked, and `reset to the built values` |

| control | what it does |
| --- | --- |
| drag | turn round the point looked at |
| Shift drag | move that point across the view |
| wheel | nearer or further |
| W A S D, E, Q | forward, left, back, right, up, down; Shift five times as fast |

## Building and shooting from the command line

From the repo's root:

| command | what it does |
| --- | --- |
| `node --experimental-strip-types games/demo_library/assets/build.ts <scene>` | a scene of pro-ng's (`castle/smallville/rooms/tavern.art`) into `builds/<its last name>/` |
| `... build.ts kit <kind> [<Key>=<value> ...]` | one kit kind from its studio defaults, each key laid over them |
| `... build.ts materials [<material> ...]` | every material on its swatch, or only those named (`builds/materials/`, `builds/materials-pick/`) |
| `... build.ts list` | pro-ng's list of every kit kind and landmark (`builds/library.json`) |
| `... games/demo_library/assets/shoot.ts <place> [<flags>]` | the build shot view by view in headless Chrome; the flags are its header's (`--views`, `--thing`, `--mode`, `--clip`, `--at`, `--effects`, `--prefill`, `--url`) |

`index.html` and `client.html` draw main as its file names it: the tavern, `build.ts castle/smallville/rooms/tavern.art`
first.

## How it is made

- `plugins/library/`: the game's plugin, loaded through `shipped`. `library.plugin.ts` the camera, the tool bar and the
  builds; `library.scene.ts`, `library.kit.ts` and `library.material.ts` the three tools; `library.effects.ts` the
  effects editor;
  `library.things.ts` the place's things off its glb; `library.place.ts` a build made main's place before the boot.
- `addons/library/`: the builds, run where the truth is: `assets/build.ts` as a child process of the server, pro-ng's
  effects files saved, pro-ng watched.
- `library.sim.ts`: the `library` row, which every seat sees: what the server builds, has built and last failed.
- `assets/demo_library.json`: every number the plugin uses (the camera's, the panel's, the overlays' colours).

## Tests

`yarn vitest run games/demo_library/plugins/library/library.effects.test.tsx`: a brightness typed into a layer plays
at once under the effect's full name, and Save hands back the file by its own names.
