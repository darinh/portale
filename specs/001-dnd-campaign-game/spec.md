# Feature Specification: A D&D campaign game

**Feature Branch**: `docs/spec-001` (implementation lands on per-phase `feat/` branches)

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "this project was started by older models. please review everything, fill
gaps, fix bugs, and finish the game", refined by the user's answers: "this should be like a real d&d
game"; fuller 5e rules from "the latest PHB"; the twelve classes plus the Artificer, "a custom class that
the player can create", and classes supplied by campaigns and modules; death saving throws with the choice
to end or "roll another character at the same level that is woven into the story"; ability scores by
rolling, a point pool, or maxing every ability; campaigns made of modules "like seasons in a tv series";
and a separate tool that generates campaigns and modules whose "protocol / contracts / etc. need to stay in
sync with the game".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Roll a hero and play a module to its end (Priority: P1)

A player opens the game on a phone, creates a character by the 2024 rules (species, background, class,
ability scores, skills, starting equipment, and spells for casters), and plays the first module of a
campaign. The module ends either when its goal is achieved, which shows a victory, or when the hero dies,
which shows the death screen.

**Why this priority**: Without a character and an ending there is no game, only a conversation with dice.

**Independent Test**: Create a character with each ability-score method, play a hand-authored module with
a deterministic DM to victory and, on another seed, to death, in the phone-sized browser.

**Acceptance Scenarios**:

1. **Given** the title screen, **When** the player chooses New campaign and completes character creation,
   **Then** the first module begins with the character's sheet visible and correct for its choices.
2. **Given** a module in play, **When** its goal condition is met, **Then** the module ends in victory and
   no further turn is accepted in it.
3. **Given** a module in play, **When** the hero dies, **Then** the death screen offers End and Continue
   with a new character.
4. **Given** any point in play, **When** the page reloads or the server restarts, **Then** the game
   resumes exactly where it was.

---

### User Story 2 - Fight by the rules (Priority: P1)

Combat follows the 2024 rules as adapted for one player: initiative decides who acts first; every
hostile in the room acts each round; attacks roll against armor class; damage is rolled from the weapon,
spell or stat block; advantage, disadvantage, conditions and resistances apply; a hero at 0 hit points
makes death saving throws. The player can also try to break away from a fight.

**Why this priority**: Combat is where the engine's authority is most visible and most often tested.

**Independent Test**: Scripted fights over many seeds show every roll, modifier and outcome derived from
the rules, and a replay of the save reproduces each one.

**Acceptance Scenarios**:

1. **Given** a fight with two hostiles, **When** a round passes, **Then** both act in initiative order.
2. **Given** an attack, **When** it resolves, **Then** the roll, the total, the target's armor class and
   the damage dice are shown, and the DM never chose any of them.
3. **Given** a hero at 0 hit points, **When** turns pass, **Then** death saving throws are rolled until
   three successes stabilise the hero or three failures kill them.
4. **Given** a fight, **When** the player tries to flee through an exit, **Then** the engine resolves the
   attempt and either the hero escapes to the next room or the fight continues.

---

### User Story 3 - Checks and saving throws (Priority: P1)

What the player types resolves as an ability check with the right skill, proficiency and expertise, at a
difficulty the DM proposes and the engine holds to the rules' bands. Hazards and spells call for saving
throws against the right ability. Passive perception can notice things without a roll.

**Why this priority**: Most turns outside combat are checks. A check that ignores the character sheet
makes the sheet pointless.

**Independent Test**: For each skill, a scripted check shows the modifier built from the sheet, and the
difficulty the engine allowed.

**Acceptance Scenarios**:

1. **Given** a rogue with expertise in Stealth, **When** they sneak, **Then** the roll adds twice the
   proficiency bonus.
2. **Given** a DM that proposes an out-of-band difficulty, **When** the check resolves, **Then** the
   engine clamps it and says so in the fiction.

---

### User Story 4 - Spells and class features (Priority: P2)

Every class plays like itself: spellcasters cast from spell slots, cantrips scale, prepared spells and
spell lists follow the class, concentration ends when broken, and class resources (for example rage,
second wind, channel divinity, bardic inspiration) have their uses and recharge on the right rest.

**Why this priority**: Classes are what make a character a D&D character, but a game with one class
playing well is already playable.

**Independent Test**: For each class at each supported level, a scripted scenario spends every resource
and checks it recharges on the right rest.

**Acceptance Scenarios**:

1. **Given** a wizard with one 1st-level slot, **When** they cast a 1st-level spell twice, **Then** the
   second cast is refused and the reason is shown.
2. **Given** a concentrating caster, **When** they take damage, **Then** a Constitution save decides
   whether concentration holds.

---

### User Story 5 - Loot, inventory and equipment (Priority: P2)

Items are found in rooms and on defeated foes. The player carries, equips and uses them: weapons with
their damage and mastery properties, armor and shields that set armor class, potions and other
consumables, gold, and magic items.

**Why this priority**: Treasure is half of why a dungeon is worth entering.

**Independent Test**: A scripted module places items, the player picks them up, equips and uses them,
and the sheet changes accordingly.

**Acceptance Scenarios**:

1. **Given** a potion of healing in the pack, **When** the player drinks it, **Then** hit points rise by
   the rolled amount, capped at the maximum, and the potion is gone.
2. **Given** a foe that falls, **When** its loot drops, **Then** the items are in the room to take.

---

### User Story 6 - Rest and recover (Priority: P2)

The player takes a short rest to spend hit dice or a long rest to recover fully, where the fiction allows
it. Resting costs time, and time is pressure: danger clocks may advance and a rest can be interrupted.

**Why this priority**: Without rest, attrition makes every module a single sprint; with free rest, there
is no attrition at all.

**Independent Test**: Scripted rests restore exactly what the rules restore and advance the module's
pressure.

**Acceptance Scenarios**:

1. **Given** hostiles in the room, **When** the player tries to rest, **Then** the rest is refused.
2. **Given** a short rest, **When** the player spends two hit dice, **Then** each die heals its roll plus
   the Constitution modifier.

---

### User Story 7 - Level up (Priority: P2)

Experience comes from encounters overcome and goals achieved. At each threshold the hero levels up:
hit points, proficiency bonus, new class features, a subclass at 3rd level, feats or ability score
improvements where the class grants them, and new spells.

**Why this priority**: Growth is the reward loop that makes a campaign longer than one module.

**Independent Test**: A scripted character gains experience past each threshold in the supported range
and its sheet matches the rules at every level.

**Acceptance Scenarios**:

1. **Given** a hero at the threshold for 3rd level, **When** they level up, **Then** they choose a
   subclass and its 3rd-level features apply.

---

### User Story 8 - Campaigns made of seasons (Priority: P3)

A campaign is a sequence of modules, like seasons of a series, with an arc that threads through them.
The player chooses a campaign, plays its modules in order, and the same hero carries their level, gear
and story from one module to the next. Finishing the last module ends the campaign with an epilogue.

**Why this priority**: The user asked for campaigns, but a single good module is playable first.

**Independent Test**: A two-module campaign is played end to end with a deterministic DM, and the hero
entering module two is exactly the hero that left module one, plus a long rest.

**Acceptance Scenarios**:

1. **Given** a won module that is not the last, **When** the player continues, **Then** the next module
   begins with the same character.
2. **Given** the title screen, **When** the player chooses Continue, **Then** the most recent save
   resumes where it stopped, including between modules.

---

### User Story 9 - A new hero when one dies (Priority: P3)

When a hero dies, the player chooses to end the campaign or to continue with a new character created at
the same level. The new hero enters the story near where the last one fell, with a reason the DM
narrates, and the campaign keeps what was already achieved.

**Why this priority**: Death with real stakes, without throwing away hours of campaign.

**Independent Test**: A scripted death, then Continue, produces a new level-matched character in the same
module, with the module's progress intact.

**Acceptance Scenarios**:

1. **Given** a dead 4th-level hero, **When** the player continues, **Then** character creation starts at
   4th level with the experience that level requires.
2. **Given** the replacement enters, **When** the turn resolves, **Then** discovered clues and completed
   goals are still discovered and completed.

---

### User Story 10 - Classes of your own (Priority: P3)

The player can build a custom class from the same building blocks the standard classes use: hit die,
proficiencies, saving throws, features by level, and spellcasting. Campaigns and modules can ship their
own classes, species, backgrounds, items, spells and monsters, which appear only in that campaign.

**Why this priority**: Asked for explicitly, and it is the proof that the content model is really data.

**Independent Test**: A class built in the game and a class shipped in a module both level up and play
through the same code paths as a standard class.

**Acceptance Scenarios**:

1. **Given** a campaign that ships a class, **When** the player creates a character in that campaign,
   **Then** the class is offered, and it is not offered in other campaigns.

---

### User Story 11 - The forge (Priority: P3)

A separate tool generates campaign and module drafts from a pitch, validates any campaign or module
against quality rules drawn from established adventure-design practice, and exports data the game loads.
Anything the forge accepts the game accepts, and anything the game refuses the forge refuses.

**Why this priority**: The user asked for it, and it makes more content possible than hand-writing
allows.

**Independent Test**: Every bundled campaign passes the forge; a module with a deliberately broken clue
chain is rejected with the rule it breaks.

**Acceptance Scenarios**:

1. **Given** a module where a conclusion has only one clue, **When** it is validated, **Then** the forge
   rejects it and names the conclusion.
2. **Given** the game's data contract changes, **When** the checks run, **Then** a forge built against the
   old contract fails the checks instead of drifting silently.

---

### User Story 12 - The title screen (Priority: P1)

The first screen offers New campaign, Continue, and a list of saves to resume or delete.

**Why this priority**: Today the only way to start over is a URL parameter.

**Independent Test**: Start two campaigns, continue each, delete one, in the browser.

**Acceptance Scenarios**:

1. **Given** two saves, **When** the player opens the game, **Then** Continue resumes the most recent one.

### Edge Cases

- A replacement character is created while hostiles are still in the room.
- The player closes the page mid-level-up, mid-creation, or between modules.
- A module ships a class whose features reference a spell the module does not ship.
- A danger clock fills during a rest, during combat, or on the turn the goal is achieved.
- The local model is unreachable for a whole session.
- A saved game was created before the content it references changed.
- A custom class is absurdly strong. That is allowed; it is the player's game.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine MUST decide every mechanical outcome: rolls, modifiers, damage, hit points,
  conditions, resources, spell slots, experience, levels, loot, movement, and endings. The DM proposes.
- **FR-002**: Character creation MUST offer ability scores by rolling (4d6, drop the lowest, seeded so a
  save replays), by a point-buy pool, and by free assignment up to the rules' maximum.
- **FR-003**: Rules content MUST come from SRD 5.2 (CC-BY-4.0) with the required attribution, or be
  original. The Artificer MUST be original expression.
- **FR-004**: The twelve SRD classes and the Artificer MUST be playable, each at the levels the current
  phase supports, with their subclass from the SRD or an original one.
- **FR-005**: Combat MUST use initiative, attack rolls against armor class, rolled damage, advantage and
  disadvantage, conditions, and death saving throws, with every hostile in the room acting each round.
- **FR-006**: Checks MUST add the relevant ability modifier and proficiency or expertise; the DM MAY
  propose a skill and a difficulty band, and the engine MUST hold the difficulty to the rules' bands.
- **FR-007**: Spellcasting MUST track slots, cantrip scaling, prepared spells, concentration and ritual
  casting as the class allows.
- **FR-008**: Inventory MUST support carrying, equipping, using, dropping and looting items, and gold.
- **FR-009**: Short and long rests MUST restore what the rules restore, MUST be refused while hostiles are
  present, and MUST advance module pressure.
- **FR-010**: Experience MUST follow the rules' thresholds, and levelling MUST apply every feature and
  choice the class grants at that level.
- **FR-011**: A module MUST have an engine-checkable goal, and MUST end in victory when it is met or in
  defeat when the hero dies and the player ends.
- **FR-012**: A campaign MUST be an ordered set of modules that carries one hero between them, with a long
  rest between modules, and an epilogue after the last.
- **FR-013**: On a hero's death the player MUST be offered End or Continue; Continue MUST create a new hero
  at the dead hero's level, placed in the same module, with the campaign's progress intact.
- **FR-014**: Danger clocks MUST have mechanical consequences when they fill.
- **FR-015**: Players MUST be able to build a custom class; campaigns and modules MUST be able to ship
  classes, species, backgrounds, items, spells and monsters scoped to themselves.
- **FR-016**: Campaign and module data MUST be defined by a versioned contract shared by the game and the
  forge, and a mechanical check MUST fail when they disagree.
- **FR-017**: The forge MUST validate campaign and module quality rules and report each violation with its
  location.
- **FR-018**: A saved game MUST resume exactly after a reload or a restart, and MUST NOT change when
  campaign content is edited later.
- **FR-019**: The player MUST be able to act by typing and by tapping structured actions (attack, cast,
  use, rest, flee, move); a structured action MUST leave the DM only the narration.
- **FR-020**: The title screen MUST offer New campaign, Continue, and a list of saves to resume or delete.

### Key Entities

- **Character**: a hero's sheet. Species, background, class and level, ability scores, proficiencies,
  hit points and hit dice, armor class, resources, spells, conditions, inventory, experience.
- **Content**: classes, subclasses, species, backgrounds, feats, spells, items, monsters and conditions,
  from the SRD, from a campaign, or built by the player.
- **Campaign**: a titled sequence of modules with an arc, its own content, and a starting level.
- **Module**: locations, NPCs with wants and secrets, factions, clues serving conclusions, encounters,
  treasure, clocks with consequences, a goal, a strong start, a finale.
- **Save**: one playthrough of a campaign: the record of everything that happened, the seed, and the
  content it was played against.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player creates a character in under three minutes on a phone.
- **SC-002**: In 1,000 automated playthroughs of each bundled module, none ends in a state where the goal
  can no longer be reached and the hero is alive; every module is won in some runs and lost in some.
- **SC-003**: Every mechanical value shown to the player can be reproduced by replaying the save.
- **SC-004**: A save resumes exactly at every point tested: mid-combat, mid-creation, mid-level-up, and
  between modules.
- **SC-005**: With the local model as DM, at least 95% of turns in a 30-turn session produce a usable
  answer rather than a stall.
- **SC-006**: Every bundled campaign passes the forge, and the game accepts every campaign the forge
  accepts, over the whole bundled set.
- **SC-007**: A module takes 30 to 60 minutes to play.

## Assumptions

- The rules source is SRD 5.2 (the 2024 rules under CC-BY-4.0). Content from the 2024 Player's Handbook
  that is not in the SRD is out of scope unless re-expressed originally.
- Supported character levels grow by phase; the first phase supports levels 1 to 3 for every class.
- Free ability-score assignment is capped at 20, the rules' maximum without magic; the cap is one
  constant if the user wants more.
- One hero at a time. Companions are out of scope for this specification.
- The existing tavern becomes the first module of a hand-authored campaign; generated delves become a
  module type.
- The forge is a command-line tool in this repository that runs on the same machine as the game.
