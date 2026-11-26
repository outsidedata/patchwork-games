// demo_motion3d's own numbers of a strike, for the strike workshop (`tools/workshop/strikes.ts`): where in the scene's
// definitions file (`world.defs`) a striker kind's strikes are, by the clip each is played with, and each number of
// one. They are the combat plugin's (`plugins/combat/combat.sim.ts`): the player's `strikes.<clip>`, its damage, the
// knock its blow pushes the foe with, and the striker's own hitstop when it lands.
export const strikes = {
  at: ['player', 'strikes'],
  numbers: [
    { key: 'damage', label: 'damage', unit: '', min: 0, max: 100, step: 1 },
    { key: 'knock', label: 'knockback', unit: 'm/s', min: 0, max: 20, step: 0.1 },
    { key: 'stop', label: 'hitstop', unit: 's', min: 0, max: 0.5, step: 0.01 },
  ],
}
