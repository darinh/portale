# Vows and clocks

The two things that make a session a game rather than a conversation. A vow is why the
player is here. Clocks are the pressure they feel while pursuing it. Both are engine-owned,
both are visible, and the DM may only nominate, never decide.

## Sub-features

- `vow-visible` the player's goal is on screen from the first turn, with a ten-box track.
- `vow-earned` a milestone claim is refused unless the turn actually produced something.
- `vow-rank` rank sets the size of a milestone, so a dangerous vow crawls.
- `vow-kept` a fulfilled vow pays off once and leaves the DM's options.
- `clock-visible` open clocks show as segments and fill as pressure builds.
- `clock-nominated` the DM may advance a clock in play, and cannot invent one.
- `clock-payoff` a full clock fires its consequence exactly once.
- `clock-secret` a secret clock is tracked and never reaches the browser.

## How to get to it (user POV)

- Both appear automatically. There is no control for either; they are consequences of play.
- The vow sits under the header. Clocks sit below the cast.
- Advance a danger clock by being loud, violent or slow. Advance a vow by achieving
  something rather than by talking about it.

## Driving it with drive.mjs

Preconditions:

- `PORTALE_DM=scripted`, whose script ticks `c_harbourmaster` every turn, so clock movement
  is deterministic.
- A server started for this recipe and not yet driven, and a fresh session on it. Every
  `drive.mjs` run gets a throwaway browser profile, so it always starts a new session; what
  it does NOT do is rewind the server's scripted cursor.

- **Both are on screen before anything happens.** Run
  `goto "/?scenario=lantern&seed=4"`, then
  `wait "document.body.dataset.screen === 'game' && document.querySelectorAll('[data-testid=log] .line').length > 0"`, then
  `assert "document.querySelectorAll('#vows .box').length === 10" "ten vow boxes"` and
  `assert "document.querySelectorAll('#clocks .clock').length === 2" "two clocks"`.
- **A clock advances one segment.** Take one turn, then
  `assert "document.querySelector('[data-testid=clock-c_harbourmaster]').dataset.filled === '1'"`
  and `assert "document.querySelectorAll('#clocks .pip.on').length === 1"`.
- **The transcript records it.** `assert "document.querySelectorAll('.line.clock').length === 1"`.
  The line shows the value AT THAT MOMENT, not the current total, which is a bug this code
  has already had once. Take three turns in ONE drive and assert the lines read `1/6`, `2/6`,
  `3/6`; three identical values is the regression.
- **A vow does not move for talk.** Under the live model, say something purely
  conversational and check `[data-testid=vows] .box.on` does not increase. Under the
  scripted DM the script claims no milestone, so the boxes stay empty throughout.
- **Earned progress at the unit level.** The refusal path needs a DM that claims a milestone
  on a turn that achieved nothing, which neither shipped DM does. Prove it with
  `node --test "test/**/*.test.ts"` and `node tools/mutate/run.mjs`.
- **Proof.** `shot clocks-1` and `dump clocks-1`.

## Gotchas

- Clock and vow values in the transcript are REPLAYED from the log, not read from the
  current world. An earlier version read the final value and stamped it on every historical
  line. If you change projection, re-check that the ticks read 1/6, 2/6, 3/6 rather than the
  same number three times.
- Secret clocks exist and are deliberately absent from `PlayerView`. Finding one missing from
  the UI is correct behaviour, not a bug.
- A finished clock and a kept vow leave the DM's enums. That is why a spent threat stops
  being poked, and it means a harness asserting on their presence will fail after completion.
- The vow track is ten boxes of four ticks. A `dangerous` vow marks 8 ticks per milestone, so
  two boxes at a time. Do not assert on tick counts; assert on boxes.
