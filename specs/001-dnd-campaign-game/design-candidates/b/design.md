# A campaign package, a command log, and a small decision

## Usage (caller's view)

This is a proposed architecture, not a description of shipped functionality. The sketches are contracts with unimplemented bodies. The repository remains unchanged.

For the player, the game is a saved campaign with a character sheet and reliable action buttons. The narrator can be unavailable without disabling those buttons. For the next engineer, one accepted command owns its complete result, one content package owns its definitions, and one adjudicator owns mechanical decisions.

The proposed command-line quickstart is:

```powershell
node tools\forge\src\cli.ts generate --pitch "Debt beneath the harbour" --seed 42 --out data\harbour.portale.json
node tools\forge\src\cli.ts validate data\harbour.portale.json
node packages\app\src\server.ts
```

Generation produces a draft with located diagnostics. Only successful admission produces an export the game can start. The first game screen remains the title screen. New campaign opens resumable creation rather than an unfinished adventure.

### Game engine caller

The engine's public API owns admission, persistence, replay, and projection. A caller never coordinates `load`, `adjudicate`, and `append`.

```ts
import { openGame, newOperationId } from './sketch/game.ts';
import { offlineDirector } from './sketch/turn.ts';

const game = openGame({
	databasePath: 'data\\portale.db',
	director: offlineDirector(),
});
const started = await game.start({
	operation: newOperationId(),
	campaignFile: 'data\\harbour.portale.json',
	seed: 42,
});
const creating = started.view;
// The browser renders creating.screen and submits its offered creation choices.
const resumed = await game.view(creating.save);
const attack = resumed.offers.find((offer) => offer.category === 'attack');
if (attack !== undefined) {
	await game.submit(resumed.save, {
		operation: newOperationId(),
		expected: resumed.revision,
		command: { kind: 'choose', offer: attack.id, selections: [] },
	});
}
```

An offer describes its required selections. A fully bound attack needs none. A spell with target or slot choices exposes those controls explicitly. The UI filters the full menu locally. It never sends its own damage, AC, remaining slots, or derived sheet.

### HTTP caller

The transport adapter accepts the same deep game object. It alone parses request bodies, sets HTTP codes, and serializes `PlayerView`.

```ts
import { createHttpApp } from './sketch/game.ts';

const app = createHttpApp({ game, publicDirectory: 'packages\\app\\public' });
await app.listen(8787);
```

The browser submits `POST /api/saves/{id}/commands` with an operation ID, expected revision, and either an offer selection or text. The ID is minted and retained before `fetch`. An uncertain network result resends the identical request, not a new ID. A successful response contains the operation ID, terminal revision, and `PlayerView`. A revision conflict contains only the current `PlayerView` and a public reason. Unknown saves return 404. Malformed bodies return 400. Reusing an ID with different content returns 409. Internal errors never become successful views.

Other routes are `GET /api/campaigns`, `GET /api/saves`, `POST /api/saves`, `GET /api/saves/{id}`, and `DELETE /api/saves/{id}`. Campaign listings, creation options, save cards, and command responses are all variants of `PlayerView`, built by `project`. There is no content-download endpoint that leaks module secrets.

### Forge caller

```ts
import { forge } from './sketch/forge.ts';

const draft = await forge.generate({
	pitch: 'Debt beneath the harbour',
	seed: 42,
	modules: 2,
	levels: [1, 3],
	theme: 'harbour',
});
const exported = await forge.publish(draft, 'data\\harbour.portale.json');
if (exported.kind === 'rejected') {
	console.error(exported.issues);
}
```

`publish` runs the game's admission function. It does not ask callers to remember a separate lint pass. A failure names the rule, content path, referenced ID, and repair suggestion. A game import runs that same admission again. It does not trust a forge-generated certificate.

## Problem

Portale already has the right authority boundary and the wrong unit of play for a campaign. The current `Entity` conflates a hero with a simple NPC. A `Proposal` asks a small model for damage, difficulty, targets, clocks, and milestones simultaneously. Saves reconstruct mutable scenario definitions from an ID and seed. Adding classes to that shape would multiply model choices and make old campaigns change when content changes.

This design keeps the total event fold, local constrained model, plain HTML client, Node 24 execution, and no runtime dependencies. It replaces a mutable scenario session with a campaign log whose first event contains its admitted content. It replaces the model's large proposal with an engine-owned menu of complete actions.

## Shape

### Grounding and historical constraints

The source read was at `3aa54f5c9ac6c3bf7ae0c3149210b17441de0836`.

| Current path and symbol | Traced behavior | Consequence for this design |
| --- | --- | --- |
| `packages\app\src\app.ts`, turn route | Rebuilds or reads a cached session, adds an in-process guard, calls `takeTurn`, then persists | Move command atomicity into the game API so HTTP is not its owner |
| `packages\app\src\engine.ts`, `takeTurn` | Records `said` before awaiting the director, adjudicates its response, then mutates the live session | Never publish an uncommitted candidate world |
| `packages\app\src\rules.ts`, `adjudicate` and `finish` | Rolls a bare d20, clamps model damage, discovers, advances nominated vows, and picks one reprisal | Preserve one settlement path but replace single reprisal with a resumable initiative machine |
| `packages\app\src\world.ts`, `apply` and `project` | Folds events without adjudicating and exposes a filtered view | Keep both obligations. New event versions cannot call new rules during replay |
| `packages\app\src\store.ts`, `append` | Now appends a batch transactionally, but has neither durable command identity nor expected-head CAS | Add log-indexed commands and transactional compare-and-append |
| `packages\app\src\director.ts`, `briefFor` and `buildSchema` | Builds live enums, puts mechanics before narration, and exposes undiscovered clue text to the model | Keep constrained decoding, remove secret content from narrator input |
| `packages\app\src\mapgen.ts`, `generateDelve` | Builds a seeded graph, then populates foes before choosing clue rooms | Retain graph-first generation but reserve valid goals and clues before encounters |
| `packages\app\public\index.html`, `act` and `render` | Exit buttons submit prose. The client has title, save, and ending screens already | Retain these screens. Replace prose-backed buttons with projected offers |

The review reports describe an older revision. Transactional append, last-clue handling, room-scoped combat exit, OOC safety, title screens, and endings have already changed in the source read here. They are not all current bugs. Still-current structural gaps include retry identity, content pinning, model-nominated progress, and clock payoffs that are only prose. See `review-claims.md` sections 1, 2, 5, and 8, and `review-gaps.md` findings 15, 16, and 20.

`decisions.tsv` explains why the current shape exists. Mechanics-first decoding fixed a real intent failure. Deleting `introduce` removed a tempting wrong choice. The claimed enum-length effect was retracted after confounded experiments; salient distractors remained a problem. Therefore the proposed menu cap is a tunable hypothesis, not a measured threshold. This design removes irrelevant choices and binds targets to actions rather than claiming a magic enum size.

### Three load-bearing decisions

1. **The admitted campaign package is immutable input to the log.** A save pins every module, referenced definition, original class, generator result, rules revision, and support profile before play. Editing files cannot change a started campaign.
2. **The engine offers actions; the model selects at most one.** A structured command needs narration only. A free-text command can select one complete, labeled candidate whose targets and consequences are already engine-owned.
3. **An operation is a durable state machine.** Acceptance, an optional model-attempt marker, and a terminal batch are log records. Turn retry, creation, level-up, transition, and replacement all use this same protocol.

Model the Domain changed the main abstraction from mode flags and proposal fields to lifecycle states and offered commands. Boundary Discipline put package parsing, request parsing, and model decoding outside trusted adjudication. Make Operations Idempotent made operation identity durable rather than relying on an in-memory busy flag.

### Packages and the acceptance contract

| Proposed owner | Knowledge owned | Allowed dependencies |
| --- | --- | --- |
| `packages\contracts\src` | Content definitions, finite rule expressions, references, admission, quality rules, private file codec | Node built-ins only |
| `packages\rules-content` | Checked-in SRD 5.2.1 data, original content, provenance, source patches | Data only |
| `packages\game\src` | Character derivation, admissible actions, rules, campaign transitions, fold, projection, command durability | Contracts, rules content, Node built-ins |
| `packages\app` | HTTP parsing and plain HTML rendering | Game and its public view types |
| `tools\forge` | Seeded topology, local prose drafting, diagnostics, export, simulation | Contracts and the pure game rules used for simulation |

These are folders with direct `.ts` imports, not published npm dependencies. Nothing needs transpilation or generated runtime code. `sketch\contracts.ts`, `character.ts`, `turn.ts`, and `campaign.ts` show the load-bearing internal shapes. `game.ts` and `forge.ts` show the deep caller APIs.

`AdmissionContract` consists of the file-format revision, mechanics grammar revision, and quality-policy revision. A checked-in fingerprint covers their executable descriptors. Tests recompute it and fail on stale fingerprints. Game and forge import the same admission implementation and actual engine `Support` descriptor. CI has a deliberately stale forge-export fixture, plus unknown-grammar, unknown-handler, unsupported-level, dangling-reference, and quality-failure fixtures.

A format number alone is insufficient. `Support` declares executable intrinsics, the supported level band, and the required bundled classes. Admission derives each class's capability coverage by traversing every reachable feature, choice, spell, and creature definition. Custom classes use this same closure check rather than requiring registration in an engine class-name allowlist. Every path must be executable in the declared range. An unimplemented effect is an error, not a text-only feature. Portable packages claiming an older contract fail explicitly unless an explicit deterministic importer exists. Compatibility does not mean accepting whatever an older forge happened to emit.

Structural failures and quality errors are part of one acceptance verdict. Warnings never become game-only errors. `forge.validate` and game admission must agree on the same bytes and support revision. `publish` permits warnings, returns them, and rejects errors. A draft can be saved even when invalid, but is not an accepted package.

### Content that carries mechanics, not executable plugins

Definitions use namespaced, kind-specific references. Base SRD content, campaign content, module content, and the player's custom definitions enter the same admission path. References carry stable IDs within the pinned package; package digest provides the revision. There is no last-writer-wins override of an SRD ID. Duplicate IDs and cross-scope references are errors.

Campaign-scoped options appear throughout that campaign. A module option becomes selectable when that module is unlocked. Once acquired, its referenced definitions remain in that save for later modules. They never leak into another campaign's catalog. A custom class is admitted as an original overlay and recorded as an input event before the hero chooses it. Strength is not an admission criterion.

Class data defines a hit die, training, saving throw proficiencies, progression rows, subclass choices, resource capacities, recharge rules, feature grants, and casting progression. Species supply traits rather than background increases. Backgrounds supply their ability-increase choices, Origin feat, skills, and equipment. Feats use prerequisites and grants. Spells and item actions use the same action recipes. Monsters have stat blocks and tactics, not player advancement histories.

The bounded mechanics language handles resource costs, activation timing, attack and save gates, dice, damage types, healing, conditions, duration, movement, and simple numerical modifiers. Acyclic expressions can read ability modifiers, proficiency, class level, spell rank, and bounded tables. They cannot invoke arbitrary JavaScript, fetch data, loop, name a function, or recurse through arbitrary script.

Rules code owns initiative, D20 Test semantics, advantage cancellation, critical dice, action economy, resistances, concentration, rests, and death. Exceptional mechanics use a closed discriminated `Intrinsic` union, initially including transformation, delayed spell effects, and controlled summons. Its members have typed arguments and a versioned implementation registry. Adding a genuinely new mechanic requires engine code and a named test. Creating a new class out of supported mechanics does not.

This is deliberately less expressive than a general scripting engine. A new class cannot claim support by supplying prose. All twelve SRD classes and the original thirteenth class use recipes and these same intrinsics. Wild Shape cannot receive a privileged class-name branch while a custom transformation feature takes a different path.

Rules-source choices follow `research-rules.md`, sections 1, 2, and 3. Pin the reported 5e-database commit as an import source, convert it into Portale's checked-in domain data, patch the 5.2.1 gaps, and audit every shipped monster. The vendor's text descriptions are not executable mechanics. Inventory checks compare name families and known errata, not only counts. Import maintenance is a developer tool, never a startup build.

Every definition carries an SRD page and attribution reference or original-work provenance. Exports and the application's credits retain notices and modification statements. No Foundry assets, non-SRD PHB text, or copyrighted adventure prose is imported.

The thirteenth class is a clean-sheet original called the Maker in player-facing text, labeled an original artificer-style option in product documentation. This interprets the requested Artificer as a fantasy, not permission to copy the proprietary class. Its feature names and progression are original, its spells come from the SRD, and no companion PC is added. This naming choice remains a product and legal review question. See `research-rules.md`, section 4. Its legal guidance is inference, not a legal opinion.

### Character facts and derived sheets

The hero's persistent facts are choices and outcomes. Store base ability scores, their roll records, background allocation, chosen options, class identity, completed level grants, HP advancement results, XP awards, inventory ownership, resource spending, conditions, and resting history as events.

Derive current scores from those facts and admitted grants. Derive AC from equipped armor, shield, conditions, and active effects. Derive proficiency from completed advancement steps, not immediately from XP. XP opens a level-up choice; an unfinished wizard level does not grant slots early. Attack bonuses and save DCs derive from the same sheet function. Resource capacities derive from content; only spending and recovery are facts. Never persist a second `slotsRemaining` field beside slot spending.

The body stores damage taken and temporary HP rather than a second copy of maximum HP. Current HP is the projection of derived maximum and damage taken. `Life` distinguishes conscious, dying, stable, and dead. It has no independent `dead` boolean. Numerical and cross-reference constraints are checked at construction and command boundaries; a TypeScript brand alone does not prove a number is finite.

Monsters instead store a stat-block reference and mutable body facts. Shared combat queries produce a combat profile from either a hero or an NPC. NPCs do not accidentally gain hero point-buy rules or player death saves.

Creation offers 4d6-drop-lowest, 27-point buy over 8 through 15, or free assignment up to 20. Background increases cannot exceed the current cap. Free assignment can set the final scores directly up to that cap, rather than secretly creating 22s after background bonuses. Its original-rule variation is labeled. Seeded rolls and assignments are events. Reload never rerolls them. Species, background, class, subclass when applicable, training, equipment, languages, and spells have resumable choices with legal defaults.

Prepared-spell counts and replacement cadence come from each class's 2024 table. Pact Magic has a separate rest-recharging resource rather than pretending to be ordinary spell slots. Known spells derive from grants and selected options. Spellbook acquisitions and preparation selections are independent recorded choices. Ritual permissions, slot spending, and concentration have separate meanings. See `research-rules.md`, section 3.

### One player command is not one combat round

`TurnState` is exploration, combat, or resting. Combat holds initiative order, the active actor, round, action budget, and an optional pending reaction or die decision. A player command spends part of a turn. The engine continues automatic actors only until the next player decision or a terminal state.

Positions use integer five-foot cells inside the current location, with blocked cells, elevations, exits, and authored cover. This is internal rules geometry, not a requirement for a desktop battlemap. The phone projects named nearby targets and legal movement destinations. Reach, opportunity attacks, cone and line effects, pushing, and movement between attacks have actual spatial facts to use.

On first violence, initiative is rolled for all active combatants. Surprise affects initiative rather than deleting a turn. An attacking hero does not automatically act before faster enemies. Stable ID order breaks remaining initiative ties. Every living hostile gets its scheduled turn each round unless a condition, retreat, death, or encounter end prevents it. Engine tactics choose from stat-block actions and visible state. The model never schedules opponents.

Action budgets track action, bonus action, reaction, movement, remaining attacks, the Light extra attack, and whether a spell slot was spent this turn. The scheduler pauses for legal reactions and Heroic Inspiration choices with the rolled faces already persisted. A typed continuation stores the remaining effect or movement steps and prior roll IDs, rather than rerunning the original action. Declining a reaction or reroll is explicit and repeatable. No wall-clock timeout silently chooses for the player.

Attack rolls use AC. Checks and saves use their own DCs. Natural 1 and 20 are not universal check success rules, unlike the current `dice.ts`. Advantage and disadvantage cancel by presence, not by summing sources. Critical hits roll extra damage dice rather than doubling the final total. Condition rules, resistance, immunity, vulnerability, concentration checks, and weapon mastery are engine behavior with named tests.

Flee is an offered combination of movement and, when available, Disengage or Dash. It shows the consequence of crossing threatened cells. The engine resolves opportunity attacks and changes rooms only if the hero reaches an exit. There is no arbitrary universal fleeing check that replaces those rules.

Short and long rests carry elapsed game time and progress, not only a `rested` boolean. Hostiles or zero HP prevent starting. Pressure advances during elapsed time, interruptions occur before benefits, and hit dice are spent only at valid recovery points. A long rest restores all spent hit dice under 2024 rules, honors the 16-hour restart restriction, and handles interrupted-rest benefits. See `research-rules.md`, section 1, "Death saves, resting, exhaustion and Heroic Inspiration", and section 3.

### A small model decision, even with hundreds of spells

`options(world)` is the only source of legal action offers and choice controls. The projection can expose a long spell list because a person can search it. The model cannot see that entire list merely because the browser can.

For a structured action, the engine binds its offered parameters and resolves it first in a private candidate world. The model receives only the public outcome facts and narrates them. Its live schema contains `narration` alone. There is no op, target, damage, or difficulty to second-guess.

For free text, deterministic name matching, equipped actions, current interaction tags, and the player's selected focus produce a small candidate list. Each candidate already binds an action to a target and any permitted check skill and DC band. The model chooses one labeled ID and an attempt narration, in that order. Difficulty bands map to SRD values in engine code; authored obstacle constraints can narrow or rewrite the proposed band with a `ruled` event. Ordinary skill checks use all eighteen skills through this route.

The first implementation tries at most six candidates. That number is an inference to measure, not an established 3B limit. A uniquely named spell or target survives filtering. Ambiguous text produces a projected clarification choice, not a hidden arbitrary selection, another model call, or a giant enum. A missing candidate does not erase a spell from the UI. The player can always choose the structured action.

Free text uses one model call. Its narration describes an attempt, followed by engine-authored result lines. Structured input uses one outcome-narration call. No second recount call is introduced to the slow path. This accepts less fluent free-text result narration to avoid doubling local-model latency.

The current prompt receives secret clue text before discovery. The new director receives public descriptions, authorized dialogue fragments, and already disclosed facts only. Adjudication reveals a clue through an engine event and the projection renders its authored text. This prevents the engine from handing undiscovered secrets to the narrator. It cannot prove that an unrestricted language model never guesses or invents a secret. Mechanical summaries remain authoritative, and narration is untrusted text rendered with `textContent`, never HTML.

Out-of-character input has a distinct command and no time cost. All directors, including scripted and wandering ones, pass through the same response boundary. Their deterministic choice index comes from the save, not a process-global closure. Schema faults are recorded breaches, not trusted `JSON.parse(...) as Proposal` values.

An unavailable director yields one recorded breach and a diegetic stall, without retry. A structured command still resolves and receives engine result text plus the stall. Free text with no selected candidate settles without invented mechanics and offers the structured controls. This is how a whole session remains playable offline. Transport failures are measured separately from semantic model mistakes.

This choice follows `research-campaigns.md`, sections 3.1, 3.2, 3.4, and 4.2. The report's scratch-field suggestion is not adopted. Portale's constitution requires mechanics before narration and its local evidence is more relevant than experiments on larger models.

### Save authority and command recovery

The campaign's first event, `campaign-created`, contains canonical admitted content as input data, its digest, the seed, and the executable rules revision. Generated modules are materialized into this event, not regenerated on resume. The fold begins from an empty state and these events. No character sheet, world snapshot, compiled catalog, or action index is stored.

The in-memory `Catalog` builds reference maps, room and clue indexes, goal dependencies, and trigger indexes from the frozen content. These are disposable derivations. Package bytes, event payloads, and load sizes have explicit boundary limits.

Rules code also needs pinning. Content hashes alone do not preserve how an old spell behaves. A save selects a retained rules revision for future adjudication and a retained event decoder and fold version for past events. A missing revision refuses continuation with an explicit message. Updating an active campaign is an explicit migration with a new input event and a differential-replay test, never silent use of the latest rules.

SQLite stores save identifiers and events. Partial unique indexes over event payloads enforce one accepted operation ID and one terminal record for that ID. Command fingerprints and terminal revisions live in events, not in a separately authoritative receipt table. Save lists derive last activity and lifecycle from logs. Indexes may accelerate reads but do not become state.

The operation protocol is:

1. In a short `BEGIN IMMEDIATE`, look up the operation ID before checking revision. An identical prior request returns its original result; different content under the same ID is a conflict. Otherwise require the expected head and no pending operation, then append `command-accepted`.
2. For a command needing a director, append `director-started` before external I/O. Never hold a SQLite transaction across the model call. Two HTTP requests cannot both reserve a turn, even across app instances.
3. Produce the candidate against the accepted base revision. Append the proposal or breach, every ruled correction, all resolved events, narration, and `command-settled` in one CAS transaction. Publish only that committed result. A late response cannot commit after recovery settled the operation.
4. A retry returns the view at the original terminal revision. It never rolls again. The browser can fetch a newer view separately. The operation ID and expected head are included in the request fingerprint.

At startup, an accepted command without `director-started` can resume. One with `director-started` but no terminal record settles with a breach without issuing a second call. The external call might not actually have left the process; accepting that small false-stall window is the price of never retrying the model. Structured mechanics are recalculated from the reserved base and dice cursor, so recovery commits the same outcome with fallback text.

A single writer process owns the database through an exclusive local lockfile containing its process identity. A second server fails startup rather than trying to recover a live owner's operation. SQLite CAS remains the final defense for races and late work. Recovery of an old lock requires proving that owner is gone. No process-name killing is involved.

Dice use the saved seed and monotonically recorded draw sequence, with separate named streams for creation, rules, and generation. Telemetry and prose do not advance the rules draw sequence. Every roll event records faces, purpose, modifier components, DC or AC, and the resolved result. Replay applies those events without rolling. A verifier can independently recalculate the faces from the seed and cursor.

Creation and level-up choices are commands in the same log. A chosen die result stays chosen across reload. `advance-module` applies its recovery and module entry once. Replacement installation is keyed to the death event and its creation draft. Duplicate End or Continue cannot create two successors.

### Death, module victory, and campaign victory

Zero HP starts dying unless instant-death rules apply. Death saves occur at the hero's initiative start. Three successes become stable; three failures become dead. Natural 1, natural 20, damage while dying, massive damage, and stabilization are explicit cases. Stable recovery has a recorded seeded duration. Opponents have declared tactics for abandoning, capturing, or continuing to attack a downed hero; there is no secret immunity for the player.

Death stops action scheduling and opens `death-choice`, preserving the module's facts. End records module defeat and campaign loss. Continue opens a durable replacement draft at the dead hero's completed level and minimum XP for that level. It uses the ordinary creation system, including every intervening choice.

The package defines entry anchors with engine-checkable safety requirements. Select the nearest currently safe reachable anchor, with the module entrance as a validated fallback. If all normal anchors are hostile, an authored `secure-entry` consequence relocates the hostiles to another admitted room and preserves their HP and equipment. Admission verifies the fallback room and recovery paths and rejects a module without this contingency. The successor enters outside immediate enemy initiative, then play resumes normally.

The old body retains its gear as loot; the new hero gets level-appropriate starting equipment. Quest-critical items cannot disappear with an unreachable corpse because goals use durable quest custody or admit a recovery route. Completed quests, found clues, defeated foes, and front changes remain campaign facts. The model narrates the already-decided arrival and cannot choose its position, level, or inheritance.

A goal is an engine predicate over facts, such as a conclusion learned and the ledger delivered, not a request that the model nominate a milestone. XP awards use stable reward IDs and can fire once. Merely revisiting a room cannot farm progress. Quest display progress derives from achieved terms and award events.

After each action, the settlement order is action effects, immediate rule reactions, elapsed-time triggers, discoveries and goal awards, then lifecycle settlement. Dead hero takes precedence over a simultaneous goal satisfaction. The goal facts remain earned, so a successor can conclude the module without rediscovering them. A living hero with a satisfied goal gets module victory before the scheduler gives another opponent a new turn. This is an explicit game policy and needs a named test.

A won nonfinal module opens `between-modules`; gameplay commands are refused there. Continue records an interlude long rest and enters the next module in one settlement. It preserves character identity, gear, choices, XP, and story facts. The interlude advances enough game time to satisfy rest eligibility and does not secretly run the completed module's clocks. The final module yields campaign victory and a stored epilogue. A hero who dies between campaigns is not a meaningful state in this design.

Research informs the legacy framing, but not the mechanics. `research-campaigns.md`, section 4.3 proposes Face Death and half vow inheritance. Both are rejected because they conflict with D&D death saves and FR-013's preserved progress. Likewise, its five-to-nine-session season suggestion does not override SC-007. Bundled modules target 30 to 60 minutes total, with interruption-safe saves throughout.

### Clocks, goals, and campaign structure

The campaign is an ordered nonempty list of modules. Each module has physical locations, encounters, clue deliveries, conclusions, a start, a finale, an engine goal, and a successor entry policy. Campaign conclusions and clocks have campaign scope and survive module transitions. Module clocks stop with their module. Campaign revelations can refer across modules but may only unlock reachable future content. Admission proves that completing the final module can also satisfy the campaign goal.

Physical exits and investigative leads are different graphs. Exits are authored geography. Investigative lead edges are derived from clue delivery to conclusion to destination; authors do not maintain a second independent lead-edge list. A conclusion can have three independent clues while a player needs only one to learn it. Redundancy does not mean demanding all three clues.

Clocks carry activation predicates, elapsed-time or event triggers, and nonempty mechanical consequences. Fronts and faction plans group clock IDs; they do not maintain another progress counter. A module advances the campaign arc by disclosing a campaign conclusion or advancing one of those clocks, so arc coverage derives from effects rather than a second authored arc-beat list. Filling a clock emits `trigger-fired` and consequences once. A dead NPC invalidates its social clock's activation predicate. Simultaneous clock consequences use stable trigger order and a bounded acyclic dependency graph.

Consequences can spawn admitted encounters, change access, disclose a proactive clue, move a faction, or create an explicit hazard. They cannot silently destroy the only remaining route to a live hero's goal. A setback changes the problem or activates a recovery route. Clock-triggered interruption happens before rest benefits. This directly addresses `review-gaps.md` findings 15, 16, and 20.

### Forge generation and quality

The forge builds a graph and all IDs deterministically. It reserves goal terms, conclusions, at least three clue deliveries per required conclusion, proactive recovery, successor anchors, locked-door solutions, and reward locations before choosing encounters. Encounter choices use audited SRD XP budgets for one hero, with solo warnings for action economy and excessive CR. Themes select original location and encounter tables, not a different rule engine.

The model fills one local entity's short text at a time. It cannot emit references, numeric budgets, feature mechanics, graph edges, or predicates. It receives only the entity's allocated facts and relevant neighbor names. Failed generation is a located diagnostic. A fixed fallback table is explicitly labeled in the draft. The forge does not retry a failing model automatically; manual regeneration is a new draft operation.

The shared admission policy implements `research-campaigns.md`, sections 2.1 through 2.6, with support grades retained in diagnostics. G1, critical G2, G4, G6, G8, S2, C1, C2, relevant C5 and C6, C8, A1, A3, and A4 are blocking rules. Ordinary-node G2, clue diversity, loop counts, encounter pacing, pillar opportunities, and NPC text lengths remain warnings. Companion and sidekick rules do not apply to this one-hero specification. Reward tables outside the SRD are not copied.

For bundled modules, stricter executable tests add 1,000 game-engine playthroughs per module and state-space checks for irreversible quest facts and locks. The explorer records a witness path or a located dead-end explanation. A timeout is inconclusive, never a pass or a loss. Stochastic walks alone do not prove SC-002. The test asks whether a winning route remains reachable from each visited alive state, not whether every random player chose it.

Clue counts and syntax cannot prove that prose is coherent. Human review of the pitch, clues, finale, and a sample of NPCs is recorded as editorial evidence, not misrepresented as engine validation. The same seed reproduces the deterministic structure; model output itself is not promised repeatable across hardware. The exported text bytes and recorded draft results supply reproducibility.

### Dominant access patterns

| Query or transition | Authoritative inputs and derived access | Result |
| --- | --- | --- |
| Show hero AC and a spell DC | Hero choices, level grants, equipment, active effects, catalog references | One `sheet` calculation supplies both UI values and adjudication |
| Attack one foe | Revision-bound offer, actor profile, position grid, target profile | Engine spends budget and produces roll, damage, conditions, and triggered effects |
| Cast on several targets | Prepared spell, slot resource, legal target selection, grid and range | One validated activation; save and damage rules shared with monster abilities |
| Process an enemy turn | Initiative cursor, actor map, condition and reaction state | Deterministic tactics until the next player decision |
| Find the last clue | Clues indexed by room and trigger, conclusion membership, goal dependency index | `discovered` updates facts and may award or end the module without a model milestone |
| Advance pressure over a rest | Time cursor, active-clock index, next trigger times | Bounded chronological consequences before recovery |
| Retry a turn or replacement | Save ID and operation ID indexed in events | Original terminal revision, no additional rolls or grants |
| Resume after code or data changes | Genesis content and rules revision, event decoder, complete log | Same facts and supported pinned adjudication, never fresh generation |
| Show title screen | Save IDs and last settled log positions | Only projected summaries, including interrupted creation and between-module saves |

Indexes are created at admission or rebuild and updated by the fold. They are never asynchronously synchronized with another authority. Small modules permit full derivation first; performance work cannot introduce persisted sheet caches.

### Interface depth and call chains

The public game object exposes `start`, `submit`, `view`, `title`, and `delete`. Starting hides content admission and pinning. Submitting hides concurrency, recovery, decisions, adjudication, atomic settlement, and projection. Callers supply intent and concurrency identity, which they genuinely own.

Internally the familiar `apply`, `project`, and `adjudicate` functions remain inspectable. HTTP goes to game orchestration and then the relevant domain owner. It does not traverse a controller, service, repository, manager, and adapter chain. Character derivation is shared domain knowledge rather than a wrapper around a class-name switch. The mechanics interpreter and its intrinsic handlers are the only justified extra depth.

The forge owns generation and export, while contracts own admission. There are no public `loadStage`, `validateStage`, or `saveStage` methods that make a consumer repeat policy.

## Synthesis decision

This is candidate B only. No other candidate directory was read. Base selection and grafting belong to the arena coordinator.

## Tradeoffs accepted

- We accept larger genesis events in exchange for saves independent of edited content and generator changes.
- We accept maintaining a small set of pinned rules revisions in exchange for honest continuation semantics. Unsupported old revisions fail explicitly.
- We accept a finite effect language and handwritten exceptional handlers in exchange for deterministic, inspectable mechanics without plugin code.
- We accept occasional clarification choices and less fluent free-text result prose in exchange for one small model call and no dropped structured actions.
- We accept internal grid geometry in exchange for real range, cover, movement, and area-effect rules. The mobile UI need not become a virtual tabletop.
- We accept a rare crash-recovery stall in exchange for never reissuing an uncertain model request.

## Alternatives considered

| Alternative | Complexity hidden | Complexity exposed or retained | Why it loses |
| --- | --- | --- | --- |
| Extend the current flat proposal with spells, items, saving throws, and rounds | Few new application entry points | The model and every validator must coordinate many independent mechanical fields | Shallow despite a small function count. The worst caller is a 3B model |
| Make the DM a planner with arbitrary tool calls | Content authors can describe nearly anything | Rules legality, sequencing, partial tool completion, and repair become a conversation protocol | Violates the small-decision and one-authority constraints |
| Load campaign JavaScript plugins | Feature authors can implement exceptional behavior | Every package author inherits sandboxing, serialization, compatibility, and determinism | Moves engine complexity to the least trusted caller and violates the data-only import boundary |
| Save a mutable world snapshot and regenerate later modules | Easy reads and smaller initial saves | Two authorities, content drift, snapshot migrations, and future generation failures | Conflicts with constitution III and FR-018 |

## Open questions and risks

1. Can the finite recipes plus typed intrinsics express every feature reachable for all thirteen classes at levels 1 through 3 without becoming a general scripting language? This is the largest uncertainty and the first rules feasibility gate.
2. Does one selection call plus engine result text meet the local model's quality target without a second narration call? A measured 30-turn production-model session decides, not enum validity alone.
3. Is Maker an acceptable player-facing name for the original artificer-style class? The safe default avoids presenting proprietary content as implemented rules.
4. How many historical rules revisions can the project realistically maintain? The default is to preserve every shipped revision until an explicit, verified migration replaces it.

## Next implementation step

Implement command identity and crash recovery around the existing playable engine, with duplicate-submit and failure-at-every-boundary tests, before adding any new rules.

## Phased migration plan

These are proposed landable units, not claims of implemented scope. Work proceeds in worktrees and updates the specification, module map, verification recipes, and `decisions.tsv` with each behavior change.

| Unit | Change and removals | Playable endpoint | Independent evidence required |
| --- | --- | --- | --- |
| 0. Durable command envelope | Add acceptance, CAS, receipts derived from events, and publish-after-commit. Remove HTTP-owned world mutation | Existing tavern and delves still play | Duplicate request, same-ID conflict, concurrent process refusal, failed SQLite transaction, restart at each protocol boundary, no extra roll |
| 1. Frozen content and executable goals | Add genesis content and shared admission. Convert new tavern and generated delves. Remove new-save dependence on mutable `scenarioFor` and model milestone nominations | Existing lightweight rules play a finishable module with real clock consequences | Edit source content after save, reopen identical view; danger fills once; last clue completes its actual goal; graph and lock witnesses |
| 2. Rules feasibility slice | Implement a representative full level-3 caster, martial action economy, transformation, reaction suspension, and one custom-class recipe in isolated fixtures. Do not advertise partial class support | Lightweight game remains the public playable game | Feasibility matrix proves each low-level feature can be represented; scrap the effect language if unrelated mechanics repeatedly need escape hatches |
| 3. First D&D release | Ship all twelve SRD classes plus the original class at levels 1 through 3, their required subclasses, low-level reachable spells, death saves, gear, rests, checks, progression, and resumable creation | Tavern is a 2024 campaign pilot. Every offered class is actually playable | Named tests and mutants per rule; replay each class and resource path; 390x844 creation under three minutes; actual HTTP and browser reload, database effects, and server restart |
| 4. Seasons and succession | Add interlude transitions, same-level successors, safe anchors, campaign epilogue, and retained-content scope | Two-module campaign can be won, ended after death, or continued by a successor | Repeated transition and replacement requests; hostile death room; minimum-level XP; gear and facts carryover; restart mid-creation, mid-level-up, and between modules |
| 5. Forge and custom content release | Add deterministic generation, local text filling, custom class builder, exact shared admission, and all themes | Player authors a class or imports a generated campaign and finishes it | Stale-contract rejection; identical game and forge verdicts; one-clue rejection names conclusion; 1,000 runs per bundled module with no alive dead end and at least one win and loss |
| 6. Higher-level expansion | Extend supported ranges in complete class bands and fill remaining spell and item handlers. Never expose an option whose effects are unsupported | Every release supports its declared level range across all classes | Class-by-level capability closure, rest and resource matrix, adversarial replay, solo encounter playtests, measured 30-to-60-minute module pacing |

Unit 2 is a design risk reduction step, not a release of a fighter-only D&D game. The specification's first D&D support band remains levels 1 through 3 for every requested class. Higher levels are not claimed complete merely because their source data has been imported.

### Existing saves

Do not pretend that the prototype's `hp` and `power` identify a D&D class. Existing sessions continue under a frozen `prototype-v1` executor and frozen tavern and generator definitions. At the first migration, record their original scenario input and executor revision in an appended legacy-input event without rewriting old events. The migration records the baseline from the known deployed revision and verifies it against the pre-migration view. If the historical revision cannot be established, report that limitation and preserve the original save for read-only inspection rather than guessing.

New saves use the new genesis format. The title marks prototype saves clearly and offers a separate new D&D campaign. No automatic conversion invents ability scores, class choices, or a changed map. The adapter stays isolated and is removed only through an explicit supported migration or a deliberate end-of-support decision.

### Specification and constitution checks

| Requirement group | Concrete owner or rule in the proposal |
| --- | --- |
| FR-001, FR-005, FR-006, FR-019 | `adjudicate`, initiative `TurnState`, bound actions, and public offers |
| FR-002 through FR-004, FR-007, FR-010, FR-015 | `CharacterChoices`, `LevelGrant`, `Casting`, `Definition`, `Support`, and original provenance |
| FR-008, FR-009 | Inventory custody, equipment choices, resource ledgers, and resumable rests |
| FR-011 through FR-014 | Goal predicates, trigger consequences, campaign lifecycle, and death-keyed replacement |
| FR-016, FR-017 | Shared `admit`, contract fingerprint, located issues, and stale-export tests |
| FR-018, FR-020 | Frozen genesis, command log, pinned rule revisions, and projected title and save views |

Constitution I remains in adjudication, including visible `ruled` events. II remains in the per-request director adapter, with no retry. III remains in the event-only store and total fold. IV remains in the single projection, including creation and title screens. V requires a named mutant-killing test for every new rule. VI applies to each implemented release, not this stub package. VII is preserved by direct Node execution, Node built-ins, and plain HTML.

SC-001 needs a timed phone creation exercise. SC-002 needs the 1,000-run and reachability checks above. SC-003 and SC-004 need dice verification and real restarts at all suspended states. SC-005 means at least 29 usable model answers in a 30-turn session; fallback playability is counted separately and cannot inflate that numerator. SC-006 compares actual game and forge verdicts over all bundled campaigns. SC-007 is measured player elapsed time for a module, not a guessed scene count.
