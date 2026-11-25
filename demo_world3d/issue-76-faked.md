# Issue 76, faked

Issue 76 (core, "Built light: interiors lit from the space description stronghold and pro-ng write") lists eleven
things the renderer would work out from a space description the build writes. Before building any of that, we
faked it by hand in one scene, the tavern, to see what each thing looks like and how many numbers it takes. This
file says what was faked, what was seen, and what is left for the solver to decide.

Nothing here is the solver and nothing here is in the engine, a plugin or a scene file. It is the tavern in
`dev.html` only.

## Where it is

`dev.html?scene=tavern`, then walk inside. The `faked light` folder at the bottom of the panel has `day`,
`night` and `lightning` buttons and seven sliders. Every other scene and `index.html` are unchanged.

- `dev.html`: one block, `faked` / `fake` / `fakeUpdate`, that runs only when the scene is the tavern.
- `assets/tavern/tavern.hints.json`: every number the block uses.

## The hints file

Written by hand from what stronghold's tavern solver builds (its door, its three front windows, its four side
windows, its two hearths, the table rows, the counter, the barrels, the stair). It holds:

- the room's box (inside walls, floor, the ceiling's underside);
- the sun's direction, one fixed way for both day and night;
- each opening: where it is, which way it faces into the room, its width and height, whether it throws a beam,
  whether it lets sky in;
- each hearth;
- the floor under each table set, the counter, the barrels, the hearths and the stair, and strips along the
  walls, as places to darken;
- two presets, `day` and `night`: the hour, how much ambient is left inside, the exposure inside, and the
  brightness of window skylight, sunbeams, bounce, hearths and the glow out of the windows.

This is the list the build would have to write.

## What was faked, one to one with the issue

1. **Sunbeams.** The sky's key light is aimed one fixed way, so the sun's own shadow lands on the floor through
   the real holes in the wall, wall thickness and all.
2. **Shafts in the air.** A glowing prism from each front window and the door down to where the sun's light lands
   (each opening's corners pushed along the sun's direction to the floor), with about fifty dust specks drifting
   inside each.
3. **Daylight through each opening.** A spot light at each window, facing in, warm white.
4. **Bounce.** A warm point light on each sunlit patch.
5. **Lamps that know their room.** A flickering point light on each hearth. It lights the room it stands in; the
   tavern is one room, so this does not show whether it stops at a wall.
6. **Ambient occlusion from what is known.** Soft dark patches on the floor under each table set, the counter,
   the barrels and the hearths, and along the foot of each wall.
7. **Night from inside out.** At night a warm spot light faces out of each front opening onto the street.
8. **Lightning, moonlight, fire.** Lightning is a short spike in the window light. The moon comes through the
   same openings, since the key light is the moon at night. The hearths flicker.
9. **Going in and out.** While the player stands inside the room's box, the sky's ambient and its environment
   light fall to a fraction and the exposure rises, easing over about a third of a second each way.

Not faked: light between rooms (the tavern is one room, and the stair to the upper floor is not a second lit
space), and reflections that fit the room (they need probes).

## What was seen

All of it in a Chrome tab on this machine, from screenshots of the tavern at noon and at night. Frame rates are
that tab's own counter, not the benchmark.

- At noon, with nothing added, the inside is lit evenly by the sky: the issue's premise holds.
- Taking the sky's ambient away inside is what makes it a dark room. With it dropped and the window light hidden,
  the room was dark, the hearth glowed, and the tables were brown.
- One number decides whether a room is bright by its windows or just bright. Window light at 60 lit the whole
  floor evenly; at 10 it made pools by the windows. The table legs also went blue at 60 and were brown at 10. The
  cause of the blue was not found.
- Three's rectangle light (the exact "how much of the window a point sees" the issue names) was tried first. With
  it the tables went blue and the tab ran 22 frames a second; with it hidden, 35. It was replaced by spot lights.
  Whether the rectangle light is wrong for this renderer's materials, or only needed a lower number, was not
  tested.
- The two hearths as shadow-casting point lights ran the tab at about 3 frames a second; with their shadows off
  (and the window light recoloured in the same step), 28. They were left without shadows.
- The beams met the sun's patches on the floor, because both come from the same direction. The dust is visible
  in the beams.
- At night the room is lit by the hearths, the windows show pale moon patches on the floor, and the beams are
  faint.

Looked at as a whole in a day shot and a night shot. Not looked at one at a time: the bounce lights, the
floor-darkening patches, the lightning, the flicker and the glow out of the windows onto the street.

## What the faking cost in numbers

Seven sliders: ambient left inside, exposure inside, window skylight, sunbeams, bounce, hearths, glow outside.
Plus the hand-placed numbers in the hints file. The `day` and `night` presets set all seven at once.

## What the solver has to decide

- **What it writes.** The list under "The hints file". Every opening's place, facing and size is already in the
  pro-ng window and door records the tavern solver passes on (shares of a face, from which metres follow), and the
  room box follows from the box's size and wall depth.
- **Ambient inside.** Faked by the player's position against the room's box, which is all or nothing across the
  whole scene. The issue asks for ambient that falls with what each point sees of the windows. That is the part
  the fake does not answer.
- **Window light.** A spot light per window is a stand-in. The issue's exact form-factor light is the open
  question above.
- **Darkening.** Floor patches under what stands in the room are a trick that works on a flat floor. The issue
  asks for corners and the foot of a wall from the room's own boxes.
- **Cost.** Not measured with `benchmarking-a-game`. The frame rates above come from the page's own counter,
  which that skill says is not a measure.
