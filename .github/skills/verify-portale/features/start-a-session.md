# Start a session

Opening Portale drops the player into a scene with an opening narration, full hit points, and
a cast of characters present. Returning to the page continues the same session rather than
starting a new one.

## Sub-features

- `session-new` a first visit creates a session and shows the opening narration.
- `session-vitals` the header shows the player's hit points and the current mode.
- `session-cast` characters present in the scene appear as chips.
- `session-resume` returning to the page continues the same session, transcript intact.
- `session-recover` a session id the server does not recognise silently starts a fresh one
  instead of stranding the player on an error.

## How to get to it (user POV)

- Open `http://127.0.0.1:8787/` in a browser.
- Reload the page while a session is in progress.
- Return to the page later, with the session id still in `localStorage`.

## Driving it with drive.mjs

Preconditions:

- Portale is healthy and `dm` is `scripted`.
- A database file unique to this run, so no earlier session is present.

- **First load.** Open the app. Run `goto /` then
  `wait "document.querySelectorAll('[data-testid=log] .line').length > 0"`. The transcript
  contains the opening narration beginning `Rain hammers the shutters`.
- **Vitals.** Assert the header.
  `assert "document.querySelector('[data-testid=hp]').textContent === '20/20'" "player starts at full health"`
  and
  `assert "document.querySelector('[data-testid=mode]').textContent === 'exploration'" "the scene opens out of combat"`.
- **Cast.** Assert the chips.
  `assert "document.querySelector('[data-testid=cast]').textContent.includes('Marga')" "Marga is present"`.
- **Resume.** Take a turn, then `reload`, then
  `wait "document.querySelectorAll('[data-testid=log] .line').length > 0"`. Assert the earlier
  turn is still there, for example
  `assert "document.querySelectorAll('.roll').length > 0" "the previous roll survived the reload"`.
- **Recover.** Point the page at a session that does not exist. Run
  `goto /` then `type` is not used here; instead run
  `assert "(() => { localStorage.setItem('portale.session','00000000-0000-0000-0000-000000000000'); return true; })()" "planted a stale id"`,
  then `reload`, then
  `wait "document.querySelectorAll('[data-testid=log] .line').length > 0"`. A fresh opening
  narration appears and no error is shown.
- **Proof.** `shot session-opening` and `dump session-opening`. The dump names Portale, the
  hit points, and the opening line.

## Gotchas

- The session id lives in `localStorage`, so a second run in the same browser profile resumes
  the previous session. `drive.mjs` uses a throwaway profile each run, which avoids this. If
  you drive the app by hand, clear `localStorage` first.
- A fresh `PORTALE_DB` does not clear the browser. The page will hold an id the new database
  has never seen, which is exactly the `session-recover` path.
- The opening narration is fixed scenario text, not model output. It appears even with the
  model offline, so its presence does not prove the DM works.
