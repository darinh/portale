# The DM contract

## Problem

We are building an AI dungeon master whose entire value is improvisation, on a 14B-class
local model that will reliably emit rule-violating output, with business logic that must be
provable on a laptop with no GPU. The brief names the tension as engine-owns-truth versus
model-must-improvise, and that framing is what makes the shape non-obvious. Stated that way
it looks like a dial to be tuned, with a menu-driven adventure at one end and a drifting
chatbot at the other. Every point on that dial is a bad product. The constraints that pin
the design are all FIXED. One API tier owns business logic. The model is a locally hosted
OpenAI-compatible endpoint. Production is a single 4090. The test suite must be green
without a GPU. TypeScript runs end to end so domain types are shared rather than
duplicated. Node 24 executes `.ts` directly and `node --test` runs `.ts`, so there is no
transpiler and no build step anywhere in this design.

Two constraints arrived as measurement rather than assumption, and both moved the design.

**Measurement 1, shape.** Probing qwen2.5:3b-instruct through Ollama at 8 trials per mode
gave 0/8 engine-valid unconstrained, 0/8 with `format: "json"` while parsing cleanly every
single time, and 8/8 with `format: <json schema>`. The middle row is the one that matters.
JSON-syntax validity and schema-shape validity are different properties, and a gate calling
`JSON.parse` sees only the first. So malformed and mis-shaped output is not a problem this
design gets to be clever about. The runtime closes it, there is no parse-repair ladder
anywhere, and there is no option to turn the schema off, because an option to turn it off
would only ever be an option to break the game.

**Measurement 2, choice.** The obvious way to exploit measurement 1 is to build the schema
per turn from live world state, so every closed set the engine already knows becomes an
enum the decoder enforces. That works. What it costs was measured twice, and the first
measurement was wrong in a way worth recording.

`probe-enum.mjs` first appeared to show choice quality collapsing as the target enum grew,
scoring 8/8, 4/8 and 3/8 for enum sizes 3, 10 and 25. That experiment was confounded. The
tempting distractor sat at index 5 of an arbitrarily ordered list, so it was absent from
the 3-entity condition and present in the larger ones, and it then accounted for almost
every wrong answer. Length was confounded with distractor identity.

Re-run with the attractor pinned into every condition, the trend disappears.

| Target enum | Target inside the enum | Target correct |
| --- | --- | --- |
| 3 entities | 8/8 | 6/8 |
| 6 entities | 8/8 | 3/8 |
| 8 entities | 8/8 | 3/8 |
| 10 entities | 8/8 | 4/8 |
| 25 entities | 8/8 | 6/8 |

Size 25 matches size 3. There is no length effect, and with eight trials a cell these
differences are not separable anyway.

Two things survive, and they are the ones that matter. The decoder guarantee is absolute:
target-inside-enum was 8/8 in every condition of both runs, 40/40 overall. And reference
resolution is unreliable on a small model at every list size, which no validity metric can
see, because in-enum conformance was perfect in the same runs where the model attacked an
unarmed bystander five times out of eight.

What does NOT survive is the cap that was derived from the retracted trend. `MAX_IN_REACH`
is a hedge, not a finding. Capping the list does not restore correctness, because length was
never the mechanism. The plausible fix is the id-to-name table now carried in the prompt,
since the model must map a description onto an opaque identifier, and that is the step most
likely to be failing. Re-measure on the production model before treating any number here as
settled.

Latency is not binding. The 3B managed 14.5 tok/s on a CPU-only box, so a 14B on a 4090 has
ample headroom and nothing here is contorted to hide a wait.

## Usage (caller's view)

The whole API is three methods.

```ts
const engine = createEngine({
  store: sqliteStore('file:./portale.db'),
  director: localDirector({ endpoint: 'http://127.0.0.1:11434/v1', model: 'qwen2.5-14b-instruct-q5_k_m' }),
  onBreach: (b) => logger.error({ breach: b.reason }, 'director contract breach'),
});
```

Note the two options that are absent. There is no `constrainDecoding` flag, per measurement
1. There is no retry or attempt policy, because there is nothing to retry.

**The HTTP route.** Transport only. No prompts, no dice, no repair.

```ts
app.post('/sessions/:id/turns', async (req, res) => {
  const stream = engine.takeTurn({
    session: SessionId(req.params.id),
    turn: TurnId(req.body.turnId),   // client-minted; resending replays, it does not re-roll
    utterance: req.body.text,
  });
  for await (const ev of stream) res.sse(ev satisfies TurnEvent);
  res.end();
});

app.get('/sessions/:id', (req) => engine.view(SessionId(req.params.id)));  // resume, days later
```

**The client** consumes `TurnEvent` in table order. The DM calls for a roll, the die lands,
then you hear what it meant.

```
deliberating -> check{ finesse vs the harbour lock, hard, stakes } -> rolled{ 14 vs 15, failure }
             -> prose... -> settled{ view, outcome }
```

There is no `error` variant to handle. `settled.outcome` is the one thing the client
branches on, and only one arm needs UI. On `soft-fail` the DM understood the player and
nothing it proposed was legal, so the client invites a rephrase instead of leaving the
player to retype the same sentence. `strained` is an advisory that does not terminate the
stream.

**The test**, on a machine with no GPU. The layers are asserted separately, because one
"is the output valid" check conflates exactly the properties the probes showed are
different.

```ts
const e = createEngine({ store: memoryStore(), director: scriptedDirector([ /* raw wire JSON */ ]) });
```

```ts
// Layer 1. We assert only that we hand the runtime the right enums, and that they are short.
expect(proposalSchema(brief).$defs.Target.enum).not.toContain(idOf('the harbourmaster'));
expect(proposalSchema(brief).$defs.Target.enum.length).toBeLessThanOrEqual(MAX_TARGET_ENUM);
```

```ts
// Layer 2. Schema-valid, still illegal, dropped whole and narrated.
expect(out.rulings).toContainEqual({
  kind: 'drop',
  refusal: { kind: 'insufficient-coin', asked: 50, held: 12, subject: you },
});
expect(out.corrections).toContainEqual(expect.stringContaining('come up short'));
```

```ts
// The breach path. A target the engine never offered is not a refusal, it is an outage.
const e = createEngine({ store: memoryStore(), director: scriptedDirector([forgedTarget]), onBreach: spy });
expect(spy).toHaveBeenCalledWith(expect.any(DirectorContractBreach));
expect(lastTurn.outcome).toBe('stalled');
expect(transcript).not.toContain('harbourmaster');   // never narrated
```

```ts
test.prop([fc.array(hostileDirector.arbitraryProposal(brief))])('nothing the DM says can break the world',
  async (proposals) => { /* every turn settles; invariantsHold(world); re-folding is stable */ });
```

## Shape

**The central claim. Truth does not split by authority, it splits by arithmetic.** The
brief's tension dissolves once you notice the engine and the model were never competing for
the same column. Every `Entity` carries two.

```ts
interface Entity {
  readonly id: EntityId;          // engine-minted, always
  readonly name: string;          // immutable once minted
  readonly ledger: Ledger;        // closed union, typed, invariant-checked, adjudicator-written
  readonly lore: readonly Fact[]; // free text, append-only, MODEL-written, engine-notarised
  readonly at: EntityId | null;
  readonly introducedAt: EventSeq;
}
```

The engine owns everything it can do arithmetic on. The model owns everything it cannot.
Marga's hit points are Ledger. Her missing eye and her debt to the harbourmaster are Lore.
The engine does not need to know that one-eyed smugglers are legal in order to own the
truth about how much blood Marga has left. For Lore the engine's role is custody rather
than validation. Mint an identity, freeze the text, keep it forever. For the Ledger it is
arithmetic with clamps. One entity, both columns.

**Second load-bearing decision. Adjudicate, then narrate.** A turn is two model calls with
the dice strictly between them. `propose` has authority and emits roughly 200 tokens of
structured JSON before any die exists. `recount` has no authority and streams prose after
the outcome is a committed fact in its own prompt. Two consequences are worth naming. The
model can never observe a roll while it still has power to act on it, so "the model
imagined the outcome" is a sentence with no referent. And prose, having no authority, is
free to retry, free to stream, and free to be wrong without corrupting anything.

**Third load-bearing decision. Play mode is the discriminant, not a flag.** `Scene` is a
union discriminated by `mode`, either `exploration` or `combat`, and `PlayMode` is derived
from it. `AFFORDANCES` is keyed by mode and by nothing else, and the array it returns is
generated straight into the per-turn schema as the `op` enum. Mode therefore decides what
is sayable, not just what the brief emphasises. Measurement 2 is why this is a correctness
feature rather than tidiness. An op list that grows with every mode's needs at once is an
enum that grows, and enum length is the thing that degrades. Mode gating cuts the combat
list from fourteen ops to ten. It is still one contract and one pipeline. `engage` and
`disengage` are ordinary effects, each legal only in the mode it leaves, and that is the
entire state machine.

**Invariants encoded in types rather than enforced at runtime.** `Meter` is branded and
only constructible through clamping functions, so healing past max HP is unrepresentable
rather than rejected. `Coin` cannot go negative, and `debit` returns `null` rather than
clamping. The asymmetry is deliberate. Clamp what is harmless, refuse what hands out free
goods. `Fact` has a `Standing` union instead of a `retired` boolean beside a nullable
timestamp. `adjudicate` is total, with no error return and no throw, so no caller has a
failure branch to forget. `TurnEvent` has no `error` variant for the same reason. Per
type-system-discipline and encode-lessons-in-structure.

**Validation lives at two boundaries and nowhere else**, per boundary-discipline.
`proposalSchema` in `director.ts` hands the runtime a per-turn JSON Schema that makes wrong
shapes and out-of-reach targets undecodable. `adjudicate` is the sole place a well-shaped
proposal can be rejected on rules. Between them sits `parseProposal`, which is not a gate
at all. With a conforming runtime the shape is guaranteed, so its only job is turning wire
strings into branded domain types. Inside, everything trusts the types. The reducer is
total and never validates, because re-checking committed events on replay would let a rules
change break old sessions.

**What the system deliberately does not do.** It does not understand fiction. It cannot
tell whether "she reaches for a knife" is plausible, and it does not try. Every engine check
here is a set-membership test, a lookup, or arithmetic, which is precisely why the
closed-set half of it could be handed to a decoder wholesale.

### The scoping cap, and why it is a correctness invariant

`brief.ts` owns scope resolution and exports `MAX_IN_REACH = 6`. `inReach` is the set of
entities the model may target, it is a strict subset of `cast`, and it is truncated hard.
Everything in `cast` and not in `inReach` stays in the prompt as scenery. The DM may name
it. The schema will not let the DM act on it.

Six is the default because 3 was measured perfect and 10 was already a coin flip, so the
cap has to sit nearer 3 than 10, and 6 is the largest value that still holds a whole
tactical scene. The protagonist, three foes, and two things worth reaching for. Linear
interpolation between the measured points puts 6 near 75% on the weakest model we tested,
and the production target is stronger. Re-measure on the production host before trusting
that specific number.

The number is only half the mitigation. The mechanism is distractor removal, so the
priority order in `scopeCast` carries as much weight as the cap does. The knitting old
woman has to be the entity that falls off the end of the list, and the smuggler the player
just named has to be the one that never does. That ordering is written out as pseudocode in
`brief.ts` and is unit-testable with no model at all.

Mint slots share the target enum with entities in reach, so the enum the decoder actually
sees is `MAX_IN_REACH + MINT_SLOTS` long. `MINT_SLOTS` is therefore 2 rather than 4, which
holds the total at 8. At four slots the total would have been 10, which is exactly the
condition measured at 4/8 correct. A DM that needs three new things in one breath is
writing a bad beat, and introducing across two turns costs the fiction nothing.

`MAX_CITABLE_FACTS = 12` caps the other live enum. It is extrapolation, not measurement,
and it is labelled as such in the code. A wrong citation is a milder failure than a wrong
stabbing.

### The two layers, and the third channel

| | Layer 1, syntax and shape | Layer 2, semantic and rules legality |
| --- | --- | --- |
| Owned by | the runtime, through `format: <schema>` | `adjudicator.ts`, and only that module |
| Measured | 8/8 engine-valid, against 0/8 for JSON mode | not measurable by a decoder at all |
| Catches | wrong field names, out-of-enum values, out-of-reach targets, off-mode ops, stale fact ids | difficulty 30 for a rusted lock, spending 50 while holding 12, two payments jointly bankrupt, a band contradicting last turn |
| Our code | builds the schema, never re-checks it | the whole rules engine |

The probe's own schema is the clearest illustration of where the line falls. It declared
`difficulty` as an integer from 5 to 30, so a model answering "pick the rusted cellar lock"
with 30 is schema-valid, decodes cleanly, and counts among the 8/8 successes. Layer 1 cannot
see it. Layer 2 must. This is why `Band` is a five-value enum the engine maps to numbers
rather than a number the model writes. Had the number been on the wire, constrained decoding
would have blessed difficulty 30 for a rusted lock eight times out of eight with a clean
conscience.

The dividing rule, applicable to any field added later. A closed set known before the model
speaks goes in the schema. Anything depending on a value the model is about to choose, on
arithmetic, or on history stays in the adjudicator. Conditionals stay out on purpose. JSON
Schema can express `if/then`, but conditional schemas degrade small-model output and would
move game policy into a format string.

**The third channel is the one this synthesis adds.** The adjudicator still checks the
conditions Layer 1 made undecodable, because a rules engine that assumes its transport is
honest becomes unsound the day someone points it at a different server or swaps in a model
whose runtime ignores grammar constraints. But those checks no longer produce refusals.
They produce `ContractBreachReason` values, the engine raises `DirectorContractBreach`, and
the turn stalls in voice. A breach is an infrastructure contract breach, not model
behaviour, and the two must not share a channel. A refusal becomes fiction and is counted as
a quality signal. A breach never becomes fiction and pages an operator. The player never
sees one. The operator always does.

The distinction is checkable because `adjudicate` takes the brief as well as the world.
The world is what is true. The brief is what the model was offered. A value contradicting
the world is a rules event. A value that was never in the brief is a transport fault,
because the engine generated those enums itself and a conforming decoder could not have
produced anything outside them. `ContractBreachReason` carries raw strings throughout, since
a breach is exactly the case where the wire value is not a domain value.

### The terminal taxonomy

Two named unions, at the two levels where the decisions actually live.

`Ruling` is per proposed effect. `applied` landed as proposed. `rewrite` was clamped or
re-banded and continued, and it carries an engine ruling beat through
`renderCorrections`. `drop` never became an event and nothing moved. Which arm applies is
decided by one question. Does honouring this partially transfer value the player did not
earn? No means rewrite. Yes means drop. Over-healing and over-marking a clock are rewrites.
Paying coin the purse lacks and handing an item not held are drops.

`Terminal` is per turn. `resolved` means at least one effect landed or was rewritten.
`asked` means the DM asked the player for specifics, which is state-neutral by construction.
`soft-fail` means every proposed effect was dropped, so the turn settles with prose and the
player is invited to rephrase. `stalled` means the DM never spoke usably, which is
infrastructure rather than fiction.

Naming the all-dropped case is the point of the graft, and naming it immediately paid for
itself. `asked` and `soft-fail` both produce zero events, and an implicit taxonomy conflates
them. They must not be conflated. A DM asking a question is a good beat the player answers
next turn. A beat where nothing the DM proposed was legal is a failure the player has to be
told about, or they retype the same sentence and get the same nothing.

One exhaustive `Ruling[]` replaces the applied-plus-refused pair a looser design would keep,
including in the `turn-recorded` event. An effect cannot then appear in neither list, which
is the failure mode that makes an audit lie.

### The six hard problems

**1. Invented content.** One verb, `introduce`, covers people, places, things, factions and
clocks. The model supplies a mint slot, a kind, a name and free-text traits tagged by
`Aspect`. The engine mints the `EntityId`, because a weak model will reuse, misspell and
hallucinate ids and every reference after that would be silently wrong. The slot is one of
two pre-allocated aliases rather than a name the model invents, which is what keeps every
target field a closed enum. Referring to an entity that does not exist is undecodable rather
than refused. The slot binds within the turn, so one proposal can introduce Marga and have
her hand over a letter. From then on she is in the map, and every brief that scopes her in
carries her current facts verbatim. The model reads canon, it does not recall it. Minting is
always legal. The engine has no opinion on whether a one-eyed smuggler may exist.

Against later contradiction there are three layers, and the third has an honest limit. There
is no update operation on canon, only `reveal` and `amend`, and an amend supersedes a named
fact with a stated reason and stays visible in the log. Memory is never load-bearing,
because facts are re-fed each turn. And `appearance`, `allegiance` and `wants` are
single-slot aspects, so asserting a second current fact into an occupied slot without an
amend is a `fact-conflict` drop, and the correction tells the model what canon already says.
That catches "Marga has two brown eyes" landing on "Marga is one-eyed". It does not catch a
subtle contradiction buried in prose, and a design claiming otherwise would be lying about
what a set-membership test can do.

**2. Dice.** The boundary is drawn at numbers. The model picks a `Band` from a closed
five-value enum and the engine owns the mapping to targets. There is nowhere in the contract
to write "DC 2". Three further guards are all engine-checkable without understanding
fiction. Stakes are declared before the die, since `CheckRequest` carries `onSuccess` and
`onFailure` and the engine picks the branch, which makes fudging structurally unavailable. A
calibration memo maps an engine-derived `ObstacleKey` to the band first used, so a second
attempt at the same lock reuses the remembered band and records a `recalibrated` rewrite.
The key is engine-derived rather than model-supplied, or it would be defeated by paraphrase.
And `routine` and `forlorn` require `justifiedBy` naming a current fact, so difficulty
cannot be invented at whim in either direction. The engine cannot judge whether a
justification is good. It can check the citation exists.

Rolls are pure functions of the seed, the committed log height, the turn id and an index.
No hidden RNG state, exact replay, and since a turn commits in one transaction at the end, a
crash mid-turn leaves the height unchanged and the retry draws the identical die.
Disconnecting to reroll is not policed. It is arithmetically unavailable. The die animation
runs client-side against a roll that is already committed, so interactive dice cost no
second model call.

**3. Malformed and illegal output.** Answered by measurement 1 above. Layer 1 belongs to the
runtime and this design does not re-implement it. `directorContract` asks the configured
server once at boot whether it honours `format`, and the process should refuse to start if
it does not. Layer 2 is the rules engine, and after Layer 1 it is the only place a proposal
can be rejected. The engine's ruling is authoritative and diegetic. It lands in the log, and
`renderCorrections` tells the narrator in plain language what actually happened, so the
prose says it. "You count out your coins and come up four short" is better fiction than a
silent clamp and better table feel than a pause while the DM tries again. Rules-illegal
output is never re-prompted, for the reasons in the synthesis section below.

**4. Two modes, one contract.** One contract, with mode as a first-class discriminant. Two
protocols would duplicate dice, canon, persistence and rulings across two pipelines and
re-litigate the mode decision in each, which is information leakage by the book. Combat is
not a different kind of truth, it is a denser one. See the third load-bearing decision
above.

**5. Persistence.** The append-only event log is the single source of truth. World state is
a fold, the transcript is a projection of `turn-recorded`, and snapshots are opaque
`Uint8Array` with zero authority, so `DELETE FROM snapshots` must be safe. That is what
stops derived state from quietly becoming a second source of truth. Events record outcomes,
not commands. `meter-set` carries the resulting `Meter`, not "apply 6 damage", so when the
rules change next quarter every old session still folds to exactly the state it had.

Context rebuild is a query over state, not a window over history. There is no resume code
path. Turn 1 and turn 400 after a three-day gap build identically, from current Ledger,
scoped dossiers with current Lore, an engine-maintained rolling `Recap` revised by a cheap
background call off the critical path, and the last N exchanges verbatim for voice. Bounded
by construction, not by trimming. A locally hosted model is stateless per request anyway.
This design stops pretending otherwise.

**6. Testing a nondeterministic DM.** The seam is `Director`, two methods, the only module
that knows an LLM exists. Everything else is pure. `assemble`, `adjudicate`, `applyEvent`
and `draw` take no model. The model is a constructor argument, not an import, so the suite
is green without a GPU by construction rather than by mocking.

Four implementations, four kinds of proof. `scriptedDirector` takes raw wire JSON rather
than pre-branded domain objects, so every unit test exercises the real branding boundary for
free, and it is also the only way to test the breach path without a live model.
`replayDirector` plays captured 14B sessions from checked-in fixtures, which is where real
model pathologies become regression tests. `hostileDirector` emits only schema-valid
proposals, because malformed bytes are the runtime's problem and fuzzing them here would be
testing Ollama. It generates against `proposalSchema` itself, so the fuzzer cannot drift
from the contract, and it attacks the arithmetic. The property is total and never mentions
the model's quality. For any sequence of schema-valid proposals, every turn settles,
`invariantsHold(world)` stays true, no breach is raised, and re-folding the log reproduces
the same world. You do not pin down a stochastic collaborator by asserting on what it says.
You assert that nothing it can say matters.

### Interface depth

The public surface is `createEngine`, `Engine` with three methods, `PlayerView`,
`TurnEvent`, `TurnOutcome`, three id constructors, the vocabulary the UI renders, and
`DirectorContractBreach`. Behind it sit canon custody, calibration, seeded dice, clamping,
ruling rendering, context scoping, schema generation, initiative, snapshots, idempotency and
single-writer CAS. No options bag exposes an internal stage and there is no order of calls
to get right. The one thing the caller must supply that looks like a leak, `TurnId`, is not
one. Idempotency is a contract only the caller can uphold. `World`, `Effect`, `Proposal`,
`WorldEvent`, `SceneBrief`, `Refusal` and `Ruling` are all private, so a UI change can never
be blocked on the DM's internal governance.

Concurrency is visible in one signature and resolved in one place, `append(session,
expectedHead, events)`. Two tabs on one session cannot interleave. The loser is rejected and
shown the winner's turn. Per separate-before-serializing-shared-state, there is no shared
mutable state. One log, one writer at a time, enforced by CAS rather than by a lock.

## Synthesis decision

**Base, candidate 1, essentially whole.** It was the only candidate that converts illegal
model actions from caught after the fact into undecodable in the first place, by building
the JSON Schema per turn from live world state so every closed set the engine already knows
becomes an enum the decoder enforces. The other three all validate after the model speaks.
Preventing beats catching. Its module split, its Ledger and Lore column split, its
adjudicate-then-narrate ordering, its event log, and its four Director implementations are
carried across unchanged.

**Graft from candidate 2, the contract breach framing.** Candidate 2 framed a schema-shape
violation as an infrastructure contract breach rather than model behaviour. That framing is
adopted and pushed further than candidate 2 took it. Candidate 1 kept refusal arms for the
Layer-1-unreachable cases, reasoning correctly that the rules engine should not trust the
decoder. Those checks are kept, and they no longer surface as gameplay refusals. They raise
`DirectorContractBreach`, which means the transport is broken or the model was swapped for
one whose runtime does not honour grammar constraints. A player never sees it. An operator
always does, through `EngineDeps.onBreach`. Executing this changed one signature.
`adjudicate` now takes the brief as well as the world, because telling a breach from a rules
event requires knowing what the model was offered, not only what is true.

**Graft from candidate 3, the terminal taxonomy.** The outcomes are named discriminated
unions rather than implicit behaviour. `Ruling` carries `applied`, `rewrite` and `drop` per
proposed effect. `Terminal` carries `resolved`, `asked`, `soft-fail` and `stalled` per turn.
Candidate 1 had equivalent behaviour and did not name the all-dropped terminal case cleanly.
It is named now, and naming it exposed that `asked` and `soft-fail` both produce zero events
and must never be confused.

**Graft from candidate 4, play mode as a first-class discriminant.** `Scene` is
discriminated by `mode`, and `PlayMode` is derived from it rather than inferred from
affordances and initiative. This matters more than candidate 4 argued. Mode determines which
ops are offered, and the op list feeds directly into the per-turn schema, so given
measurement 2 gating the op enum by mode is a correctness feature rather than tidiness.
Candidate 4's own combat state machine, with action economies and armour class, is not
adopted. Rules density is a 14B's error surface.

**Rejected, re-prompting the model on a rules violation.** Candidates 2 and 4 both wanted
it. Candidate 1's argument stands and measurement 2 strengthens it. The structured-output
win came from a forcing function inside the decoder, and semantics has no analogue, so
redrawing from the same sampler against a constraint it does not internally represent is a
coin flip rather than a correction. Measurement 2 shows the model's semantic choice is
precisely the faculty that degrades, so re-prompting asks the degraded faculty to repair
itself. Three further costs. It makes calls-per-turn data-dependent, which makes audit and
replay fixtures brittle. It erases the DM's overreach from the log, and that overreach is the
best quality signal the system has, since a rising `insufficient-coin` rate means the brief
is not showing the purse clearly enough. And it reintroduces one layer up exactly the retry
ladder measurement 1 told us not to build, complete with a cap, a backoff, and a decision
about what the player stares at meanwhile.

**Rejected, candidate 4's two-turn roundtrip for interactive player dice.** The die
animation runs client-side against an already-committed roll. Genuine player agency does not
require a second model call, and a second call would put a model between the stakes and the
outcome, which is the one place this design will not allow one.

**Rejected, candidate 2's structured narration tokens.** Candidate 2 renders entity names
and roll outcomes from accepted state and lets the model write only atmosphere. It is a
sound answer to prose drift and it costs the voice that makes the product worth playing.
Candidate 1's answer, that prose has no authority so being wrong in prose is a quality bug
rather than a correctness bug, buys most of the safety for none of the flatness.

## Tradeoffs accepted

- **A hard cap on `inReach`, in exchange for correctness the metrics cannot see.** Six
  entities is a small room. A crowded tavern will have people in it the DM can describe and
  cannot act on, and that will occasionally read as the DM ignoring someone. We accept that
  in exchange for not stabbing the wrong person 63% of the time. This is the tradeoff most
  likely to be mistaken for an oversight, because everything looks fine without it.
- **Two mint slots per turn instead of four**, in exchange for holding the whole target enum
  at 8. The cost is a DM that cannot introduce three things in one breath.
- **Two model calls per turn instead of one**, in exchange for the model never observing a
  die it can still act on. Latency is measured not to be binding, so this stands purely on
  correctness.
- **The per-turn JSON Schema is generated, so schema generation is load-bearing code.** In
  exchange, whole refusal classes become undecodable rather than merely caught. The cost is
  two build-time assertions, that every `Effect` arm is represented and that the target enum
  never exceeds its bound. Miss the first and an op silently becomes unsayable. Miss the
  second and correctness degrades invisibly.
- **We depend on the runtime honouring `format`, with no fallback**, deliberately, because
  the fallbacks measured 0/8. It is checked once at boot rather than negotiated per turn,
  and failing it should stop the process.
- **A deliberately thin rule set.** Six approaches, one d20, five bands, fourteen effect
  ops, no classes or spell lists, in exchange for a large class of model errors becoming
  unrepresentable. This will look under-featured to anyone who reads the types without
  reading FIXED constraint 3.
- **Rules-illegal effects are rewritten or dropped and then narrated, never re-prompted**,
  in exchange for occasional narration that under-delivers what the DM intended. The
  correction channel makes the prose honest about it. A retry loop would make the audit
  dishonest.
- **The adjudicator keeps checks the schema already makes unreachable.** Looks like dead
  code. It is defence in depth, and routing those checks to a breach channel rather than a
  refusal channel is what stops the defence from corrupting the fiction.
- **Slot-based contradiction detection catches only slot contradictions.** Free-text Lore is
  the price of improvisation, and prose-level consistency is bought upstream by never making
  the model's memory load-bearing, not downstream by a checker that cannot exist.
- **Event log plus derived state means every read is a fold**, in exchange for exact audit
  and replay. Snapshots make it fast and are deliberately authority-free, which looks like
  leaving performance on the table and is actually refusing a second source of truth.
- **No `error` variant in `TurnEvent`.** This hides genuine outages behind fiction, and
  `strained` plus `onBreach` is the honest compensation. Expect this one to be argued about.
- **A third background call for the recap** competes for the same GPU. Accepted because it
  is off the critical path and its failure is a no-op.
- **`engine.ts` orchestrates eight peers**, which is wide. Accepted because the hierarchy is
  flat, every peer is a leaf, and the alternative of nesting them is the deep call chain the
  laziness protocol actually warns about.

## Alternatives considered

- **Narrow the schema and redraw.** The strongest alternative. On `pay 50` against a purse of
  12, regenerate with `maximum: 12` on that field. Unlike re-prompting this is a forcing
  function rather than a plea, so it would actually work. It loses on three counts. It does
  not compose, because `maximum` constrains one field while the case that matters is two
  individually affordable payments in one proposal. It needs a differently shaped schema per
  violation kind, so the generator grows a branch per rule and the rules end up expressed
  twice. And it makes calls-per-turn data-dependent, which is the retry ladder again with
  better manners. The correction channel handles the same case diegetically for no
  machinery.
- **A static schema reused across turns.** Simpler to build and test, and it still buys the
  8/8 shape result. It loses everything the per-turn schema adds. Without live enums,
  out-of-reach targets, off-mode ops and stale fact ids all fall back to being rules checks.
  Given the schema is supplied per request anyway, a static one is strictly less for the same
  price. Measurement 2 complicates this one honestly, since a static schema has no target
  enum to degrade, but it buys that immunity by giving up prevention entirely and a capped
  live enum keeps both.
- **`format: "json"` plus a validation gate.** Rejected by direct measurement. 8/8 parsed,
  0/8 engine-valid. A gate calling `JSON.parse` would have reported perfect health while the
  model omitted the required object every time.
- **One-call turn, prose and effects in a single JSON blob.** The model writes the outcome
  and the mechanics together, so it fudges by construction and there is no moment at which
  stakes are committed but unknown.
- **Tool-calling agent loop**, where the model calls `roll_dice` and `spend_gold` until it
  decides it is done. Hides less than it appears to. The model still decides when to stop,
  the turn has no atomic boundary, idempotency becomes near-impossible, and the tool schema
  is transport sitting on the domain surface.
- **Enumerated action space**, where engine authors declare every legal move and the model
  picks one. Deepest possible validation, trivially testable, and disqualified by the brief.
  This is the menu the product exists not to be. Worth noting that the per-turn schema is
  this idea applied only to references and never to content. Marga's existence is
  unconstrained. Only the set of things already in the room is closed.
- **Two contracts for two modes.** Duplicates dice, canon, persistence and rulings, and puts
  the mode decision in both pipelines. Rejected as information leakage.
- **Mutable state row plus stored transcript, no event log.** Simplest implementation and the
  worst interface. No dice audit, no replay, and two sources of truth to sync by hand
  forever.
- **LLM-as-validator**, a second model call checking the first. A nondeterministic guard on a
  nondeterministic producer, untestable without a GPU, disqualified by FIXED constraint 4,
  and now also by evidence. Both probes found failures that were confident and well-formed,
  which is exactly what a second model is worst at catching.
- **Model-authored entity ids.** Removes the slot-binding machinery at the cost of every
  downstream reference being silently wrong the first time the model misspells one.
  Identity is the one thing custody cannot delegate.

## Open questions and risks

- Is 6 the right cap for `inReach`, and what does `probe-enum.mjs` say about it on the real
  14B on the 4090? The curve between 3 and 10 was never measured, so 6 is interpolation
  between one perfect point and one coin flip. Would you rather ship 4 and widen it on
  evidence, or ship 6 and narrow it?
- The exploration affordance list is thirteen ops, and the only op enum ever measured had
  four members and never degraded. Is a thirteen-member op enum safe, and if the probe says
  it is not, do we split `Move` so each kind carries a shorter op list, or do we cut ops?
- `MAX_CITABLE_FACTS` is 12 by extrapolation and by nothing else. Is a wrong fact citation
  cheap enough to leave unmeasured, or should the enum probe be re-run against citations
  before we trust it?
- Should the player see the target number before the roll, or only the band? Audit argues
  for showing it. Table feel often argues against. Which way?
- A `soft-fail` invites the player to rephrase. Is that the right player experience, or does
  it break the fiction by admitting the DM is a machine that failed? The alternative is to
  narrate a stall beat and say nothing, at the cost of the player repeating themselves.
- Does a contract breach mid-proposal really justify discarding the whole proposal, or should
  the engine honour the effects that were legal and drop only the breaching one? Discarding
  is the current answer, on the grounds that you stop trusting a source that just proved it
  is not the one you configured. That is a judgement call and you may disagree.
- How much does a `warden` content policy belong in this repo at all, given a locally hosted
  unaligned model and a single-player product?

## Next implementation step

Write `adjudicate` for the `narrate` move only, with `Ruling` and `Terminal` returned and
`scriptedDirector` feeding it raw wire JSON, so the rewrite, drop and soft-fail arms are
proven against a real branding boundary with no model and no GPU.
