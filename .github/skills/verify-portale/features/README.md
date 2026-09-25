# Portale verification map

This directory is the maintained source for verifying what a player can actually do in
Portale. Read this index before driving the app, then use the matching feature file as the
recipe.

## Baseline preconditions

- Start Portale with a disposable database and a port this run owns. See **Launch** in
  [`../SKILL.md`](../SKILL.md).
- Set `PORTALE_DM` for anything that asserts on a number. A live model chooses differently
  every run and a flaky proof is not a proof. Use `scripted` in the `lantern` scenario and
  `wander` in a generated delve, where the script's cast does not exist.
- Set `PORTALE_DB` to a path unique to this run so concurrent runs do not share state.
- Run the doctor call and require `ok:true` and the `dm` you expected.
- Never drive an instance this run did not start. A turn is a write.

## Driving conventions

- Two harnesses, and they answer different questions. Use `drive.mjs` when the question is
  about the browser. Use `tools/api-cli/run.mjs` when the question is about server logic,
  because it is faster, needs no browser, and can assert on status codes the UI hides.
- Drive the browser through `drive.mjs` for anything a player sees. The HTTP API is not the
  user's path for UI claims.
- Emulate a phone. The harness defaults to 390x844 and the app is mobile-first.
- Prefer the `data-testid` handles listed in the skill over CSS classes or DOM position.
- Gate on `!document.body.dataset.busy` after clicking Act. Never use a fixed sleep.
- Start each recipe from a fresh server, not merely a fresh session. `scripted` and `wander`
  both keep their cursor in the director object, which `server.ts` builds once per process,
  so a second session on the same instance starts mid-script. Clearing `localStorage` gives
  you a new session; only a restart gives you turn one.
- Pair every screenshot with a `dump` so the proof is greppable.

## Proof and skip reporting

- Capture the action and the resulting state, not only the final screen.
- Prove a state change in the database as well as on screen. The client renders whatever it
  was handed, so the screen alone does not prove the engine did anything.
- Prove persistence with a real `reload` step. Re-reading the API can be served from the
  server's in-memory session while the database is empty.
- Against a live model, assert on invariants such as "a roll happened" rather than on
  specific numbers or wording.
- Report an unreachable path with the attempted command and the unmet precondition. Do not
  report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible
behaviour. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behaviour.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with drive.mjs` starts with `Preconditions:` and pairs each user action with
   an exact command and an observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [The HTTP API](./api.md) covers every endpoint, the error contract, concurrency, restart
  and secrecy. Drive this first when the question is whether the server works.
- [Start a session](./start-a-session.md) covers first load, the opening scene, resuming an
  existing session, and recovery from a stale session id.
- [Take a turn](./take-a-turn.md) covers the core loop of utterance, narration, dice, and the
  resulting state change, plus out-of-character messages.
- [Engine authority](./engine-authority.md) covers the engine overruling the Dungeon Master,
  which is the product's central claim and the thing most likely to regress silently.
- [Vows and clocks](./vows-and-clocks.md) covers the goal track and the pressure clocks: what
  is shown, what the DM may nominate, and what the engine refuses.
- [Places and the map](./places-and-map.md) covers rooms, exits, movement, the map that draws
  only what you have seen, and procedurally generated delves.
- [Clues and what you know](./clues.md) covers discoverable information, the panel that
  collects it, and the rule that a vow advances on learning rather than on winning.
- [Endings](./endings.md) covers winning by keeping every vow, losing by falling, the refusal of
  any further turn, and starting a new tale from the ending.
