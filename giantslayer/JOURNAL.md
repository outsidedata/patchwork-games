# giantslayer journal

The climbing work, step by step, as it happens. The plan is issue #41 (outsidedata/core): climbing on a
net made from a mesh's vertices, built one small step at a time, each proven before the next. Every step
is proven both ways, by numbers read off the running game: that he is ON the surface, and that nothing
of him is inside it.

## 2026-10-20

**The colossus is mechworker.** The rig `assets/colossus/colossus.rig.json` names
`characters/mechworker/mechworker.fbx`; baked at size 12, the same 9 clips. It stands 21.5 m. Every
material came out with metallic 0. Seen walking to the hero and stomping in the arena.
Commit: games `faea3bf`.

**A first try at the whole climb, thrown away.** Built the net, hold modes, swinging, stepping hands
and feet, IK limits and a bot in one go and tested it on a giant walking, roaring and stomping. The hero
was nowhere near the body. Everything reverted except the mechworker bake. Lesson: the steps in #41,
one at a time, the giant last.

**1a. A box in the yard.** A new scene, `yard` (`dev.html?scene=yard`): the gym's flat plain, one
`wall`, and the hero's start 6 m in front of it. The wall is a box of its definition's `size`
`[6, 8, 1]` metres, each face a grid of `cell` 0.25 m squares (climb's `box`), standing on the ground
under it (walker's height).
Proof (`yard.test.ts`, the game booted and its page run in node): the yard's rows are only scenemanager,
loader, skydome3d, start, wall and the hero; the wall's base is at the height the hero's feet stand at;
the page draws one `wall` mesh whose box is exactly 6 × 8 × 1 m from the ground up, centred on its row.
Commit: games `871047e`.

**1b. The wall's net.** climb's `netOn(mesh)`: a point for each place a vertex stands (the box's faces
share their edges' vertices, so they are one point), a link for each edge of a triangle, and each
point's way out the faces round it, by area. The wall draws it over itself while its definition's
`shown` is true (`dev.html?net`).
Proof (`yard.test.ts`): on — every point and the middle of every link is 0 m from the box's surface,
and a point for every place a vertex of the mesh stands, no more; each point's way out is one long and
leads out of the box (1 cm along it is outside, 1 cm against it inside); every link is an edge of a
triangle, both ways, no longer than a cell's diagonal; not inside — no point or link middle is in the
box. Drawn: hidden until `shown`, then a line for each link, each end on its point where the wall stands.
Commit: games `52af105`.

**1c. The hero put on one spot.** A hold on a net is `{ on, a, b, t }`: two linked points and how far
from one to the other. climb's `stay` puts the hero there every step: facing into the surface, upright,
his root set back so the middle of his palms (his own `ends`, in his hold clip's first frame) is on the
spot, standing, not falling.
Proof (`yard.test.ts`): put on the point nearest the middle of the face 4 m up, over 120 frames his place
does not move (0 m), his yaw does not change, he is not falling (`grounded`, no velocity), his front is
the way into the wall (cos = 1), his drawn model's up is the world's up, and his feet are 1.7 m up.
Measured for 1d: in the `dangle` clip his left hand is 6 cm into the wall, his right 9 cm, and his right
thigh 20 cm: that clip hangs from a ledge with the hands straight over the hips and the knees forward.
Commit: games `6144166`.

**1d. Palms on the face.** Every hanging clip measured against the wall, held on its first frame after
its fade: `hang` (Braced Hang) puts the left hand 48 cm in and the right 31 cm off, useless on a flat
face; `dangle` the thigh 20 cm in; the wall-climbing clips (`shimmyL`, `climbUp`, `climbDown`, `drop`)
have both hands 4–7 cm in, 1.5 cm apart, and the toes about 10 cm in. A net hold now holds its own
clip, `clips.still` = `shimmyL` (the Braced Hang Shimmy's first frame, its braced pose), at rate 0, and
`climb.palm` = 5.55 cm, the hand's skin past the middle of its palm.
Proof (`yard.test.ts`): held still for a second past the fade, his clip is `shimmyL` at 0 every frame,
and each hand's nearest skin is within 1 cm of the face: left 0.78 cm in, right 0.74 cm off.

**1e. Measured against the wall.** Every vertex of his drawn skin, every frame for a second: nothing
above the knees but the touching hands is in the wall at all (0 m). His shins and feet are: the right
toes 4.6 cm in, pressed to the wall in the braced pose. They come out when his feet reach the face by IK
(3d); until then the test holds them to 5 cm.
Commit: games `67644bc`.

**1f. Grab from the ground.** climb's `grabNet`: the point of a wall's net nearest the middle of his
palms (as they are in his still pose where he stands), within his `reach` 1.2 m. His rule tries a wall
before the colossus.
Proof (`yard.test.ts`, the page's own keys: `w` walks him at the wall, `e` holds grip): every step
before he took hold, no point was within 1.2 m of his palms; the step he took hold, he took the point
nearest them (point 262, 2.5 m up the face, 1.17 m off), at its spot; settled, both palms on the face
within 1 cm, his root 6.8 cm and his lowest skin at or over the ground.

**1g. Let go.** Grip let go, the hold is dropped the next step and he falls. Off a net, `release` first
moves him back from the surface until the toes of his standing pose (his `still` role's first frame,
his own `ends`) are `climb.clear` 3 cm off it: without it he landed with a toe 2.7 mm in the wall.
Proof (`yard.test.ts`): from 4 m up he is off the ground, then lands (`grounded`) at the ground's
height, standing in `idle`, upright as drawn, his lowest skin 1.2 cm into the ground (his soles on it,
within 2 cm), and nothing of him in the wall (0 m).
Commit: games `c35b7ea`.

**2. Climbing the wall.** climb's `climbNet`: the stick (the page's `w a s d`) pushes his hold over the
net at `climb.speed` 0.8 m/s, the way his right and the world's up laid on the surface. First tries got
three things wrong, each seen in the numbers, each fixed:
- pushed down he first slid a whole cell (25 cm) sideways: a hold starts on any link, and he kept going
  along it because it lay within `turn` of down. Now at every point he takes the best link onward.
- pushed up-left he went straight left: the left and up links tie on the face's grid and he took the
  same one each time. Now of the links within `fan` (45°) of the push he takes the one that leaves him
  nearest the straight line he is pushed along (`lat`, his drift to one side of it, kept on the hold).
- at a side his outer hand overhung the edge, 1.3 cm off the face. Now a point is taken only where both
  palms, placed as his still pose places them, land on net facing within `bend` of it.
Proof (`yard.test.ts`, every frame of every push: the hold on the front face, both palms within 1 cm of
it, nothing above the knees in it, shins and feet within 1e's 5 cm, root and skin over the ground, and
his root the same offset from his hold every frame, his body following it):
- 2a up: straight up (0 m across), 0.8 m/s from the step the push reaches the rules.
- 2b down, left, right: each straight (0 m across), at the same speed.
- 2c the four slants: up-right and down-left run the face's diagonal links straight; up-left and
  down-right zigzag up and across, each within 10° of the push.
- 2d at the top and both sides he stops where his hands are all on the face and a cell further would put
  one past its edge, and stays; down, he stops before his root would go under the ground.
- 2e going up, every step's move is his speed times the step, to a nanometre.
Commit: games `a96bc8a`.

**3a. One hand by IK.** climb gets its browser half (`climb.plugin.ts`, shipped) and ik3d's `limbs` mod
(`climb.ik3d.ts`); the yard lists `shipped` and `ik3d` after anim. Each limb `climb.ik` names reaches the
net point nearest its middle as its clip puts it, its middle a `palm` out from the face there, as it is
turned, its elbow bending the way the clip bends it. Core: ik3d's `unbend(id)` puts back the last
solve's bones at once, so the page reads the hand where the clip has it this frame and not where last
frame's reach left it (without it the hand clung to its old point). ik3d's own tests were not run: only
giantslayer's are run in this work.
Measured while climbing: the point nearest the clip's hand jumps a row (12.5 cm) above it and the arm,
near straight hanging, falls 5.7 cm short of it for five frames. Planting a hand on a point while the
body moves is step 4's stepping; until then a hold that moved since the last frame reaches with nothing
(its clip's hands, as in step 2), and when he stops the hand goes to its point in one frame.
Proof (`yard.test.ts`): held still, every frame for a second his left palm's middle is on the net point
nearest it, a palm out, within 1 mm, ik3d short under 0.1 mm, not moving (under 1 µm); its skin 0.86 mm
into the face (it was 7.8 mm); the right hand, the rest and the feet as before. Step 2's tests all pass
with it.
Commit: core `639ef07` (ik3d's `unbend`), games `0cec4b0`.

**3b. Both hands by IK.** `handR` joins `climb.ik`. Two cases found by step 2's tests once both hands
reached when he stops:
- by a side edge the right hand's nearest point was the wall's corner, facing 45° off, and its palm sat
  1.7 cm off the face. A limb now reaches only points facing within `bend` of where he holds.
- stopped going down (his root at the ground), the nearest points were 6 cm above his hands and his arms,
  near straight hanging, fell 2.5 cm short. A limb now reaches only points it can reach (its end bone,
  placed for the point, within its two bones' lengths of its first bone, less ik3d's millimetre);
  failing the nearest point, the nearest of those that can, out to `climb.near` 4 links.
Proof (`yard.test.ts`): held still, every frame for a second each hand's middle on its point, a palm
out, within 1 mm, ik3d short under 0.1 mm, not moving; skins 0.86 mm and 0.075 mm into the face, both
within 1 mm. All of steps 1 and 2 pass with both hands reaching whenever he stops.
Commit: games `a9ec42a`.

**3c. Palms flat.** A palm faces along `side` times the cross of the line across its knuckles (index to
little finger) and the line from its wrist to its middle fingertip; each hand is turned the shortest way
that lays its palm onto the way into the surface, and placed so turned. Laid flat, the hands' skin sat
2.81 and 2.82 cm off the face: the 5.55 cm was the clip's tilted hand. So two numbers now: `brace` 5.55
cm, how far the rules stand his body back (his clip's hands while he climbs without IK), and `palm`
2.74 cm, the skin of a flat palm past its middle.
Proof (`yard.test.ts`): in his bind pose (the T-pose) both palms, by `side`, face down (y under −0.9), so
the signs are right; held still, every frame for a second, each drawn palm faces into the face within
1°, and its skin is 0.0009 mm and 0.09 mm from it. 2d now says what its stop means: he stays however long
he is pushed, hands on the face, no further from the edge than a cell and half his hands' spread.
Commit: games `678b47c`.

**3d. Feet by IK.** A limb now names the two bones whose middle touches (`touch`) and its own `skin`
past that middle: for a hand its wrist to its middle fingertip (skin 2.74 cm, laid flat by `across` and
`side`); for a foot the ball of its foot to its toe tip, keeping the turn its clip gives it. With skin 0
the shoes went 3.55 cm (left) and 3.27 cm (right) into the face: those are the feet's `skin`. With the
toes moved out onto the face the left shin went 3.7 cm into the wall and the thigh 0.6 cm: the knee,
bending the way the clip bends it (toward the wall), bent further in as the hip-to-foot distance shrank.

**3e. Elbows and knees out.** The bend ik3d is handed is the clip's, with what of it points into the
surface taken off: the into-surface way squared to the line from the hip (or shoulder) to the target
first, since ik3d squares the bend to that line and a plain cut let 16.5 cm of it back in. A knee the
clip bends at the wall swings out to the side.
Proof (`yard.test.ts`): held still with all four reaching, every frame for a second, each foot's middle
on its point its skin out within 1 mm and its skin 0.03 mm from the face; each elbow and knee outside the
wall and bent with nothing toward the face (to 0.01 mm: a joint bent along the wall is 0 to the
arithmetic's grain); every limb reached (ik3d short under 0.1 mm); nothing of him in the wall but touching
skin, 1 mm (above the knees 0; 1e's toes, 4.6 cm in on the clip alone, are now 0.03 mm).
Commit: games `30dfc15`.

**3f. Joint limits.** Core: ik3d's limbs (a kind's, and those a mod hands) take `bend` `[least, most]`
degrees, the angle at the elbow or knee (180 straight), and the solve cuts the reach to what those angles
span. climb hands each limb its `bend`: elbows 30–178°, knees 30–179°. A wrist limit was tried too and
taken out: it was not on the list, its number was mine, and it counted from wherever the clip's hand sat
on its forearm; with it at 80° the palms could not lie flat, since flat needs about 100° of turn from the
clip's hand, nearly all bend, little roll (measured).
Proof (`yard.test.ts`): held still with all four reaching, every frame for half a second, each elbow and
knee is within its limits (121°, 125°, 57°, 38°) and bends to the side its clip bends it (the bend off its
line has a positive dot with the clip's, read by ik3d's `unbend`); and the limit bites: with the left
elbow's least raised to 140° the elbow opens to 140.0° and no less, and the hand falls 3.8 cm short of
its point. ik3d's own tests were not run.
Commit: core `15c4fe3`, games `cfddf02`.

**4. Stepping as he climbs.** The page now reaches while he climbs too. Each limb's touch is a point it
is planted on, held while the body moves; it steps to another, lifted `step.lift` 6 cm off the surface at
the middle, over `step.time` 0.3 s; the diagonal pairs step together, one group at a time. Found and
fixed, each by numbers:
- a step started from a point the limb could no longer reach and the toes poked in: a step now begins
  where the end bone really was (kept as an offset from its old point).
- "reach" ignored ik3d's knee limit, so a foot planted where its knee could not straighten fell short:
  reach is now the span the `bend` limits allow.
- the steps could not keep up. Measured: in the braced pose his shoulders stood 47 cm off the wall with
  55 cm arms, so a hand had at most 8 cm of room anywhere on the face. The body now stands in nearer
  (`brace` −0.12, from +0.0555): shoulders 32 cm off, thighs and hips still clear; and the forearms,
  laid along the wall, are kept off it by giving each elbow at least `out` 0.3 of its bend away from the
  surface (a forearm had sunk 1.9 mm).
- `climb.speed` 0.8 m/s was mine and too fast for two pairs of 0.3 s steps; it is 0.35 m/s.
- which point to step to: nearest where the clip has the limb, or nearest where it will be, both failed
  (the feet, already bent, flipped up and down between two points). A limb now wants, of the points
  round where its clip has it, the one it could hold longest if his body went on as it is going
  (`step.ahead` 2.4 s, looked at in eighths, with `step.slack` 5 cm of room); it is behind with less than
  two steps' time left; the group with least time left goes first; partners go together.
Proof (`yard.test.ts`, 3 s each way: up, down, left, right and the four slants, every frame): a planted
hand or foot is on its point, its skin out, within 1 mm, and reached (ik3d short under 1 mm); it does not
move between frames (1 mm); every limb steps (1 to 4 times) and lifts 6 cm doing it, never more than the
lift and 1 cm off the face nor into it, and lands on the point it stepped to; never two groups at once;
none ever gives up its point; and every frame he is on the face with nothing of him in the wall deeper
than touching skin, 1 mm. All of steps 1–3 pass with it.
Commit: games `f779a45`.

**5. Tilted walls: the slab, the overhang, the ceiling.** The wall takes `pitch`, how far it leans back
about its own x through its base's middle (under 0 it leans out over him). Its net is placed by it
(climb's `heldPoint` and `heldWay`), and it is drawn the same way. The body is framed on the face: his
front points into it, and his up is the world's up laid along the face. On a face too near flat for
that (a ceiling), his up is the one he had, or, the first step, the way he faced when he took hold. That
frame is kept on his row as `lean` (null off the wall) and the page turns his body by it. The sim reads
the same frame for which way the stick moves his hold, for which links fit his hands, and for where his
palms sit. The page needed nothing new but the turn: it plants, steps and reaches in the face's own
terms already.
Proof (`yard.test.ts`, on the slab leaning back 20°, the overhang leaning out 20°, and the ceiling, the
wall laid on its back face down 4 m up):
- held still, every frame for a second, his front points into the face within a degree, and his up lies
  along it within a degree; each hand and foot has its skin on the face within 1 mm; nothing of him is in
  the wall deeper than touching skin, 1 mm (5a, 5b, 5c);
- under the ceiling he faces straight up, and his up is the way he faced when he took hold (5c);
- climbing up, down, left and right for 3 s on each (5d): every frame his hold is on the face, and
  everything 4 checks on the wall holds: planted limbs on their points within 1 mm and not sliding,
  every limb stepping (1 or 2 times) and lifting 6 cm in diagonal pairs, and nothing of him in it.
  He moves at least as far as his speed takes him in 170 frames.
All 23 tests of `yard.test.ts` pass (169 s), steps 1–4 among them.
Commit: games `ba3d69b`.

**6. A sphere: hang still on it.** A new kind, `sphere`, in the yard 12 m beside the wall, its middle
6 m up: radius 3 m, cells 0.25 m. Its mesh is climb's `sphere`, an icosahedron with each face cut 13 to
an edge and pushed out onto the ball, so it has no poles and no seam. A held kind's definition now names
its `shape` (`box` or `sphere`), and the net is made from it (`meshOf`). The wall and the sphere share one
rule, `settle` (stand that high over the ground), and one look, climb's `show`, drawn from a shape's first
tick because the game's own plugin is not on the page until then. Found and fixed, each by numbers:
- a limb took only points facing within `bend` of the hold. On a ball 1.4 m down to the feet the surface
  has turned about 27°, more than `bend` allows. A limb now takes the points reached from the hold over
  links that each turn within `bend`: on a flat face that is the same set as before, and on a ball it is
  all of it.
- hands stood 4.2–4.5 mm off the ball and toes 6–9.6 mm in. A palm laid flat at a vertex touches a flat
  wall with its heel and finger pads, but on the faceted ball the surface falls away under them. A foot
  kept the clip's turn against the hold, not against its own point. Now a foot turns as the surface turns
  from the hold to its point. And every planted or landing hand and foot is moved along the way out until
  the nearest vertex of its own skin rests on the net's triangles under it (`outOf`).
- on the lower half a foot stepped once while he held still: the limbs planted on the first frame, while
  his clip was still fading in from standing, both feet on one point, then slipped out of reach as the
  pose settled. A limb now first plants once his clip has faded in to full (anim's `blend`). Probed: both
  feet plant once, 11 frames in, on two points with 28 and 30 cm of room, and never step.
- the skin rest cost 13.2 ms a frame (15,562 hand and foot vertices read and tested every frame). The
  skin is now kept in each end bone's frame and read again only when a bone under it moves. A vertex is
  tested only if its height, less the highest triangle corner there, could still beat the nearest found.
  climb's page tick is now 1.18 ms (0.85 ms without the rest), measured over 300 frames on node.
Proof (`yard.test.ts`):
- 6a: the net has a point for each vertex place, 1692 (10·13² + 2), every one within 0.12 µm of the
  radius and of the mesh; each point's way out leaves the ball. Every link is a triangle's edge, both
  ways, 21.5–30.5 cm long. Points − links + triangles = 2, so it is closed all round. It is drawn round
  the row as far as its corners go, and its net is drawn line for line when shown. A new measure, the
  signed distance to any closed mesh, agrees with the box's own at 4000 places to a micrometre.
- 6b, 6c, 6d (with 6e in each): on its side, its upper half, its lower half and underneath, held still
  for a second, every frame: his front points into the surface within a degree and his up lies along it
  within a degree. Each hand's and foot's nearest skin is within 5 µm of the ball's mesh. Nothing else of
  him is in it at all (0), and no foot more than 5 µm.
- the wall's tests all still pass, and its hands and feet now rest within 3 µm of the face (0.09 mm
  before).
Not checked: the sword in his right hand is not skinned, so no measure reads it. Nothing has been looked
at in a browser.
All 27 tests of `yard.test.ts` pass (291 s).
