# Module map

Eleven files in `packages/app/src`, no build step, no bundler. Node 24 runs the TypeScript
directly, so every relative import carries its `.ts` extension and `tsc` runs only as a
checker. The only package in the tree is TypeScript itself.

Modules are grouped by the knowledge they own, never by when they run. Tracing a question —
"where does damage get clamped?", "who decides the DC?", "what stops the DM stabbing someone
in another room?" — should land in exactly one file.

The whole design is one sentence: **the DM proposes, the engine disposes.** Every module
below is either the proposal side, the disposal side, or the seam between them.

---

## `world.ts`, what a legal world is

**Owns** the domain. `Entity`, `Location`, `Clock`, `Vow`, `Clue`, `World`, the `WorldEvent`
union, and the branded id types that stop a `ClockId` being passed where a `VowId` belongs.
`meter` and `shift` clamp, and `apply` only ever builds hit points through them, so healing past
max cannot happen in a folded world. `Meter` itself is a plain interface, so a hand-built
`{ now: 999, max: 20 }` still typechecks; the guarantee is the reducer's, not the type's.

**Public** `apply`, `fold`, `project`, `presentHere`, `reprisalActor`, `cluesHere`, `unfoundFor`,
`meter`, `shift`, the constructors `entityId` / `locationId` / `clockId` / `vowId` / `clueId`,
`DIRECTIONS`, `VOW_TICKS` and `TICKS_PER_MILESTONE`.

**The obligation that defines this module.** `apply` is total and trusting. It never rejects,
never rolls, never decides. It is handed an event that has already been judged and it folds
it in. That is what makes `fold` a faithful replay: if `apply` could refuse, a replayed log
would diverge from the session it came from.

**`project` is the structural boundary.** It builds `PlayerView`, the only thing the browser
ever receives. The `lore` field is absent, secret clocks are filtered out, undiscovered clues
have no entry, a `ruled` event for a broken transport is left out, and the map carries visited
rooms only, with an exit's destination nulled until you have been there. A field that never
enters `PlayerView` cannot leak. Text is another matter. Lore is what the DM may say about a
character, it is in the prompt, and narration can repeat it; nothing scrubs private prose.

Transcript clock and vow values are replayed from the log with running counters, never read
off the final world. Reading current state while walking history stamps today's number onto
every tick that ever happened, which this code did once.

---

## `dice.ts`, the dice

**Owns** every die roll. `roll` is a pure function of the seed and the event sequence number
the caller passes, which is `world.seq` at the moment of the roll. A session therefore replays
exactly from its log. It does not reproduce from the seed alone: two sessions on one seed roll
differently as soon as their event histories differ, because a clock tick or a ruling moves the
next roll's index. Map generation keeps its own seeded stream in `mapgen.ts`, and new session
seeds come from `Math.random` in `app.ts` and `engine.ts`.

**Public** `seed`, `roll`, `Roll`, `Seed`.

A natural 1 always fails and a natural 20 always hits, regardless of modifier. That lives in
the roll result rather than at the call sites, so no caller can forget it.

---

## `rules.ts`, the only place a proposal can be rejected

**Owns** adjudication. Given a world and a proposal, it decides what actually happened and
returns events plus rulings. This is the file that makes the product's central claim true.

**Public** `adjudicate`, `Ruling`, `Adjudication`, `PLAYER_DEFENCE`.

**Clamp what you can, drop what you cannot, and say so.** A difficulty outside the band is
rewritten rather than refused, because refusing costs the player their turn for the DM's
mistake. A target who is not standing in the player's room is dropped, even when a DM ignores
the schema. Either way the ruling is narrated into the fiction, because a silent correction is
indistinguishable from a bug.

**Every world turn routes through `finish()`.** Reprisals, clock ticks, discoveries, milestone
checks and the end of a fight live there. An earlier version applied them in a trailing loop
that the early returns jumped over, so rulings never reached the log and the screen looked
perfect. Behaviour that must happen on every path belongs on the single path every exit takes.
The one exit that skips it is an out-of-character aside, which is not a turn in the world.

A fight is between the people in the room. It ends in `finish()` once no living hostile stands
where the player is; checking the whole world instead pinned the player beside the first
foe's corpse in most generated delves.

Discovery and milestones are judged against the world as the turn began, the room and the mode
the DM was briefed on, so a clue noticed on the way out still counts and the turn that finds the
last clue still earns ground.

A target is resolved only for ops that read one. The schema forces the target field to be
filled every turn, so on a `move` whatever sits there is noise, and ruling on noise teaches
the player to scroll past rulings.

---

## `director.ts`, the seam, and the shape gate

**Owns** everything about talking to a model, and the brief that decides what the model is
allowed to say in the first place.

**Public** `Director`, `Proposal`, `SceneBrief`, `Target`, `MintSlot`, `briefFor`, `buildSchema`,
`renderPrompt`, `SAMPLING`, `ollamaDirector`, `OllamaOptions`, `scriptedDirector`,
`wanderingDirector`, `DirectorContractBreach`, `isOutOfCharacter`, `stripOocPrefix`,
`OOC_PREFIXES`, `mentions`, `MINT_SLOTS`, `MAX_IN_REACH`, `RECENT_LINES`.

**`buildSchema` is the architecture.** The JSON Schema is rebuilt every turn from live world
state and passed to the model as a decoding constraint. Targets are the people in this room.
Directions are the exits this room actually has. Clocks are the clocks in play. Ops depend on
the mode. An illegal choice is not rejected after the fact, it is **undecodable**. Measured at
8/8 engine-valid against 0/8 for both the unconstrained and JSON-mode alternatives.

**Field order is load-bearing.** Constrained decoding emits properties in declaration order,
so whatever comes first is chosen with the least context and everything after is written to
be consistent with it. `narration` used to be first; the model wrote prose and then picked an
op to match what it had already said. Moving `op` first fixed it.

**The Director is an interface, not a model.** `scriptedDirector` replays fixed proposals and
`wanderingDirector` derives a legal one from the brief, which is what makes the whole suite
runnable with no GPU and no network. Both keep their cursor in a closure, so they are
per-process, not per-session.

---

## `engine.ts`, the turn as a unit of atomicity

**Owns** scenarios and the turn loop. `takeTurn` is the one place a turn happens: build the
brief, ask the Director, adjudicate, fold the events into the session. It does not persist;
`app.ts` appends the turn's events to the store and drops the cached session if that fails.

**Public** `SCENARIOS`, `SCENARIO_IDS`, `scenarioFor`, `begin`, `takeTurn`, `newSeed`, `Session`,
`Scenario`, `TurnResult`, and the authoring shapes `LocationDef`, `ClockDef`, `VowDef`, `ClueDef`.

`scenarioFor` resolves an id to a scenario, generating one from the seed when the id names a
generated scenario. That is why the database stores only an id and a seed: the world is
rebuilt, not reloaded.

---

## `mapgen.ts`, dungeons as a pure function of a seed

**Owns** procedural generation. `generateDelve(seed)` returns an ordinary `Scenario`, so
nothing downstream knows or cares whether the rooms were written or grown.

**Public** `generateDelve`, `DelveOptions`, `OPPOSITE`.

Graph first, prose second. Compact growth, then a spanning tree, then an explicit loop pass,
then a guaranteed bridge. The loop pass is the whole point: a spanning tree is a corridor you
walk down and back, not a place with choices in it. Seven hand-picked seeds passed while 38
of 400 were still trees, which is why the guard is a property test over thousands of seeds
rather than a handful of examples.

---

## `store.ts`, persistence port

**Owns** durability and nothing else. `node:sqlite`, an append-only event log, no ORM.

**Public** `openStore`, `Store`, `StoredSession`.

The log is the truth and the in-memory session is a cache. That is testable rather than
merely asserted: the API suite restarts the whole server and replays from disk. A turn's events
are appended in one transaction, so a failed write leaves nothing of the turn behind, and the
API suite proves that with a trigger that aborts the write halfway.

---

## `app.ts`, the HTTP surface

**Owns** routing, request validation, and the concurrency guard.

**Public** `createApp`, `AppDeps`, `App`, `MAX_BODY_BYTES`, `MAX_UTTERANCE`.

`createApp(deps)` takes the store and the Director as arguments, which is what lets the tests
build a real server on an ephemeral port with a scripted DM and a throwaway database. The
HTTP surface is tested for real rather than mocked.

Body size and utterance length are capped here, and an in-flight guard rejects a second
concurrent turn on the same session rather than interleaving two writes. The guard is per
process and does not deduplicate a retried request: a client that resends a turn after a
dropped connection takes a second turn and rolls again.

---

## `server.ts`, the entry point

Reads environment variables, picks a Director, opens a store, listens. Nothing else. It
exists so `app.ts` has no opinion about configuration and stays testable.

---

## `client.ts`, the typed client

**Owns** the shape of the API as seen from outside. Used by both the API test suite and the
CLI. Its `PlayerView` is the engine's own type from `world.ts`, imported as a type and erased at
runtime, so a typed caller reads exactly what the server sends.

**Public** `portaleClient`, `PlayerView`, `ApiError`, and the response types.

`raw()` is the deliberate escape hatch: it returns status and body untouched, which is the
only way to assert on error contracts the typed methods would throw away.

---

## `demo-script.ts`, a DM that cannot vary

A fixed list of proposals, the second of which is deliberately illegal. The scripted director
repeats its last entry once the script runs out, so every turn after the first exercises the
engine overruling the DM. Without that, the engine-authority proof has nothing to photograph.

---

## Outside `packages/app/src`

| Path | What it is |
| --- | --- |
| `packages/app/public/index.html` | the whole client. Plain HTML, no framework, no build |
| `packages/app/test/` | `node --test` against the real modules, no GPU, no network |
| `tools/model-probe/` | measures whether a model can be trusted to emit valid actions |
| `tools/replay-probe/` | scores DM proposals against a recorded session |
| `tools/mutate/` | deletes each rule and requires the test named for it to fail |
| `tools/playtest/` | plays whole sessions with the wandering DM and counts how they end |
| `tools/api-cli/` | drives the HTTP API directly, booting its own server if asked |
| `.github/skills/verify-portale/` | drives the real app in a real browser over CDP |

`tools/replay-probe/` imports `director`, `engine`, `world` and `dice`, and never calls
`adjudicate`. It measures the model's proposals in isolation, not the played game, so a
change to `rules.ts` cannot move its score.

---

## Dependency direction

Runtime imports only — `import type` is erased under `erasableSyntaxOnly`, so it costs
nothing at load time and is listed separately below.

```
server.ts ──> app.ts ──> engine.ts ──> director.ts ──┐
    │           │            │                       │
    │           │            ├──> rules.ts ──────────┤
    │           │            │       └──> dice.ts    │
    │           │            ├──> mapgen.ts ─────────┤
    │           │            └──> dice.ts            │
    │           ├──> store.ts                        │
    │           ├──> dice.ts                         │
    │           └──> world.ts <──────────────────────┘
    ├──> director.ts
    └──> demo-script.ts
```

Every arrow into `world.ts` is drawn once, at the bottom. `app.ts`, `engine.ts`, `rules.ts`,
`director.ts` and `mapgen.ts` all import values from it.

`world.ts`, `dice.ts`, `store.ts`, `client.ts` and `demo-script.ts` import no module value at
runtime. Nothing in `packages/app/src` imports `server.ts` or `client.ts`; the API suite and
`tools/api-cli` import `client.ts`.

**There is one back-edge, and it is type-only.** `engine.ts` imports the value
`generateDelve` from `mapgen.ts`, and `mapgen.ts` imports `Scenario`, `ClockDef`, `VowDef`
and `LocationDef` back from `engine.ts` as `import type`. TypeScript erases that, so there is
no cycle at load time, but the two modules do define each other's vocabulary: a generated
delve is just a `Scenario`, and `Scenario` is the shape `engine.ts` owns. Read them as a
pair. If the type-only import ever becomes a value import, it becomes a real cycle.

`world.ts` similarly depends on `dice.ts` for `Roll` and `Seed` in the type graph while
importing nothing from it at runtime.

The browser reaches `app.ts` and stops there. It never touches the model, and it never
receives a `World`.
