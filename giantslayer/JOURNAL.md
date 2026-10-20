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
