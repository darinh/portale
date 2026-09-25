# Start a session

A fresh visit opens the title screen. From there, the player can start either scenario,
choose a reproducible delve seed, or resume and delete saved tales. A reload during a tale
resumes the game rather than reopening the title screen.

## Sub-features

- `session-title` a first visit shows the title screen after the saved-tale list renders.
- `session-new-lantern` the Drowned Lantern button starts the hand-authored tale.
- `session-new-delve` the new-delve button starts a generated tale with a random seed.
- `session-new-seeded-delve` entering a seed starts the matching generated tale.
- `session-vitals` a game shows the player's hit points and current mode.
- `session-cast` characters present in the scene appear as chips.
- `session-continue` Continue resumes the newest tale in progress and is hidden when none exists.
- `session-list` every saved tale can be resumed from the list.
- `session-delete` deleting a tale requires two clicks and removes it from the list.
- `session-reload` reloading with a current session resumes its game and transcript.
- `session-recover` an unknown stored session id returns to the title screen instead of
  stranding the player on an error.

## How to get to it (user POV)

- Open `http://127.0.0.1:8787/` in a fresh browser profile.
- Choose **The Drowned Lantern** or **A new delve into the undercroft**.
- Enter a delve seed and choose **Descend**.
- Choose **Tales** during a game, then use **Continue**, **Resume**, **Read**, or **Delete**.
- Reload the page while a session is in progress.
- `POST /api/session`, optionally with `{"scenario": "...", "seed": 123}`. See
  [the API feature](./api.md).
- `node tools/api-cli/run.mjs --serve scripted begin`.

## Driving it with drive.mjs

Preconditions:

- Portale is healthy and `dm` is `scripted`.
- A database file unique to this run, so the saved-tale list starts empty.
- One `drive.mjs` run for the whole recipe, so the browser keeps the same `localStorage`.

- **First load.** Run `goto /`, then
  `wait "document.body.dataset.screen === 'title'"`. Assert
  `assert "!document.querySelector('[data-testid=title]').hidden" "the title screen is visible"`,
  `assert "document.querySelector('[data-testid=continue]').hidden" "Continue is hidden with no tale in progress"` and
  `assert "document.querySelector('[data-testid=saves]').children.length === 0" "the fresh saved-tale list is empty"`.
- **Start the Drowned Lantern.** Run `click "[data-testid=new-lantern]"`, then
  `wait "document.body.dataset.screen === 'game' && document.querySelectorAll('[data-testid=log] .line').length > 0"`.
  The opening narration begins `Rain hammers the shutters`.
- **Vitals and cast.** Assert
  `assert "document.querySelector('[data-testid=hp]').textContent === '20/20'" "the player starts at full health"`,
  `assert "document.querySelector('[data-testid=mode]').textContent === 'exploration'" "the scene opens out of combat"` and
  `assert "document.querySelector('[data-testid=cast]').textContent.includes('Marga')" "Marga is present"`.
- **Reload resumes the game.** Take one turn, wait for `!document.body.dataset.busy`, then
  `reload` and
  `wait "document.body.dataset.screen === 'game' && document.querySelectorAll('.you').length === 1"`.
  Assert
  `assert "document.querySelector('[data-testid=title]').hidden" "reload resumes the game, not the title screen"` and
  `assert "document.querySelector('.you').textContent.includes('strike at Marga')" "the turn survived the reload"`.
- **Continue.** Run `click "[data-testid=menu]"`,
  `wait "document.body.dataset.screen === 'title'"`, then
  `assert "!document.querySelector('[data-testid=continue]').hidden" "Continue is shown for a tale in progress"`.
  Run `click "[data-testid=continue]"`, `wait "document.body.dataset.screen === 'game'"`, then
  assert the earlier `.you` line is still present.
- **Start a random delve.** Run `click "[data-testid=menu]"`,
  `wait "document.body.dataset.screen === 'title'"`,
  `click "[data-testid=new-delve]"`,
  `wait "document.body.dataset.screen === 'game'"`,
  `click "[data-testid=menu]"` and
  `wait "document.body.dataset.screen === 'title'"`. Assert
  `assert "document.querySelector('[data-testid=saves]').children.length === 2" "the random delve was saved"` and
  `assert "document.querySelector('[data-testid=saves] li:first-child').innerText.includes('seed')" "the random delve records its seed"`.
- **Start a seeded delve.** Run
  `type "[data-testid=seed-input]" "20260919"`,
  `click "[data-testid=new-seeded-delve]"`,
  `wait "document.body.dataset.screen === 'game'"`,
  `click "[data-testid=menu]"` and
  `wait "document.body.dataset.screen === 'title'"`. Assert
  `assert "document.querySelector('[data-testid=saves] li:first-child').innerText.includes('seed 20260919')" "the requested delve seed was used"`.
- **Resume from the list.** Run
  `click "[data-testid=saves] [data-testid^=resume-]"`,
  `wait "document.body.dataset.screen === 'game'"`, then assert
  `assert "document.body.dataset.screen === 'game'" "the saved tale resumed"`.
- **Delete from the list.** Run `click "[data-testid=menu]"`,
  `wait "document.body.dataset.screen === 'title'"`, then assert that three tales are listed.
  Run `click "[data-testid=saves] [data-testid^=delete-]"` and
  `assert "document.querySelector('[data-testid=saves] [data-testid^=delete-]').textContent === 'Delete?'" "the first delete click asks for confirmation"`.
  Click the same selector again, wait for the list to contain two tales, then assert that
  `seed 20260919` is absent.
- **Recover from a stale id.** While the title screen is open, run
  `assert "(() => { localStorage.setItem('portale.session','00000000-0000-0000-0000-000000000000'); return true; })()" "planted a stale id"`,
  then `reload` and `wait "document.body.dataset.screen === 'title'"`. Assert
  `assert "!document.body.innerText.includes('Could not start a session')" "a stale id returns to the title screen"`.
- **Proof.** Capture `shot session-title` and `dump session-title` before starting a tale,
  `shot session-resumed` and `dump session-resumed` after the reload, and
  `shot session-saves` and `dump session-saves` after deleting the seeded delve.

## Gotchas

- `document.body.dataset.screen` changes to `title` only after `/api/sessions` has returned
  and the list has rendered. Wait for that value instead of waiting only for
  `[data-testid=title]`.
- `drive.mjs` uses a fresh browser profile for every run. Keep this recipe in one invocation
  because Continue, reload, and stale-id recovery depend on the same `localStorage`.
- A reload with a valid session id resumes the game. Use `[data-testid=menu]` to return to
  the title screen.
- The first Delete click only arms the button and changes its text to `Delete?`. The second
  click deletes the tale.
- The opening narration is fixed scenario text, not model output. It appears even with the
  model offline, so its presence does not prove the DM works.
- An unknown `scenario` or a non-numeric `seed` is refused with 400 rather than falling back
  to the default.
