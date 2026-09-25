# Take a turn

The core loop. The player types what they attempt, the Dungeon Master narrates and decides
what must be rolled, the engine rolls and applies the outcome, and the transcript and cast
update to show what changed.

## Sub-features

- `turn-submit` typing an utterance and choosing Act sends the turn.
- `turn-echo` the player's own words appear in the transcript.
- `turn-narrate` the DM's narration appears as a new line.
- `turn-roll` a die roll appears showing the face, the DC, and success or failure.
- `turn-effect` a successful attack reduces the target's hit points in the cast chips.
- `turn-busy` the Act button is disabled and a working indicator shows while the DM thinks. The
  text box stays enabled so the player can draft the next line.
- `turn-ooc` a line starting `//` reaches the DM as a question and cannot start a fight.
  Live model only, see the gotchas.
- `turn-persist` everything above survives a browser reload.

## How to get to it (user POV)

- Type into the `What do you do?` field and choose `Act`.
- Type into the field and press Enter, which submits the same form.
- Start a line with `//` to ask the DM something without acting in the world.
- `POST /api/session/:id/turn` with `{"utterance": "..."}`. See [the API feature](./api.md).

## Driving it with drive.mjs

Preconditions:

- Portale is healthy and `dm` is `scripted`, so the roll and the damage are deterministic.
- A server started for this recipe and not yet driven. The scripted cursor is per process,
  so a session begun on an already-driven instance does not get script entry one.

- **Submit.** Enter an attempt and act. Run
  `type "[data-testid=utterance]" "I draw my blade and strike at Marga"` then
  `click "[data-testid=send]"` then `wait "!document.body.dataset.busy"`.
- **Echo.** Assert the player's words are present exactly once.
  `assert "document.querySelectorAll('.you').length === 1" "the player's own words appear once"`.
- **Narrate.** Assert the DM spoke.
  `assert "document.querySelectorAll('.dm').length >= 2" "the DM added a line beyond the opening"`.
- **Roll.** Assert the engine rolled.
  `assert "/d20 . \\d+ vs DC \\d+/.test(document.querySelector('.roll').textContent)" "a d20 was rolled against a DC"`.
- **Effect.** Assert the target took damage.
  `assert "!document.querySelector('[data-testid=cast]').textContent.includes('Marga 12/12')" "Marga's hit points changed"`.
- **Persist.** Run `reload` then
  `wait "document.querySelectorAll('[data-testid=log] .line').length > 0"` then
  `assert "document.querySelector('.you').textContent.includes('strike at Marga')" "the turn survived a reload"`.
- **Side effect.** Confirm the database holds the events, not just the screen. Query the
  event log for the session as shown under **Evidence** in the skill. Expect a `said` event,
  a `proposed` event recording what the DM asked for, a `narrated` event, and a `rolled`
  event carrying the same face and DC the screen showed. The `proposed` event is DM
  bookkeeping and must never appear in the transcript.
- **Out of character.** Only assertable against a LIVE model. Send `// did that last one land?`
  and check the roll count did not increase. Under `PORTALE_DM=scripted` this recipe proves
  nothing, because the scripted director returns its next script entry without ever reading
  the schema, so the collapsed op enum cannot affect it. The structural proof is the unit
  test `an out-of-character message cannot start a fight, because engage is undecodable`,
  which asserts the enum has exactly one member.
- **Proof.** `shot turn-after` and `dump turn-after`.

## Gotchas

- Against a live model the roll, the damage, and the wording all vary. Assert that a roll
  happened and that hit points changed, never on specific values.
- On CPU-only hardware a live turn takes 15 to 30 seconds. The harness default timeout is 180
  seconds, which is enough, but a fixed sleep is not.
- The DM may legitimately choose to talk rather than fight, which produces no roll at all.
  That is correct behaviour, so `turn-roll` is only assertable under the scripted DM.
- A violent utterance produces `engage`, which both starts combat AND resolves the blow, so
  the first attack of a fight rolls on the same turn. A harness expecting combat to start
  with no roll is testing the old behaviour.
- The client optimistically shows the player's line before the server replies, then re-renders
  from the server response. Asserting `.you` length before `!document.body.dataset.busy` can
  see the optimistic copy and pass for the wrong reason.
- `turn-effect` asserts the chip is no longer `Marga 12/12` rather than asserting an exact
  value, because a critical hit doubles damage.
- Some phrases are treated as out of character even without the `//` prefix, including any
  line ending in `DM` and anything mentioning a cut-off or repeated message. A test utterance
  that trips one of those will not act on the world.
- The out-of-character guard works by collapsing the schema's op enum, so it only binds a DM
  that reads the schema. The scripted director does not, which means `PORTALE_DM=scripted`
  will happily attack in response to `// hello`. That is the seam behaving as designed, not
  a bug. Drive this one against a live model or trust the unit test.
- Submitting twice quickly returns 409 on the second request rather than queuing it. The UI
  disables the button, so this is only reachable through the API.
