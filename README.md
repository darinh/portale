# Portale

A solo tabletop RPG in the browser, where the Dungeon Master is a locally hosted language
model. Mobile-first, web first.

The DM narrates, runs the NPCs, and decides what you must roll against. It does not decide
what happens. The engine owns every mechanical outcome, so your hit points cannot drift, the
world hits back, and the DM cannot talk you to your goal.

## Run it

Node 24 or newer. Nothing to build.

```powershell
cd packages/app
node src/server.ts
```

Then open `http://127.0.0.1:8787`.

That expects [Ollama](https://ollama.com) serving locally with a model pulled.

```powershell
ollama serve
ollama pull qwen2.5:3b-instruct
```

To play without a model, run with a fixed script instead.

```powershell
$env:PORTALE_DM = "scripted"; node src/server.ts   # a fixed tavern script
$env:PORTALE_DM = "wander";   node src/server.ts   # reads the brief, works in any scenario
```

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `PORTALE_DB` | `data/portale.db` | SQLite file |
| `PORTALE_DM` | unset | `scripted` or `wander` replace the model |
| `OLLAMA_ENDPOINT` | `http://127.0.0.1:11434/v1` | OpenAI-compatible endpoint |
| `OLLAMA_MODEL` | `qwen2.5:3b-instruct` | model to load |

Start a line with `//` to ask the DM a question without acting in the world.

## Two ways to play

`http://127.0.0.1:8787/` opens the hand-authored tavern.

`http://127.0.0.1:8787/?scenario=delve&seed=20260919` generates a dungeon. Change the seed
for a different one, keep it to replay the same one. The seed is the dungeon, so a link is
shareable and a session rebuilds identically.

## What is in the game

- **A vow.** Ten Ironsworn boxes. The engine refuses a milestone the turn did not earn, and
  while clues remain unfound the only thing that earns one is discovering something. You
  cannot fight your way to knowing who holds the debt.
- **Clues.** Placed in rooms, following the three-clue rule, so no single missed roll can
  strand a session. The DM may only reveal what is in the room you are standing in.
- **Clocks.** Blades in the Dark progress clocks, named for outcomes rather than methods, so
  you can see what is coming and decide whether another attempt is worth the risk.
- **Places.** Rooms with named exits, and a map that draws only where you have been, with
  dashed stubs where you have not.
- **Generated dungeons.** Graph first, with an explicit loop pass, because a spanning tree is
  a corridor you walk down and back rather than a place with choices in it.
- **A world that fights back.** Hostiles strike at you every round of combat. You can lose.
- **Rulings you can read.** When the engine overrules the DM it says so in the fiction.

## Shape

Three tiers and no dependencies. The only package in the tree is TypeScript, for typechecking.

```
client    packages/app/public/index.html   plain HTML, no build step
API       packages/app/src/app.ts          node:http, the only thing that talks to the model
entry     packages/app/src/server.ts       reads env, listens, nothing else
database  packages/app/src/store.ts        node:sqlite, append-only event log
```

The browser never reaches the model, and never receives a `World`. It receives a `PlayerView`,
which omits the DM's private lore.

## How the DM is kept honest

Two layers stand between the model and the world, and they are not variations of each other.

**Shape** belongs to the runtime. The JSON Schema is built fresh each turn from live world
state and passed with the request, so decoding is constrained. An absent target, an
out-of-mode action, a direction with no door, a clock that does not exist and a vow you never
swore are not rejected, they are undecodable. Measured at 8/8 engine-valid against 0/8 for
both alternatives.

**Legality** belongs to the engine. A schema-valid proposal can still be illegal, so
`rules.ts` clamps what it can, drops what it cannot, and narrates the ruling rather than
hiding it. The model is never asked to try again. Refusals are telemetry, not an error log.

The division holds everywhere. The DM proposes a difficulty; the engine clamps it. The DM
nominates a clock; the engine decides how far it moves. The DM claims a milestone; the engine
checks whether the turn earned one. The DM never chooses whether the world strikes back.

Dice are a pure function of seed and turn number, so a session replays exactly.

Every DM proposal is recorded as a `proposed` event, never shown to the player. Without it
the log cannot answer why a session went wrong, which is a question that has come up more
than once.

## Develop

```powershell
cd packages/app
npm install                       # typescript, for typechecking only
node --test "test/**/*.test.ts"   # no GPU and no model needed
npx tsc --noEmit
```

The Director is a constructor argument, which is what makes the suite runnable on a machine
with no GPU. The API tier is the same: `createApp(deps)` builds a server you can start on an
ephemeral port with a scripted DM and a throwaway database, so the HTTP surface is tested for
real rather than mocked.

```powershell
node tools/mutate/run.mjs            # proves each rule is covered by its own named test
node tools/playtest/run.mjs          # plays 200 seeds of each scenario and counts the endings
node tools/model-probe/probe.mjs     # measures whether a model can be trusted
node tools/replay-probe/run.mjs --repeat 3   # scores the DM against a real recorded session
```

The playtest plays whole sessions with the model-free wandering DM and reports how many were
won, lost, stuck or ran out of turns. `--app` points it at another checkout, so one command
measures a before and an after.

One replay pass is ten turns at temperature 0.85. On known-good code a single pass reports a
fatal failure about a third of the time, so compare branches at equal repeated sample sizes
rather than one pass each.

## Talk to the API directly

`tools/api-cli/` is a direct line to the server, no browser involved. It can boot its own
throwaway instance, so there is nothing to start first.

```powershell
node tools/api-cli/run.mjs --serve scripted smoke      # drive a scenario and assert the basics
node tools/api-cli/run.mjs --serve live play           # interactive, against the local model
node tools/api-cli/run.mjs --url http://127.0.0.1:8787 health
node tools/api-cli/run.mjs raw GET /api/sessions       # anything else
```

`--serve scripted` needs no model at all. `raw` prints the status and body and exits non-zero
on failure, which is what makes it usable in a script.

### Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/health` | liveness, and which DM is wired in |
| `GET` | `/api/scenarios` | what can be played |
| `GET` | `/api/sessions` | sessions and their turn counts |
| `POST` | `/api/session` | start one. Optional `scenario` and `seed` |
| `GET` | `/api/session/:id` | the player's view |
| `POST` | `/api/session/:id/turn` | take a turn. Body `{ "utterance": "..." }` |

`packages/app/src/client.ts` is a typed client for all of the above, used by both the CLI and
the API tests.

## Verify

`.github/skills/verify-portale/` drives the real app in a real mobile-viewport browser over
CDP, with no Playwright and no browser download. See its feature map for what to prove and how.

## Documents

- [`docs/design/dm-contract.md`](docs/design/dm-contract.md) is the architecture and why it is
  shaped this way.
- [`docs/design/module-map.md`](docs/design/module-map.md) is what each module owns.
- [`decisions.tsv`](decisions.tsv) is the decision trail, including a retracted finding.
- [`tools/model-probe/README.md`](tools/model-probe/README.md) is the measurement evidence.

## State of things

The game runs, persists, and is tested. Everything that runs is in `packages/app/`;
[`docs/design/module-map.md`](docs/design/module-map.md) is a file-by-file map of it.

Known gaps. There is no rest, no inventory, and no progression beyond the vow track.
Generated delves reuse one prose table, so they vary in shape more than in voice.
