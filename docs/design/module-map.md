# Module map

Eleven modules in one package, `@portale/engine`, plus a thin HTTP host and the client. The
hierarchy is flat, not deep. `engine` calls its peers and every one of those peers is a
leaf. Tracing any question, such as "where does damage get clamped?" or "who decides the
DC?" or "what stops the DM stabbing the wrong person?", lands in exactly one file. Breadth
under one orchestrator is not a deep call chain.

Modules are grouped by the knowledge they own, never by when they run. The pair that looks
most like temporal decomposition, `world` and `adjudicator`, is addressed explicitly below.

Node 24 runs these files directly. There is no transpiler, no bundler and no build step, so
every relative import carries its `.ts` extension and `tsc` runs only as a checker.

---

## `ids.ts`, identity and bounded arithmetic

**Owns** every semantic primitive in the system and the arithmetic that cannot go wrong.
`Meter` clamps. `Coin` cannot be negative. `debit` refuses rather than clamps. Branding
means an `EntityId` can never be passed where a `FactId` belongs.

**Public** the brands, `meter` and `shift` and `isFull`, `coin` and `debit` and `credit`,
`mintEntityId` and `mintFactId`.

**Why it is a module and not a util file.** "You cannot heal past max HP" lives here as a
construction, so no other module contains that rule and no other module can get it wrong.
Small surface, one non-negotiable invariant each, zero callers who need to know how.

---

## `world.ts`, what a legal world is

**Owns** `Entity` and the Ledger and Lore split, which is the design's central claim. Also
`Fact`, `Aspect` cardinality, `Scene`, `PlayMode`, `Recap`, `World`, and the reducer.

**Public** `applyEvent`, `project`, `currentLore`, `invariantsHold`, `ASPECT_CARDINALITY`,
and the types.

**Changed by graft 3.** `Scene` is discriminated by `mode`, either `exploration` or
`combat`, and `PlayMode` is derived from it. Mode is the discriminant rather than a flag
beside one, because it selects the op list that is generated into the per-turn schema. The
regime is still data and there is still one pipeline.

**The obligation that defines this module.** `applyEvent` is total and trusting. It never
validates, never rejects, never throws. Events in the log were adjudicated when they were
written, and re-checking them on replay would mean a rules change in March could stop a
February session from loading.

---

## `proposal.ts`, the model contract and its breach

**Owns** the entire vocabulary in which the model may change the world. `Target`,
`Approach`, `Band`, `Effect`, `CheckRequest`, `Move`, `Proposal`, `Told`. Also the contract
policy tables, `BAND_TARGET`, `BAND_REQUIRES_CITATION` and `AFFORDANCES`. And, since graft
1, `ContractBreachReason` and `DirectorContractBreach`.

**Public** the types, the tables, `affordances(mode)`, and the error class.

**Why `affordances` lives here rather than in `adjudicator`.** It is a statement about which
ops the contract offers in which mode, keyed by `PlayMode` and nothing else. It sits beside
the op union it constrains, and putting it here keeps `adjudicator` free to import
`SceneBrief` without a cycle.

**Why the breach type lives here.** A breach is a violation of this contract. Both the
module that parses the wire, `director`, and the module that re-checks the rules,
`adjudicator`, need to raise one, and neither may import the other. The contract and its
breach belong together.

**Every field of `ContractBreachReason` is a raw string**, on purpose. A breach is exactly
the case where the wire carried a value that is not a domain value, so typing those fields
as `EntityId` or `EffectOp` would assert the thing that just failed. It also means the type
can be exported from `index.ts` without dragging the model contract onto the public surface.

---

## `adjudicator.ts`, the rules, and the only place a proposal can be rejected

**Owns** every game rule. Reach, calibration, band citation, effect legality, rewrite versus
drop, degree-to-branch selection, initiative advance, and the ruling vocabulary.

**Public** `adjudicate(world, brief, turn, proposal)`, plus `calibrationKey`,
`renderCorrections`, `appliedEffects`, `stall`, and the `Refusal`, `Ruling` and `Terminal`
types.

**Changed by graft 1, in the signature.** `adjudicate` takes the brief as well as the world,
because those are two different questions. The world is what is true. The brief is what the
model was offered. A value contradicting the world is a rules event. A value that was never
in the brief is a transport fault, since the engine generated those enums itself. Without
the brief the two are indistinguishable and the breach channel cannot exist.

**Changed by graft 1, in the union.** `Refusal` holds only Layer-2 conditions now, which are
the ones depending on arithmetic, on a conjunction of effects inside one proposal, or on
history. The conditions the schema already makes undecodable are still checked and are
reported as `ContractBreachReason`, not as refusals. A refusal becomes fiction and is
counted as a quality signal. A breach never becomes fiction and pages an operator.

**Changed by graft 2.** Outcomes are named. `Ruling` is `applied`, `rewrite` or `drop`, one
per proposed effect. `Terminal` is `resolved`, `asked`, `soft-fail` or `stalled`, one per
turn. `asked` and `soft-fail` both produce zero events and must never be conflated, which is
the bug an implicit taxonomy would have shipped.

**The two layers, stated once.**

| | Layer 1, syntax and shape | Layer 2, semantic and rules legality |
| --- | --- | --- |
| Owned by | the runtime, through `format: <schema>` | this module, and only this module |
| Measured | 8/8 engine-valid, against 0/8 for JSON mode | not measurable by a decoder at all |
| Catches | wrong field names, out-of-enum values, out-of-reach targets, off-mode ops, stale fact ids | difficulty 30 for a rusted lock, spending 50 while holding 12, two payments jointly bankrupt, a band contradicting last turn |
| Our code | builds the schema, never re-checks it for gameplay purposes | the whole rules engine |

**`world` versus `adjudicator` is a split by trust obligation, not by execution order.** The
adjudicator is the boundary that validates. The reducer is the interior that trusts. That is
boundary-discipline expressed as a module boundary. Collapsing them would force one function
to be both rejecting, for new proposals, and total, for replay, which is the exact
contradiction that breaks event-sourced systems a year in.

**Depth.** One exported function hides the entire rules engine. Callers pass a proposal and
a brief and get events. They learn nothing about reach, clamping or calibration to use it.

---

## `dice.ts`, the only randomness

**Owns** the PRNG, the band-to-target mapping, the degree ladder, and the cost rule.

**Public** `draw`, `resolve`, `costTarget`, `Roll`, `Degree`, `RollKey`.

**Why separate from the adjudicator.** It is the sole source of nondeterminism that is not
the model, and isolating it is what makes "re-fold the log, get the same die" a property you
can state in one sentence and test in three lines. The RNG has no hidden state. A draw is a
pure function of the committed log height.

---

## `brief.ts`, what the DM may know, and what it may name

**Owns** context scope resolution, the token budget, and the closed sets the model may
choose from. Which NPC survives a crowded room, which of Marga's facts get dropped, when a
veiled secret is pinned, and, most importantly, who is targetable versus merely mentionable.

**Public** `assemble`, `scopeCast`, `recapRequest`, `SceneBrief`, `MAX_IN_REACH`,
`MAX_CITABLE_FACTS`.

**This module now owns a correctness invariant, not a context budget.** `MAX_IN_REACH` is 6
and `inReach` is truncated hard. The enum probe held the scene fixed and unambiguous and
varied only the length of the target enum. Correctness went 8/8 at three entities, 4/8 at
ten, 3/8 at twenty-five, while in-enum validity stayed 24/24 throughout. A generous
`inReach` is actively harmful and no validity metric will ever report the harm. The priority
order in `scopeCast` matters as much as the cap does, because the mechanism is distractor
removal. The knitting old woman has to be the one that falls off the list and the smuggler
the player just named has to be the one that never does.

`MAX_CITABLE_FACTS` is 12 and is labelled in the code as extrapolation rather than
measurement.

**Why `inReach` lives here rather than in `director`.** The decision that Marga is relevant
and the decision that Marga is nameable are the same scoping decision with two consumers,
the prompt and the per-turn JSON Schema. Splitting them would give two places to change when
the rule moves, and a bug class where the prompt introduces someone the schema forbids
naming. Consolidate the decision, pass the result.

**Why it is not part of `director`.** This is pure domain policy with real consequences, and
keeping it out of the IO module means it is unit-testable on a GPU-less laptop. `SceneBrief`
is a domain type. No messages, no roles, no prompt strings.

**Second consumer, added by graft 1.** The brief is also the record of what the model was
permitted to say, which is what lets `adjudicate` tell a rules event from a transport
breach.

---

## `director.ts`, the seam, and the shape gate

**Owns** everything about the fact that an LLM exists. Prompt rendering, HTTP transport,
per-turn JSON Schema construction, the wire to domain branding step, and all four Director
implementations.

**Public** `Director`, `proposalSchema`, `parseProposal`, `localDirector`,
`scriptedDirector`, `replayDirector`, `hostileDirector`, `warden`, `directorContract`,
`MINT_SLOTS`, `MAX_TARGET_ENUM`.

**Strictly private** every transport shape. Targets are bare strings on the wire and a
discriminated union inside. Nothing outside this file has ever seen a string where a
`Target` belongs.

**What measurement 1 changed here.** A probe of qwen2.5:3b via Ollama scored 0/8
engine-valid unconstrained, 0/8 with `format: "json"` while parsing 8/8, and 8/8 with
`format: <schema>`. So this module has no parse-repair loop and no retry ladder. Shape is
the runtime's job. What it gained instead is `proposalSchema`, which builds the schema from
this turn's world so every closed set the engine already knows becomes an enum the decoder
enforces. Out-of-reach targets, off-mode ops, stale fact ids and out-of-initiative actors
stop being rules checks and become undecodable.

**What measurement 2 changed here.** `MINT_SLOTS` is 2, down from 4. Mint slots share the
target enum with entities in reach, so the enum the decoder sees is
`MAX_IN_REACH + MINT_SLOTS` members long. Four slots would have put the total at ten, which
is exactly the condition measured at 4/8 correct. Two holds it at eight. `MAX_TARGET_ENUM`
names the bound and `proposalSchema` asserts it, because an overflow is invisible to every
other check in the system.

**This is the module that makes the test suite GPU-free.** The model is a constructor
argument, not an import. `scriptedDirector` takes raw wire JSON, which is also the only way
to test the breach path without a live model.

---

## `store.ts`, persistence port

**Owns** the append-only log, CAS on the head, turn-id lookup for idempotency, and an opaque
snapshot cache.

**Public** `EventStore`, `sqliteStore`, `memoryStore`, `AppendResult`.

**Strictly private** the schema. Snapshots are `Uint8Array`, so the store does not know what
a `World` is and a snapshot format change is not a migration. Snapshots carry zero
authority. `DELETE FROM snapshots` must be safe.

---

## `events.ts`, the log and its projections

**Owns** `WorldEvent`, `Recorded`, `Exchange`, and the transcript projection.

**Changed by graft 2.** `turn-recorded` carries one exhaustive `Ruling[]` and a `Terminal`,
replacing the applied-plus-refused pair a looser design would keep. An effect cannot then
appear in neither list, which is the failure mode that makes an audit lie. `Exchange` also
carries the terminal kind, so scrollback keeps showing the rephrase invitation on a
soft-failed turn.

**Contract breaches are deliberately absent from the log.** They are operational facts about
the deployment, not events in this world, and the transcript is projected from this log. A
breach reaches the operator through `EngineDeps.onBreach` and the process log. `terminal`
records that the turn stalled and nothing more.

---

## `engine.ts`, the turn as a unit of atomicity

**Owns** the public surface of `begin`, `takeTurn` and `view`, turn idempotency, the single
commit transaction, the unreachable-model fallback, the breach fallback, the streaming
protocol, and the `PlayerView` projection.

**Public** `createEngine`, `Engine`, `EngineDeps`, `PlayerView`, `TurnEvent`, `TurnOutcome`,
`TurnRequest`.

**Not a pass-through.** It owns a guarantee no other module can make. The turn always
settles, exactly once, with prose and a consistent world, whatever the model did.

**`PlayerView` is not `World`.** The world holds veiled facts, NPC dispositions, hidden
clocks and the calibration table. Shipping it to the browser would leak the secrets the game
is made of. `PlayerView.here.present[].inReach` is the one field that crosses from the
scoping decision to the UI, so the client can grey out what the player cannot act on.

**`onBreach` is the operator channel.** The player never sees a contract breach, so someone
has to, or a swapped model degrades silently into stalled turns that look like bad luck.

---

## `index.ts`, the public boundary

Re-exports `createEngine`, the two projections, `TurnOutcome`, the branded id constructors,
the shared vocabulary the UI renders, `DirectorContractBreach`, and the two ports. Nothing
else. `World`, `Effect`, `Proposal`, `WorldEvent`, `SceneBrief`, `Refusal` and `Ruling` are
all private, so a UI change can never be blocked on the DM's internal governance.

---

## Outside the package

| Module | Owns | Surface |
| --- | --- | --- |
| `api/` | HTTP and SSE framing, auth, session ownership | four routes, all thin adapters |
| `client/` | rendering, optimistic input, the die animation | imports types from `@portale/engine` only |
| `fixtures/` | captured real-model sessions as JSONL | consumed by `replayDirector` |
| `tools/model-probe/` | the two measurements this design rests on | run by hand, and again on the production host |

`api/` routes are genuinely thin and that is correct. A transport adapter at a system
boundary is the one place a forwarding layer earns its keep, because it converts protocol
into domain and back.

The die animation runs client-side against a roll that is already committed, which is why
interactive dice cost no second model call.

---

## Dependency direction

```
ids
 |
 +-- world  <type>  proposal          two halves of one idea
 |      |              |
 |      +---- dice ----+
 |               |
 |             brief
 |               |
 |        adjudicator  <type>  events
 |               |
 |      +--------+--------+
 |      |                 |
 |   director           store
 |      |                 |
 |      +--------+--------+
 |               |
 |            engine
 |               |
 |             index
```

No runtime cycles. `world` and `proposal`, and `adjudicator` and `events`, are mutually
referential by type only, which TypeScript resolves and `verbatimModuleSyntax` erases
entirely. Each pair is two halves of one idea. A world and the vocabulary for changing it. A
log and the rulings that produced it.

`adjudicator` imports `SceneBrief` as a type only, and never the other way round.
`affordances` sits in `proposal` so that `brief` and `adjudicator` can both reach it without
either importing the other, which is why it moved out of `adjudicator` during synthesis.
