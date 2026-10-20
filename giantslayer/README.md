# Giantslayer

You are a small hero with a sword, in a desert basin. There is one giant, the colossus, 20 m tall,
with three glowing weak points on it. Climb onto it, get to each one and stab it. Break all three
and it falls.

## Playing

Open `index.html` in the game's folder. `dev.html` is the testbed: `?scene=arena` enters the fight,
`?body=ybot` plays the hero as Y Bot, `?bot` lets the seat play itself, and `?watch=x,y,z` holds the
camera on the colossus.

| | Gamepad | Keyboard and mouse |
|---|---|---|
| Move, and climb on a limb | Left stick or d-pad (push part way to go slower) | W A S D |
| Camera | Right stick | Mouse (click to take the pointer) |
| Run (held) | B, or the left stick pressed in | Shift |
| Jump | A | Space |
| Grip (held) | Right trigger or right shoulder | E or the right button |
| Stab (hold to charge, let go to strike) | X | F or the left button |

The buttons are named as on an Xbox pad; a PlayStation pad uses the same places (cross, circle,
square). The pad last used rumbles when the colossus stomps (stronger the nearer you are), when you
take hold, while it roars with you on it, when you slip off, when you break a weak point, when you
are hit, and when it falls.

## How the colossus fights

- It notices you from 120 m, walks toward you, and stops about 13 m off.
- Within 19 m it stomps with its right leg, at most once every 4 seconds. If the leg comes within
  about 2 m of you, you lose 1 of your 4 health and are thrown back.
- At no health you lie flat for 4 seconds, then stand again at the start, whole.
- While you hang on it, it stops walking at you. Instead it roars every 14 seconds to shake you
  off, and it roars every time you stab it.

## Where you can go on it

These are the parts you can hold. Climbing past the end of one carries you onto the next:

```
          head          ← weak point (back of the head)
           ↑
         torso          ← weak point (upper back)
        ↗  ↑  ↖
  upper arms  thighs
     ↑          ↑
  forearms    shins     ← weak point (back of the right shin)
```

- **Getting on:** walk up to a shin and hold grip. You grab whatever limb is within about 1.2 m of
  your hands. The feet can't be held.
- **The way up:** shin → thigh → torso → head. Push up past the top of a limb and you go onto the
  next one; push down past the bottom and you go back down.
- **Arms:** they can be held, but climbing doesn't lead onto them. You'd have to grab one as it
  swings past your hands.
- **On a limb:** up and down climb it, left and right go round it. All three weak points are on its
  **back**, so you have to go round.

## Grip

- The grip bar drains while you hang on. A full bar lasts about 50 seconds, and it drains about
  three and a half times faster while the colossus roars.
- When grip runs out, you fall.
- You need at least a quarter of the bar to take hold.
- On the ground it fills back up, empty to full in about 2.5 seconds.
- Letting go of grip drops you on purpose, at no cost.

## Stabbing

- Hold stab to charge it. It is full after 1.2 seconds. Let go to strike.
- You must be within 2.5 m of the weak point, on the same limb.
- A full charge breaks a weak point in one hit. An uncharged stab does a quarter, so four of those.
- Every stab makes it roar, so charge fully and hang on through the shake.

## A good run

1. Walk to its right leg, staying out of the stomp.
2. Grab the shin, go round to the back, and stab the glowing spot. Hang on through the roar.
3. Climb up the thigh to the torso, go round to the upper back, stab.
4. Climb on to the head, round to the back of it, stab.
5. It dies, drops you, and "The colossus falls".

If grip runs low partway up, let go, refill on the ground, and climb back on.

## Where the numbers are

Every number above is the game's data: the hero's and the colossus's in `assets/giantslayer.json`
(speeds, health, grip, stab, climbing, the camera, rumble), the weak points and the start in
`arena.scene.json`, and the dead zone and analog steps of the sticks in `giantslayer.scene.json`
(`world.player`). Change them there and this page goes out of date, so change it with them.
