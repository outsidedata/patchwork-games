# demo_box3dvehicle

A motorcycle in a yard of ramps, run by box3dvehicle and drawn from the library's pro-ng motorcycle kit. The
bike is one entry of the scene's fleet (`world.box3dvehicle.vehicles.motorcycle` in `yard.scene.json`): two
one-wheel axles on the middle line, the front raked like a fork, a `balance` that holds it up and leans it into
its turns, and a look that is the baked kit (`assets/motorcycle/`). The kit is `pro-ng/kit/modern/vehicles/motorcycle/`
in `~/patchwork-library` (its plan `pro-ng/kit/modern/MOTORCYCLE_KIT.md`), and `yarn bake demo_box3dvehicle` cuts
and packs it (`assets/demo_box3dvehicle.bake.ts`), writing the ride clips' spring and steering numbers from the scene.

`yarn dev`, then `localhost:5173/games/demo_box3dvehicle/index.html`: W and S or the up and down arrows are
the throttle and the brake, A and D or left and right steer, space brakes. A second bike stands parked
in the yard. `dev.html` has a panel for the time of day and the bike's engine and handling numbers.

## The yard

What stands in it is shapes3d's (`world.shapes3d.kinds` in `yard.scene.json`), solid to box3d and drawn by solids
from the same numbers: the ground, a slab of sand (a cc0 texture, `assets/cc0-textures.json`); a `ramp`
down the lane at x = 44 and a `landing` ramp laid for the jump off it; the same pair off to the side, going up
the z axis; a `block`. The sun, the sky and the clouds are skydome3d's, weather3d's and clouds3d's, the sun
standing at noon until `dev.html`'s clock is turned. A ramp's `thick` is how deep its slab goes under its
surface, and a ramp that is to be solid has it reach the ground.

## What it found

- A bike is held up by a roll torque on its chassis, a spring and damper on its lean (`balance`). Without it a
  bike lies flat in under two seconds.
- It leans before it turns: the steer key asks for one turn, the lean moves to what it needs no faster than
  `balance.rate`, and at speed the front wheel is turned by the lean the chassis has, not by the key.
- Its brake is mostly the front's (`brakeTorque` on each axle).
- A raked axle has trail, which pulls the wheel straight: it needs a stiff steering joint (`steering.hertz` 20).
- The roll torque is an outside torque, so a turn at the limit sheds speed and slides rather than tips, and a
  landing it cannot take rolls it over and then rights it. It has no crash model.

## Where things are

- `parking.sim.ts`: a bike no seat holds is parked, controls let go and brake held.
- `player.sim.ts`: the rider, who takes the bike its `start` names and hands it the seat's controls.
