# demo_clothes3d

A robed person walked by walker and drawn by anim, wearing a set of garments that clothing3d puts on
the body. The garments are their own FBX, rigged on the same Mixamo skeleton as the body and baked the
same way, so they play the body's clips on the body's bones.

- W A S D walk; C takes the clothes off and puts them back on.
- `assets/robed_person.rig.json` names both FBX files as bodies of one rig; `yarn bake demo_clothes3d`
  bakes `robed_person_bare.glb` and `robed_person_garments.glb` from the library's
  `characters/robed_person/`.
- The player's `clothing` field lists the loader models it wears; `world.clothing3d.mods.bodies:
  ['anim']` puts them on the bodies anim draws.
