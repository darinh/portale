---
name: verify-portale
description: Drive the real Portale app and prove behaviour, either through a real mobile-viewport browser or directly against the HTTP API with no browser at all. Portale is a solo tabletop RPG where a locally hosted LLM plays the Dungeon Master. Reach for this before claiming any change to the engine, the API, or the UI works, and whenever a DM change needs proof that the engine still owns game state.
---

# Verify Portale

Portale is a mobile-first web game. A player types what they attempt, a locally hosted model
narrates as Dungeon Master, and the engine owns every mechanical outcome. The surface a user
touches is the browser page. The page talks to the HTTP API; the model sits behind the API and
the page never contacts it.

Three tiers, no dependencies. `packages/app/public/index.html` is the client,
`packages/app/src/server.ts` is the API, and `node:sqlite` is the database. Node 24 runs the
TypeScript directly, so there is nothing to build before you can drive it.

## Launch

If `node --version` does not answer, Node is not on `PATH` in this shell. Prefix it first.

```powershell
$env:Path = "C:\Users\dahoove\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;" + $env:Path
```

Start a disposable instance. Always give it its own port and its own database file so it
cannot collide with another run or with the operator's own session.

```powershell
$env:PORT         = "8787"
$env:PORTALE_DB   = "$PWD\data\verify-$PID.db"
$env:PORTALE_DM   = "scripted"     # omit for the live local model
cd packages/app
node src/server.ts
```

It is ready when it prints `portale listening on http://127.0.0.1:8787`.

`PORTALE_DM` swaps the Dungeon Master for something deterministic. Use one for anything that
asserts on mechanics, because a live model makes a different choice every run and a flaky
proof is not a proof. Drop it only when the thing under test IS the model.

| Value | What it is | Use it for |
| --- | --- | --- |
| `scripted` | fixed proposals, welded to the tavern cast | the hand-authored `lantern` scenario |
| `wander` | reads the brief and picks something legal | generated delves, or any scenario |
| unset | the local model over Ollama | proving the model itself |

`scripted` names Marga and `c_harbourmaster` on every turn. In a generated delve neither
exists, so the engine correctly refuses every turn and you photograph a wall of rulings.
Use `wander` there.

Running against the live model additionally needs Ollama serving and the model pulled.

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\Ollama;" + $env:Path
ollama serve            # if nothing answers on 11434
ollama pull qwen2.5:3b-instruct
```

## Doctor

One read-only call answers whether an instance is worth driving.

```powershell
(Invoke-WebRequest "http://127.0.0.1:8787/api/health" -UseBasicParsing).Content
```

Expect `{"ok":true,"dm":"...","scenarios":["lantern","delve"]}`.

Read `dm` before you trust anything. `scripted` and `wandering` mean mechanics are
deterministic and safe to assert on. `ollama:<model>` means every run differs, so assert on
invariants such as "a roll happened" rather than on specific numbers or wording.

`GET /api/scenarios` says more: each entry carries a `generated` flag. A generated scenario
takes a seed and builds its rooms, so `lantern` is always the same four rooms and `delve` is
a different dungeon per seed.

If it does not answer, check nothing else already owns the port.

```powershell
Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
```

Never drive an instance this run did not start. Another agent or the operator may be using it,
and a turn is a write.

## Drive

`drive.mjs` speaks the Chrome DevTools Protocol over Node's built-in WebSocket, using the Edge
already installed on the machine in a throwaway profile. No Playwright, no browser download.
It emulates a 390x844 phone by default, because Portale is mobile-first and verifying it at
desktop width proves the wrong thing.

```powershell
node .github/skills/verify-portale/drive.mjs --base http://127.0.0.1:8787 --out ./evidence `
  goto / `
  wait "document.querySelectorAll('[data-testid=log] .line').length > 0" `
  shot 01-opening `
  type "[data-testid=utterance]" "I draw my blade and strike at Marga" `
  click "[data-testid=send]" `
  wait "!document.body.dataset.busy" `
  shot 02-after-turn `
  dump 02-transcript `
  assert "document.querySelectorAll('.roll').length > 0" "the engine rolled a die"
```

Steps run in order. `goto`, `wait`, `type`, `click`, `reload`, `shot`, `dump` and `assert` are
the whole vocabulary. Flags are `--base`, `--out`, `--width`, `--height`, `--timeout` and
`--headed`. It exits 0 only when every assert passed, 1 on a failed assert, and 2 if the
browser or the page never came up.

Use these stable handles rather than positions or classes.

| Handle | What it is |
| --- | --- |
| `[data-testid=utterance]` | the text input |
| `[data-testid=send]` | the Act button |
| `[data-testid=log]` | the transcript container |
| `[data-testid=cast]` | the NPC chips |
| `[data-testid=npc-<id>]` | one NPC chip |
| `[data-testid=hp]` | the player's hit points |
| `[data-testid=mode]` | exploration or combat |
| `[data-testid=thinking]` | the DM-is-working indicator |
| `[data-testid=vows]` | the vow tracks, hidden when there are none |
| `[data-testid=vow-<id>]` | one vow; `dataset.boxes` is its progress out of 10 |
| `[data-testid=clocks]` | the open clocks |
| `[data-testid=clock-<id>]` | one clock; `dataset.filled` is its segments |
| `[data-testid=exits]` | the ways out of this room |
| `[data-testid=exit-<dir>]` | one exit button, disabled in combat |
| `[data-testid=leads]` | what the player has discovered, `hidden` until they know something |
| `[data-testid=lead-<id>]` | one discovered clue |
| `[data-testid=mapwrap]` | the map, `hidden` until a second room is known |
| `[data-testid=map]` | the map SVG itself |
| `[data-testid=ending]` | the ending panel, `hidden` while the session is being played |
| `[data-testid=ending-title]` | "Sworn and done" or "You have fallen" |
| `[data-testid=again-lantern]` / `[data-testid=again-delve]` | start a new tale from the ending |
| `document.body.dataset.busy` | present while a turn is in flight |
| `document.body.dataset.mode` | exploration or combat, without reading text |
| `document.body.dataset.outcome` | playing, won or lost |
| `.you` `.dm` `.roll` `.mech` `.ruled` `.move` `.clock` `.vow` `.clue` | transcript line kinds |

Always gate on `!document.body.dataset.busy` after clicking Act. A fixed sleep will pass
before the model has answered and capture an empty screen.

## Evidence

Artifacts go to `--out`, which defaults to `./evidence`. Capture the action and the resulting
state, not just the final screen, and pair every screenshot with a `dump` so the proof is
greppable and does not depend on a human reading pixels.

Proof standards for this app.

- Drive the browser. The HTTP API is convenient and it is not the user's path, so an API-only
  check does not prove the feature works.
- Verify the side effect, not only the screen. A state change must also be in the database,
  because the client renders whatever it was handed.

```powershell
node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync(process.env.PORTALE_DB); console.log(db.prepare('SELECT seq, payload FROM events WHERE session_id = ? ORDER BY seq').all(process.env.SID));"
```

- Prove persistence with a real `reload` step, not by re-reading the API. The server keeps a
  live session in memory, so a reload can appear to work while the database is empty. That
  exact gap hid a real bug once already.
- Use `PORTALE_DM=scripted` whenever an assertion names a number. Against the live model,
  assert on invariants instead.

## Cleanup

Stop only what this run started, by its own process id. Never kill by name, because the
operator may be running their own instance.

```powershell
Stop-Process -Id <the pid you started> -ErrorAction SilentlyContinue
Remove-Item "$PWD\data\verify-*.db" -ErrorAction SilentlyContinue
```

Stop the server before removing its database. On Windows SQLite holds the file open, so a
delete while the process is alive fails silently and leaves scratch state behind.

`drive.mjs` removes its own browser profile from the temp directory and closes the browser it
launched, including on failure.

Evidence survives cleanup. Never delete `--out`.

## Helpers

- `drive.mjs` in this directory is the browser harness. Invocation is shown above.
- `tools/api-cli/run.mjs` talks to the API directly, with no browser. It can boot its own
  throwaway server, so it needs nothing running first. This is the fastest way to answer
  "does the server work", and the only way to assert on status codes.

  ```powershell
  node tools/api-cli/run.mjs --serve scripted smoke      # drive a scenario, assert, exit non-zero on failure
  node tools/api-cli/run.mjs --serve live play           # interactive, against the local model
  node tools/api-cli/run.mjs raw GET /api/sessions       # any endpoint
  ```

- `packages/app/src/client.ts` is the typed client the CLI and the API tests both use. Import
  `portaleClient(baseUrl)` to script against the API from anything else.
- `packages/app/test/api.test.ts` builds a real server on an ephemeral port with a scripted DM
  and covers the error contract, the concurrency guard and restart persistence. Run it with
  `node --test "test/**/*.test.ts"` from `packages/app`.
- `tools/model-probe/` measures whether a model can be trusted to emit engine-valid actions.
  Run it after changing the model, the prompt, or the schema.
- `tools/replay-probe/` scores the DM against a real recorded session. Run it after any
  prompt or schema change, because it catches quality regressions the unit tests cannot see.
  Use `--repeat 3`: one pass is ten turns at temperature 0.85, and on known-good code a
  single pass reports a fatal failure about a third of the time. Comparing two branches by
  one pass each compares coin flips. Baseline at `--repeat 3` is 0/12 violence dropped, 0/6
  fight-over-meta, 26/30 op defensible.
  It never calls `adjudicate`, so a change to `rules.ts` cannot move its score.
- `tools/mutate/run.mjs` proves each engine rule is covered by the test named for it. Run it
  after changing anything in `packages/app/src/rules.ts` or `packages/app/src/app.ts`.

## Feature map

[`features/README.md`](./features/README.md) is the maintained list of what a user can do and
how to prove each one. A proof that drives one convenient entry point is incomplete when the
map lists others.
