# demo_grass3d

A hatch driven through a meadow of grass3d's grass. The blades thin out with distance, sway as gusts
roll across the field in weather3d's wind, part round the car and lie down in its tracks, standing back up
over the next half minute. The meadow's `program` (`assets/grasses.json`) is gpgpu3d's list of ops: patches
of tall lush grass and short dry grass by noise, clumps by worley noise, and patches of blooms, the blades' tips
tinted toward pink where a sparse noise is high (`tipColour`).

- `yarn dev`, then `localhost:5173/games/demo_grass3d/index.html` to drive it: w and s or the triggers are
  the pedal (s from a stop reverses), a and d or the stick steer, space brakes.
- `dev.html` has every number of the grass and of its program's nodes, the gusts and the trampling on a panel, the weather and the
  hour, and views that hold the camera: `feet`, `meadow`, `hill`, `wind` and `track` (`?view=<name>`).
  `?grass=0` is the same scene without grass3d, to measure it against.
- `yarn serve demo_grass3d` and `client.html` drives it against the game's server.

The land is `assets/meadow.json`, written by `assets/meadow.mjs`: rolling hills flattened round the start,
the cc0 Grass004 ground under the grass, rock on the steep slopes and a gravel track painted round the
start that no grass grows on. `yarn bake demo_grass3d` cuts the ground's maps from `assets/cc0-textures.json`.
