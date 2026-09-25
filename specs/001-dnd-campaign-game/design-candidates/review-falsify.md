# Falsify report. Plan 001, 2026-09-25

Read-only review of
`C:\Users\dahoove\projects\portale\.worktrees\docs-plan-001\specs\001-dnd-campaign-game\plan.md`
against `tasks.md`, `spec.md`, the constitution, the live engine under
`packages\app\src`, the replay and model probes, and design candidates A, B, C.
Ranked by what it would cost if found during implementation.

throughput checkpoint: n/a, read-only investigation

---

## 1. The phase 1 kill criterion does not compare like with like

**Cost if found late.** It is the stop-or-continue gate for the whole nine-phase
program. A false fail kills the central idea after T001 through T010 have already
rewritten the schema, the rules, the directors, and the UI. A false pass lets eight
later phases sit on a 3B picker that never beat the hard task.

**Claim.** Plan phase 1 gate and `tasks.md` lines 17-18, T011. Offer-pick accuracy
at `MAX_TYPED_OFFERS` must be at least "today's op accuracy on the replay probe
(26/30 op defensible, 0/12 violence dropped, 0/6 fight over a meta aside, at
`--repeat 3`)".

**What 26/30 actually is.** `tools\replay-probe\run.mjs` scores
`turn.accept.includes(p.op)`. The fixture in `real-session.json` gives each
utterance a *set* of ops, often two or three of `narrate_only`, `skill_check`,
`talk`, `engage`. Exploration ops in `director.ts` `OPS_BY_MODE` are five members.
The probe never calls `adjudicate`. It never scores target, tick, milestone, or
reveals.

**What offer-pick is.** One enum whose members are fully bound actions. That is
op plus target plus ability plus direction, collapsed. The enum probe in
`tools\model-probe\README.md` already split those jobs. `op` was 7/8 or 8/8 at
every size. Binding a described person to an id was 37% to 75%, and list length
was not the cause. The corrected table is 6/8, 3/8, 3/8, 4/8, 6/8 from size 3 to
25. The README retracted the length story and said `MAX_IN_REACH = 8` has no
evidence.

T001 still varies the one variable that probe said does not matter (6, 8, 12) and
still scores against the fixture's accepted *intents*, which are ops, not offer
ids. T001 is `[P]` and builds "labelled offers built from the real scene" before
`offers()` exists in T002. The kill run in T011 is supposed to use production
ranking. Those are two different lists.

The ten-turn fixture never leaves the common room, never searches, never walks,
never fills a clock. Phase 1's new work is search, walk, and engine-owned
progress. The gate cannot see it.

**Why this is false, not merely sloppy.** Comparing a 5-way defensible-op rate to
a 6-to-12-way bound-action rate is the easy task against the hard one. Mapping
offer groups back onto `accept[]` makes the gate pass whenever the model still
picks `talk` versus `engage`, which is what 26/30 already measured. Either reading
fails as a test of the new mechanism.

---

## 2. Three schema fields do not make a combat round one model call, and that is the SC-007 argument

**Cost if found late.** Phase 2 builds initiative, the budget, Fighter 1 to 3, and
the phone combat loop on this protocol. Changing "one HTTP decision per budget
spend" after that lands is a rewrite of the turn machine, the action bar, and
every combat test.

**Claim.** Plan line 36 treats two things as one performance goal. "one model call
per player decision; a module plays in 30 to 60 minutes (SC-007)". Lines 73-79
keep the model's per-call decision at most three fields. Lines 99-105 graft B's
action budget. T007 still sends every tap to the model for `{ narration }`.
`director.ts` `SAMPLING.max_tokens` is 700.

**Call count per hero round.** The three-field claim is about one invocation. It
is true as schema arithmetic. It is false as a round cost.

- Outside combat, one offer is one decision. In combat, the remaining budget
  still buys a bonus action, zone movement, and End turn after the action is
  spent. The turn ends only when the player picks End turn or nothing affordable
  remains (plan lines 99-102). Leftover movement means End turn is a second tap.
- T007. A tapped offer resolves, then the DM narrates. End turn is a tapped
  offer. It still costs a call.
- Action Surge is a Fighter 2 feature. Phase 1b T021 and phase 2 T034 put it in
  the first release. It adds a second action to the same round.
- T021 names Shield as a reaction. Plan line 100 says "later a reaction". B's
  `TurnState` pauses the engine walk for a pending reaction. Each incoming hit
  can become another player decision, therefore another call.
- Extra Attack is cited at plan lines 103-104 and 238-240 as the reason to reject
  A's one-command round. Extra Attack is a 5th-level feature. The first release
  is levels 1 to 3 (plan Scale/Scope, spec Assumptions). The justifying example
  is out of band.

NPC turns. "The engine then runs every other combatant" (plan line 102). The plan
does not say who narrates those swings. Today's `finish()` in `rules.ts` already
rolls reprisal without a DM choice. Engine-authored lines could stay silent on
the model. If each foe still needs a narration call, add one per combatant.

**Time.** `tools\model-probe\README.md` line 34. `qwen2.5:3b-instruct` on CPU ran
at 14.5 tok/s, "roughly 11s per turn". Constitution additional constraint. The
production DM is that 3B local model. A design that only works on a larger model
is not done.

At 11s, a cheap hero round is 2 calls (attack, End turn) = 22s of generation
before anyone reads. A round with bonus or move is 33s. Action Surge plus a
Shield interrupt is well above that. At the allowed 700 tokens, one call is
700 / 15 ≈ 47s, and three calls are about 2.3 minutes of wait per round. Spec
SC-007 is a 30 to 60 minute module, a band, not a slogan. Two five-round fights
at the cap consume most of an hour in generation alone.

Candidate A already asked this. `design-candidates\a\design.md` open question 4.
A full D&D turn (action plus bonus plus move) is "more faithful and fewer
round-trips per minute" if packed into one command, and it "multiplies the menu"
if offered as a combination. A also wrote "any model call that is not one per
turn" as deliberately not done. The plan rejected A's one-command round, grafted
B's budget, and kept A's SC-007 sentence. The round-trip math belongs to the
option they threw away.

The schema staying small does not save wall clock. SC-007 is not shown to hold on
a CPU 3B at ~15 tok/s. The plan never multiplies call count by measured seconds.

---

## 3. Three room zones plus opportunity attacks are not a rules model for spells or ranged attacks

**Cost if found late.** Phase 2 T032 ships zones and opportunity attacks. Phase 4
then pours 339 spells onto that geometry. If range, cover, and "in melee with A,
shooting B" cannot be expressed, combat and spellcasting both get rewritten.

**Claim.** Plan lines 107-108. "Space is theater of the mind with three zones per
room: engaged, near and far. Leaving engaged provokes an opportunity attack. A
tactical grid is out of scope."

**What the candidates actually specified.**

- A (`design.md`, "Deliberately not done"). Nodes and "in reach" only. No grid.
  No three-zone model.
- B (`design.md` line 177). Integer five-foot cells, blocked cells, cover, reach,
  opportunity attacks, cones, lines, pushing, movement between attacks. Phone UI
  still projects names, not a VTT.
- The plan rejected B's grid and did not keep A's "in reach". Zones are a
  synthesis with no sketch and no range table.

**What is undefined.**

- Zones are "per room". Two hostiles in one room cannot be engaged with one and
  far from the other. Opportunity attack and ranged disadvantage in 2024 are
  per-creature reach (5 feet of *an* enemy), not a room flag.
- Who swings the opportunity attack if several creatures share engaged. Everyone,
  the one you left, the engine's `reprisalActor`.
- Spell ranges. Touch, 15-foot cone or emanation, 30, 60, 90, 120, 150 collapse
  onto one bit (near versus far) plus engaged. Fire Bolt and Shocking Grasp
  become the same geometry, or an unstated extra table appears later.
- Ranged attack in melee. 2024 gives disadvantage when you make a ranged weapon
  or spell attack within 5 feet of an enemy, even if the *target* is far. A
  room-wide engaged zone either flags every shot or none.
- Disengage, teleport (Misty Step is in the 1 to 3 band), and forced movement.
  2024 opportunity attacks trigger on leaving reach with action, bonus, or move.
  They do not trigger on teleport. The plan only says "leaving engaged".
- Speed. 25 versus 30 feet, Dash, moving engaged to near to far as one spend or
  two. Unstated.
- Spec US2 says combat is "2024 rules as adapted for one player". FR-005 lists
  initiative, AC, damage, advantage, conditions, death saves. It does not list
  range. Adaptation can drop a grid. It cannot leave opportunity attacks and
  spell range as three adjectives and still be well defined.

B's grid exists because those facts need numbers. Rejecting the grid without
replacing the facts is not a smaller combat model. It is a missing one.

---

## 4. Deleting `reveals`, `tick`, and `milestone` in phase 1 does not leave clocks meaningful, and it can strand automated completeness

**Cost if found late.** T012 playtest and the "each phase keeps the game
playable" rule. If wanderer and scripted paths stop completing the tavern and
the delve, phase 1 ships a broken loop. Clock teeth then wait until phase 5
while T006 claims the gap is already closed.

**Today's win and pressure.**

- `outcomeOf` in `world.ts` wins when every vow is `done`.
- Tavern (`engine.ts` `SCENARIOS[0]`). One dangerous vow, four clues in four
  rooms, harbourmaster danger clock 6, Marga progress clock 4. Clock `payoff` is
  a string. `apply` of `filled` marks the clock done and `project` prints that
  string. Nobody is spawned. Review-gaps 15 in candidate A's problem statement.
  "A filled danger clock does nothing."
- Delve (`mapgen.ts`). One dangerous vow, three clues, pursuit danger clock 6.
  Same flavor payoff.
- Vow math. `VOW_TICKS = 40`. `TICKS_PER_MILESTONE.dangerous = 8`. Four
  discoveries with milestones yield 32, not 40. Today's tavern does not complete
  on clues alone. `applyMilestone` then allows an `earnedSomething` tick once
  nothing is hidden.
- Discovery is DM-nominated. `applyReveal` in `rules.ts` honors `proposal.reveals`.
- `wanderingDirector` in `director.ts` always sets `reveals` to the first clue
  here, ticks a clock every 3 turns, and milestones every 4. The comment says a
  model-free DM that never finds anything cannot walk a clue chain. It prefers
  fight or `move`. It never searches. Reveal-on-move is how playtests complete.

**What T004 through T006 do.**

- T004 deletes `tick`, `milestone`, `reveals`.
- T005 resolves walk, engage, attack, search (check at the clue DC), talk,
  improvised check, pass. Talk does not discover. Move does not discover. Entering
  a node does not discover. Passive perception is phase 5.
- T006. Each discovery advances the vow by an equal share "so finding every clue
  keeps it". Danger clocks tick on a failed check or a fight starting. It claims
  this "closes review-gaps 15 and 20 for today's content."

**Completeness, human.** A player who uses search offers in each clue room can
finish the tavern if equal-share really fulfills on the last clue. That is a
different game than talking to Olen and having the DM set `reveals`, but it is
winnable. The four tavern clues already have `at`. T003 only adds `where` and
`dc`.

**Completeness, delve, integer ticks.** Three clues into 40 ticks is not a whole
number. `floor(40/3)*3 = 39`. The vow never reaches 40 unless T006 also emits
`fulfilled` on the last find, ignoring remainder. The task text does not say
that.

**Completeness, wanderer and playtest.** T010 says the wandering DM "picks
offers by group". It does not say search-before-move when a clue is here. Today's
wanderer will map onto walk and fight. After T004 those paths do not `found` a
clue. T006 then never advances the vow. T012's 200-seed playtest should show the
collapse. Scripted `demo-script.ts` still names `tick`, `milestone`, and
`reveals`. It dies with T004 unless T010 rewrites it.

**Clocks are not meaningful.**

- Gap 15 is payoff-does-nothing. T006 adds more *ticks*, not effects. `filled`
  still writes flavor text. Harbourmaster's men still do not arrive. Plan
  "Progress" describes payoff as `Effect[]`. That is phase 5 T060, not phase 1.
  T006's claim that it closes gap 15 is false.
- T006 ticks only *danger* clocks. `c_marga` is `kind: 'progress'`. It never
  moves again.
- Harbourmaster has 6 segments. Triggers are failed check and fight starting.
  One fight is one tick. A careful player who never fails a search and never
  engages leaves the clock at 0. Today's wanderer ticked every 3 turns. Pressure
  becomes rare rather than mechanical.

Gap 20 (vow stuck unless the DM also claims milestone) is the one T006 actually
addresses, and only if search happens.

---

## 5. "Replay folds recorded outcomes and never re-resolves" does not hold for the receipt view or for a recorded offer id

**Cost if found late.** T008 and phase 3 pinning. Either old saves show a
different action bar after a rules patch, or a retried turn id rebinds a stored
id through a new `offers()` and silently does a different thing.

**Claim.** Plan lines 185-194.

```
turns  (save_id, turn_id, first_seq, last_seq, PRIMARY KEY (save_id, turn_id))
```

"A retried turn id returns the recorded view and rolls nothing."
"Replay folds recorded outcomes. It never re-resolves a command."
"Rules code is not pinned per save."

Candidate A `sketch\turn.ts` lines 77-80. "The payload is never recorded. The log
records the chosen `id` and `label`, and the *outcomes* as events." Same fold
story.

Candidate A `sketch\save.ts` lines 8-10. Recording a `MoveId` is safe because
pinned *content* makes "the menu that minted it" reproducible.

**The turns table does not store a view.** It stores a sequence range. After a
process restart the in-memory cache from plan line 191 is gone. A retry can only
`project(fold(events[1..last_seq]))`. T009 puts `view.offers` in that projection.
`offers()` is rules code. Rules are not pinned. The "recorded view" is rebuilt,
and the action bar is not an outcome event.

**MoveId plus no payload.** Live resolution is a lookup. Plan. "A turn resolves
the chosen offer's payload." A's crash recovery even says a missing marker
"replays the turn". That path *does* re-resolve. If ids are positional (`offer-1`
after ranking), a rules change or a ranking change points the same id at a new
payload. If ids are content-shaped (`attack:e_marga:it_longsword`), content
pinning helps and rules pinning is still required for "how that attack works".
B `design.md` line 215 said this in as many words. "Content hashes alone do not
preserve how an old spell behaves." The plan rejected B's rules pinning for
exactly the cost of keeping old revisions, then kept A's MoveId story that needs
them.

**What remains true.** Folding `rolled`, `damaged`, `found` events does not reroll
dice. Constitution III and `world.ts` file header want that. Past HP and past
discoveries survive a rules patch. The false part is extending that guarantee to
the receipt view and to any command stored as an offer id.

Spec SC-003. Every mechanical value shown can be reproduced by replaying the
save. After T009 the action bar is shown. Spec FR-018 is content edits, not
rules patches. The plan's own sentence "a rules fix changes future turns" admits
the bar will move. Calling the rebuilt projection "the recorded view" is the
lie.

---

## 6. Other load-bearing falsehoods

**Constitution Check says no violation.** Plan table, last line. Two sit in the
design.

- Principle II. Every enumerable choice is a closed enum so an illegal pick
  cannot be decoded. The typed path "never shows the model the whole list"
  (plan, The one idea). The cut is `MAX_TYPED_OFFERS`. A legal walk or search
  that sits on the action bar can be undecodable in the schema. That is not
  "illegal cannot be decoded". It is "legal cannot be chosen by typing". FR-019
  requires both typing and tapping.
- Principle III. A replayed log reproduces the world exactly. Dice stay pure.
  Derived offers do not, once rules are unpinned. See finding 5.

**"Before anything else is built."** Plan Synthesis. Phase 1 "falsifies its own
riskiest assumption on the real model before anything else is built." T001 can
run first. The named kill is T011, after T002 through T010 have replaced the
live contract. The assumption is not cheap to falsify.

**Tapped actions still need the model.** T007. B line 205. Structured commands
resolve when the director is down, with engine text and a stall. Spec edge case.
"The local model is unreachable for a whole session." The plan grafted B's
resolve-then-narrate order and dropped B's offline buttons. A 3B outage freezes
the action bar even after the engine already has the outcome.

**First release is 1 to 3, combat story uses Extra Attack.** Repeated from
finding 2. The graft note that A's round "could not express bonus actions or
Extra Attack" oversells a 5th-level feature. Bonus actions at 1 to 3 are real
(Cunning Action, Light extra attack, Healing Word, Second Wind, Action Surge).
Argue from those.

**Goal predicates versus T006 equal-share vows.** Plan Progress replaces the
Ironsworn track with `outcomeOf` on a predicate. T006 still uses the 40-tick
vow on today's tavern. Phase 1 and the target progress model are not the same
mechanism. Tests that assert boxes out of ten will not match "finding every
clue keeps it" unless someone picks one and deletes the other.

---

## Verdict

The one-list idea (UI, DM enum, rules lookup) can still be the right 3B move.
The plan then grafts a multi-call combat budget, a three-zone spatial model with
no ranges, a phase 1 progress cut that does not give clocks teeth, a receipt that
cannot return a recorded view, and a kill criterion that measures the old easy
op against a new hard bind.

I would not start phase 2 on this text. Fix the gate, the round's call budget
against 11s and 700 tokens, and the zone rules, in that order, or the later
phases spend their time undoing phase 2.
