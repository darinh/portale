# Implementation-plan omissions

Reviewed 2026-09-25. Findings are ranked by the cost of discovering them after dependent phases have shipped, not by implementation size.

The largest gaps concern persisted player choices, combat timing, and whether the effect vocabulary can actually execute its examples. Later tasks often name an entire subsystem without assigning its required behavior. This report distinguishes those assertions from omissions and from existing behavior that needs migration.

Only this report was written. No application, plan, research, or verification file was changed. This is a document and source review, not a claim that the planned implementation has been exercised.

## Reference key

References use the following files and their line numbers, task IDs, or named sections.

| Key | File |
| --- | --- |
| P | `C:\Users\dahoove\projects\portale\.worktrees\docs-plan-001\specs\001-dnd-campaign-game\plan.md` |
| T | `C:\Users\dahoove\projects\portale\.worktrees\docs-plan-001\specs\001-dnd-campaign-game\tasks.md` |
| S | `C:\Users\dahoove\projects\portale\.worktrees\docs-plan-001\specs\001-dnd-campaign-game\spec.md` |
| C | `C:\Users\dahoove\projects\portale\.specify\memory\constitution.md` |
| R | `C:\Users\dahoove\projects\portale\docs\research\rules-srd-5.2.1.md` |
| A | `C:\Users\dahoove\projects\portale\docs\research\campaign-design.md` |
| F | `C:\Users\dahoove\projects\portale\.github\skills\verify-portale\features\` |
| U | `C:\Users\dahoove\projects\portale\packages\app\public\index.html` |
| APP | `C:\Users\dahoove\projects\portale\packages\app\src\` |
| M | `C:\Users\dahoove\projects\portale\tools\mutate\run.mjs` |

An **omission** has no assigned behavior. An **assertion** has a heading, noun, or promise but lacks the rule or check needed to establish it. **Preservation** means the behavior already exists, but the plan changes its dependencies without assigning its migration.

## Ranked findings

### G01. Interrupted creation and level-up have no persisted workflow

**Cost if late: foundational save-format and UI rework. Omission.**

S SC-004 requires exact recovery mid-creation, mid-level-up, mid-combat, and between modules. US1.4 and the second edge case also require these paths after reload or restart. P:138-152 records completed hero choices and ability rolls. P:179-194 defines turn receipts and event folding. Neither defines incomplete choices, the pending screen, the next required selection, or when a creation or level-up decision commits.

T034 assigns a creation UI, T060 assigns level-up, and T070 assigns succession. None assigns events, commands, or projections for partial creation, subclass selection, spell selection, pending level-up, or a resumable successor draft. A browser-only draft is not part of the authoritative log and cannot be reconstructed by the server. Saving only the completed hero cannot reproduce which choices were already made.

The transition claim also lacks its enforcement. P:190-191 says counting `moduleEntered` events and taking the last roster entry makes a doubled transition a no-op. Counting two appended events advances twice. A turn receipt deduplicates the same ID, not two distinct IDs submitted from the same old between-module or fate screen. No task assigns a phase precondition or transition identity.

**Missing deliverable.** A persisted workflow with legal transitions and `PlayerView` states, followed by browser reload and cold-server restart checks at every incomplete choice. Transition checks must include repeated requests with both the same ID and different IDs from an obsolete screen.

### G02. The combat schedule has no reaction window or complete 2024 action rules

**Cost if late: combat scheduler, event, offer, and UI redesign. Omission and assertion.**

P:99-104 postpones a reaction until "later" and runs other combatants until the hero's next decision. T032 assigns initiative, budgets, zones, opportunity attacks, and only "a first set of conditions." No later task assigns a reaction interrupt, declining one, resuming the interrupted action, refreshing the reaction budget, or saving an open reaction choice. Yet T021 selects Shield as a feasibility example, and T051 promises all classes at levels 1 to 3.

The missing rules are already relevant in that band. R:479 requires a per-turn spell-slot expenditure counter. R:483 requires save-based grapple and shove. R:484 requires Hide to retain the Stealth total as the discovery DC. R:482 requires surprise to modify initiative. R:470 requires Heavy to test ability scores. None has an assigned implementation or check.

The zones decision is allowed, but its conversion rules are absent. R's weapon and mastery tables distinguish reach, range, 5-foot adjacency, 10-foot pushes, and Speed reductions. P:107-108 defines only three zones and provoking on leaving engaged. There is no rule translating those distances into movement costs, targets, Push, Slow, or areas of effect. "Conditions" also does not assign resistances, immunities, or their place in the damage pipeline.

Critical damage needs an explicit migration. R:486 requires rolling attack damage dice twice. Today's `APP\rules.ts`, `finish`, doubles a computed damage amount on a critical reprisal. T032 says "weapon damage dice" but never assigns critical-hit semantics or their display.

**Missing deliverable.** An executable action and reaction schedule with a declared zone adaptation, full supported-condition and damage semantics, and named checks for each required rule. The section 3 audit below identifies every affected row.

### G03. The effect-language gate only proves that examples can be written down

**Cost if late: replacement of the content vocabulary after thirteen classes depend on it. Assertion.**

T020 creates a sketch not imported by the game. T021 permits each hard feature to be expressed as either data or a named script. T022 records the result and uses repeated need for scripts as the redesign signal. There is no task to execute a feature, implement the named handler, spend and restore its resources, interrupt and resume its action, or replay its effects.

A `script` name can stand in for any behavior. Writing one does not show that the event model can support Shield, Wild Shape, Pact Magic, or Metamagic. P:132-134's admission closure checks that a handler exists, not that it obeys those rules. Phase 1b therefore does not establish the feasibility claim in P:268.

There is also an unresolved custom-content limit. P:128-130 forbids campaign and player packs from containing scripted effects, while US10 requires the same building blocks and code paths as standard classes. The feasibility work records which standard features need scripts but never checks that an equivalent player-built or campaign class can use the allowed building blocks. This need not mean allowing arbitrary code. The missing decision is which safe capabilities a custom class may reference.

**Missing deliverable.** Execution fixtures using the intended rules runner, with event replay and resource assertions, before phase 4. Identify any capability available only to trusted packs and test the promised custom-class path. Keep phase 1b explicitly test-only if it is not intended to satisfy the browser gate.

### G04. Capped, fully bound offers can make valid actions inaccessible

**Cost if late: redesign of the central UI, DM schema, and action-selection contract. Omission.**

P:63-65 caps the engine's fully bound offer list. P:87-90 makes typed offers a subset of the action-bar list. T002 requires at least one offer per group, not every valid weapon, spell, slot, target combination, or item.

There is no task for selecting an action group and then its parameters, browsing omitted offers, or otherwise exposing legal choices outside the cap. One cast offer does not let a wizard choose a different prepared spell or target. A relevance rank can preserve a category while removing the exact action the player requested. This becomes expensive in phase 4, when FR-007, FR-008, and FR-019 require those options.

The phase 1 probe does not cover that risk. T001 uses `tools\replay-probe\real-session.json`. That fixture's ten entries accept broad operations such as `talk` or `engage`; they do not encode the correct fully bound spell, item, slot, and target. T011 does not add dense spellcasting or inventory fixtures.

**Missing deliverable.** A way to reach every supported legal choice while keeping the model's enum small, plus exact-action and crowded-catalog tests. The offer cap gate must test more than acceptable operation categories.

### G05. Licensing is reduced to a notice, with no model-output exclusion boundary

**Cost if late: release blockage and re-authoring of content already embedded in packs and saves. Omission and assertion.**

T050 says "ship the attribution notice." It does not assign the obligations R:46-75 and R:435-446 spell out for the selected source. Those include the SRD 5.2 and 5.2.1 notices, source and license links, a modification statement, and the full upstream MIT permission notice. There is no check that distributed game data and forge exports retain the applicable notices. R:64-66's attribution wording and branding constraints are also unassigned. This is an audit against the research, not a new legal opinion.

The more consequential omission is R:641 and R:651-653's deny-list for model output. Engine-owned catalogs stop illegal mechanical IDs, but narration can still introduce non-SRD names. T004's narration-only schema does not constrain that text. No task assigns filtering to the live DM, aside answers, or forge filler, or tests PHB-only names and the Artificer-related names in R:523-525.

P's original-content pack and open naming question do not replace R:522-527's original-expression provenance record and per-entity source check. A pack-level `provenance` field describes the pack, not the origin of every entity inside it.

The timing also matters. T034 ships a real Fighter class and T030 ships stat blocks in phase 2, but the only attribution task is in phase 4.

**Missing deliverable.** Notices and source checks when the first SRD-derived material ships, an original-class provenance record, and tested non-SRD-name filtering on every model-authored output path. Foundry asset stripping is conditional on using Foundry material; the plan does not select that importer, so its absence is not a separate finding.

### G06. Character creation omits the 2024 origin mechanics

**Cost if late: invalid initial characters, revised content schemas, and save migrations. Omission.**

US1 requires species, background, starting equipment, skills, and caster spells. P:138 names species and background as stored choices. T031 assigns ability methods and skills, while T034 assigns a Fighter creation UI. T051 does not assign the missing origin behavior.

R:460-463 requires background-specific ability increases, Origin feats and prerequisites from level 1, the Human's additional Origin feat, independent language choices, and species options for lineages or ancestries. A raw score cap of 20 does not implement the background increase restrictions. No task assigns species traits, the choice-dependent grants, or their selection screens. R:472's Heroic Inspiration is also absent, even though Human Resourceful needs it from the first long rest.

**Missing deliverable.** Origin definitions and creation choices that feed `sheetOf` and effects, with the background cap checked after increases. Include starting equipment and spell choices, not just ability assignment.

### G07. Rest is named without game time or interruption semantics

**Cost if late: rework of resource recovery, clocks, death recovery, and campaign transitions. Assertion.**

T051's "short and long rests" has no supporting rest design. R:474-475 explicitly calls for interruption events and a rest state machine with timestamps. R:248-254 requires durations, a minimum starting HP, hit-die recovery rules, the 16-hour long-rest interval, partial short-rest benefits, resumable long rests, and exhaustion reduction.

P:160-163 says a rest triggers pressure, but neither P nor T defines how elapsed hours relate to clock progress or when a clock payoff interrupts a rest. No task assigns hostile-present refusal, choosing how many hit dice to spend, per-die healing with a minimum of 1, or class-specific recharge.

There is a phase-order dependency. Rests land in phase 4, but general clock triggers and mechanical payoffs land in phase 5. Phase 4 cannot demonstrate US6's interrupted rest or a rest that creates hostiles unless a minimal payoff is pulled forward.

**Missing deliverable.** Persisted game time and rest transitions, exact recovery and refusal checks, and a phase-4 fixture where pressure interrupts a rest. Apply the same rules to the between-module long rest.

### G08. Forge and game acceptance are not actually the same predicate

**Cost if late: contract redesign and re-authoring bundled campaigns. Omission.**

US11 says both programs accept and refuse the same content. P:205 makes forge `lint` equal `parsePack` plus quality rules. The game's described entry point is `parsePack`. No task says game admission also runs those quality rules.

A structurally valid one-clue conclusion is the concrete counterexample. T080 requires the forge to reject it with G1, but neither T040 nor T041 requires game admission to reject it. Sharing a parser and checking a digest cannot establish this behavioral equality.

The plan also leaves many quality checks without their input fields. A:192-310 requires, among other things, locks and keys for G8, dramatic questions for S1, success and failure effects for C2, wants and autonomous plans for C6, campaign revelations and arc beats for A1/A4, and recap and act-out metadata for P2. T060 names nodes, cast pools, clues, goals, and clocks. T070 names ordered modules and an epilogue. T080 then says "graded rules" without assigning those missing fields or deciding which research rules are excluded.

**Missing deliverable.** A declared admission predicate shared by both programs, positive and negative parity fixtures, and an explicit adopted quality-rule list with contract fields and severities. P1's sidekick requirement must be excluded or adapted because S's assumptions exclude companions. Research warnings must not silently become errors.

### G09. Pinning content omits scoped reference resolution and content completeness checks

**Cost if late: pack-contract changes and unplayable imported saves. Omission and assertion.**

The third edge case is a class referencing an absent spell. P:132-134 promises that reachable class effects map to vocabulary or scripts, but does not define dependency lookup, ID scoping, missing-reference errors, or the closure of pinned dependencies. T040's parser and T090's scoped content do not assign those rules.

Scope is also late. Campaign packs load in phase 3 and the forge exports them in phase 7. Campaign- and module-scoped catalogs and the explicit script provenance task arrive in phase 8. There is no earlier task to exclude another campaign's class during creation, reject unsupported imports, or prevent a module's content from becoming globally available.

T050's count check is weaker than the research's proposed data gate. R:428-431 requires name-family comparison, Invocation and Metamagic additions, and checks of the actual monsters spawned against authoritative values. R:388 explicitly warns that schema tests do not validate monster statistics. Equal counts can still include the wrong entity or wrong attack. The class-only capability closure also leaves encountered monsters and independently looted items outside its stated scope.

**Missing deliverable.** Scoped dependency resolution and pinning at first import, absent-reference fixtures, an admission policy for all encounter and loot effects, and the named-content and monster-value checks from the selected-data recommendation.

### G10. The existing title screen is not assigned a campaign migration

**Cost if late: blocked entry and recovery paths after the save model changes. Preservation.**

FR-020 and US12 have no task. This is not a request to build the current screen again. `U:508-568` already lists, resumes, and deletes saves. `APP\store.ts:64-73` orders them by last play, and `APP\app.ts:144-155` exposes the list.

The migration is missing. The screen's Continue chooses only `outcome === 'playing'` at U:521. It distinguishes only playing, won, and lost at U:535-545. P introduces creation, level-up, fate selection, and between-module states without defining which are resumable or how Continue selects them. A module won inside an unfinished campaign cannot simply remain today's read-only won session.

The new saves/events/turns schema also needs the existing list, delete, last-play ordering, stale-ID recovery, and cache eviction to continue working. T041 mentions read-only prototype transcripts, but does not assign their loader or list integration. Today's list rebuilds every saved world from the current scenario before projecting its outcome, so retaining old transcripts is not accomplished merely by hiding their Act button.

**Missing deliverable.** A migration of the existing title and save API in phases 2, 3, and 6, including campaign selection, pending-state Continue, deletion of receipts and events without deleting shared packs, and readable legacy transcripts.

### G11. The mandatory settlement funnel does not preserve the aside exception

**Cost if late: subtle regressions across every new time, combat, and progress rule. Preservation.**

T004 assigns a narration-only schema for an aside. P:110-112 says every resolution path uses `settle`. Those are not enough to preserve the current behavior.

`APP\rules.ts:308-321` deliberately returns before `finish` for an out-of-character message, even when a director ignores the schema. It prevents clock ticks, discoveries, and enemy attacks. The corresponding mutants are in M:597-617. P does not say that an aside consumes no action, movement, time, death save, concentration check, rest interval, or stall-trigger count.

The new turns-without-discovery trigger makes this omission especially concrete. Asking `// what happened?` must not count as a world turn that brings in a proactive clue or fills a danger clock. T010 ports deterministic directors but does not assign an engine-level aside regression test.

F `take-a-turn.md` also still describes the older schema-only guarantee and says the scripted director can act during an aside. The current engine guard is stronger. Carrying that recipe forward would verify the wrong contract.

**Missing deliverable.** An explicit no-world-change aside route or settlement mode, with deterministic engine, browser, and database checks. Preserve the existing detected meta phrases as well as the `//` prefix.

### G12. Settlement collisions and stable-at-zero recovery remain unspecified

**Cost if late: softlocks and incompatible ending events. Assertion and omission.**

The fourth edge case requires a clock filling during rest, combat, or the goal-winning turn. P:110-112 promises a fixed order but does not specify its terminal semantics. If a payoff spawns an enemy or kills the hero on the same decision that satisfies the goal, the plan does not say whether victory, continued combat, or fate selection wins. T060 contains no collision cases.

The death design similarly names `stable` and references stabilization, but P:170-174 describes only dying and three failures. It does not state the three-success transition or how a solo stable hero returns to play. R:246 specifies recovery to 1 HP after 1d4 hours, critical damage while down counting twice, and massive-damage death. Knockout at 1 HP starts a short rest. T033's "death saves" does not assign those distinctions.

**Missing deliverable.** Terminal precedence and once-only payoff cases, plus a complete stable/recovery path tied to game time. The same-decision clock/goal/death case needs its own expected event sequence.

### G13. The all-classes task does not assign spell and resource behavior

**Cost if late: widespread corrections across class data, offers, and rests. Assertion.**

T051 is the sole production task for thirteen classes, spells, inventory, and rests. Its capability closure is not a behavioral test. FR-007's cantrip scaling is not assigned anywhere. Prepared spells are stored in P:139, but their per-class limits and swap cadence from R:478 are not implemented by storing the list.

Other unassigned checks include Paladin and Ranger slots at level 1, per-class spell lists, Pact Magic recharge, ritual eligibility including Wizard spellbook rituals, concentration saves on damage and termination when incapacitated, and each class resource's recharge. US4's independent test explicitly requires spending every resource at every supported level, not one difficult example per class.

US4.1 also expects an exhausted cast to be refused with a visible reason. An offer list that simply removes the spell does not specify that response to typed text or a stale tapped action.

**Missing deliverable.** A class/level/resource matrix backed by execution fixtures and real player choices, including rejected actions and recovery. Name cantrip scaling and spell preparation changes explicitly.

### G14. Inventory has no assigned operations, loot lifecycle, or visible roll breakdown

**Cost if late: incomplete player loop and revisions to effects and projections. Assertion.**

FR-008 enumerates carrying, equipping, using, dropping, looting, and gold. T051 says only "items ... inventory." P mentions a `loot` effect, inventory on the hero, and old gear left after death. There is no assignment for defeated-foe loot entering the room, player drop operations, gold changes, or inventory/equipment screens.

US5.1 requires a potion's rolled healing to be capped and the potion removed. US5.2 requires loot in the room when a foe falls. R:497 requires potion use to consume a bonus action. Neither the effect vocabulary nor naming "inventory" fixes the timing and atomic consumption rules.

US2.2 separately requires the attack roll, total, AC, and damage dice to be shown. P:93 promises engine-authored result lines, but no task assigns the new result projection or client rendering for modifiers and multi-die damage. Today's F `take-a-turn.md` checks a single d20 against DC and a fixed four-point hit.

**Missing deliverable.** The specified inventory commands and panels, room-loot transitions, potion consumption, and a deterministic browser check of the complete combat breakdown.

### G15. Model failure has no defined behavior after tapped actions start resolving first

**Cost if late: lost or repeated actions and inconsistent receipts. Preservation and omission.**

The fifth edge case is a model unreachable for an entire session. C II requires a recorded breach and a diegetic stall, without asking the model to retry. Today's `APP\engine.ts:263-284` requests the model before adjudication and records the failure without the proposed action.

T007 reverses that order for taps. T008 assigns atomic receipts, but no task specifies what happens when the action resolves and narration then fails, when the response is lost, or when the page reloads while a receipt is pending. A browser-minted ID alone does not say how that ID survives the reload or which result is shown after reconnecting.

There is no model-offline scenario for typed actions, taps, asides, creation, or succession. The plan need not invent an offline DM. It does need to state whether a resolved tapped action commits with a stall and prove it happens once.

**Missing deliverable.** A failure matrix with durable result and receipt checks, no second roll, no raw transport error in the player projection, and a recoverable pending request.

### G16. The mutation and real-app gates have no migration plan after phase 1

**Cost if late: the project can no longer run the checks that define completion. Preservation and assertion.**

T012 updates recipes and requires a green mutation harness in phase 1. P:262-263 promises named tests, mutants, a browser run, and a database check for every phase, but later tasks do not assign the required harness changes.

M uses `packages\app` as its fixed root and runs `test/**/*.test.ts` there. Every built-in mutation path is relative to that root. Phase 3 moves rules into `packages\rules` and creates `packages\contract`; phase 7 creates forge tests. No task assigns package-aware mutation/test selection. M:906-915 explicitly fails stale anchors, so the phase 1 deletion of proposal fields also needs deliberate replacement or retirement of mutants, not only a request to make the harness green.

The typed API client still exposes only `turn(id, utterance)` at `APP\client.ts:123-124`. `tools\api-cli\run.mjs` uses it. T008/T009 require IDs and tapped offers, but neither caller is assigned a migration. The playtest runner reads current `view.you`, vows, and current app imports. Moving files and replacing vows invalidates its measurements unless it is migrated.

F's index has no creation, sheet, inventory, spell preparation, rest, level-up, campaign transition, successor, or class-builder recipe. Updating only the old recipes in T012 cannot cover entry points that arrive later.

**Missing deliverable.** Per-phase feature-map entries, deterministic drivers, package-aware named mutants, API CLI/client migrations, and re-found win/loss seeds. The phase audit below names the checks currently missing.

### G17. The success criteria lack their actual measurements

**Cost if late: release gates reveal usability, reliability, or pacing failures after content is complete. Omission and assertion.**

T001/T011's replay accuracy gate is useful but is not SC-005. Repeating ten fixed prompts three times does not measure at least 95% usable answers during one stateful 30-turn session. For that session length, the threshold requires at least 29 usable turns. No task defines usable versus stall, runs that session, or fails below the threshold.

SC-001 has no timed under-three-minute first-player creation check. SC-007 appears in P:36 as a goal but has no timed 30-to-60-minute module play or calibration task. A:309 and A:381 describe a time estimate that needs calibration; P's simulation does not include one.

SC-002 is partially addressed by winning-route reachability in `sim`, but T012 measures only 200 seeds per scenario. T080 never assigns 1,000 runs of each bundled module or requires both wins and losses. No task distinguishes a harmless bounded-run timeout from an alive state with no winning continuation.

SC-003 has an event-folding design, but no check comparing every displayed mechanical value with a cold replay. That matters when new sheet values and choice screens are derived rather than stored. SC-006 has a bundled acceptance gate, but needs the parity correction in G08.

**Missing deliverable.** Executable pass/fail checks for the exact thresholds and output comparisons in SC-001 through SC-007, attached to the first phase that can measure each one.

### G18. Replacing numeric DC proposals leaves an acceptance scenario without a path

**Cost if late: spec/test disagreement and silent invalid-input behavior. Omission.**

US3.2 explicitly tests an out-of-band difficulty being clamped with an explanation in the fiction. T004 deletes numeric difficulty and P:76/84-85 uses a closed band enum mapped to five DCs. That can improve the design, but it does not say what replaces the required behavior for a director that ignores the schema or for an invalid supplied band.

T005 resolves an improvised check at the band's DC but does not assign an invalid-band ruling. C I requires every rewrite or drop to produce a player-visible `ruled` event. The existing difficulty mutant at M:22-27 will become obsolete without a specified successor test.

**Missing deliverable.** Either preserve a defined, visible adjudication path for invalid difficulty proposals, or explicitly revise this acceptance scenario to the new undecodability contract and its boundary-error behavior.

## Functional-requirement audit

Every FR was walked. "Assigned" means the plan contains a concrete mechanism and task for that requirement; it does not certify implementation. Partial rows identify the uncovered portion rather than treating the entire requirement as absent.

| Requirement | Plan/task coverage | Omitted or asserted portion |
| --- | --- | --- |
| FR-001 | Offers, engine resolution, T004-T008, `settle` | Aside, failure, reaction, and simultaneous terminal semantics are not assigned. G02, G11, G12, G15. |
| FR-002 | P:151-152; T031 | Methods and seed recording are assigned. Post-background cap and interrupted creation are not. G01, G06. |
| FR-003 | Original pack; T050 | Notice details, entity provenance, and model-output exclusion are missing. G05. |
| FR-004 | T034, T051, T100 | All-class playability is asserted through closure, without per-class execution and resource checks. G02, G03, G06, G13. |
| FR-005 | P's turn schedule; T032-T033 | Complete conditions, damage semantics, reactions, and stabilization are not assigned. G02, G12. |
| FR-006 | `sheetOf`, T005, T031 | Skill/expertise is assigned. Invalid difficulty handling no longer matches US3.2. G18. |
| FR-007 | T051; hero prepared-spell state | Cantrip scaling, preparation rules, concentration behavior, and ritual/class distinctions are asserted or omitted. G13. |
| FR-008 | T051's inventory; `loot` effect | Drop, gold, room loot, equip/use behavior, and UI are unassigned. G14. |
| FR-009 | T051; rest trigger in P:160 | Hostile refusal, exact recovery, time, and interruption rules are unassigned. G07. |
| FR-010 | T060, T100; `sheetOf` | Threshold and subclass work is named. Every granted choice, its UI, and interrupted level-up are not assigned. G01, G06, G13. |
| FR-011 | Goal predicates, `outcomeOf`, T060 | Goal mechanism is assigned. Same-turn terminal precedence and the existing post-ending refusal migration are not. G01, G10, G12. |
| FR-012 | T070; ordered modules and epilogue | Carryover is designed. Safe transition commits and pending-state Continue lack assigned behavior. G01, G07, G10. |
| FR-013 | P:168-177; T070 | Same level, XP, safe placement, and saved progress are assigned. Successor creation persistence and duplicate transitions are not. G01. |
| FR-014 | Effect payoffs; T060 | Mechanical payoff is assigned. Rest/combat/goal collision behavior is only asserted by `settle`. G07, G12. |
| FR-015 | T090 | Builder and scoping are named. Scoped reference admission and safe reuse of standard capabilities are unresolved. G03, G09. |
| FR-016 | Shared parser/digest, T040 | Version mismatch checking is assigned. Acceptance parity is not established by it. G08. |
| FR-017 | `lint`; T080 | G1 failure/location is explicit. Most adopted rule fields and per-rule verdict fixtures are not assigned. G08. |
| FR-018 | P:179-194; T008, T041 | Pinning and atomic events are concrete. Draft workflow persistence and transitive content references are not. G01, G09, G15. |
| FR-019 | T004, T007, T009 | Typed/tapped distinction is concrete. Complete option access and later structured commands are not. G04, G13, G14. |
| FR-020 | Existing title/list/delete code | No task migrates it to campaigns and new save phases. G10. |

## Success-criterion audit

| Criterion | Coverage and concrete gap |
| --- | --- |
| SC-001 | No task measures first-player creation below three minutes at 390x844. G17. |
| SC-002 | P's `sim` checks winning-route reachability, but no task mandates 1,000 runs per bundled module and both win and loss outcomes. G17. |
| SC-003 | Recorded-outcome replay is designed. A cold-replay comparison of all new player-visible mechanical values is not assigned. G14, G17. |
| SC-004 | Partial workflow states are not designed, and no phase enumerates all four restart points. G01, G16. |
| SC-005 | The repeated ten-prompt accuracy probe is not a stateful 30-turn usability measurement with at least 29 usable turns. G17. |
| SC-006 | T080 assigns bundled campaigns passing. Shared acceptance needs negative as well as positive parity checks. G08. |
| SC-007 | P:36 names 30 to 60 minutes, but no task measures or calibrates module duration. G17. |

## Acceptance-scenario audit

All 25 numbered scenarios were walked. The final column names only the remaining omission or assertion.

| Scenario | Closest assignment | Gap |
| --- | --- | --- |
| US1.1, New campaign to correct sheet | T031, T034 | Campaign entry migration and full origin/equipment/spell choices are absent. G06, G10. |
| US1.2, goal ends module and refuses turns | T060 | No assignment migrates the existing refusal to distinguish module completion from campaign continuation. G01, G10, G12. |
| US1.3, death screen offers End and Continue | T033, T070 | Continue is explicitly deferred to phase 6, not silently omitted. Pending fate UI and persistence still need assignment. G01. |
| US1.4, reload/restart anywhere | T008, T041 | Incomplete workflows are not represented. G01. |
| US2.1, both hostiles act in initiative order | T032 and P:102-104 | Mechanism assigned. No separate omission beyond the per-phase proof gap in G16. |
| US2.2, show roll, total, AC, and damage dice | T032; P:93 | Result rendering and complete deterministic display assertion are absent. G14. |
| US2.3, three successes stabilize or three failures kill | T033; P:170-174 | Stabilization is referenced but its transition and recovery are not specified. G12. |
| US2.4, flee succeeds or fight continues | T032 | Flee is named without resolution, failure cost, or zone/opportunity-attack ordering. G02. |
| US3.1, expertise doubles proficiency | T031 | Relevant arithmetic is assigned through `sheetOf` and expertise. Named real-app proof still needs G16. |
| US3.2, clamp out-of-band difficulty visibly | T004-T005 | New enum removes the described input without replacing the scenario or ruling. G18. |
| US4.1, second exhausted cast refused with reason | T051 | No rejection path or reason is assigned when the offer disappears. G13. |
| US4.2, damage triggers concentration Constitution save | T051 | "Concentration" is the only assignment; the trigger and event result are not specified. G13. |
| US5.1, rolled capped healing and potion removed | T051 | Atomic consumption, cap, die roll, and action cost are not assigned. G14. |
| US5.2, defeated foe drops room loot | T051 | No death-to-room-loot task. G14. |
| US6.1, hostiles prevent rest | T051 | No refusal rule or check. G07. |
| US6.2, spend two hit dice with Constitution | T051 | No hit-die choice or per-die recovery task. G07. |
| US7.1, subclass choice at level 3 applies | T060 | Unlock is explicit; persisted selection and execution of the chosen features are not. G01, G13. |
| US8.1, continue into next module with same hero | T070 | Carryover is explicit; legal once-only transition is asserted, not implemented by event counting. G01. |
| US8.2, title Continue includes between modules | None for title; T070 for transition | Existing playing-only Continue has no migration. G10. |
| US9.1, dead level-4 hero replaced at level 4 with threshold XP | P:172; T070, T100 | Level/XP policy is explicit. This exact scenario waits for phase 9; there is no phase-6 lower-band equivalent plus deferred level-4 check. G16. |
| US9.2, discoveries and completed goals persist | P:176-177; T070 | Save-owned progress is an explicit mechanism. Its successor/browser/restart fixture is unassigned. G16. |
| US10.1, campaign class appears only there | T090 | Scope resolution and two-campaign creation fixture are absent and scheduled after pack import. G09. |
| US11.1, one-clue conclusion rejected by name | T080 | Explicitly assigned, including G1 and location. |
| US11.2, obsolete forge contract fails checks | T040 | Version/digest mechanism is explicit. Actual second-consumer verification is not available until the forge lands. G16. |
| US12.1, Continue selects most recent of two saves | Existing store ordering and title code | No campaign-state preservation task or two-save browser regression. G10. |

The stories' independent tests add obligations beyond their numbered scenarios. US1 needs every ability method plus victory and death; US2 needs many-seed combat and replay; US3 needs every skill; US4 needs every resource at every supported class/level; US7 needs every supported threshold. T012's current-world 200-seed run does not assign those matrices. US5/US6 need inventory and rest scripts. US8 needs a two-module fixture with an exact long-rest-adjusted hero comparison. US9/US10 need successor and custom-class playthroughs, and US12 needs starting, resuming, and deleting two campaigns through the existing screen. These are the concrete missing per-phase recipes in G16, not a request for an unrelated general test expansion.

## Edge-case audit

| Spec edge case | Coverage and gap |
| --- | --- |
| Replacement while hostiles remain | P:173-174 explicitly supplies a safe anchor and validated entrance fallback. The migration needs a hostile-room fixture and restartable successor creation. G01, G16. |
| Close mid-level-up, mid-creation, or between modules | No persisted partial-choice workflow. G01. |
| Class refers to an absent spell | Capability closure is named, but scoped reference/dependency validation and a missing-spell fixture are not. G09. |
| Clock fills during rest, combat, or goal completion | `settle` promises order without the required collision outcomes. G07, G12. |
| Model unreachable for the entire session | No failure scenario for the new resolve-before-narrate tap flow. G15. |
| Saved content changes afterward | Stored content digests/body address direct edits. The unresolved part is pinning and resolving referenced content across packs. G09. |
| Absurdly strong custom class is allowed | No explicit builder/admission check distinguishes structurally valid strength from invalid effects. The generic quality/capability gates need an acceptance fixture for this case. G03, G08, G09. |

## Every section 3 engine row

This table covers all 28 rows of R:460-487. "No change" in the research means no difference from 2014, not that Portale's prototype already implements the rule.

| Research row | Closest assignment | Uncovered behavior |
| --- | --- | --- |
| Ability score increases, R:460 | T031; species/background fields | Background's three abilities, +2/+1 or +1/+1/+1 choice, no species increases, and post-increase cap. G06. |
| Level 1 feat, R:461 | T051's classes | Origin feat grant, Human additional feat, prerequisites, and selection from level 1. G06. |
| Languages, R:462 | None | Common plus two independent choices and a creation step. G06. |
| Species, R:463 | P:138; T030 | Lineage/ancestry choices and type, size, Speed, and traits are not assigned. G06. |
| Standard array, R:464 | P:151-152; T031 | Method assigned. No separate omission. |
| Point buy, R:465 | P:151-152; T031 | Budget/range assigned. Exact cost-table validation is only implicit in "point buy" and needs a named boundary fixture. G06, G16. |
| Random scores, R:466 | P:151-152; T031 | 4d6/drop-lowest and recording assigned. Persistence of the unfinished assignment is missing. G01. |
| Maximum at level 1, R:467 | P:152 | Raw free-assignment cap assigned; background-increase cap is not. Later Epic Boon cap behavior is only within T100's blanket band extension. G06. |
| Weapon mastery, R:468 | T051 | Mastery selection counts and class-specific long-rest swaps are not assigned. G02, G07. |
| Two-weapon fighting, R:469 | P:103-105; T032 | Light extra attack is mentioned. Different-weapon and once-per-turn Nick state is not specified by the generic action budget. G02. |
| Heavy property, R:470 | T051's items | Strength/Dexterity 13 tests rather than size. G02. |
| Exhaustion, R:471 | T032's first conditions | Stacking integer, -2 per D20 test, Speed penalty, death at 6, rest recovery. G02, G07. |
| Inspiration, R:472 | None | Reroll hook on every die, one held use, mandatory replacement roll, solo overflow loss. G06. |
| Death saves, R:473 | T033; P:170 | Basic rolls assigned. Knockout rule is absent; stable recovery and damage-at-zero variants also need R:246's rules. G12. |
| Short Rest, R:474 | T051 | Interruption events and no benefit on interruption. G07. |
| Long Rest, R:475 | T051; T070 | Timestamped/resumable rest, waiting interval, partial benefits, full hit-die recovery, restoration, exhaustion. G07. |
| Subclass level, R:476 | T051; T060 | Level 3 is explicit. Pending selection and application proof are missing. G01, G13. |
| Paladin/Ranger casting, R:477 | T051 | Level-1 slots are not explicitly assigned or checked. G13. |
| Prepared spells, R:478 | P:139; T051 | Per-level counts and per-class swap cadence. G13. |
| Bonus Action spells, R:479 | Generic turn budget | One expended slot per turn needs separate state; an action plus bonus-action budget does not enforce it. G02. |
| Rituals, R:480 | T051 | Any caster with a prepared ritual, plus Wizard's spellbook exception, is only asserted by "rituals." G13. |
| Casting action, R:481 | Offers and effects | Shared Magic-action accounting across spells, magical features, and magic items. G02, G14. |
| Surprise, R:482 | T032's initiative | Disadvantage on initiative, not losing the first turn. G02. |
| Grapple/shove, R:483 | None | Target's Strength/Dexterity save against the specified DC, not a contested skill check. G02. |
| Hiding, R:484 | T031's skills | DC 15, Invisible, and saved rolled discovery DC. G02. |
| Encounter math, R:485 | P:202-203; T060, T080 | SRD per-character budget is explicitly chosen. No separate omission in the table rule; data checks remain G09. |
| Critical hits, R:486 | T032's damage dice | Double rolled attack dice, not the current doubled reprisal amount. G02. |
| Advancement, R:487 | T060; `sheetOf` | XP/level work assigned. Threshold and proficiency table fixtures and every granted choice are still assertions. G01, G13, G16. |

R's following notes also expose low-level requirements not captured by the row headings. Examples are choosing to fail a save, combined tool/skill proficiency advantage, equipping or unequipping per attack, concentration DC capped at 30, revised condition effects, and bonus-action potion use. T032/T051 do not assign those behaviors. This report does not treat multiclassing, companions, or every optional high-level subsystem in the research as an unstated first-release requirement.

## Phase order and verification omissions

C V-VI and Development Workflow require named mutation-proven rules, browser proof for player behavior, API proof for server behavior, database side effects, real reload/restart, and a feature map covering every entry point. P:262-263 promises these per phase. The tasks below do not yet make that promise executable.

| Phase | Missing prerequisite or assigned proof |
| --- | --- |
| 1 | T010/T012 do assign director and recipe updates. They do not assign typed API-client/API CLI migration, engine-level aside preservation, new receipt fault cases, or replacement mappings for deleted proposal-field mutants. A broad operation fixture cannot prove bound-offer correctness. |
| 1b | T020 is explicitly not imported by the game, so this phase cannot satisfy the literal every-phase real-browser gate. Either make it a declared nonshipping proof gate with an executor, or integrate the smallest executable slice. Writing data and script names is not execution proof. |
| 2 | T034 supplies creation, but there is no full origin flow or saved draft. Fighter 1-to-3 can be sampled only if starting-level selection or fixtures exist; earned level-up is phase 5. Opportunity attacks need a defined reaction policy now. The SRD notice cannot wait until phase 4. |
| 3 | `parsePack` is claimed to have a second consumer, yet forge implementation waits until phase 7. A minimal forge contract consumer and import path are needed for the two-program conformance gate now. The rules split also breaks app-root-only mutation/test selection unless migrated. Legacy transcript loading and save-list migration are unassigned. |
| 4 | All-class/rest proof depends on reactions, origin choices, class-level fixtures, and timed rests. General pressure payoffs and earned level-up arrive in phase 5. Pull forward minimal executable examples or narrow this phase's claims; do not call the full US4/US6 tests complete. |
| 5 | Goal/payoff/XP work needs named same-turn collision cases, a persisted level-up screen, and an expanded playtest driver. No 1,000-run bundled-module gate is assigned. |
| 6 | The campaign UI needs resumable between-module and fate states on the existing title screen. A two-module campaign and death-to-successor fixture are not assigned. US9.1's exact level-4 example cannot run before phase 9; use a supported-level equivalent now and explicitly retain the later check. |
| 7 | Forge output needs an actual game import command or endpoint and the same acceptance predicate. None is assigned. `pack` producing a file and `parsePack` accepting it in a unit test do not demonstrate generated content entering a playable save. Add generated-content acceptance, rejection/location, and game-loading checks. |
| 8 | New builder recipes need create, invalid-reference refusal, deliberately overpowered acceptance, campaign isolation, play, level-up, and restart. Data/script restrictions must have been reconciled with the standard building blocks before this phase. |
| 9 | T100 has no band-by-band expansion of the class/resource matrix, feat and cap rules, sample characters, feature map, or mutants. Higher-level coverage cannot inherit a level-1-to-3 green result. |

The map needs explicit ownership per phase. Phase 1 changes `take-a-turn`, `engine-authority`, `places-and-map`, `clues`, `vows-and-clocks`, and API recipes. Phase 2 adds creation, sheet, combat, fleeing, and death-save recipes. Phase 3 changes startup, save APIs, legacy read paths, and cold reconstruction. Phase 4 adds spells, equipment, inventory, and rests. Phase 5 adds goals, clock payoffs, XP, and level-up. Phase 6 adds campaign continuation and succession. Phase 7 adds forge export/import. Phase 8 adds the builder and scoped content. Phase 9 extends each affected recipe to the new band. T012 only owns the first wave.

The mutation harness needs the same sequence. Phase 1 must replace retired adjudication mutants with offer/receipt/aside rules without dropping surviving invariants. Phase 2 needs scheduler and sheet mutants. Phase 3 must support the new package locations and conformance checks. Later phases need effect, rest, goal, transition, quality-rule, and builder mutants tied to their exact named tests. "Mutation harness green" alone does not identify any of that work.

## Review method

Sequence Work into Verifiable Units changed the phase-order judgment. A phase was not credited with a real-app proof when its needed player action, fixture, or second program appears only in a later phase. Throughput checkpoint was not applicable because this was a read-only investigation. Comment cleanup, code changes, and runtime mutation runs were excluded by the brief.
