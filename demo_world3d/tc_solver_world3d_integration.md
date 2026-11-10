# TrinityCore, the solvers and world3d

How a place's people get their quests, shops and scripts: the records, the solvers that place the people, and the
game that joins them.

```
trinitycore > ??? > overrides > solvers > compilation > [ game + trinitycore ]
```

## Vocabulary

Identity, class, record, override strings and how they name each place's people:
[composing_a_world.md](composing_a_world.md).

## The chain

### trinitycore

The game's records, in TrinityCore's shape: `quest_template`, quest starters and enders, vendors, trainers, SmartAI
scripts. demo_world3d's plugins already read these shapes: `quests`, `talk`, `vendor`, `crafting`, `enchanting`,
`smartai`, `classes`, `loot`.

Each record is filed under a class and a record name: the smith kind's `malibu` is its stock in the vendor file, its
recipes in the crafting file and its lines in the talk file; the questgiver kind's `33` is its quests in the quest file
and its lines in the talk file.

### ???

Not known yet: how the records become override strings, which person in the world is cast as which class and record.

### overrides

The story, written into one world: override strings, each one key chain to one person or thing and one value, giving
people the world already has their class and record:

```
village-terrain3d.tavern 1.tavern_speaker 9.class = 'questgiver'
village-terrain3d.tavern 1.tavern_speaker 9.record = '33'
```

The same seed, the same config and the same override strings give the same place, with every class and record on the
person its key chain names.

### solvers

`~/patchwork-library/stronghold`. The solvers make a living world on their own: a tavern seats its patrons, a smithy
has its smith at the anvil, a graveyard has its restless dead. They never place a quest giver because a quest asks for
one.

- **The village** hands each override string down to the thing its key chain names next, with that name taken off:
  `tavern_speaker 9.class` to `tavern 1`. It does nothing with it.
- **The tavern** names its people as it places them (`tavern_speaker 9`) and lays each person's overrides over them.
- **The person's type** is the registry's (`src/lib/util/people.mjs`): where it may stand and what verbs it does. The
  registry holds types, not individuals. The individual is the identity, its key chain.

A solver succeeds when every override string resolves. Each solver that places people checks
`people overridden: n of m`, and refuses each key chain naming a person it did not place:
`the override tavern_speaker 10.class names nothing in this tavern`. That is a failed run; the world is nudged (a
bigger tavern, the next seed) and solved again, never fixed by the solver dropping a line.

### compilation

The harness writes the run as one XML: each placed person a `<person>` in its solver's `<nav>`, with their name, and
the class and record their overrides gave them, beside their type, model and chains. The build compiles it into the
place's files: its layout, its terrain3d layer (`.terrain3d_layers.json`), its people (`<scene>.crowd.json`), and
every person with a class, with their identity, class, record and landmark, in the place's mmo3d file.

### [ game + trinitycore ]

The game loads the place and brings each person in at their landmark as their class's kind, and the kind loads their
record from the TrinityCore-shaped data: the quest giver their quests, the smith their stock, the boss their script.
Today `assets/hills/hills.mmo3d.json` places the old woman, the smith and the priest by hand, each at a typed
position:

```json
{ "kind": "smith", "at": [71.6, 11.45, -108.4], "yaw": 3.6 }
```

Each placement's `at` becomes the identity of the person the solvers placed, and the game reads where they stand, and
which way they face, from the compiled place:

```json
{ "kind": "smith", "record": "hills", "at": "village-terrain3d.smithy 1.smith 1" }
```

## What has to be built

- **Every building numbered.** `village-terrain3d.mjs` line 370 gives the bare word when there is one; it gives
  `smithy 1` always.
- **Named people.** A person in the nav is `{ person, model, chains, activities? }`, with no name. Each solver that
  places people names them as placed things are named, lays each person's overrides over them, checks
  `people overridden`, and refuses each key chain naming a person it did not place.
- **Creatures as people.** The solvers whose places have creatures (the graveyard, the barrow, the forest) place them
  at their landmarks, with creature types in the registry.
- **Class and record through compilation.** Written to the XML and carried through the build into the place's mmo3d
  file.
- **The game's join.** Each person brought in at their landmark as their class's kind, loading their record.
- **The ??? step.** From the records to the override strings.
