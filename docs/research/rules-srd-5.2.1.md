# Portale rules research on SRD 5.2.1 and the 2024 fifth edition rules

Research date 2026-09-25. This covers the five questions in the brief. I verified every count by script against the official PDFs or the dataset files, unless a line says otherwise. Lines marked **Inference** are my reasoning, not a sourced fact. None of this is legal advice.

The tables copied from the SRD are used under its license. This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. I reformatted those tables and paraphrased rules text.

## Summary

- The legal base is the System Reference Document 5.2.1. Wizards of the Coast published it on May 1, 2025 under CC-BY-4.0. It supersedes SRD 5.2.0 from April 22, 2025.
- SRD 5.2.1 has 12 classes with one subclass each, 9 species, 4 backgrounds, 17 feats and 339 spells. It has 330 stat blocks in its monster chapters plus 5 more inside spell and item text, 258 magic items, 38 weapons with 8 mastery properties, and a 155-entry rules glossary.
- SRD 5.2.1 also carries the 2024 XP Budget per Character table, the XP-by-CR table and the character advancement table. The whole encounter and leveling loop is openly licensed.
- No JSON dataset matches 5.2.1. 5e-bits/5e-database and open5e both lack the 15 magic items that 5.2.1 added. Foundry's dnd5e packs have them, but in a Foundry-only YAML schema.
- I recommend vendoring 5e-database `src/2024/en` pinned to a commit. Patch the known gaps from the PDF and gate the data with a build-time check against the 5.2.1 lists this research produced.
- The 2024 Artificer lives in *Eberron: Forge of the Artificer*, released December 9, 2025. None of it is openly licensed.
- For one PC the 2024 budget is the per-character row times one. The 2024 rules dropped the 2014 small-party multiplier, so solo fights built by the table run harder than their label. **Inference.**

## Method and sources

| Key | Document | Link |
| --- | --- | --- |
| SRD 5.2.1 | System Reference Document 5.2.1, 364 pages, CC-BY-4.0 | https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf |
| SRD 5.2.0 | System Reference Document 5.2, 361 pages, CC-BY-4.0 | https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf |
| Conversion guide | Converting to SRD 5.2.1, 15 pages, WotC copyright, not CC | https://media.dndbeyond.com/compendium-images/srd/guide/converting-to-srd-5.2.1.pdf |
| SRD 5.1 | System Reference Document 5.1 (2014 rules), CC-BY-4.0 | https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf |
| SRD page | D&D Beyond SRD downloads and FAQ, last updated March 2, 2026 | https://www.dndbeyond.com/srd |
| Basic Rules 2014 | Free 2014 rules on D&D Beyond | https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters and https://www.dndbeyond.com/sources/dnd/basic-rules-2014/building-combat-encounters |
| Basic Rules 2024 | Free 2024 rules on D&D Beyond, readable but not CC-licensed | https://www.dndbeyond.com/sources/dnd/br-2024 |

A citation such as "SRD 5.2.1 p. 21" means PDF page 21. In both SRD 5.2 PDFs and in SRD 5.1 the printed page number equals the PDF page index, so a `#page=21` link lands on it.

I downloaded the PDFs and extracted text with PyMuPDF. Spells were counted by their school line, stat blocks by their AC line, and magic items and glossary entries by their header font. The script `srd-5.2.1-data/srd_inventory.py` reruns the headline counts (spells, stat blocks, magic items, glossary entries) and diffs 5.2.0 against 5.2.1. Independent cross-checks agree. The SRD's own Index of Stat Blocks lists 330 entries, and 5e-database, open5e and charnik-content-srd all carry 339 spells.

## 1. SRD 5.2

### Release history

| Version | Date | Source |
| --- | --- | --- |
| SRD v5.2.0 | Published April 22, 2025 | [SRD page](https://www.dndbeyond.com/srd), "Previous SRD Releases" |
| SRD v5.2.1, English | Published May 1, 2025 | [SRD page](https://www.dndbeyond.com/srd) |
| Converting to SRD v5.2.1 guide | Published May 27, 2025 | [SRD page](https://www.dndbeyond.com/srd) |
| SRD v5.2.1 in German, Spanish, French, Italian | Published December 8, 2025 | [SRD page](https://www.dndbeyond.com/srd) |

The PDF metadata agrees. The 5.2.0 file was created 2025-04-22. The 5.2.1 file was created 2025-04-23 and last modified 2025-04-29. The FAQ says SRD 5.2 includes all second-printing errata of the core books. Later errata may produce versions such as 5.2.2, and each version keeps its own license ([SRD page](https://www.dndbeyond.com/srd)). The page now offers 5.2.1 as the current download and lists 5.2.0 under previous releases. Portale should target 5.2.1.

### License and the required attribution

Both 5.2.0 and 5.2.1 are licensed under CC-BY-4.0 ([SRD 5.2.1 p. 1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=1)). The FAQ says the license can't be revoked, commercial use is allowed, and all future SRDs will be Creative Commons only. SRD 5.2 is not under the OGL. SRD 5.1 is under both.

The exact statement WotC asks for, from [SRD 5.2.1 p. 1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=1):

```text
This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
```

SRD 5.2.0 asks for the same sentence with "5.2" in place of "5.2.1" ([SRD 5.2.0 p. 1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf#page=1)):

```text
This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
```

Both blocks keep the PDF's curly quotes so they match character for character.

The same page adds three conditions. The statement must appear "in any of your work". WotC asks that you "not include any other attribution to Wizards or its parent or affiliates". You may describe the work as "compatible with fifth edition" or "5E compatible".

The CC license adds two rules of its own ([CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en)). Section 3(a)(1)(B) requires you to "indicate if You modified the Licensed Material". Section 2(b)(2) says patent and trademark rights are not licensed. Converting SRD text into JSON and editing it is modification, so Portale's notice should say so. The trademark rule means the product shouldn't brand itself Dungeons & Dragons or D&D. How both rules apply to Portale is my **Inference**.

Suggested notice for Portale (**Inference**):

```text
This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
Portale converted this material into structured data and edited it for use in a game engine.
```

If vendored data comes from SRD 5.2.0, as 5e-database's does (section 2), add the 5.2 statement as well.

### Inventory of SRD 5.2.1

Chapter map, from the PDF bookmarks:

| Chapter | Pages |
| --- | --- |
| Legal Information | 1 |
| Playing the Game | 5-18 |
| Character Creation, including Level Advancement, Multiclassing and Trinkets | 19-27 |
| Classes | 28-82 |
| Character Origins | 82-86 |
| Feats | 86-88 |
| Equipment | 88-103 |
| Spells | 103-175 |
| Rules Glossary | 176-191 |
| Gameplay Toolbox | 192-203 |
| Magic Items | 204-253 |
| Monsters, stat block overview | 254-257 |
| Monsters A-Z | 258-343 |
| Animals | 344-364 |

#### Classes and subclasses

All 12 classes are present with one subclass each. Every class gains its subclass at level 3 (the "Level 3: ... Subclass" feature in each class section).

| Class | SRD subclass | Casting | Weapon Mastery at level 1 | Level 1 HP |
| --- | --- | --- | --- | --- |
| Barbarian | Path of the Berserker | none | 2 kinds of melee weapon | 12 + Con modifier |
| Bard | College of Lore | Spellcasting, Charisma | none | 8 + Con |
| Cleric | Life Domain | Spellcasting, Wisdom | none | 8 + Con |
| Druid | Circle of the Land | Spellcasting, Wisdom | none | 8 + Con |
| Fighter | Champion | none | 3 kinds | 10 + Con |
| Monk | Warrior of the Open Hand | none | none | 8 + Con |
| Paladin | Oath of Devotion | Spellcasting from level 1, Charisma | 2 kinds | 10 + Con |
| Ranger | Hunter | Spellcasting from level 1, Wisdom | 2 kinds | 10 + Con |
| Rogue | Thief | none | 2 kinds | 8 + Con |
| Sorcerer | Draconic Sorcery | Spellcasting, Charisma | none | 6 + Con |
| Warlock | Fiend Patron | Pact Magic, Charisma | none | 8 + Con |
| Wizard | Evoker | Spellcasting, Intelligence | none | 6 + Con |

Sources are the Weapon Mastery features ([SRD 5.2.1 pp. 29, 48, 54, 58, 62](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=29)), the Level 1 Hit Points by Class table (p. 22) and the Fixed Hit Points by Class table (p. 23). Class options come with the classes. The Sorcerer has 10 Metamagic options (p. 66) and the Warlock has 28 Eldritch Invocation options (pp. 72-74), counted from their headers.

#### Species and backgrounds

The nine species are Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc and Tiefling (pp. 83-86). Species give no ability score increases and no languages ([conversion guide p. 2](https://media.dndbeyond.com/compendium-images/srd/guide/converting-to-srd-5.2.1.pdf#page=2)). The Human's Versatile trait grants an Origin feat, and its Resourceful trait grants Heroic Inspiration after every Long Rest (p. 86).

The four backgrounds (p. 83):

| Background | Ability scores | Origin feat | Skills | Tool |
| --- | --- | --- | --- | --- |
| Acolyte | Int, Wis, Cha | Magic Initiate (Cleric) | Insight, Religion | Calligrapher's Supplies |
| Criminal | Dex, Con, Int | Alert | Sleight of Hand, Stealth | Thieves' Tools |
| Sage | Con, Int, Wis | Magic Initiate (Wizard) | Arcana, History | Calligrapher's Supplies |
| Soldier | Str, Dex, Con | Savage Attacker | Athletics, Intimidation | one Gaming Set |

The Gameplay Toolbox includes rules for building new backgrounds (p. 192). You pick three abilities, one Origin feat, two skills and one tool, and assemble 50 GP of equipment without Martial weapons or armor. That section is the legal route to more backgrounds.

#### Feats

There are 17 feats (pp. 86-88).

| Category | Feats |
| --- | --- |
| Origin, 4 | Alert, Magic Initiate, Savage Attacker, Skilled |
| General, 2 | Ability Score Improvement, Grappler. Both require level 4+. |
| Fighting Style, 4 | Archery, Defense, Great Weapon Fighting, Two-Weapon Fighting |
| Epic Boon, 7 | Boon of Combat Prowess, Boon of Dimensional Travel, Boon of Fate, Boon of Irresistible Offense, Boon of Spell Recall, Boon of the Night Spirit, Boon of Truesight. All require level 19+. |

#### Spells

There are 339 spells (pp. 104-175).

| Spell level | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Count | 27 | 57 | 57 | 42 | 34 | 38 | 31 | 20 | 17 | 16 |

Each class section prints its own spell list. Seventeen spells use generic names where the PHB uses a named wizard, such as Acid Arrow for Melf's Acid Arrow. The full mapping is in the PHB comparison below.

#### Monster stat blocks

The monster chapters hold 330 stat blocks, which matches the SRD's own Index of Stat Blocks. Monsters A-Z has 234 (pp. 258-343) and Animals has 96 (pp. 344-364). Five more sit inside spell and item text. They are Animated Object in Animate Objects (p. 109), Otherworldly Steed in Find Steed (p. 131), Giant Insect (p. 136), Draconic Spirit in Summon Dragon (p. 166) and Giant Fly in Figurine of Wondrous Power (p. 222). The total is 335.

Challenge Rating spread of the 330. Most of the list is low CR, which suits a solo game.

| CR | 0 | 1/8 | 1/4 | 1/2 | 1 | 2 | 3 | 4 | 5 | 6-10 | 11-16 | 17-24 | 30 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stat blocks | 29 | 19 | 32 | 27 | 27 | 42 | 25 | 16 | 25 | 41 | 27 | 19 | 1 |

Stat blocks use the 2024 format ([conversion guide pp. 13-14](https://media.dndbeyond.com/compendium-images/srd/guide/converting-to-srd-5.2.1.pdf#page=13)). Each has an Initiative modifier and an Initiative score, saving throws inside the ability table, one Immunities line for damage and conditions, an optional Gear line, and a CR line with XP and PB, such as "CR 1 (XP 200; PB +2)". The "Running a Monster" sidebar (p. 255) tells the GM to use limited high-damage abilities early, use Multiattack otherwise, and use Bonus Actions, Reactions and Legendary Actions as often as possible. That's a ready-made tactics policy for an LLM DM.

#### Magic items

Magic Items A-Z has 258 entries (pp. 209-253), counted from entry headers. Some entries are families, such as "Armor, +1, +2, or +3", Ioun Stone and Figurine of Wondrous Power. That's why datasets that split variants report higher numbers. By category line the split is Wondrous Item 127, Weapon 33, Potion 24, Ring 22, Armor 19 (shields included), Wand 13, Staff 12, Rod 7 and Scroll 1. The chapter also covers categories, rarity and value, activation, cursed items, resilience, crafting magic items (pp. 206-207) and sentient items. Two items carry new names to avoid trademarks. Mysterious Deck is the Deck of Many Things and Dragon Orb is the Orb of Dragonkind ([SRD page](https://www.dndbeyond.com/srd)).

#### Equipment and weapon mastery

The Equipment chapter (pp. 88-103) covers coins, weapons with properties and masteries, armor (12 armors plus the Shield), tools, adventuring gear, mounts and vehicles, lifestyle expenses, food and lodging, hirelings, spellcasting services, identifying magic items, crafting nonmagical items, brewing Potions of Healing and scribing Spell Scrolls.

The weapons table (pp. 91-92) has 38 weapons, Musket and Pistol included. Each weapon has exactly one mastery property. Weight and cost columns are omitted here.

| Weapon | Category | Damage | Properties | Mastery |
| --- | --- | --- | --- | --- |
| Club | Simple melee | 1d4 Bludgeoning | Light | Slow |
| Dagger | Simple melee | 1d4 Piercing | Finesse, Light, Thrown (Range 20/60) | Nick |
| Greatclub | Simple melee | 1d8 Bludgeoning | Two-Handed | Push |
| Handaxe | Simple melee | 1d6 Slashing | Light, Thrown (Range 20/60) | Vex |
| Javelin | Simple melee | 1d6 Piercing | Thrown (Range 30/120) | Slow |
| Light Hammer | Simple melee | 1d4 Bludgeoning | Light, Thrown (Range 20/60) | Nick |
| Mace | Simple melee | 1d6 Bludgeoning | none | Sap |
| Quarterstaff | Simple melee | 1d6 Bludgeoning | Versatile (1d8) | Topple |
| Sickle | Simple melee | 1d4 Slashing | Light | Nick |
| Spear | Simple melee | 1d6 Piercing | Thrown (Range 20/60), Versatile (1d8) | Sap |
| Dart | Simple ranged | 1d4 Piercing | Finesse, Thrown (Range 20/60) | Vex |
| Light Crossbow | Simple ranged | 1d8 Piercing | Ammunition (Range 80/320; Bolt), Loading, Two-Handed | Slow |
| Shortbow | Simple ranged | 1d6 Piercing | Ammunition (Range 80/320; Arrow), Two-Handed | Vex |
| Sling | Simple ranged | 1d4 Bludgeoning | Ammunition (Range 30/120; Bullet) | Slow |
| Battleaxe | Martial melee | 1d8 Slashing | Versatile (1d10) | Topple |
| Flail | Martial melee | 1d8 Bludgeoning | none | Sap |
| Glaive | Martial melee | 1d10 Slashing | Heavy, Reach, Two-Handed | Graze |
| Greataxe | Martial melee | 1d12 Slashing | Heavy, Two-Handed | Cleave |
| Greatsword | Martial melee | 2d6 Slashing | Heavy, Two-Handed | Graze |
| Halberd | Martial melee | 1d10 Slashing | Heavy, Reach, Two-Handed | Cleave |
| Lance | Martial melee | 1d10 Piercing | Heavy, Reach, Two-Handed unless mounted | Topple |
| Longsword | Martial melee | 1d8 Slashing | Versatile (1d10) | Sap |
| Maul | Martial melee | 2d6 Bludgeoning | Heavy, Two-Handed | Topple |
| Morningstar | Martial melee | 1d8 Piercing | none | Sap |
| Pike | Martial melee | 1d10 Piercing | Heavy, Reach, Two-Handed | Push |
| Rapier | Martial melee | 1d8 Piercing | Finesse | Vex |
| Scimitar | Martial melee | 1d6 Slashing | Finesse, Light | Nick |
| Shortsword | Martial melee | 1d6 Piercing | Finesse, Light | Vex |
| Trident | Martial melee | 1d8 Piercing | Thrown (Range 20/60), Versatile (1d10) | Topple |
| Warhammer | Martial melee | 1d8 Bludgeoning | Versatile (1d10) | Push |
| War Pick | Martial melee | 1d8 Piercing | Versatile (1d10) | Sap |
| Whip | Martial melee | 1d4 Slashing | Finesse, Reach | Slow |
| Blowgun | Martial ranged | 1 Piercing | Ammunition (Range 25/100; Needle), Loading | Vex |
| Hand Crossbow | Martial ranged | 1d6 Piercing | Ammunition (Range 30/120; Bolt), Light, Loading | Vex |
| Heavy Crossbow | Martial ranged | 1d10 Piercing | Ammunition (Range 100/400; Bolt), Heavy, Loading, Two-Handed | Push |
| Longbow | Martial ranged | 1d8 Piercing | Ammunition (Range 150/600; Arrow), Heavy, Two-Handed | Slow |
| Musket | Martial ranged | 1d12 Piercing | Ammunition (Range 40/120; Bullet), Loading, Two-Handed | Slow |
| Pistol | Martial ranged | 1d10 Piercing | Ammunition (Range 30/90; Bullet), Loading | Vex |

The eight mastery properties (p. 90), paraphrased:

| Mastery | Effect |
| --- | --- |
| Cleave | After a melee hit, make one more melee attack roll against a second creature within 5 feet of the first. The second hit adds no ability modifier unless it's negative. Once per turn. |
| Graze | On a miss, deal damage equal to the ability modifier used for the attack. |
| Nick | The Light property's extra attack happens as part of the Attack action, not as a Bonus Action. Once per turn. |
| Push | On a hit, push a Large or smaller creature up to 10 feet straight away. |
| Sap | On a hit, the target has Disadvantage on its next attack roll before your next turn starts. |
| Slow | On a damaging hit, cut the target's Speed by 10 feet until your next turn starts. Multiple hits don't stack past 10 feet. |
| Topple | On a hit, the target makes a Constitution save against DC 8 + your attack ability modifier + PB or falls Prone. |
| Vex | On a damaging hit, you have Advantage on your next attack roll against that creature before the end of your next turn. |

#### Rules Glossary and Gameplay Toolbox

The Rules Glossary (pp. 176-191) has 155 entries by header count. The tagged entries are:

- 12 actions. Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study, Utilize.
- 15 conditions. Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious.
- 5 hazards. Burning, Dehydration, Falling, Malnutrition, Suffocation.
- 6 areas of effect. Cone, Cube, Cylinder, Emanation, Line, Sphere.
- 3 attitudes. Friendly, Hostile, Indifferent.

The rest are untagged definitions such as Bloodied, Concentration, D20 Test, Heroic Inspiration, Long Rest, Short Rest and Unarmed Strike. The full list is in `srd-5.2.1-data/srd521-glossary.txt`.

The Gameplay Toolbox (pp. 192-203) has eight sections. They are Travel Pace, Creating a Background, Curses and Magical Contagions, Environmental Effects, Fear and Mental Stress, Poison, Traps and Combat Encounters.

#### Death saves, resting, exhaustion and Heroic Inspiration

**Death Saving Throws** ([SRD 5.2.1 pp. 17-18](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=17)). Roll 1d20 at the start of each turn at 0 HP, and 10 or higher succeeds. Three successes make you Stable and three failures kill you. A 1 counts as two failures and a 20 restores 1 HP. Damage at 0 HP is one failure, or two from a Critical Hit, and damage equal to your HP maximum kills. Massive damage kills outright when the damage left over after dropping to 0 equals or exceeds your HP maximum. A Help action with a DC 10 Wisdom (Medicine) check stabilizes a creature, and a Stable creature regains 1 HP after 1d4 hours. A melee attacker can knock a creature out at 1 HP instead of killing it. The creature then starts a Short Rest (p. 17, p. 184).

**Short Rest** (p. 187). It lasts 1 hour and needs at least 1 HP to start. You spend Hit Point Dice, each rolling the die plus your Constitution modifier, minimum 1. Rolling Initiative, casting any spell other than a cantrip, or taking damage interrupts it, and an interrupted Short Rest gives no benefit.

**Long Rest** (p. 185). It lasts at least 8 hours, including at least 6 hours of sleep, and needs at least 1 HP. You regain all HP and all spent Hit Point Dice. Reduced ability scores and HP maximum return to normal, and Exhaustion drops by one level. After a Long Rest "you must wait at least 16 hours before starting another one". Rolling Initiative, casting a non-cantrip spell, taking damage, or 1 hour of walking or other exertion interrupts it. If you rested at least 1 hour first, you still get Short Rest benefits. You can resume, adding 1 hour per interruption.

**Exhaustion** (p. 181). Levels stack. Each D20 Test "is reduced by 2 times your Exhaustion level", Speed drops 5 feet per level, and level 6 is death. Each Long Rest removes one level.

**Heroic Inspiration** (p. 8, p. 183). You can expend it "to reroll any die immediately after rolling it, and you must use the new roll." You hold at most one. If you gain a second, it's lost unless you give it to a player character who lacks it. The GM awards it, and Humans also gain it after each Long Rest. **Inference.** In a one-PC game the overflow has no recipient, so it's simply lost.

### SRD 5.2.0 versus 5.2.1

The inventory script diffs the two PDFs.

- 5.2.1 added 15 magic items, taking the count from 243 to 258. They are Bead of Nourishment, Cloak of Invisibility, Elixir of Health, Energy Bow, Gloves of Thievery, Hat of Many Spells, Potion of Invulnerability, Potion of Longevity, Potion of Vitality, Quarterstaff of the Acrobat, Rod of Resurrection, Sending Stones, Sentinel Shield, Shield of the Cavalier and Thunderous Greatclub.
- 5.2.1 added an Octopus stat block. 5.2.0 already offered Octopus as a Find Familiar form without one.
- 5.2.0 printed the Knight stat block under the title "Iron Golem" ([SRD 5.2.0 p. 299](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf#page=299)). It's a Medium or Small Humanoid with AC 18 and 52 HP. 5.2.1 titles it Knight.
- The spell list is the same 339 names in both.

The D&D Beyond table of "differences between SRD 5.1 and 5.2" lists exactly those 15 items as additions, so it describes 5.2.1 ([SRD page](https://www.dndbeyond.com/srd)).

### In the 2024 Player's Handbook but not in SRD 5.2.1

Foundry's official PHB listing gives 12 classes, 48 subclasses, 10 species, 16 backgrounds and 75 feats ([Foundry PHB page](https://foundryvtt.com/packages/dnd-players-handbook)). Two fan databases list 391 PHB spells ([dndspells.com](https://dndspells.com/), [aidedd.org spells](https://www.aidedd.org/spell/)). Aidedd marks SRD content with a "(BR)" tag, and its tagged sets match my SRD parse exactly. The 339 tagged spells equal the SRD list once the 17 renamed spells are mapped, and the 17 tagged feats equal the SRD feats ([aidedd.org feats](https://www.aidedd.org/feat/)).

| Category | PHB 2024 | SRD 5.2.1 | Missing from the SRD |
| --- | --- | --- | --- |
| Classes | 12 | 12 | none. The Artificer is in neither. |
| Subclasses | 48 | 12 | 36 |
| Species | 10 | 9 | Aasimar |
| Backgrounds | 16 | 4 | 12 |
| Feats | 75 | 17 | 58 |
| Spells | 391 | 339 | 52 |

Missing subclasses, from the [comicbook.com reveal of all 48](https://comicbook.com/gaming/news/dungeons-dragons-2024-players-handbook-48-subclasses/):

| Class | Not in the SRD |
| --- | --- |
| Barbarian | Path of the Wild Heart, Path of the World Tree, Path of the Zealot |
| Bard | College of Dance, College of Glamour, College of Valor |
| Cleric | Light Domain, Trickery Domain, War Domain |
| Druid | Circle of the Moon, Circle of the Sea, Circle of the Stars |
| Fighter | Battle Master, Eldritch Knight, Psi Warrior |
| Monk | Warrior of Mercy, Warrior of Shadow, Warrior of the Elements |
| Paladin | Oath of Glory, Oath of the Ancients, Oath of Vengeance |
| Ranger | Beast Master, Fey Wanderer, Gloom Stalker |
| Rogue | Arcane Trickster, Assassin, Soulknife |
| Sorcerer | Aberrant Sorcery, Clockwork Sorcery, Wild Magic |
| Warlock | Archfey Patron, Celestial Patron, Great Old One Patron |
| Wizard | Abjurer, Diviner, Illusionist |

Missing backgrounds ([Wargamer](https://www.wargamer.com/dnd/2024-backgrounds)) are Artisan, Charlatan, Entertainer, Farmer, Guard, Guide, Hermit, Merchant, Noble, Sailor, Scribe and Wayfarer.

Missing feats, 58 in all ([aidedd.org feats](https://www.aidedd.org/feat/)):

- Origin, 6. Crafter, Healer, Lucky, Musician, Tavern Brawler, Tough.
- General, 41. Actor, Athlete, Charger, Chef, Crossbow Expert, Crusher, Defensive Duelist, Dual Wielder, Durable, Elemental Adept, Fey-Touched, Great Weapon Master, Heavily Armored, Heavy Armor Master, Inspiring Leader, Keen Mind, Lightly Armored, Mage Slayer, Martial Weapon Training, Medium Armor Master, Moderately Armored, Mounted Combatant, Observant, Piercer, Poisoner, Polearm Master, Resilient, Ritual Caster, Sentinel, Shadow-Touched, Sharpshooter, Shield Master, Skill Expert, Skulker, Slasher, Speedy, Spell Sniper, Telekinetic, Telepathic, War Caster, Weapon Master.
- Fighting Style, 6. Blind Fighting, Dueling, Interception, Protection, Thrown Weapon Fighting, Unarmed Fighting.
- Epic Boon, 5. Boon of Energy Resistance, Boon of Fortitude, Boon of Recovery, Boon of Skill, Boon of Speed.

Missing spells, 52 in all, by level ([aidedd.org spells](https://www.aidedd.org/spell/)):

| Level | Spells |
| --- | --- |
| 0 | Blade Ward, Friends, Mind Sliver, Thorn Whip, Thunderclap, Toll the Dead, Word of Radiance |
| 1 | Armor of Agathys, Arms of Hadar, Compelled Duel, Hail of Thorns, Thunderous Smite, Witch Bolt, Wrathful Smite |
| 2 | Arcane Vigor, Beast Sense, Cloud of Daggers, Cordon of Arrows, Crown of Madness, Summon Beast |
| 3 | Aura of Vitality, Blinding Smite, Conjure Barrage, Crusader's Mantle, Elemental Weapon, Feign Death, Hunger of Hadar, Lightning Arrow, Summon Fey, Summon Undead |
| 4 | Aura of Purity, Fount of Moonlight, Grasping Vine, Staggering Smite, Summon Aberration, Summon Construct, Summon Elemental |
| 5 | Banishing Smite, Circle of Power, Conjure Volley, Destructive Wave, Jallarzi's Storm of Radiance, Steel Wind Strike, Summon Celestial, Swift Quiver, Synaptic Static, Yolande's Regal Presence |
| 6 | Arcane Gate, Summon Fiend, Tasha's Bubbling Cauldron |
| 7 | Power Word Fortify |
| 8 | Telepathy |

These 17 spells are in the SRD under a generic name. The PHB name follows each one.

| SRD name | PHB name |
| --- | --- |
| Acid Arrow | Melf's Acid Arrow |
| Arcane Hand | Bigby's Hand |
| Arcane Sword | Mordenkainen's Sword |
| Arcanist's Magic Aura | Nystul's Magic Aura |
| Black Tentacles | Evard's Black Tentacles |
| Faithful Hound | Mordenkainen's Faithful Hound |
| Floating Disk | Tenser's Floating Disk |
| Freezing Sphere | Otiluke's Freezing Sphere |
| Hideous Laughter | Tasha's Hideous Laughter |
| Instant Summons | Drawmij's Instant Summons |
| Irresistible Dance | Otto's Irresistible Dance |
| Magnificent Mansion | Mordenkainen's Magnificent Mansion |
| Private Sanctum | Mordenkainen's Private Sanctum |
| Resilient Sphere | Otiluke's Resilient Sphere |
| Secret Chest | Leomund's Secret Chest |
| Telepathic Bond | Rary's Telepathic Bond |
| Tiny Hut | Leomund's Tiny Hut |

Other PHB material outside the SRD ([PHB contents](https://www.dndbeyond.com/sources/dnd/phb-2024)):

- Appendix A, The Multiverse. The SRD FAQ says 5.2 dropped "The Planes of Existence" as not rules-bearing.
- Appendix B, Creature Stat Blocks, as a unit. The SRD has many of these creatures in Animals and in spell text, but I didn't audit the overlap.
- The introduction, "Worlds of Adventure".
- Named figures. The FAQ says names like Strahd, Orcus and Tiamat won't appear, and it excludes the Beholder.

DMG 2024 material a DM engine might want but can't use sits in the [DMG contents](https://www.dndbeyond.com/sources/dnd/dmg-2024). It includes Bastions (chapter 8), the Group Size advice (chapter 2), Chases, Mobs, Creating a Creature, Creating a Magic Item, Creating a Spell, Supernatural Gifts, Marks of Prestige, Renown, Settlements, Greyhawk, Cosmology and the Lore Glossary. The SRD's Gameplay Toolbox headings match a subset of DMG headings, such as Traps, Poison and Combat Encounters.

## 2. Machine-readable SRD 5.2 data

### The candidates

| Dataset | Format | Code license | SRD content license | Base version | Last data commit |
| --- | --- | --- | --- | --- | --- |
| [5e-bits/5e-database](https://github.com/5e-bits/5e-database/tree/main/src/2024/en), `src/2024/en` | 25 JSON arrays, one per category | MIT ([LICENSE.md](https://github.com/5e-bits/5e-database/blob/main/LICENSE.md)) | CC-BY-4.0 by way of the SRD. The README still cites the OGL. | 5.2.0 for magic items. Has Knight, lacks Octopus. | `6f6299e7`, 2026-09-22 |
| [open5e/open5e-api](https://github.com/open5e/open5e-api/tree/staging/data/v2/wizards-of-the-coast/srd-2024), `data/v2/wizards-of-the-coast/srd-2024` | 34 Django fixture JSON files, rows joined by `pk` | "Modified MIT" that excludes SRD content and images ([LICENSE.md](https://github.com/open5e/open5e-api/blob/staging/LICENSE.md)) | CC-BY-4.0, recorded in Document.json | 5.2.0 for magic items. Has Knight and Octopus. | `0acbf263`, 2026-09-22 |
| [foundryvtt/dnd5e](https://github.com/foundryvtt/dnd5e/tree/6.0.x/packs/_source), `packs/_source/*24` on branch 6.0.x | YAML, one Foundry document per file, HTML descriptions with Foundry template tags | MIT ([LICENSE.txt](https://github.com/foundryvtt/dnd5e/blob/6.0.x/LICENSE.txt)) | CC-BY-4.0. The [README](https://github.com/foundryvtt/dnd5e/blob/6.0.x/README.md) carries the SRD 5.1 and 5.2 statements. Art and tokens have separate restrictive licenses. | 5.2.1. Has all 15 added items, Octopus and Knight. | spells24 `efd1c8d5`, 2026-09-04. Release 6.0.5 on 2026-09-22. |
| [downfallx/dnd-5e-srd-markdown](https://github.com/downfallx/dnd-5e-srd-markdown) | Markdown, one file per chapter | none separate | CC-BY-4.0 per its LICENSE file | 5.2.1 | 2026-01-10 |
| [oldmanumby/dnd.srd.5.2.1](https://github.com/oldmanumby/dnd.srd.5.2.1) | Markdown folders per chapter | GitHub detects no license file | SRD text. The repo has a Legal.md that I didn't review. | 5.2.1 | 2026-06-20 |
| [FernDragonborn/charnik-content-srd](https://github.com/FernDragonborn/charnik-content-srd), `srd-2024` | 17 CSV files with in-band `#content-*` headers | CC-BY-4.0 | CC-BY-4.0 | 5.2.1 per its `#content-source` header | 2026-09-23 |

Coverage, counted from the files I downloaded:

| Category | SRD 5.2.1 | 5e-database | open5e | Foundry `*24` packs | charnik |
| --- | --- | --- | --- | --- | --- |
| Classes and subclasses | 12 and 12 | 12 and 12 | 24 CharacterClass rows, 12 of them subclasses | classes24, 282 files with classes, subclasses, features and options | present, not counted |
| Level progression | 12 classes x 20 levels | 287 level rows (240 class, 47 subclass) with slots, prepared spells and class-specific columns | 1,811 ClassFeatureItem level rows | advancement data inside the class items | present, not counted |
| Class features | not counted | 232, with descriptions | 352 | one item per feature | 232 |
| Invocations and Metamagic | 28 and 10 | missing | prose inside one feature each | 29 and 10 separate items | not checked |
| Spells | 339 | 339 | 339, plus 671 upcast rows | 341 files | 339 |
| Stat blocks | 330, plus 5 embedded | 341 rows, shapechanger forms split, no Octopus | 331, including Giant Fly | actors24, 436 files including summons, premades and vehicles | 330 |
| Magic items | 258 | 262 rows with variants split. Lacks the 15 added in 5.2.1. | 760 rows with every variant expanded. Lacks the same 15. | inside equipment24, 633 files including mundane gear | inside a 420-row items file with gear |
| Feats | 17 | 17 | 17 | 17 | 17 |
| Backgrounds and species | 4 and 9 | 4 and 9, plus 24 subspecies | 4 and 9 | origins24, 54 files | present, not counted |
| Conditions | 15 | 15 | 15 | in the rules journals | present, not counted |
| Weapons and masteries | 38 and 8 | 38 weapons with a `mastery` field, 8 properties | 38 weapons, 17 properties of which 8 are masteries | inside equipment24 | inside the items file |
| Glossary and toolbox | 155 entries, 8 sections | conditions, 14 poisons and damage types only | 56 rules covering Playing the Game and Character Creation | content24, 43 journal files | not checked |

#### 5e-bits/5e-database

The data is plain JSON arrays keyed by `index`, with references shaped `{index, name, url}`. It's the same data the public API serves at https://www.dnd5eapi.co/api/2024, which returned 339 spells, 341 monsters and 262 magic items when I queried it. The level rows are ready to use. `wizard-1` has 3 cantrips, 4 prepared spells and two level 1 slots. `barbarian-1` has `rage_count` 2, `rage_damage_bonus` 2 and `weapon_mastery` 2.

The gaps are the Eldritch Invocation and Metamagic options, the glossary and toolbox tables, the XP thresholds for leveling, and the 5.2.1 additions.

The monster data is three days old and unaudited. [PR #1229](https://github.com/5e-bits/5e-database/pull/1229) says it came from a third-party gist, answers "How was it tested?" with "It's not (yet).", and notes the gist lacked skills, gear and proficiency bonus. [PR #1231](https://github.com/5e-bits/5e-database/pull/1231) merged the generated 341-row file on 2026-09-22 with the schema tests passing. Schema tests don't check stat values against the book.

The README says the "underlying material is released using the Open Gaming License Version 1.0a". That doesn't fit the 2024 folder, because SRD 5.2 is Creative Commons only. Use the CC statement instead.

#### open5e/open5e-api

The data is relational. Monsters come with structured attacks (to-hit, reach, damage dice) and spells come with per-slot casting options. It's the only JSON source with rules text, 56 entries across 11 rule sets for the Playing the Game and Character Creation chapters. Document.json still names "System Reference Document 5.2" with a placeholder publication date of 2024-01-01 and an old WotC link. I found at least one bad row. The Aboleth's tentacle attack has `damage_type: null`. The license says "This software makes no claims to license of included SRD and OGL content", and its images are CC BY-NC 4.0.

#### foundryvtt/dnd5e

This is the only structured source that tracks 5.2.1. It's also the richest in mechanics, with activities that encode saves, damage and templates, plus active effects. The costs are high. Node 24 has no built-in YAML parser. Descriptions embed Foundry template syntax such as `[[lookup @labels.description.affects capitalize]]`. The data model migrates with each Foundry major version. Assets are a trap. [tokens/LICENSE](https://github.com/foundryvtt/dnd5e/blob/6.0.x/tokens/LICENSE) forbids using the Forgotten Adventures tokens outside Foundry, and [ui/official/LICENSE](https://github.com/foundryvtt/dnd5e/blob/6.0.x/ui/official/LICENSE) says the same for the WotC art. The SVG icons are game-icons.net under CC BY 3.0 ([icons/LICENSE](https://github.com/foundryvtt/dnd5e/blob/6.0.x/icons/LICENSE)). Take text and numbers only and drop every `img` path.

#### Markdown and CSV conversions

downfallx and oldmanumby hold the full 5.2.1 text as Markdown. That's good for an LLM retrieval index and for reading, but it isn't structured data. charnik-content-srd is a small project with no stars, but its counts match my parse exactly, 339 spells and 330 stat blocks.

#### Smaller repos found late

A final GitHub search turned up four more. I audited only the first.

- [adkinn/srd-5.2.1](https://github.com/adkinn/srd-5.2.1) has MIT code and CC-BY data built from SRD 5.2.1. It holds only `monsters.json` and `conditions.json`. The monster file has 322 entries, including Octopus and Knight, so it's short of the SRD's 330. Last commit 2026-08-30.
- [archivist-gg/archivist-dnd5e](https://github.com/archivist-gg/archivist-dnd5e) is a TypeScript package with MIT code. Its README says it bundles SRD 5.1 and 5.2 as Markdown sources plus JSON under CC-BY-4.0. Last push 2026-09-23.
- [greghcarr/dnd-srd-engine](https://github.com/greghcarr/dnd-srd-engine) describes itself as a standalone TypeScript domain engine for the 2024 rules, with a two-license split explained in its NOTICE. Last push 2026-07-09.
- [gelatinous-labs/dndsrd5.2_markdown](https://github.com/gelatinous-labs/dndsrd5.2_markdown) is CC-BY-4.0 Markdown of the SRD. Last push 2026-04-28.

#### APIs

https://www.dnd5eapi.co/api/2024 and https://api.open5e.com/v2/documents/srd-2024/ serve the two JSON datasets above. Portale can't call them at runtime under its constraints. They're fine for build-time cross-checks.

### Recommendation

| Option | Strengths | Weaknesses |
| --- | --- | --- |
| Vendor 5e-database `src/2024/en` | Plain JSON that Node imports natively. One flat file per category. Level tables ready. Active maintenance. | 5.2.0 item gap. No invocations or Metamagic. Monsters unaudited. README license text is wrong. |
| Vendor open5e `srd-2024` | Structured monster attacks and upcasting. Some rules text. | Many joins by `pk`. Same 5.2.0 gap. Stale metadata. Known bad rows. |
| Convert Foundry `*24` packs | Only 5.2.1-complete source. Richest mechanics. | YAML, a Foundry schema and template markup. A large converter. Asset license traps. |
| Parse the SRD PDF ourselves | Authoritative, exactly 5.2.1 | Layout parsing is fragile and every entity still needs JSON shaping. |

I recommend 5e-database, pinned at `6f6299e7` or a later audited commit. Ship it with four additions.

1. A build-time validator that compares names and counts against the SRD 5.2.1 lists in `srd-5.2.1-data/`. Those are 339 spells, 330 stat blocks, 258 magic items and 155 glossary entries. Compare by name family, since the datasets split variants differently.
2. Patches for the 15 magic items and the Octopus, transcribed from SRD 5.2.1.
3. Invocation and Metamagic data transcribed from SRD 5.2.1 pp. 66 and 72-74, with Foundry's items as a cross-check.
4. Spot checks of every monster Portale actually spawns, against the PDF or against open5e's structured attacks.

**Inference.** A solo engine uses a few hundred entities, so a validator plus patches costs less than converting Foundry.

If you take this route, ship these notices:

```text
5e-database (https://github.com/5e-bits/5e-database)
MIT License
Copyright (c) [2018-2020] [Adrian Padua, Christopher Ward]
<full MIT permission notice from LICENSE.md>

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
Portale converted this material into structured data and edited it for use in a game engine.
```

We'd have to transcribe these ourselves whichever dataset we pick. Everything listed is in SRD 5.2.1.

- Tables. XP Budget per Character (p. 202), Experience Points by Challenge Rating and Proficiency Bonus by Challenge Rating (p. 256), Character Advancement XP (p. 23, since 5e-database has only `prof_bonus`), point costs and the standard array (p. 21), Standard and Rare Languages (p. 20), Starting Equipment at Higher Levels (p. 24), the multiclass spell slot rules (pp. 24-26), Travel Terrain and travel pace (p. 192), traps, curses and contagions, environmental effects, and fear and mental stress (pp. 193-201), and Magic Item Crafting Time and Cost (p. 207).
- Rules as engine code. All 12 actions, all 15 conditions, rests, death saves, exhaustion, Heroic Inspiration, Concentration, cover, Opportunity Attacks and grappling. No dataset encodes their semantics. The conditions arrive as prose.
- Spell and item effects. Datasets carry damage dice, save type and area. Effects such as Polymorph or Wish need handwritten handlers.

## 3. 2014 to 2024 differences that change an implementation

The 2014 column cites SRD 5.1 or the 2014 Basic Rules. The 2024 column cites SRD 5.2.1 unless it names the conversion guide, which is WotC's official change list.

| Topic | 2014 | 2024 | What the engine must do |
| --- | --- | --- | --- |
| Ability score increases | From race. The Elf gets "Your Dexterity score increases by 2" ([SRD 5.1 p. 4](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=4)). | From background. Add +2 and +1, or +1 to all three, among the background's three listed abilities. No score may go above 20 (p. 21). Species give none (guide p. 2). | Move the increase choice from species to background. Check the cap. |
| Level 1 feat | Not part of standard creation in SRD 5.1 | Every background grants an Origin feat (p. 83). The Human's Versatile trait grants another (p. 86). | Feats and feat prerequisites exist from level 1. |
| Languages | Set by race | Common plus two of your choice, independent of species and background (guide p. 2) | Language choice is its own creation step. |
| Species | "Race", with subraces | "Species" give creature type, size, Speed and traits. The SRD has 9. | Model lineages and ancestries as species options. 5e-database calls them subspecies. |
| Standard array | 15, 14, 13, 12, 10, 8 ([Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters)) | Same (p. 21) | No change |
| Point buy | 27 points, scores 8 to 15. A score of 8 costs 0, 9 costs 1, 10 costs 2, 11 costs 3, 12 costs 4, 13 costs 5, 14 costs 7 and 15 costs 9 ([Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters)). | Same budget and costs (p. 21) | No change |
| Random scores | Roll 4d6, keep the highest three, six times ([Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters)) | Same (p. 21) | No change |
| Maximum at level 1 | Point buy tops out at 15 "before applying racial increases" ([Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters)) | Background increases can't raise a score above 20 (p. 21). **Inference** from the arithmetic. Array and point buy top out at 17, and a rolled 18 can reach 20. | One cap check at 20. Epic Boons later raise the cap to 30 (p. 88). |
| Weapon mastery | None | Every weapon has one of 8 mastery properties (pp. 90-92). Barbarian, Paladin, Ranger and Rogue unlock 2 weapon kinds at level 1 and the Fighter 3. After a Long Rest the Barbarian and Fighter can change one choice, and the Paladin, Ranger and Rogue can change their choices (pp. 29, 48, 54, 58, 62). | Track a mastery set per character with the per-class swap rule. Hook the properties into the attack pipeline. |
| Two-weapon fighting | A light melee weapon in each hand gives a Bonus Action off-hand attack ([SRD 5.1 p. 95](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=95)). | The Light property grants the extra attack as a Bonus Action with a different Light weapon. Nick folds it into the Attack action once per turn (pp. 89-90). | The Attack action state tracks the Light extra attack. |
| Heavy property | Small creatures have Disadvantage ([SRD 5.1 p. 65](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=65)). | Disadvantage if Strength is below 13 for melee or Dexterity is below 13 for ranged (p. 89) | Check scores, not size. |
| Exhaustion | Six levels with distinct effects. Disadvantage on checks, Speed halved, Disadvantage on attacks and saves, HP maximum halved, Speed 0, death ([SRD 5.1 p. 358](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=358)). | Minus 2 per level on every D20 Test, minus 5 feet of Speed per level, death at 6. A Long Rest removes one level (p. 181). | One integer drives the penalty. There's no per-level table. |
| Inspiration | Inspiration grants Advantage ([SRD 5.1 pp. 59-60](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=59)). | Heroic Inspiration rerolls any die, and you hold at most one (p. 8, p. 183). | Put a reroll hook on every die roll. Store one boolean per PC. |
| Death saves | DC 10, three of a kind, a 1 is two failures, a 20 regains 1 HP, damage at 0 is a failure ([SRD 5.1 p. 98](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=98)) | Same (pp. 17-18). Knocking out now leaves the target at 1 HP and starts a Short Rest (p. 17). | Keep the death save logic. Update the knockout rule. |
| Short Rest | At least 1 hour, spend Hit Dice ([SRD 5.1 p. 87](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=87)) | 1 hour, spend Hit Point Dice. Rolling Initiative, casting a non-cantrip spell or taking damage interrupts it, and then it gives nothing (p. 187). | Model interruption events. |
| Long Rest | 8 hours. Regain all HP and up to half your total Hit Dice. One per 24 hours. Restart after 1 hour of strenuous activity ([SRD 5.1 p. 87](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=87)). | Regain all HP and all Hit Point Dice. Ability scores and HP maximum restored. Exhaustion drops one level. 16 hours between rests. Listed interruptions, resumable for 1 extra hour each. One hour of rest before an interruption earns Short Rest benefits (p. 185). | A rest state machine with timestamps |
| Subclass level | Cleric, Sorcerer and Warlock at 1, Druid and Wizard at 2, the rest at 3 ([SRD 5.1 class tables](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=15)) | Every class at 3 | One unlock level |
| Paladin and Ranger casting | From level 2 (SRD 5.1 class tables) | From level 1 (pp. 54, 57) | Level 1 spell slots for both |
| Prepared spells | Cleric, Druid, Paladin and Wizard prepare ability modifier plus level. The Wizard version is on [SRD 5.1 p. 53](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=53). The others know a fixed list. | Every caster has a Prepared Spells column. Wizard level 1 prepares 4 (p. 77). Bard, Sorcerer and Warlock swap one spell on gaining a level. Paladin and Ranger swap one after a Long Rest. Cleric, Druid and Wizard can change any after a Long Rest (pp. 32, 37, 42, 54, 58, 65, 72, 78). | Table lookup per level. Swap cadence per class. |
| Bonus Action spells | After a Bonus Action spell, the only other spell that turn is a cantrip with a 1-action casting time ([SRD 5.1 p. 101](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=101)). | You can expend only one spell slot per turn (p. 105). | Replace the old rule with a per-turn slot counter. |
| Rituals | Needed a class ritual feature | Any caster can ritual-cast a prepared spell that has the Ritual tag (p. 104, p. 187, guide p. 10). The Wizard's Ritual Adept casts rituals from the spellbook. | Allow the ritual flag for every caster. |
| Casting action | Cast a Spell action | The Magic action covers spells, magic items and magical features (p. 185, guide p. 2). | One action type for all three |
| Surprise | You can't move or act on your first turn ([SRD 5.1 p. 90](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=90)). | Disadvantage on Initiative (guide p. 2). A static Initiative score of 10 + Dex is an option (p. 184). | Surprise becomes a roll modifier. |
| Grapple and shove | A special attack resolved by contested Athletics ([SRD 5.1 p. 95](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=95)) | Options of the Unarmed Strike. The target makes a Strength or Dexterity save against DC 8 + Strength modifier + PB (p. 190). | Save-based resolution |
| Hiding | Stealth against Perception, no fixed DC ([SRD 5.1 p. 80](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=80)) | The Hide action needs DC 15 Stealth and makes you Invisible. Your total becomes the DC to find you (p. 183). | Hidden is the Invisible condition plus a stored DC. |
| Encounter math | XP thresholds plus multipliers by monster count and party size ([Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/building-combat-encounters)) | An XP budget per character with no multipliers (p. 202) | See section 5. |
| Critical hits | Roll the attack's damage dice twice ([SRD 5.1 p. 96](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=96)) | Same (p. 16) | No change |
| Advancement | XP thresholds and PB ([SRD 5.1 p. 56](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=56)) | Same numbers (p. 23) | No change |

Other 2024 changes the engine will notice, from the [conversion guide](https://media.dndbeyond.com/compendium-images/srd/guide/converting-to-srd-5.2.1.pdf) and the SRD:

- "D20 Test" is the umbrella term for ability checks, attack rolls and saving throws. You can choose to fail a save without rolling (p. 7). Proficiency in both the tool and the skill gives Advantage (guide p. 1).
- The Attack action lets you equip or unequip one weapon per attack and move between attacks. Help needs a relevant proficiency and proximity. Influence is a new action. Search covers Wisdom checks and the new Study covers Intelligence checks. Use an Object is now Utilize (guide pp. 1-2).
- You can't drop Prone at Speed 0. You can move through the space of an Incapacitated creature or a Tiny non-ally. An ally's space is no longer Difficult Terrain. Ending a turn in another creature's space leaves you Prone unless you're Tiny or larger than it (guide p. 2).
- Rolling damage once for all targets now applies only to saving throw effects (guide p. 2).
- Conditions were revised, including Charmed, Exhaustion, Grappled, Incapacitated, Invisible, Petrified and Stunned (guide pp. 11-12). Incapacitated now breaks Concentration, stops speech and gives Disadvantage on Initiative (p. 184). A Stunned creature can now move but can't speak.
- The Concentration save DC caps at 30 (p. 179). A creature is Bloodied at half HP or less (p. 177).
- Drinking or administering a potion is a Bonus Action (guide p. 10, p. 13). Armor proficiency is now called Armor Training (guide p. 9).
- The weapons table added Musket and Pistol, moved the Net to adventuring gear, raised Trident damage and changed the Lance (guide p. 9).
- Ability Score Improvement is a feat (guide p. 9). Every class gets an Epic Boon feat at level 19 (guide pp. 3-9).
- Multiclass prerequisites now live in each class description. Each requires 13 in the primary ability of the new class and your current classes (p. 24, guide p. 3).
- The monster stat block format changed as described in section 1 (guide pp. 13-14).

## 4. The Artificer

### Status for the 2024 rules

- The 2024 PHB has no Artificer. WotC released an Unearthed Arcana playtest, "The Artificer", on D&D Beyond in December 2024, with feedback opening December 24 ([EN World](https://www.enworld.org/threads/d-d-releases-playtest-for-updated-artificer.709152/), [TechRaptor](https://techraptor.net/tabletop/news/dd-beyond-releases-dungeons-dragons-2024-artificer-unearthed-arcana), [UA page](https://www.dndbeyond.com/sources/dnd/ua/the-artificer)).
- The official 2024 version is in *Eberron: Forge of the Artificer*. WPN says the book went through "a full reprint due to a post-production defect" and that "both physical and digital editions will now launch December 9, 2025", with early access for North American WPN preorders on November 25 ([WPN](https://wpn.wizards.com/en/products/product-details-or-d-and-d-or-eberron-forge-of-the-artificer)). D&D Beyond gave Master Tier subscribers access on November 25 and Hero Tier on December 2 ([D&D Beyond](https://www.dndbeyond.com/posts/2106-whats-new-with-the-artificer-in-eberron-forge-of)).
- The class has five subclasses. The new one is the Cartographer, and Alchemist, Armorer, Artillerist and Battle Smith were updated (same two sources).
- The 2014-era Artificer appeared in *Eberron: Rising from the Last War* (2019) and *Tasha's Cauldron of Everything* (2020). That class history is my background knowledge. The [Wikipedia article on Forge](https://en.wikipedia.org/wiki/Eberron:_Forge_of_the_Artificer) confirms the two books and their years but not the class history.

### Licensing

None of it is openly licensed. SRD 5.1 has no Artificer. The SRD 5.2 FAQ names the Artificer as excluded for "brand identity protection, licensing strategy, and intellectual property rights" ([SRD page](https://www.dndbeyond.com/srd)). The UA and the book are all rights reserved. The [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy) doesn't open a door either. It says "Don't use Wizards' IP in other games", which covers a game like Portale whether or not it's free.

### Building an original artificer-like class

The legal footing, US only and not legal advice. [Copyright Office Circular 33](https://www.copyright.gov/circs/circ33.pdf) says copyright excludes "any idea, procedure, process, system, method of operation, concept, principle, or discovery", and protects only the expression. It also says names and short phrases aren't copyrightable but "may be protectable under federal or state trademark laws".

Practical steps. All of this is **Inference** and design guidance.

1. Write a one-page functional spec before anyone on the project reads WotC's artificer text. State the fantasy in your own words, for example an Intelligence half-caster who builds temporary magic gear and fights beside a construct. Commit the spec as the provenance record.
2. Build only from SRD 5.2.1 parts. Take the half-caster slot progression from the Paladin and Ranger tables and the multiclass rule "Half your levels (round up)" (p. 25). Take Intelligence casting from the Wizard. Choose a class spell list from the 339 SRD spells. Base crafting on Brewing Potions of Healing and Scribing Spell Scrolls (p. 103) and Crafting Magic Items (pp. 206-207). Draw replicable gear from the 258 SRD items. Pick a companion from SRD stat blocks, such as Homunculus (CR 0), Animated Flying Sword (CR 1/4), Animated Armor (CR 1) or Shield Guardian (CR 7) as a high-level reference.
3. Invent every name. Avoid the class name Artificer, the subclass names Alchemist, Armorer, Artillerist, Battle Smith and Cartographer, and feature names from the book, the UA and the 2014 version. Those include Tinker's Magic, Replicate Magic Item, Magic Item Tinker, Flash of Genius, Magic Item Adept, Spell-Storing Item, Advanced Artifice, Magic Item Master, Soul of Artifice, Infuse Item, Steel Defender and Eldritch Cannon.
4. Don't mirror the level-by-level structure. Pick your own feature levels and numbers from playtests. Structure alone isn't protected, but copying the whole progression invites a derivative-work argument.
5. Keep the local DM model away from it. The model has probably memorized PHB and Forge text. Never ask it to "play an artificer". Give it Portale's own class text and filter its output for the names above.
6. Tag provenance on every rules entity, such as `source: "SRD 5.2.1 p. 83"` or `source: "Portale original"`, and have a build check reject anything else.

## 5. Encounter building and advancement

### XP Budget per Character

This table is in [SRD 5.2.1 p. 202](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=202). The conversion guide marks Combat Encounters as a new rule drawn from the 2024 core books (guide pp. 1, 13), and the DMG places Combat Encounters in chapter 4 ([DMG contents](https://www.dndbeyond.com/sources/dnd/dmg-2024)). Using the SRD copy keeps the numbers under CC-BY.

| Party level | Low | Moderate | High |
| --- | --- | --- | --- |
| 1 | 50 | 75 | 100 |
| 2 | 100 | 150 | 200 |
| 3 | 150 | 225 | 400 |
| 4 | 250 | 375 | 500 |
| 5 | 500 | 750 | 1,100 |
| 6 | 600 | 1,000 | 1,400 |
| 7 | 750 | 1,300 | 1,700 |
| 8 | 1,000 | 1,700 | 2,100 |
| 9 | 1,300 | 2,000 | 2,600 |
| 10 | 1,600 | 2,300 | 3,100 |
| 11 | 1,900 | 2,900 | 4,100 |
| 12 | 2,200 | 3,700 | 4,700 |
| 13 | 2,600 | 4,200 | 5,400 |
| 14 | 2,900 | 4,900 | 6,200 |
| 15 | 3,300 | 5,400 | 7,800 |
| 16 | 3,800 | 6,100 | 9,800 |
| 17 | 4,500 | 7,200 | 11,700 |
| 18 | 5,000 | 8,700 | 14,200 |
| 19 | 5,500 | 10,700 | 17,200 |
| 20 | 6,400 | 13,200 | 22,000 |

The procedure (pp. 202-203) is three steps. Choose a difficulty. Multiply the row by the number of characters. Spend the budget on creature XP without going over. Low means one or two scary moments and no casualties. Moderate could go badly without healing and other resources. High could be lethal for one or more characters. The SRD's rule of thumb is that "a single monster generally presents a low-difficulty challenge for a party of four characters whose level equals the monster's Challenge Rating."

The troubleshooting notes (p. 203), paraphrased:

- With more than two creatures per character, include fragile ones, especially at levels 1 and 2.
- Adjust on the fly. Creatures can flee to ease a fight or reinforcements can arrive to harden it.
- Use CR 0 creatures sparingly and prefer swarms.
- Keep to two or three different stat blocks per encounter.
- A creature whose CR is above the party's level can drop a character with one action. The SRD's example is an Ogre (CR 2) killing a level 1 Wizard with one blow.
- Skip monsters with features that lower-level characters can't easily overcome.

### Scaling for a single player character

The official rule is simple. One character's budget is the table row times one. The SRD gives no solo adjustment. The DMG has a "Group Size" section in chapter 2 ([DMG contents](https://www.dndbeyond.com/sources/dnd/dmg-2024)). It isn't in the SRD, and I couldn't read it.

The 2014 rules show why solo play needs care. They multiplied monster XP by 1 for one monster, 1.5 for two, 2 for three to six, 2.5 for seven to ten, 3 for eleven to fourteen and 4 for fifteen or more. A party of fewer than three used the next multiplier up, so a solo PC facing one monster used 1.5 ([Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/building-combat-encounters)). At levels 1 to 5, the 2024 Low, Moderate and High rows equal the 2014 Medium, Hard and Deadly thresholds exactly, and High equals Deadly through level 8. For example, level 3 is 150, 225 and 400 in both.

**Inference.** A 2024 Moderate solo fight at level 3 buys one CR 1 monster at 200 XP. The 2014 rules would have rated it 300 adjusted XP, between Hard (225) and Deadly (400). Solo fights built from the 2024 table are harder than their label.

**Inference.** Death is the sharp edge. A solo PC at 0 HP has no ally to heal or stabilize it, and every hit while down is a failed save, or two on a Critical Hit. The SRD knockout rule (p. 17) gives the engine a legal off-ramp. Monsters can capture, rob or abandon the PC instead of killing it.

A starting policy for Portale. All of it is **Inference** and tunable.

| Situation | Budget row | Limits |
| --- | --- | --- |
| Routine fight | Low | At most 2 creatures. At levels 1 and 2, one creature or fragile minions. |
| Significant fight | Moderate | At most 2 creatures. No creature with CR above the PC's level. |
| Boss or set piece | High | An exit must exist, such as flight, surrender or capture. Consider an NPC ally. |

The engine should compute the budget and pre-filter SRD stat blocks that fit. The LLM then picks from that list and never invents a monster. The SRD recommends starting at level 3 for groups of seasoned players (p. 24). For a solo PC, starting at level 2 or 3 widens the safety margin. **Inference.**

Worked solo budgets from the tables:

- Level 1, Moderate, 75 XP. One CR 1/4 creature (50 XP) plus one CR 1/8 (25 XP). Three CR 1/8 creatures also fit the budget but break the two-creature cap above.
- Level 3, Moderate, 225 XP. One CR 1 creature (200 XP).
- Level 5, High, 1,100 XP. One CR 4 creature (1,100 XP).

### Character advancement and Proficiency Bonus

This table is on [SRD 5.2.1 p. 23](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=23). The numbers match the 2014 table ([SRD 5.1 p. 56](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf#page=56)).

| Level | XP | PB | Level | XP | PB |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | +2 | 11 | 85,000 | +4 |
| 2 | 300 | +2 | 12 | 100,000 | +4 |
| 3 | 900 | +2 | 13 | 120,000 | +5 |
| 4 | 2,700 | +2 | 14 | 140,000 | +5 |
| 5 | 6,500 | +3 | 15 | 165,000 | +5 |
| 6 | 14,000 | +3 | 16 | 195,000 | +5 |
| 7 | 23,000 | +3 | 17 | 225,000 | +6 |
| 8 | 34,000 | +3 | 18 | 265,000 | +6 |
| 9 | 48,000 | +4 | 19 | 305,000 | +6 |
| 10 | 64,000 | +4 | 20 | 355,000 | +6 |

After level 20 a GM can grant one feat per 30,000 XP earned above 355,000 (p. 24). The tiers of play are levels 1-4, 5-10, 11-16 and 17-20 (pp. 23-24).

### XP and PB by Challenge Rating

This table is on [SRD 5.2.1 p. 256](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=256).

| CR | XP | CR | XP | CR | XP |
| --- | --- | --- | --- | --- | --- |
| 0 | 0 or 10 | 10 | 5,900 | 21 | 33,000 |
| 1/8 | 25 | 11 | 7,200 | 22 | 41,000 |
| 1/4 | 50 | 12 | 8,400 | 23 | 50,000 |
| 1/2 | 100 | 13 | 10,000 | 24 | 62,000 |
| 1 | 200 | 14 | 11,500 | 25 | 75,000 |
| 2 | 450 | 15 | 13,000 | 26 | 90,000 |
| 3 | 700 | 16 | 15,000 | 27 | 105,000 |
| 4 | 1,100 | 17 | 18,000 | 28 | 120,000 |
| 5 | 1,800 | 18 | 20,000 | 29 | 135,000 |
| 6 | 2,300 | 19 | 22,000 | 30 | 155,000 |
| 7 | 2,900 | 20 | 25,000 | | |
| 8 | 3,900 | | | | |
| 9 | 5,000 | | | | |

A monster's Proficiency Bonus by CR is +2 for CR 0-4, +3 for 5-8, +4 for 9-12, +5 for 13-16, +6 for 17-20, +7 for 21-24, +8 for 25-28 and +9 for 29-30 (p. 256).

## Gotchas

- **5.2.0 and 5.2.1 differ.** Datasets built on 5.2.0 miss 15 magic items and the Octopus. 5.2.0 also mislabels the Knight as "Iron Golem". Validate against 5.2.1.
- **5e-database's README says OGL.** Ignore that line for the 2024 folder and use the CC statement.
- **The trademark isn't licensed.** "5E compatible" is the permitted description.
- **The LLM DM will reach for non-SRD content from memory.** Expect Beholders, Aasimar, Great Weapon Master and Toll the Dead. Keep the catalogs engine-owned, put only SRD names in prompts, and filter output. The name lists in `srd-5.2.1-data/` seed the deny-list.
- **Foundry art and tokens can't leave Foundry.** Strip `img` fields when converting.
- **Heroic Inspiration's give-away clause has no target in a one-PC game.** A second award is lost.
- **Datasets split entries differently.** Variants and shapechanger forms change raw counts, so compare name families.
- **SRD 5.2 carries no Bastions, Chases or Mobs.** Any such DM subsystem in Portale must be original.

## Files produced

`docs/research/rules-srd-5.2.1.md` is this report.

`srd-5.2.1-data/srd_inventory.py` downloads both SRD 5.2 PDFs, prints the spell, stat block, magic item and glossary counts, and diffs the versions. It needs PyMuPDF (`pip install pymupdf`). It writes four lists. `srd521-spells.tsv` has level and name, `srd521-statblocks.tsv` has name and CR, `srd521-magic-items.txt` has one item per line, and `srd521-glossary.txt` has one glossary entry per line. Copies of those four outputs sit beside the script.

`srd-5.2.1-data/phb2024-only-spells.tsv` and `phb2024-only-feats.tsv` hold the 52 spell and 58 feat names from aidedd.org that the SRD lacks. They seed the LLM output filter. Names are facts, not protected text.

## Principles applied

- **Prove It Works.** I counted from the official PDFs instead of trusting dataset or search-engine claims. That's how the 5.2.0 and 5.2.1 gap and the Knight mislabel surfaced. Two AI web-search answers during this research echoed numbers from my own query back as "verified", and one listed the wrong SRD subclasses.
- **Build the Lever.** The inventory script reruns every SRD count, and its output lists become the fixtures for the recommended build-time validator.
- **Boundary Discipline.** The recommendation treats vendored data as untrusted input and validates it once, at build time, so the engine can trust its internal types.
