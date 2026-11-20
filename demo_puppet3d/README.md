# demo_puppet3d

AWOL animals, a Mixamo body and a pro-ng hawk posed by puppet3d.

Keys: 1 to 5 pace, `w` `s` pace up and down, `t` upright or on four legs, `j` leap, `[` `]` station,
`q` `e` camera, `p` take the controls of the hawk at its station or give them back. Flying it: `a` `d`
turn, `w` climb, `s` dive (or the arrows), 1 to 5 its speed, 1 landing it.

## The rider

Station 5 is the horse ridden: the `rider` kind is the horse's definition with a second layout, the
X Bot, hung `on` the horse's `body:spine 2` with `along`, `offset` and `turn`. The horse's solver
stands its bones first, then the X Bot is hung on that bone and seated by a cues driver on the
horse's own senses (`stride`, `speed`, `clock`), so it rides each stride the way the head and tail do.
`rider.cues.mjs` writes the `rider` definition, its seat and every bone's cues; tune the pose there
and run `node games/demo_puppet3d/rider.cues.mjs`.

`pose.html` (`?kind=<kind>`, `rider` by default) poses a kind's hung layouts with puppet3d's own
`played`, `hung` and `skinned` on the world layout's rest skeleton: drag and wheel to orbit, side,
front, back and top views, a slider for each sense, and `R` to read the definition again.

## The hawk

Station 6 is the red-tailed hawk, a bird of the library's pro-ng kit (`pro-ng/scenes/animals/red_tailed_hawk.json`),
posed by cue sheets that read its own flight. Pace 1 perches it on the ground with its wings folded; 2 flies
it beating its wings with short glides between; 3 glides it longer; 4 and 5 soar it, a few beats now and
then. It beats harder as it climbs and takes off, pulls its wings in when it dives, and rears back with its
legs down and its tail spread as it lands. Its long feathers are the kit's `feathers` parts, laid on the
wing and the tail, and hang on art bones of their own (each wing's `wrist feathers primaries.first`,
`wrist feathers primaries.last`, `wrist feathers alula` and `elbow feathers secondaries`, the tail's
`tail feathers rectrices.first` and `tail feathers rectrices.last`), which sheets of their own turn, so the
feathers ruffle and the tail fans whatever the wing does.

- The bake's `birds` (`assets/demo_puppet3d.bake.json`) builds it with the library's `pro-ng/build.mjs`
  and writes `assets/hawk/`: its glb, its looks file and their pictures for supershader3d, and its rest
  skeleton for puppet3d.
- `hawk.cues.mjs` writes the `hawk` definition, its sheet (`assets/hawk/hawk.json`) and its ten cue sheets
  (`assets/cues/hawk.*.cues.json`); tune the poses, the wing's stroke and the solver's numbers there and run
  `node games/demo_puppet3d/hawk.cues.mjs`. Its header says each sheet and when it plays.
- `plugins/aviary/aviary.plugin.ts` dresses its skin in supershader3d's materials before puppet3d builds
  its body, so it is drawn in its own looks.
- paddock's `flier` takes it round its circle, on the ground at a stand and in the air as it gathers
  speed, its rise gathered and shed so it comes to rest at its height, and brought to a stand it comes
  down along a slope and stops as it touches the ground. With `p` the seat's `keeper` takes hold of it
  (core's `take`) and it is flown by the keys, the camera behind it; `p` again lets go, and its circle goes
  on from where it is.
- `plugins/aviary/aviary.puppet3d.ts` delivers puppet3d the `aloft` solver, the driver of its flying
  sheet. It stands no bone. It reads the row's own motion and gives off what the sheets and their weights
  read: where the wings are in their beat, how much they are beating or held in a glide, how hard the bird
  works, brakes and dives, how far it leans into its turn and how steeply it climbs. It lifts the body
  with each stroke down. Its numbers are `assets/hawk/hawk.json`.
- `dev.html`'s `__hold(true)` stops the page's clock and `__run(frames)` plays that many frames, so a
  wing beat can be looked at a frame at a time.

## Sheets from the library

Over its walk, each animal plays cue sheets from the library's `cues/`, each naming only its own bones:
the horse wags its tail and flicks its ears, the tiger looks round and wags, the lion wags and roars
every ten seconds, the cheetah grazes when it stands and flicks its ears. The X Bot nods, and waves when
it stands. `yarn bake demo_puppet3d` (`assets/demo_puppet3d.bake.ts`) copies the sheets into
`assets/cues/`; the walk and upright cues each animal's solvers play are its own sheets there too.

## Manes and tails

The horse's mane and tail and the lion's mane are hair3d's, grown on their bodies from the hairs file
`assets/hairs/paddock.hairs.json`, which `main.scene.json` names (`world.hair3d.hairs`, with
`mods: { skins: ['puppet3d'], behaviors: ['render3d'] }`): the horse's mane on the top of its neck
between two planes either side of its middle, its tail on the last three tail bones, the lion's mane all
round its neck, the back of its head and the front of its chest. Each hangs, swings as the animal walks
and blows in the wind. The herd's horses and lions wear the same hairs from a file of their own,
`assets/hairs/herd.hairs.json` (`mods: { skins: ['crowd3d'], behaviors: ['crowd3d'] }`), every horse in
one draw; three takes the spaces out of a glb's bone names, so the tail's bones are `tail_5` there and
`tail 5` here.

## The herd

`dev.html?scene=herd` is the AWOL animals as a crowd3d crowd, some walking up and down their lines and
some standing, drawn from `assets/awol/<animal>.clips.glb`: each animal posed by puppet3d and written
with a `walk` and an `idle` by `plugins/puppet3d/puppet3d.clips.ts`, which the bake runs. Every body is
on the horse's skeleton, so crowd3d plays the horse's clips on all four.

## An animal's files

Each animal is three files in `assets/awol/`:

- `<animal>.glb`: its body, on the AWOL bones.
- `<animal>.skeleton.json`: its bones as its glb has them, from its own glb.
- `<animal>.json`: its sheet, the numbers of how it walks: `walk` on four legs, `upright` on two.

Its definition in `assets/demo_puppet3d.json` says how it is posed: its senses, and its layout's
drivers, the four-legged walk and the upright, each with the cues of the bones it does not stand.

The lion's and the cheetah's sheets and definitions are copies of the tiger's.

## Adding an animal

Put its three files in `assets/awol/`.

In `main.scene.json`, three catalogue entries in `world.loader.assets`:

```json
"<animal>": { "type": "json", "url": "/games/demo_puppet3d/assets/awol/<animal>.json", "preload": true },
"<animal>Skeleton": { "type": "json", "url": "/games/demo_puppet3d/assets/awol/<animal>.skeleton.json", "preload": true },
"<animal>Skin": { "type": "model", "url": "/games/demo_puppet3d/assets/awol/<animal>.glb", "preload": true },
```

the kind in `world.puppet3d.kinds`, a prefab in `prefabs` (a copy of another animal's), and an actor
at the next station:

```json
{ "is": "<kind>", "at": <station>, "pos": [<x>, 0, <z>] }
```

In `assets/demo_puppet3d.json`, one more in `player.stations`, and the kind's definition: a copy of
another animal's, its `sheet`, both drivers' `gait`, its `skeleton` and its `skin` named for it.

In `main.sim.ts`, the kind on `sim`:

```ts
<kind>: strider
```
