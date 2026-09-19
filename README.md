# Portale

A solo tabletop RPG in the browser, where the Dungeon Master is a locally hosted language
model. Mobile-first, web first.

The DM narrates, runs the NPCs, and decides what you must roll against. It does not decide
what happens. The engine owns every mechanical outcome, so your hit points cannot drift and
the DM cannot forget that you are at 2.

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
$env:PORTALE_DM = "scripted"; node src/server.ts
```

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `PORTALE_DB` | `data/portale.db` | SQLite file |
| `PORTALE_DM` | unset | `scripted` swaps the model for a fixed script |
| `OLLAMA_ENDPOINT` | `http://127.0.0.1:11434/v1` | OpenAI-compatible endpoint |
| `OLLAMA_MODEL` | `qwen2.5:3b-instruct` | model to load |

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
state and passed with the request, so decoding is constrained. An absent target and an
out-of-mode action are not rejected, they are undecodable. Measured at 8/8 engine-valid
against 0/8 for both alternatives.

**Legality** belongs to the engine. A schema-valid proposal can still be illegal, so
`rules.ts` clamps what it can, drops what it cannot, and narrates the ruling rather than
hiding it. The model is never asked to try again. Refusals are telemetry, not an error log.

Dice are a pure function of seed and turn number, so a session replays exactly.

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
node tools/mutate/run.mjs          # proves each rule is covered by its own named test
node tools/model-probe/probe.mjs   # measures whether a model can be trusted
node tools/replay-probe/run.mjs    # scores the DM against a real recorded session
```

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

The browser never reaches the model, and never receives a `World`. It receives a `PlayerView`,
which omits the DM's private lore. `packages/app/src/client.ts` is a typed client for all of
the above, used by both the CLI and the API tests.

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

The vertical slice runs, persists, and is tested. `packages/engine/` holds the fuller design
sketch with unimplemented bodies; it remains the target the slice is growing toward, not dead
code. Combat mode exists in the model and is only lightly exercised.
