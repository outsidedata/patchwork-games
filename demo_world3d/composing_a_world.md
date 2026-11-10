# Composing a world

The rules for writing a story into a solved world. Read this before writing or reading an override string.

## The two layers

1. **The world.** A top solver, its seed and its config. Together they fix every placed thing in the world and
   every name it has. Same seed, same config, same world, every time.
2. **The story.** Override strings, written into that one world. They never place anything. They give people and
   things the world already has their class, and their record within it.

The solver never decides to place a quest giver, a shopkeeper or a boss. It places a living world on its own. The
story tells it: the person with this name is of this class, with this record.

## Identity, class and record

- **Identity is the key chain.** `village-terrain3d.tavern 1.tavern_speaker 9` is one person and no other. The world
  names everyone it places, so everyone already has an identity before any story is written.
- **Class is the kind.** `questgiver`, `smith`, `zombie`: how the person acts. Every questgiver acts the same: they
  talk, and offer and take quests. The class maps to a kind in the game.
- **Record is their data within that kind.** `33`, `malibu`: which entry in the kind's own files this person loads.
  The questgiver kind loads the lines and quests of its record `33`; the smith kind loads the stock, prices and
  recipes of its record `malibu`. A record is named within its class, so it never repeats the class's name.

Where every one of a class loads the same data, there is no record: every zombie is the same zombie.

Both map back to real things in the game:

- **The class is game code.** `smith` is a kind with its rule, as demo_world3d's `smith.sim.ts` is today: a talker who
  sells, buys and teaches.
- **The record is real rows in the TrinityCore-shaped data.** `malibu` is the key that smith's kind looks up in each
  file it reads: the vendor file's stock (`npc_vendor`), the crafting file's trainer (`npc_trainer`), the talk file's
  rules for what it says. A questgiver's `33` is its quests in the quest file (`quest_template`, its starters and
  enders) and its lines in the talk file.

## The pattern

The people already exist. The solvers make a living world: a tavern seats its patrons, a smithy has its smith at the
anvil. The quest system casts people who are already there in its roles: one of the tavern's patrons is a quest
giver, the smith who runs the shop is a quest giver too.

1. Write the quests (the records).
2. Give the people and things the world already has their class and record, with override strings, each one key
   chain to one person or thing and one value:
   ```
   village-terrain3d.tavern 1.tavern_speaker 9.class = 'questgiver'
   village-terrain3d.tavern 1.tavern_speaker 9.record = '33'
   village-terrain3d.graveyard 1.grave 4.class = 'item'
   village-terrain3d.graveyard 1.grave 4.record = 'grave_ring'
   ```
3. Solve. Every override string either resolves or is refused by its key chain.

When a quest wants someone the world has nobody for, the solver is changed to place them, as a part of the living
world, and then override strings give them their class and record.

The solver handles all of it because every override is flat: setting one value on one placed thing.

## Mobs

Mobs do not come out of nowhere. They come from the place: the restless dead stand in the graveyard, the wolves den in
the forest. A forest solver places its wolves as the tavern seats its patrons: people of a creature type at the
forest's landmarks, named `wolf 1`, `wolf 2`, part of the living world whether a story uses them or not.

There are no spawners. A mob is a person like anyone else: one person, one name, one key chain, its own chains of
landmarks, and its verbs, loiter and transfer, as the registry gives them. Five zombies are five people, and five
lines in the overrides, never one line saying "5 zombies":

```
village-terrain3d.graveyard 1.zombie 1.class = 'zombie'
village-terrain3d.graveyard 1.zombie 2.class = 'zombie'
village-terrain3d.graveyard 1.zombie 3.class = 'zombie'
village-terrain3d.graveyard 1.zombie 4.class = 'zombie'
village-terrain3d.graveyard 1.zombie 5.class = 'zombie'
```

Five identities, one class, no record. The zombie kind holds its model, its health, its hit and death clips, how
soon it comes back. The quest "Restless Graves" asks for five `zombie` killed.

At some point the world existed and that zombie did not. One routine brings a person into the world, a mob or anyone
else: at a nav point, their own landmark, with their own name, class and record, on their own chains. It is what
brought them in the first time, and it is what brings them back after they are killed. There is no second way in for
a respawn.

## Vocabulary

- **top solver**: the solver a run starts from (`village-terrain3d`).
- **placed thing**: what a solver places, a key and a config. Its name is given by the solver that places it.
- **name**: a placed thing's name in its placer: its kind's last word and its number, `smithy 1`, `house 4`,
  `tavern 2`.
- **landmark**: a nav place for being somewhere, inside a placed thing (`smithy_anvil`), where a person stands.
- **person**: someone a solver places at its landmarks, named by it as a placed thing is: their type's word and their
  number, `smith 1`, `tavern_speaker 9`, `zombie 1`.
- **identity**: a person's or thing's key chain without its parameter,
  `village-terrain3d.tavern 1.tavern_speaker 9`. One identity is one individual.
- **class**: the kind a person or thing is in the game, how it acts: `questgiver`, `smith`, `zombie`, `item`.
- **record**: a person's or thing's own data within its class, named within it: `33`, `malibu`, `grave_ring`.
- **override string**: a whole override, `village-terrain3d.smithy 1.smith 1.record = 'malibu'`.
- **override key chain**: the first half of an override string, before the `=`:
  `village-terrain3d.smithy 1.smith 1.record`. The top solver, then the name of each placed thing down to the person
  meant, then the parameter.
- **override value**: the second half, after the `=`.

## Every placed thing is numbered

A world has many of a kind: many smithies, many taverns, many houses. Each one is its own place, with its own
people, its own shop and its own story. So each one is named by its number, always, even when the world has only one:
`smithy 1`, `smithy 2`, `smithy 3`.

That makes the key chain's form the same whether the world has one smithy or five, and makes every smithy its own
target.

## Classes and records go on people

```
village-terrain3d.smithy 1.smith 1.class = 'smith'
village-terrain3d.smithy 1.smith 1.record = 'malibu'
```

An override string sets one parameter on one thing. Its key chain is names, one per step, each step the name of a
thing placed by the step before it, and last the parameter. Its value is that one parameter's value.

The parameter can be anything. `class` and `record` are two the game reads; a story can set any other its game needs
(`tavern 1.tavern_speaker 9.funny = 'yes'`), and it travels with the person through compilation to their kind in the
game. What must resolve is the names: a key chain whose names the solvers never placed is refused.

Read the second one step by step:

| step | what it is |
| --- | --- |
| `village-terrain3d` | the top solver |
| `smithy 1` | the first smithy the village placed |
| `smith 1` | the first smith that smithy placed |
| `record` | the parameter set on that smith |
| `'malibu'` | its value: the smith's record within the class `smith` |

A shop carries this much specificity: not just a smith, but whose smith, where. Every smith acts as a smith; each
place's shop is its own record:

```
village-terrain3d.smithy 1.smith 1.class = 'smith'
village-terrain3d.smithy 1.smith 1.record = 'malibu'
village-terrain3d.smithy 2.smith 1.class = 'smith'
village-terrain3d.smithy 2.smith 1.record = 'hell'
village-terrain3d.smithy 3.smith 1.class = 'smith'
village-terrain3d.smithy 3.smith 1.record = 'heaven'
village-terrain3d.smithy 4.smith 1.class = 'smith'
village-terrain3d.smithy 4.smith 1.record = 'china'
```

Each record is that shop's own data: its stock, its prices, what it teaches, what its smith says. That data lives in
the kind's own files under the record's name. A record in an override string is only ever that name, `'malibu'`,
never the data itself (`record = '{ "stock": ... }'`).

A person is reached the way every placed thing is: by naming them, one step at a time. The key chain never stops at
the smithy with its people packed into the value (`smithy 1.people = { ... }`), and the value is never an object of
parameters (`smith 1 = { "class": ..., "record": ... }`). One override string is one key chain to one person and one
parameter, and one value.

## How it travels

1. The top solver reads its override strings. For each thing it places, it hands the ones whose key chain runs on
   past that thing's name down in its config (`smith 1.class` and `smith 1.record` for `smithy 1`).
2. The placed thing's solver (the smithy) names its people as it places them, and lays each person's overrides over
   them: `smith 1` is of the class `smith`, with the record `malibu`.
3. The run writes each person with their identity, class and record. The build writes them to the place's files.
4. The game loads the place, brings each person in at their landmark as their class's kind, and the kind loads their
   record: the shop, the quests, the lines.

## When it does not land

The story is written for one world. If `village-terrain3d.smithy 1.smith 1.class` does not resolve, the smith was
not placed: the story asked for a person this world does not have. Every failure is said, never dropped:

- **A key chain names no placed thing.** `smithy 4` in a world with three smithies: the top solver refuses it,
  `the override smithy 4.smith 1.class names nothing in this village`.
- **A key chain names no person.** `tavern 1.tavern_speaker 10.class` in a tavern that placed nine speakers: the
  tavern refuses it, and its check reads `people overridden: 9 of 10`. The run fails.

A refusal names the exact key chain that missed, so the fix is to nudge one value and solve again: make the tavern
bigger (`village-terrain3d.tavern 1.width = 24`), tick the smithy on the menu, try the next seed. The run says
whether the story lands now.

Change the world (its seed, its size, its menu) and the story may no longer land. That is the right answer: it is a
different world, and its refusals say exactly which lines of the story missed.

## What has to be built

- The village solvers number every building, one included (`village-terrain3d.mjs` line 370 gives the bare word
  when there is one).
- Each solver that places people names them as placed things are named (`smith 1`), lays each person's overrides
  over them, checks `people overridden`, and refuses each key chain naming a person it did not place.
- The solvers whose places have creatures (the graveyard, the barrow, the forest) place them as people at their
  landmarks, with creature types in the registry.
- A person in the run carries their identity, class and record through the XML and the build into the place's files.
- The game brings each person in at their landmark as their class's kind, and the kind loads their record.
