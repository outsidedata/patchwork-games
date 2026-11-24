# demo_clothes3d

A robed person walked by walker among twelve robed bystanders, each drawn by anim as the bare body,
wearing a set of garments that clothing3d draws. The garments are their own FBX, rigged on the same
Mixamo skeleton as the body and baked the same way, so they play the body's clips on the body's bones.
Every garment on every body is one mesh, drawn in supershader3d's materials in one draw call.

- W A S D walk; C takes the clothes off and puts them back on.
- `assets/robed_person.rig.json` names both FBX files as bodies of one rig; `yarn bake demo_clothes3d`
  bakes `robed_person_bare.glb` and `robed_person_garments.glb` from the library's
  `characters/robed_person/`, and `clothes.looks.json`, the materials the garments are worn in
  (`robe`, the library's `broadcloth`, and `belt`, its `leather`).
- Each row's `clothing` field lists the loader models it wears; `world.clothing3d.models` names the
  look each garment material is worn as and its uv's metres; `world.clothing3d.mods: { bodies: ['anim'],
  looks: 'supershader3d' }` puts them on the bodies anim draws, in the looks `world.supershader3d.looks`
  names.
