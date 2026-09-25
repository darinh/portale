# Tasks: A D&D campaign game

**Input**: `spec.md`, `plan.md`, `design-candidates/`, `docs/research/`.

**Tests**: mandatory (constitution V). Every rule gets a test named for it, seen failing on the unfixed
source, and a mutant in `tools/mutate/run.mjs` that its named test kills. A phase that retires a rule
retires its mutant in the same commit.

**Every phase also**: updates the verify-portale feature map with a recipe for each new entry point and
reruns the recipes it touches; keeps `tools/mutate`, `tools/playtest`, `tools/api-cli` and
`packages/app/src/client.ts` working against the new shapes; records its decisions in `decisions.tsv`;
and updates the module map and README.

**Format**: `[ID] [P?] [Story] Description`. `[P]` means it can run in parallel with other `[P]` tasks in
the same phase because it touches different files. Phases 1a to 1c are detailed; later phases are
expanded into this shape when they start, from the plan and from what earlier phases learned.

## Phase 1a: The offer probe (riskiest, runs before the game changes; FR-019)

**Goal**: measure whether `qwen2.5:3b-instruct` picks the right fully bound offer, against today's system
on the same inputs, before any live code changes.

**Kill criterion**: on the exact-action fixture, the offer schema's accuracy at the chosen
`MAX_TYPED_OFFERS` must be at least that of today's eleven-field proposal resolved through today's
`adjudicate`, at `--repeat 3`, with no increase in violence dropped or fights started over an aside. If
it is lower, stop and redesign before phase 1c.

- [ ] T001 Name the data shape in `packages/app/src/offers.ts`: `Offer { id, label, group, needsBand, payload }` with content-shaped ids, and `offers(world, utterance?)`, deterministic, ranked by the player's words then the scene's obvious action then one per group, capped for the model's enum, `pass` always last. Not wired into the game yet.
- [ ] T002 [P] Build an exact-action fixture, `tools/model-probe/offer-fixture.json`: at least 40 utterances across walking, searching a named place, talking to a named person, attacking one of two foes, an improvised check, and asides, each with its scene and the one correct resolved action. Include crowded rooms and near-miss names.
- [ ] T003 Build `tools/model-probe/probe-offers.mjs` using the production `offers()`, the offer schema and the production sampling. For each fixture row it scores (a) the offer the model picks at 6, 8 and 12 offers and (b) the action today's `ollamaDirector` and `adjudicate` resolve to. Report both, `--repeat 3`, exit 2 when not measured.
- [ ] T004 Run it, set `MAX_TYPED_OFFERS`, record the numbers in `decisions.tsv`, and apply the kill criterion.

## Phase 1b: Effect-language feasibility (parallel with 1a)

**Goal**: prove the closed effect vocabulary can express and execute the hardest level 1 to 3 features
before thirteen classes are built on it. Fixtures and a test-only runner; nothing ships.

- [ ] T010 [P] The vocabulary, `ClassDef` and a minimal test-only rules runner in `packages/app/src/content-sketch.ts` and its test, starting from `design-candidates/a/sketch/contract.ts`.
- [ ] T011 [P] Execute, with event replay and resource assertions, one feature per class chosen for difficulty: Wizard spellcasting with Shield as a reaction, Druid Wild Shape, Warlock Pact Magic, Rogue Sneak Attack and Cunning Action, Barbarian Rage, Fighter Action Surge, Paladin Lay on Hands and Divine Smite, Monk's focus features, Bard Bardic Inspiration, Cleric Channel Divinity, Ranger Hunter's Mark, Sorcerer Metamagic, and the original artificer-style class's core feature.
- [ ] T012 Build one player-style class from the building blocks a campaign or player pack may use (no scripts) and execute it through the same runner, to settle which capabilities custom content may reference.
- [ ] T013 Record the matrix in `specs/001-dnd-campaign-game/feasibility.md`: each feature, its expression, whether it needed a script, and the replay result. If scripts keep appearing for unrelated features, redesign the vocabulary before phase 4.

## Phase 1c: Offers in the game (FR-001, FR-014, FR-019)

**Goal**: the DM picks one engine-minted offer instead of filling eleven fields, on the current tavern and
delves, with engine-owned discovery and pressure, and the game stays completable.

- [ ] T020 Give clues a searchable place and a notice DC (`ClueDef.where`, `ClueDef.dc`) in the tavern and generated delves, so a search offer is labelled without revealing its clue.
- [ ] T021 Replace `buildSchema` and `Proposal` with the offer schema: typed text `{ offer, band?, narration }`, tapped `{ narration }`. Delete `tick`, `milestone`, `reveals`, `target`, `direction`, `ability`, `difficulty`, `damage`, `introduces` and the mint slots, and retire their mutants. A director that returns an offer not in the enum, or a band the obstacle does not allow, gets a visible ruling (replaces the old difficulty-clamp scenario, US3.2).
- [ ] T022 Resolve offers in `rules.ts` through one settlement funnel: walk, engage and attack at a fixed defence and fixed hero damage until phase 2, search as a check at the clue's DC, talk, improvised check at the band's DC, pass. The aside stays a separate command that never reaches settlement.
- [ ] T023 Make progress and pressure engine-owned for today's content: each discovery advances its vow, and the last clue fulfils it; each clock declares triggers (danger clocks on a failed check, a fight starting and every N turns; Marga's progress clock on a successful talk with her); a filled clock's payoff is effects, so the harbourmaster's men and the thing below actually arrive (spawn, and combat if hostile).
- [ ] T024 A tapped offer resolves before the DM narrates and commits even when the model is unreachable (engine lines plus a recorded stall). The narrator brief drops undiscovered clue text. Narration passes the non-SRD deny-list.
- [ ] T025 Turn ids: the browser mints one per decision and keeps it across a reload until answered; the store writes events, a `chose` event with the payload, and a `turns` receipt in one transaction; a repeated id takes no second turn and returns the current view.
- [ ] T026 The grouped action bar in `public/index.html`, rendered from `view.offers`, with exits folded in. Typed text keeps working. Update `client.ts` and `tools/api-cli` for turn ids and tapped offers.
- [ ] T027 [P] Port the scripted and wandering directors to offers. The wandering DM searches before it walks when a clue is here, and fights what is hostile.
- [ ] T028 [P] Port the replay probe to the offer schema and run a 30-turn live session for SC-005 (at least 29 usable turns).
- [ ] T029 Playtest before and after at 200 seeds per scenario: completions must not fall, nothing pinned, clocks fire and their payoffs act. Mutation harness green; verify-portale recipes updated and rerun; module map and README describe offers.

## Phase 2: The sheet and 2024 combat (US2, US3)

- [ ] T030 Hero choices and consumption, `sheetOf`, the `Combatant` projection, stat blocks for today's foes with tactics toward a downed hero.
- [ ] T031 Creation as a persisted phase: species with traits and lineages, a background's ability increases (checked against 20 after the increase), Origin feats and the Human's second, languages, skills, starting equipment, and the four ability methods; Heroic Inspiration.
- [ ] T032 Initiative with surprise as a modifier, the hero's turn budget, the engine's schedule, attack rolls against AC, weapon damage dice with critical dice rolled twice, advantage and disadvantage by presence, the first conditions with resistance and immunity in the damage pipeline, range bands, opportunity attacks, flee, and reaction windows as persisted taps.
- [ ] T033 Dying, death saves, stability and recovery on game time, massive damage, the fate choice (End only until phase 6).
- [ ] T034 The Fighter at levels 1 to 3 as a real `ClassDef` through the data path; the creation screens on the phone, timed for SC-001; the SRD attribution notice ships with this first SRD-derived content; every entity carries provenance.
- [ ] T035 SC-003 and SC-004 checks: every displayed value equals its cold-replay value; reload and restart at every persisted phase.

## Phase 3: Contract, packs and pinning (FR-016, FR-018, FR-020)

- [ ] T040 Split `packages/contract` with `admit`, `parsePack`, `digestOf`, `CONTRACT_VERSION`, `contractDigest` and the frozen-digest test; scoped reference resolution; conformance fixtures, positive and negative, run by both suites.
- [ ] T041 The `packs` table; saves pin digests; the tavern re-authored as module 1 of the harbour campaign; generated delves emit packs.
- [ ] T042 The title screen and save API migrated to campaigns: Continue picks the most recent save in any resumable phase; delete removes events and receipts, never shared packs; prototype sessions list as read-only transcripts.
- [ ] T043 Make the mutation harness and the test runner package-aware.

## Phase 4: Content (US4, US5, US6)

- [ ] T050 Vendor 5e-database at a pinned commit, patch it to 5.2.1, and gate it by name family against `docs/research/srd-5.2.1-data/`, with Invocations and Metamagic added and every monster a bundled module can spawn checked against the SRD values; the full notice set from the research.
- [ ] T051 All thirteen classes at levels 1 to 3 with their subclasses, as a class-by-level-by-resource matrix of execution fixtures: spell lists, slots including Paladin and Ranger at level 1, Pact Magic, cantrip scaling, prepared counts and swap cadence, rituals, concentration, the one-slot-per-turn rule, and every class resource's recharge. An exhausted cast is refused with a visible reason.
- [ ] T052 Items and inventory: carry, equip, use, drop, loot from fallen foes into the room, gold, weapon mastery, potions as a bonus action with capped healing and consumption.
- [ ] T053 Rests on game time: refusal with hostiles present, hit dice chosen and rolled with a minimum of 1, interruption semantics, the 16-hour interval, exhaustion, and a fixture where a clock interrupts a rest.

## Phase 5: Modules with teeth (US7, FR-011, FR-014)

- [ ] T060 Nodes, cast pools, clues serving revelations, goal predicates, the full clock trigger and payoff set, passive-perception discovery, encounters within the XP budget, XP, and level-up as a persisted phase with the subclass at 3.
- [ ] T061 Settlement collision fixtures: a clock filling on the goal's turn, on a rest, and in combat, each with its expected event sequence.
- [ ] T062 SC-002 at 1,000 runs per module with the reachability check; SC-007 timed on the production machine.

## Phase 6: Campaigns and succession (US8, US9)

- [ ] T070 Ordered modules with a long rest between as a persisted phase, the epilogue, End or Continue, a successor at the same level at a safe anchor, gear left as loot; repeated and obsolete-screen transition requests refused.

## Phase 7: The forge (US11)

- [ ] T080 `skeleton`, `fill` cached by seed, `lint`, `sim` with the reachability check, `pack`; the adopted quality rules listed with their contract fields and severities (companion rules excluded, as the spec has one hero); bundled campaigns pass `admit` in both programs; a one-clue conclusion fails with G1 and its location in both.

## Phase 8: Content of your own (US10)

- [ ] T090 The in-game class builder over `ClassDef`, restricted to the capabilities phase 1b settled; campaign- and module-scoped content; the provenance gate on scripts.

## Phase 9: Higher levels

- [ ] T100 Extend every class one complete level band at a time, never offering an option whose effects are unsupported.
