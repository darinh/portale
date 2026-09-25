# Clues and what you know

Discoverable information placed in rooms. Finding one is what moves a vow forward, so the
player progresses by learning things rather than by winning fights. A "what you know" panel
collects what has actually been found; everything else is invisible until it is discovered.

## Sub-features

- `clue-hidden` an undiscovered clue is absent from the payload, not merely unrendered.
- `clue-found` a discovery adds a line to the transcript and an entry to what you know.
- `clue-scoped` the DM may only reveal a clue in the room the player is standing in.
- `clue-once` a clue already found cannot be revealed again.
- `clue-gates-vow` while a vow has clues outstanding, only a discovery advances it.
- `clue-fallback` once every clue is found, the vow advances on action again.
- `clue-no-search-in-combat` discoveries are undecodable while a fight is on.
- `clue-generated` a generated delve places three clues in three distinct rooms.

## How to get to it (user POV)

- There is no control. Search, look, ask, or go somewhere new, and the DM reveals what is
  there to find.
- The panel under the clocks appears the moment you know something, headed
  `what you know (N)`.

## Driving it with drive.mjs

Preconditions:

- `PORTALE_DM=scripted` in the lantern. Script entry one reveals `c_ledger_page`, which is
  in the opening room; the repeating entry names `c_manifest`, which is three rooms away,
  so the harness gets a legal discovery and a refusal without any model.
- A server started for this recipe, because the scripted cursor is per process.

- **You start knowing nothing.** Run `goto "/?scenario=lantern&seed=4"`, then
  `wait "document.body.dataset.screen === 'game' && document.querySelectorAll('[data-testid=log] .line').length > 0"` and
  `assert "document.querySelector('[data-testid=leads]').hidden === true"` and
  `assert "!document.body.innerText.includes('torn ledger page')"`.
- **A discovery lands as the fight starts.** Drive
  `type "[data-testid=utterance]" "I grab for the ledger and square up to her"`,
  `click "[data-testid=send]"` and `wait "!document.body.dataset.busy"`. Then
  `assert "document.querySelectorAll('.lead').length === 1"`,
  `assert "document.querySelectorAll('.line.clue').length === 1"` and
  `assert "document.body.innerText.includes('torn ledger page')"`. Also assert
  `document.body.dataset.mode === 'combat'`. The turn a fight starts keeps the discovery
  because the DM received its brief out of combat.
- **Nothing is findable during a fight.** Drive
  `type "[data-testid=utterance]" "I rummage behind the bar while she swings"`,
  `click "[data-testid=send]"` and `wait "!document.body.dataset.busy"`. Then
  `assert "document.body.innerText.includes('no time to go looking')"`.
- **Evidence from elsewhere is refused out of combat.** Run
  `click "[data-testid=menu]"`, `wait "document.body.dataset.screen === 'title'"`,
  `click "[data-testid=new-lantern]"` and
  `wait "document.body.dataset.screen === 'game' && document.querySelectorAll('[data-testid=log] .line').length > 0"`.
  The server's scripted cursor stays on its repeating entry, but the new session starts in
  exploration. Run `type "[data-testid=utterance]" "I search the common room"`,
  `click "[data-testid=send]"` and `wait "!document.body.dataset.busy"`. Then
  `assert "document.body.innerText.includes('not something you could have found here')"`,
  and
  `assert "!document.body.innerText.includes('signed for by a name')" "the refused clue text did not leak"`.
- **The vow does not move for a fight.** The scripted DM claims no milestone, so assert the
  vow boxes stay empty across several combat turns. The engine-level proof of the gate is
  `while clues remain unfound a vow advances only on discovery` in the unit suite.
- **A generated delve has clues.** Boot with `PORTALE_DM=wander`, open
  `/?scenario=delve&seed=20260919`, and walk. `wander` reveals whatever is in the room, so
  leads accumulate as you explore.
- **Proof.** `shot clues-found`, `dump clues-found`, and the same pair for the refusal.

## Gotchas

- `leads` is built by filtering `w.clues` on `found`, so an undiscovered clue has no entry
  at all rather than an entry with its text blanked. Asserting the text is missing from
  `innerText` is the weaker check; the payload assertion is the real one.
- The gate is per vow, not global. A vow with every clue found falls back to the ordinary
  earned-something test, so a move CAN advance it at that point. A harness asserting "a
  move never advances a vow" will pass early in a session and fail late in one.
- The scripted DM reveals on every turn, including the illegal one. That is deliberate, so
  the refusal path is always reachable. Do not read the repeated `clue-elsewhere` ruling as
  a bug.
- Script entry one starts combat. To observe `clue-elsewhere`, consume that entry in the
  first session, then start a second lantern session on the same server. The repeated entry
  then runs while the new session is still in exploration.
- A generated delve places its three clues in `elsewhere`, which excludes the entrance. A
  recipe that only looks around the first room of a delve will find nothing and is not
  evidence that generation is broken.
- Clue ids are stable strings per scenario (`c_ledger_page`, `c_crate_mark`,
  `c_boot_prints`, `c_manifest` in the lantern; `c_lead_1..3` in a delve), so a `data-testid`
  of `lead-<id>` is a safe handle.
- The refusal reasons are ordered, and the order is deliberate. `no-searching-mid-fight`
  fires before the clue is resolved at all, so in combat you get "no time to go looking"
  even if the clue named was also in another room. A recipe expecting `clue-elsewhere`
  during a fight will fail; that is the rule working, not drift.
- The mid-fight rule reads the mode at the START of the turn, which is the mode the DM was
  briefed on. So a turn that both begins a fight and reveals something keeps the discovery.
  That asymmetry is intentional and has its own test and mutant; do not "fix" it.
