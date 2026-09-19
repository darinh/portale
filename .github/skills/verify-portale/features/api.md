# The HTTP API

The API tier is what the browser talks to, and it is the only thing that talks to the model
and the database. It can be driven directly, without a browser, which is the fastest way to
prove server logic and the only way to prove the error contract.

## Sub-features

- `api-health` reports liveness and which DM is wired in, so a harness can refuse to assert
  on a live model.
- `api-scenarios` lists what can be played.
- `api-begin` starts a session, optionally with a chosen scenario and seed.
- `api-turn` takes one turn and returns the updated player view.
- `api-view` returns a session without changing it.
- `api-sessions` lists sessions and how many turns each has taken.
- `api-errors` refuses bad input with the right status instead of a 500 or a silent success.
- `api-concurrency` refuses a second turn while one is already in flight.
- `api-restart` rebuilds a session from its event log when the in-memory cache is cold.
- `api-secrecy` never puts DM-only lore on the wire.

## How to get to it (user POV)

The API is not a user surface, so "user" here is whoever integrates with it. There are three
supported ways in, and all three exercise the same server.

- `node tools/api-cli/run.mjs --serve scripted <command>` boots a throwaway server and talks
  to it. Nothing needs to be running first and no model is required.
- `node tools/api-cli/run.mjs --url http://127.0.0.1:8787 <command>` talks to an instance
  that is already running.
- `portaleClient(baseUrl)` from `packages/app/src/client.ts` is the typed client the CLI and
  the API tests both use.

## Driving it with the api-cli

Preconditions:

- Nothing. `--serve scripted` creates its own server, on an ephemeral port, with a fixed DM
  and a temp database it deletes on exit.
- Use `--serve live` only when the model itself is what you are testing.

- **Smoke the whole surface.** Run
  `node tools/api-cli/run.mjs --serve scripted smoke`. It prints one line per check and exits
  non-zero if any fail. This is the fastest honest answer to "is the server working".
- **Health.** Run `node tools/api-cli/run.mjs --serve scripted health`. `dm` reads `scripted`.
  Against a shared instance it reads `ollama:<model>`, and nothing that asserts on a number
  should run.
- **Begin and turn.** Run `node tools/api-cli/run.mjs --serve scripted --seed 42 begin`, note
  the id, then `turn <id> "I draw my blade and strike at Marga"`. The transcript shows the
  player line, DM narration and a roll.
- **Play by hand.** Run `node tools/api-cli/run.mjs --serve live play` for an interactive
  loop. Type `quit` to leave.
- **Any endpoint.** Run `node tools/api-cli/run.mjs raw GET /api/sessions`, or
  `raw POST /api/session '{"seed":1}'`. It prints the status and body and exits non-zero on
  a non-2xx, which is what makes it usable inside a script.
- **Error contract.** Drive each of these and check the status.

  | Request | Expect |
  | --- | --- |
  | `POST /api/session` with `{"scenario":"atlantis"}` | 400 |
  | `POST /api/session` with `{"seed":"banana"}` | 400 |
  | `POST /api/session/:id/turn` with `{}` | 400 |
  | `POST /api/session/:id/turn` with `{"utterance":42}` | 400 |
  | `POST /api/session/:id/turn` with a body over 16 KB | 400 |
  | `POST /api/session/<unknown>/turn` | 404 |
  | `GET /api/session/:id/turn` | 405 |
  | `GET /api/nope` | 404 with a JSON body, never the index page |
  | `GET /../SECRET.txt` | 403 or 404, never the file |

- **Proof.** The CLI writes nothing. Capture its stdout, which names the endpoint, the status
  and the body for every check.

## Gotchas

- `--serve` gives each run its own port and its own database, so two runs never collide. A
  run against `--url` shares state with whoever else is using that instance, and a turn is a
  write.
- Check `dm` before asserting on any number. A live model chooses a different difficulty,
  narration and op every time.
- A reload is not a restart. The server keeps live sessions in memory, so re-reading through
  the API can be served from the cache while the database is empty. Only stopping the server
  and starting a new one against the same database proves persistence. The API test
  `a session survives a full server restart` is the one that does this.
- The scripted DM is a single shared object that advances per call, so two sessions on one
  server get consecutive script entries rather than the same one. Assert on the die face, not
  on the DC, when comparing two seeded sessions.
- The scripted DM's second entry is deliberately illegal, so every turn after the first
  produces a visible engine ruling. That is intentional and is not a bug to report.
