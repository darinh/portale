# Endings

A session ends. Keeping every vow wins it and a fallen hero loses it. Either way the engine
refuses any further turn, the page replaces the text box with an ending, and the player can start
a new tale from there. The outcome is derived from the world every time, never stored, so it
cannot disagree with what happened.

## Sub-features

- `end-won` keeping every vow ends the session in victory, shown as "Sworn and done".
- `end-lost` a fallen hero ends the session in defeat, shown as "You have fallen".
- `end-refused` a turn on an ended session is refused with 409 and the outcome, and nothing is
  recorded, not even the words.
- `end-persist` the ending survives a reload and a server restart, because it is derived from the
  log.
- `end-again` the ending offers a new tavern session or a new random delve, and a reload after
  that resumes the new tale rather than the link that started the old one.

## How to get to it (user POV)

- Play until the vow track is full, or until your hit points reach zero.
- Reload the page on a finished session to see the ending again.
- Tap "Return to the Drowned Lantern" or "Descend into a new delve" on the ending.

## Driving it with drive.mjs

Preconditions:

- `PORTALE_DM=wander`, and a server started for this recipe. The wandering DM keeps its turn
  counter in the process, so the seeds below only reproduce on a fresh server.
- The utterance `I press on.` on every turn. The wandering DM ignores what is said except that a
  line starting with `//` is an aside.
- Delve seed 101 is won on turn 20. Tavern seed 1438 is lost on turn 3. Both were found with a
  search over seeds 1 to 3000 and are properties of the current rules; re-find them if the rules
  change.

- **Win.** `goto "/?scenario=delve&seed=101"`, then twenty rounds of
  `type "[data-testid=utterance]" "I press on."`, `click "[data-testid=send]"`,
  `wait "!document.body.dataset.busy"`. Then
  `assert "document.body.dataset.outcome === 'won'"`,
  `assert "document.querySelector('[data-testid=ending-title]').textContent === 'Sworn and done'"` and
  `assert "document.querySelector('[data-testid=act]').hidden"`.
- **The ending persists.** `reload`, `wait "document.body.dataset.outcome === 'won'"`,
  `assert "!document.querySelector('[data-testid=ending]').hidden"`.
- **Play again.** `click "[data-testid=again-delve]"`, `wait "document.body.dataset.outcome === 'playing'"`,
  `assert "location.search === ''"`, then `reload` and assert no `.you` line exists, which proves the
  reload resumed the new delve and not the won one.
- **Lose.** On a fresh server, `goto "/?scenario=lantern&seed=1438"`, three turns as above, then
  `assert "document.body.dataset.outcome === 'lost'"`,
  `assert "document.querySelector('[data-testid=ending-title]').textContent === 'You have fallen'"` and
  `assert "document.querySelector('[data-testid=exits]').children.length === 0"`.
- **The refusal is server-side.** POST a turn to the ended session directly and require
  `409 {"error":"this session has ended","outcome":"won"}`. The UI hiding the text box proves
  nothing about the engine.
- **The database.** The won session holds exactly one `fulfilled` event and twenty `said` events,
  and no events after the refused turn.
- **Proof.** `shot` and `dump` at the ending, before and after the reload.

## Gotchas

- `document.body.dataset.outcome` is the stable handle. The mode chip still reads `defeated` for a
  fallen hero, as it did before endings existed.
- The ending hides the form and the exits. A recipe that types after the ending times out waiting
  for an element that is hidden, not missing.
- A scenario with no vows is never won by default. It can only be lost.
- The ending buttons strip the query string. That is what lets a reload resume the new tale; a
  recipe asserting on `location.search` after them should expect it empty.
