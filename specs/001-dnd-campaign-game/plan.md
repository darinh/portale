# Implementation Plan: A D&D campaign game

**Branch**: per-phase `feat/` branches in worktrees | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-dnd-campaign-game/spec.md`, the research in
`docs/research/`, and three design candidates in `design-candidates/`.

## Summary

Portale becomes a solo D&D game on the 2024 rules (SRD 5.2.1) with campaigns made of modules, while the
production DM stays a 3B local model. The design keeps the model's job small however large the rules
grow. Each turn the engine computes the legal, fully specified actions open to the hero. That one list
is the browser's action bar, the DM's only enum, and the rules' lookup table. A tapped action leaves the
DM only the narration. Typed text makes the DM pick one offer and write the attempt. The engine resolves
everything, from rolls and damage to discoveries, clocks, goals and endings. Content (SRD, original,
campaign, player-built) is data behind one parser that the forge also imports, and a save pins the exact
content it started with.

## Technical Context

**Language/Version**: TypeScript run directly by Node 24 (`erasableSyntaxOnly`, relative `.ts` imports).

**Primary Dependencies**: none at runtime. TypeScript for typechecking only. SRD 5.2.1 content is
vendored as data from `5e-bits/5e-database` at a pinned commit, patched and checked at build time
against the counts in `docs/research/srd-5.2.1-data/` (research-rules §2).

**Storage**: `node:sqlite`. Tables for saves, events, content packs by digest, and turn receipts.

**Testing**: `node --test`, the mutation harness (`tools/mutate`), the playtest lever (`tools/playtest`),
`tools/model-probe` against the live model, and the verify-portale browser recipes.

**Target Platform**: a phone browser at 390x844 against a local Node server and a local Ollama model.

**Project Type**: web game plus a command-line forge, in one repository.

**Performance Goals**: one model call per decision outside combat and one per hero turn in combat, with a
short combat narration cap; a module plays in 30 to 60 minutes (SC-007).

**Constraints**: the constitution. Zero runtime dependencies, no build step, the engine decides every
mechanical outcome, the log is the only authority, the browser sees a projection, every rule has a
named test proven by mutation.

**Scale/Scope**: 13 classes at levels 1 to 3 in the first D&D release, then higher bands; 339 spells,
330 stat blocks and 258 magic items available as data; hand-authored campaigns plus a forge.

## Constitution Check

| Principle | How the design keeps it |
| --- | --- |
| I. The DM proposes, the engine disposes | The DM picks one engine-minted offer and a difficulty band label. It never emits a number, a clock, a discovery, a milestone or a damage value. |
| II. Shape is undecodable | The offer list is the enum, rebuilt every turn. A tapped action collapses the schema to `narration`. |
| III. The log is the only authority | Saves pin content digests; events record outcomes; the sheet, progress, phase, active module and active hero are derived. |
| IV. The player sees a projection | `project` builds the view, the action bar included. The narrator never receives undiscovered clue text. |
| V. Every rule has a named test | Each phase adds its rules with mutants; the contract has conformance fixtures both programs run. |
| VI. Prove it on the real surface | Each phase ends with a verify-portale recipe on the phone viewport and a database check. |
| VII. Zero dependencies, no build | Packages import each other by relative `.ts` path. Vendored SRD data is JSON. |

No violation needs justifying.

## The design

### The one idea: the engine mints the offers

`offers(scene)` returns a closed, ordered, capped list of legal actions, each fully bound: this weapon
against that foe, this spell at this slot on these targets, search the crates for the thing hidden
there, go north. Each offer has an id, a short label, and a payload only the rules read.

| Consumer | Uses the list as |
| --- | --- |
| The browser | The action bar. A button the UI can draw is an action the engine accepts. |
| The DM | The single `offer` enum in the per-turn schema. |
| The rules | The lookup table. A turn resolves the chosen offer's payload. |

The DM's schema shrinks from today's eleven fields to at most three, and to one when the player tapped:

```
typed text  ->  { offer: enum(offer ids), band?: enum('very easy'...'very hard'), narration }
tapped      ->  { narration }
aside (//)  ->  { narration }
```

`tick`, `milestone`, `reveals`, `target`, `direction`, `ability`, `difficulty`, `damage`, `introduces`
and the mint slots are deleted. Each was the model nominating a state change the engine then had to
referee, and every progress bug the review found was a refereeing failure (review-gaps 13, 14, 15, 17,
18, 20). The band appears only when an offer needs it, which is the improvised skill check, and the
engine maps it to 5, 10, 15, 20 or 25.

Typed text never shows the model the whole list. Deterministic relevance ranking (names the player used,
the obvious action for the scene, one offer per group) cuts it to at most `MAX_TYPED_OFFERS`, a constant
the phase 1 probe sets. The model picks from that cut, and it is always a projection of the same offers
the action bar shows, never a separately constructed list. The cap applies only to the model's enum.
The action bar hides nothing legal: it is grouped (Fight, Magic, Explore, Talk, Items), and a group opens
its parameters (which spell, at what slot, on whom), so every legal choice stays reachable by tapping.
Constitution II is about illegal choices being undecodable; a legal offer cut from the typed enum is
still one tap away.

A tapped action resolves first and never needs the model to take effect. The DM narrates the outcome it
is told, and if the model is unreachable the action still commits with engine-authored result lines and
a recorded stall. Typed text is one call that picks the offer and narrates the attempt, followed by
engine-authored result lines; if the model is unreachable, typed text commits a stall and nothing else,
and the player can tap instead. The narrator's brief carries public facts, the offers' labels and what
just happened. It never carries an undiscovered clue's text, so a secret cannot leak through prose.
Narration from every model path (the DM, asides, the forge's filler) passes a deny-list of non-SRD names
taken from `docs/research/srd-5.2.1-data/`, and the names the research says the original class must
avoid.

An out-of-character aside is its own command and never reaches the settlement funnel: no time passes, no
trigger counts it, no death save rolls, nobody acts. The existing aside mutants carry over.

### The turn: a budget for the hero, a schedule for the round

Outside combat a player decision is one offer. In combat the hero's turn is an action budget: an action,
a bonus action, one move between range bands, and a reaction per round. `offers` returns only what the
remaining budget can buy, plus End turn. At levels 1 to 3 this is what Second Wind, Action Surge, Cunning
Action, Healing Word, Hunter's Mark and the Light extra attack need. The engine resolves each spend at
once and shows engine-authored lines. The hero's turn ends when they choose End turn or nothing
affordable remains. The engine then runs every other combatant in initiative order and pauses at the
hero's next decision, or earlier at a reaction window.

**The model is called once per hero turn, not once per spend.** Spends within a turn cost no model call.
The DM narrates when the turn ends, covering the hero's turn and the foes' replies, with a short
narration cap in combat (about 120 tokens, roughly 8 seconds at 15 tokens per second). A typed action
that ends the turn is the same single call. Measured against SC-007, a round costs one call, so a
five-round fight is under a minute of generation.

A reaction window (Shield, an opportunity attack against a fleeing foe, Uncanny Dodge later) is a
persisted pending choice the player answers by tapping, never a model call. Its rolls are already in the
log when it opens, it survives a reload, and declining is a recorded choice.

**Space is range bands around the hero**, because the only point of view that matters in a solo game is
the hero's. Every other combatant has its own band.

| Band | Distance | What it means |
| --- | --- | --- |
| engaged | within 5 feet | melee and touch reach; a ranged attack by or against the hero has disadvantage while any hostile is engaged with the hero |
| close | up to 30 feet | one move of 30 feet reaches engaged; most short spells and thrown weapons |
| far | beyond 30 feet, up to 120 | normal and long weapon range; long spells |

A spell or weapon range maps to the nearest band that contains it; out of every band means out of range.
Speed 30 buys one band step per move, and Dash a second; speed 25 still buys one. Leaving engaged
provokes an opportunity attack from each foe engaged with the hero unless the hero Disengaged or
teleported. Areas (a 15-foot cone, a 10-foot emanation) hit every combatant engaged with the hero, and
larger areas also hit close. Push moves a target one band out. This is an adaptation for one player on a
phone, recorded as such; a tactical grid is out of scope.

Every resolution path ends in one settlement funnel, `settle`, which applies clock triggers, proactive
discoveries, goal evaluation, combat end, death and the module lifecycle, in a fixed order with named
tests. It is today's `finish()` promoted to the only way a decision becomes events. The order resolves
collisions: effects of the action, reactions, time triggers, discoveries and goals, then lifecycle. A
dead hero takes precedence over a goal met on the same decision, and the goal facts stay earned so a
successor can finish the module. A clock pays off exactly once.

### Content: packs, one parser, pinned by digest

```
Pack = { manifest: { id, version, provenance, contractVersion, contractDigest }, entries }
```

SRD data, Portale's original content (the artificer-style class among it), each campaign, and each
player-built class are packs. `parsePack(unknown)` in `packages/contract` is the only place JSON becomes
domain types, and the forge imports that same function. `digestOf(pack)` hashes the parsed, canonically
ordered entries.

Features, spells, items and clock payoffs are expressed in a closed effect vocabulary (damage, heal,
temporary hit points, condition, attack roll, save, resource, slot, reveal, advance clock, spawn, loot,
set flag, and so on). The tail that data cannot express uses `{ kind: 'scripted', script }`, a named
handler in engine code. A pack whose provenance is a campaign or the player may not contain a scripted
effect, and `parsePack` refuses it. So campaign and player content is pure data on the same path as the
SRD, and a generated spell cannot reach engine code.

Admission also runs a capability closure. Every feature, spell and item reachable by a class within the
supported level band, every monster an encounter can spawn and every item it can drop must resolve to
vocabulary or a registered script. An unsupported mechanic is an admission error, not prose that
silently does nothing. References resolve within a pack's declared scope: SRD, then the campaign, then
the module. A campaign's class is offered only in that campaign, and a reference to an absent spell is an
error naming both ends.

`admit(bytes)` is one predicate both programs run: parse, closure, and the quality rules at error
severity. The game refuses anything the forge would refuse, and the forge refuses anything the game
would. Warnings appear only in the forge's report and never block play. Every entity carries its own
provenance (an SRD page, or "Portale original"), and admission rejects an entity with neither.

### The hero, the monsters, and one combatant shape

The hero stores choices and consumption: species, background, class and level, ability assignment,
proficiency picks, inventory, prepared spells, damage taken, slots and resources spent, conditions, XP.
`sheetOf(hero, packs)` derives AC, attack bonuses, save modifiers, spell DC, slot maxima, passive
perception and hit point maximum, and is never stored. Storing damage taken rather than current hit
points means a level-up that raises the maximum cannot disagree with it.

Current condition is a sum type, `up | dying | stable | dead`, derived from the log. Death saves are
counted from `deathSave` events since the last stabilisation.

A monster is a stat-block reference plus its own damage taken and conditions. Heroes and monsters both
project into one `Combatant` shape (AC, hit points, save modifiers, attacks, conditions, initiative), and
combat code sees only that.

Creation offers 4d6 drop lowest (seeded, recorded as events), 27-point buy over 8 to 15, the standard
array, and free assignment up to 20.

### Progress: goals are predicates, clocks have triggers and teeth

A module's goal is data: `revealed`, `defeated`, `reached`, `flag`, `clockFilled`, `all`, `any`.
`outcomeOf` evaluates it against the folded state, and the quest bar is the fraction of satisfied terms.
There is no milestone field and no unearned-milestone ruling to get wrong.

Clocks have 4, 6 or 8 segments and engine-owned triggers: rest, turns elapsed, a failed check, turns
without a discovery, entering a node, another clock filling. A filled clock's payoff is effects, so the
harbourmaster's men actually arrive. A turns-without-discovery trigger is also how a module's proactive
clue reaches a stuck player (research-campaigns G6).

Discovery happens two ways, both engine-owned. Entering a node reveals every unfound clue whose notice DC
is at or below passive Perception. A search offer is a check whose success reveals its clue.

### Death and succession

At 0 hit points the hero is dying and rolls death saves at the start of their turn (DC 10; a 1 counts
twice; a 20 stands up at 1 hit point; damage while down is a failure, a critical two; massive damage
kills outright). Three successes make the hero stable, and a stable hero regains 1 hit point after 1d4
hours of game time. Foes declare what they do to a downed hero in their stat block's tactics: keep
attacking, take them captive, or rob them and leave. That is the SRD's knockout off-ramp
(research-rules §5), so a solo hero is not killed by default and not spared by default. Three failures
open the fate choice: End or Continue. Continue opens creation at the dead hero's level with the XP that
level needs. The new hero enters at the nearest safe anchor the module declares, with the module entrance
as the validated fallback, never into a live fight. The old hero's gear stays where they fell as loot.

The hero is a slot on the save. Found clues, goal terms, clock state, flags and loot belong to the save,
so a successor inherits progress by construction.

### Persistence and idempotence

```
packs  (digest PRIMARY KEY, body)                    write-once
saves  (id PRIMARY KEY, seed, pins)                  pins = content digests
events (save_id, seq, payload, PRIMARY KEY (save_id, seq))
turns  (save_id, turn_id, first_seq, last_seq, PRIMARY KEY (save_id, turn_id))
```

The client mints a turn id before it sends and keeps it until it sees a response, so a reload resends
the same id. The events and the receipt are written in one transaction, and the cache is published only
after commit. A retried turn id takes no second turn and rolls nothing; it returns the current view,
which is not claimed to be byte-identical to the first response. Every decision appends a `chose` event
carrying the chosen offer's full payload, and offer ids are content-shaped (`attack:e_marga:it_dagger`),
so the log says exactly what was chosen without re-deriving the menu.

Creation, level-up, the fate choice and the gap between modules are persisted phases, not browser state.
Each choice is a command appended to the log, so a reload or a restart resumes at the next required
selection. Every command names the phase it expects, and a command from an obsolete screen (a second
Continue, a stale level-up) is refused with 409 and the current view, so a transition cannot happen
twice whatever ids are sent. Game time is recorded in the log, and rests, stable recovery and clock
triggers read it.

Replay folds recorded outcomes. It never re-resolves a command, so a rules fix changes future turns and
never rewrites the past; the action bar is recomputed from current rules and can differ after a patch.
Rules code is not pinned per save.

### The forge

A command-line tool and library in `packages/forge`. Code owns the plan; the model owns short local prose;
the shared validator owns the verdict (research-campaigns §3).

```
skeleton(seed, pitch) -> Draft   graph, node kinds, revelations, clue slots meeting G1 to G6, clocks,
                                 XP budgets from SRD 5.2.1 p. 202, a wave of difficulty, finale, epilogue
fill(draft, filler)   -> Draft   one model call per entity, neighbours' names only, cached by seed
lint(draft, packs)    -> Report  parsePack plus the graded quality rules, each with a location
sim(draft, n)         -> Report  engine-driven playthroughs, and a check that a winning route stays
                                 reachable from every live state visited (SC-002)
pack(draft)           -> Pack    canonical order, digest, provenance
```

### Packages

```
packages/contract   types, parsePack, digestOf, CONTRACT_VERSION, contractDigest, conformance fixtures
packages/rules      sheetOf, offers, the turn budget and schedule, effects, conditions, rests, settle
packages/app        director, store, HTTP, public/index.html
packages/forge      skeleton, fill, lint, sim, pack
content/            srd-5.2.1.pack.json, portale-original.pack.json, campaigns/*.pack.json
```

Sync is three mechanical checks. The forge calls the game's `parsePack` rather than a copy. A frozen
test asserts `contractDigest()`, a hash of the contract's declared field table, against a checked-in
constant, so any contract change fails until the constant and `CONTRACT_VERSION` move together. The game
refuses a pack whose contract digest it does not know.

## Synthesis decision

Three candidates were produced independently on different models (`design-candidates/`). A cross-judge
on a different model family scored them B 28, A 27, C 20 and recommended B. The coordinator scored them
A 30, B 26, C 20 and chose A as the base, for three reasons. A's central idea, one engine-minted list for
the UI, the DM and the rules, is the smallest mechanism that keeps a 3B model's decision constant as the
content grows. It deletes the refereeing surface that produced every progress bug the review found
rather than refereeing it better. And its first phase falsifies its own riskiest assumption on the real
model before anything else is built. Where the two scores disagree, the judge is right on one point and
it is grafted.

Grafted from B:
- The combat turn as an action budget with the engine walking initiative until the hero's next decision.
  This fixes the judge's valid objection to A, which resolved a whole round per command and could not
  express bonus actions or Extra Attack.
- A tapped action resolves before the DM narrates, so the narration describes what happened.
- The narrator never receives undiscovered clue text.
- Capability closure at admission.
- The effect-language feasibility slice (a full caster, a transformation, a reaction, Pact Magic) as an
  early gate, run alongside phase 1.
- SC-002 checked as reachability of a winning route from every live state, not only random walks.
- Safe entry anchors for a successor.

Grafted from C: the `up | dying | stable | dead` sum type, and one mandatory settlement funnel.

Then two adversarial reviewers attacked the synthesized plan with split briefs (`grok-4.6` to falsify it,
`gpt-6-astra` to find omissions). Their reports changed it:
- The phase 1 kill criterion compared a five-way op rate with a bound-offer pick on a fixture that never
  searches or walks. It now compares exact resolved actions on a purpose-built fixture, old system
  against new, before the live game is touched.
- A budget of several spends per turn at one model call each broke SC-007 on a 15 token-per-second model.
  The model is now called once per hero turn with a short combat cap, and reactions are taps.
- Three room-wide zones could not place two foes or express spell ranges. They are now hero-centric range
  bands with a conversion table.
- Deleting `reveals` and `tick` without engine replacements would have stopped the wandering DM completing
  anything and left clocks toothless. Phase 1 now carries clock payoffs, per-clock triggers and a
  search-first wandering DM.
- A receipt that stored only a sequence range could not return "the recorded view". Decisions now log the
  chosen payload, and a retry returns the current view without claiming byte identity.
- Also added: persisted creation, level-up and fate phases with a phase precondition on every command;
  a grouped action bar so the cap never hides a legal choice; offline taps; the aside as a command outside
  settlement; death-save stability, foe tactics toward a downed hero, and settlement precedence; one
  admission predicate shared by game and forge; scoped references; per-entity provenance and a deny-list
  on every model output path; attribution shipping with the first SRD-derived content.

Rejected, with reasons:
- B's five-foot grid. Zones deliver opportunity attacks and ranges on a phone without a battlemap.
- B's per-save pinning of rules code, the durable director-started operation protocol, and the process
  lockfile. Replay folds recorded outcomes, one local process owns the database, and a turn id with one
  transaction already makes retries safe. The cost is maintaining old rules revisions forever.
- C's DM-nominated `reveals` and `tick`, and its stored current and maximum meters.
- A's one-command-per-round resolution.
- DM-invented characters. Modules ship a cast pool and the DM may introduce one of its members by offer.

## Phases

Riskiest first. Each phase lands on its own branch, keeps the game playable on the phone, adds named
tests and mutants, and ends with a verify-portale run and a database check. Details are in `tasks.md`.

| Phase | What lands | Proves | Gate |
| --- | --- | --- | --- |
| 1a | `offers()` and the offer schema behind a probe, with an exact-action fixture; the live game unchanged | the 3B model picks the right offer | **Kill criterion.** Exact-action accuracy of the offer schema must be at least that of today's proposal resolved through today's rules, on the same fixture, at `--repeat 3`. If lower, stop and redesign. |
| 1b | Effect-language feasibility slice, executed through a rules runner in fixtures, alongside 1a | the vocabulary covers the hardest level 1 to 3 features, including a player-built class | If unrelated features keep needing scripts, redesign the vocabulary. |
| 1c | Offers land in the game: the grouped action bar, engine-owned discovery and clock triggers, clock payoffs, turn ids, `chose` events, offline taps | the tavern and delves still complete, now with teeth | Playtest completions do not fall; mutation green. |
| 2 | The hero sheet with 2024 origins, combat with the turn budget and range bands, reactions as taps, death saves and stability; the Fighter 1 to 3 as a real `ClassDef`; attribution notice | US2, US3 | |
| 3 | `packages/contract`, `admit`, packs, pinning, scoped references, conformance fixtures; the tavern re-authored as module 1; the title screen and API migrated; prototype saves as read-only transcripts | FR-016, FR-018, FR-020 | |
| 4 | SRD data vendored and checked by name family and monster values; all thirteen classes at 1 to 3, spells, items, inventory; rests with game time and interruption | US4, US5, US6 | Capability closure passes for every class; a clock interrupts a rest in a fixture. |
| 5 | Modules with teeth: nodes, cast pools, goal predicates, full clock triggers and payoffs, passive perception, XP, level-up | US7, FR-011, FR-014 | |
| 6 | Campaigns and succession | US8, US9 | |
| 7 | The forge | US11 | Bundled campaigns pass `admit`; a one-clue conclusion fails with G1 and its location, in both programs. |
| 8 | Content of your own: the class builder and module-scoped content | US10 | |
| 9 | Higher level bands, one complete band at a time | FR-004 at higher levels | |

## Open questions

1. The artificer-style class's player-facing name. The research advises against "Artificer" and its
   feature names (research-rules §4). The default until decided is an original name with the class
   described as an artificer-style option.
2. `MAX_TYPED_OFFERS`. Phase 1a measures exact-action accuracy at 6, 8 and 12 labelled offers and sets it.
3. How existing prototype sessions end. The default is that they stay playable under the current engine
   until phase 3, then become read-only transcripts on the title screen.

## Measuring the success criteria

Each criterion gets an executable check in the first phase that can measure it.

| Criterion | Check | First phase |
| --- | --- | --- |
| SC-001 | a timed first-player creation run on the phone viewport, under three minutes | 2 |
| SC-002 | 1,000 engine playthroughs per bundled module with a winning-route reachability check from every live state; each module won and lost at least once | 1c for today's content, 5 for modules |
| SC-003 | every mechanical value in the view equals its value after a cold replay of the log | 2 |
| SC-004 | reload and cold restart at each persisted phase: mid-combat, mid-creation, mid-level-up, between modules | 2, extended per phase |
| SC-005 | a 30-turn session against the live model; at least 29 turns produce a usable answer rather than a stall | 1c |
| SC-006 | `admit` gives the same verdict in both programs over every bundled campaign, positive and negative fixtures | 7 |
| SC-007 | a timed module playthrough on the production machine, 30 to 60 minutes | 5 |

## Project Structure

### Documentation (this feature)

```text
specs/001-dnd-campaign-game/
├── spec.md
├── plan.md                 # this file
├── tasks.md
├── checklists/requirements.md
└── design-candidates/      # the three candidates and the judge's verdict
```

### Source Code (repository root)

```text
packages/contract/src/      pack types, parsePack, digestOf, conformance/
packages/rules/src/         sheet, offers, turn, effects, settle
packages/app/src/           director, store, app, server; public/index.html
packages/forge/src/         skeleton, fill, lint, sim, pack, cli
content/                    packs
tools/                      mutate, playtest, model-probe, replay-probe, api-cli
```

**Structure Decision**: split `packages/app` into `contract`, `rules` and `app` in phase 3, when the
contract first has a second consumer. Phases 1 and 2 work inside `packages/app` so the kill criterion is
tested before any restructuring.

## Complexity Tracking

No constitution violation to justify.
