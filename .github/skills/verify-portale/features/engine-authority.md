# Engine authority

The product's central claim. The Dungeon Master narrates, but it never decides mechanics. The
engine rolls the dice, applies the damage, and overrules the DM when it proposes something the
rules do not allow. If this regresses the game still appears to work, which is why it needs
its own proof.

## Sub-features

- `authority-dice` the die is the engine's, seeded and replayable, never the model's invention.
- `authority-clamp` a difficulty outside the allowed band is rewritten and the player is told.
- `authority-drop` an illegal intent never becomes an event, for example attacking the dead.
- `authority-cap` damage beyond the cap is rewritten rather than trusted.
- `authority-undecodable` an action the mode does not allow is never offered to the model at
  all, so it cannot be proposed.
- `authority-settle` the turn still settles when the model is unreachable.
- `authority-secrets` DM-only lore never reaches the browser.

## How to get to it (user POV)

- Play any turn. The ruling appears in the transcript as an italic line.
- There is no user control for this. It is enforced on every turn.

## Driving it with drive.mjs

Preconditions:

- Portale is healthy. Several of these are provable only at the unit level, and that is noted
  per bullet rather than skipped.

- **Dice are the engine's.** Drive one turn under the scripted DM and read the roll line. Then
  query the event log and confirm a `rolled` event exists whose `roll.face` matches the screen.
  The scripted DM proposes no outcome, so a roll on screen can only have come from the engine.
- **Replayable.** Start two sessions with the same seed by posting `{"seed":42}` and drive the
  same utterance in each. The roll lines match. This is the user-visible half of the property
  that `packages/app/test/engine.test.ts` proves directly.
- **Clamp, visible to the player.** Under the scripted DM, turn one is a legal attack and
  every turn after it proposes difficulty 30 and damage 999, both illegal. Drive two turns,
  then
  `assert "document.querySelectorAll('.ruled').length > 0" "the ruling reached the transcript"`
  and
  `assert "document.body.innerText.includes('the table settles on 25')" "the player was told"`.
  The roll line on that turn must read `DC 25`, not `DC 30`.
- **Clamp, drop, cap at the unit level.** The remaining rule paths need a DM that misbehaves
  in ways the script does not cover. Prove them with `node --test "test/**/*.test.ts"` in
  `packages/app`, and prove the tests themselves are real with `node tools/mutate/run.mjs`,
  which deletes each rule and requires the test named for it to fail.
- **Undecodable.** Assert the mode gate holds on screen.
  `assert "document.querySelector('[data-testid=mode]').textContent === 'exploration'" "scene is out of combat"`.
  The attack op is absent from the schema in exploration, so the model cannot propose one. The
  schema itself is asserted in the unit suite.
- **Settle.** Stop Ollama, then drive a turn against a live-model instance. The transcript gains
  a line beginning `The tale falters` and the input becomes usable again. The turn must not hang
  and the page must not show a raw error.
- **Secrets.** Assert DM-only lore is absent.
  `assert "!document.body.innerText.includes('owes the harbourmaster')" "DM-only lore is not in the page"`.
  That string is Marga's private lore and exists only in the server's world.
- **Proof.** `shot authority-ruling` and `dump authority-ruling` on the second scripted turn,
  which produces a `.ruled` line, plus the test and mutation output.

## Gotchas

- This feature is mostly invisible when it works. A green screen proves nothing here, which is
  why the unit suite and the mutation run are part of the proof rather than an alternative to it.
- An earlier build decided every ruling correctly and then discarded it, because the rulings
  were converted to events in a trailing loop that the early returns jumped over. The screen
  looked perfect. Assert that the `.ruled` line is present, never merely that no damage landed.
- The scripted DM deliberately bypasses the schema, since it does not go through the model. That
  is what makes it able to propose illegal actions and exercise the rules layer. Do not read a
  scripted illegal proposal as evidence the schema failed.
- `authority-settle` requires actually stopping Ollama. Pointing at a wrong port tests a
  different failure path, connection refused rather than an unreachable model.
- Do not assert on the exact wording of a ruling. The detail strings are player-facing prose and
  are expected to change.
