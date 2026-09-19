# Places and the map

The world has rooms with named exits, and the player occupies one. The map draws only where
they have been, with dashed stubs where they have not. A dungeon can also be generated from
a seed, which is the same feature with the rooms built rather than written.

## Sub-features

- `place-exits` the current room's exits appear as tappable buttons.
- `place-move` choosing one moves the player and the scene changes.
- `place-pinned` movement is refused during combat.
- `place-scope` only people in the current room can be named or can strike.
- `map-grows` the map appears once a second room is known and grows as you explore.
- `map-here` exactly one room is marked current.
- `map-stubs` exits leading somewhere unvisited are drawn as dashed stubs.
- `map-secret` unvisited rooms are absent from the payload, so their names cannot leak.
- `delve-generated` `?scenario=delve&seed=N` builds a dungeon from the seed.
- `delve-stable` the same seed always yields the same dungeon.

## How to get to it (user POV)

- Tap a `ways out` button.
- Type a direction, for example `I go down`.
- Open `/?scenario=delve&seed=20260919` for a generated dungeon.

## Driving it with drive.mjs

Preconditions:

- `PORTALE_DM=wander` for any movement recipe, in either scenario. `scripted` engages on the
  server's first turn, and combat disables every exit button, so a movement proof under
  `scripted` cannot move.
- A server started for this recipe. `wander` picks its exit with `turn % exits.length` and
  that counter is per process, so a second session walks a different route.

- **Exits are offered.** `goto /` then
  `assert "document.querySelectorAll('.exit').length === 2" "the common room has two ways out"`.
- **No map until there is something to map.** `assert "document.querySelector('[data-testid=mapwrap]').hidden === true"`.
- **Moving draws the map.** `click "[data-testid=exit-down]"`, `wait "!document.body.dataset.busy"`, then
  `assert "document.querySelectorAll('#map rect.room').length === 2"` and
  `assert "document.querySelectorAll('#map rect.room.here').length === 1"`.
- **Stubs mark the unexplored.** `assert "document.querySelectorAll('#map line.stub').length >= 1"`.
- **Only what you have seen.** The room count growing from 2 to 3 as you move IS the secrecy
  proof: `project` ships visited locations only, and nulls an exit's destination until you
  have been there, so an unvisited room has no name in the payload to leak.
- **Pinned in combat.** Start a fight, then check the exit buttons are disabled:
  `assert "document.querySelector('.exit').disabled === true"`.
- **A generated delve.** Boot with `PORTALE_DM=wander`, then
  `goto "/?scenario=delve&seed=20260919"`, click `.exit` several times, and assert the map
  reaches three or more rooms, that `.line.move` counts one per move, and that
  `document.querySelectorAll('.ruled').length === 0` while you are only walking.
- **The seed is the dungeon.** No browser needed. Post the same seed twice and a third seed
  once, then compare the opening transcript and exits.

  ```powershell
  $a = Invoke-RestMethod -Method Post -Uri "$base/api/session" -ContentType "application/json" -Body '{"scenario":"delve","seed":20260919}'
  $b = Invoke-RestMethod -Method Post -Uri "$base/api/session" -ContentType "application/json" -Body '{"scenario":"delve","seed":20260919}'
  ($a.view.exits -join ',') -eq ($b.view.exits -join ',')   # True, while $a.id -ne $b.id
  ```

- **Proof.** `shot delve-map` and `dump delve-map`.

## Gotchas

- The scripted DM cannot drive a generated delve. It names the tavern's smuggler and the
  tavern's clock, neither of which exist there, and the engine refuses every turn. That is
  the engine being right and the harness being wrong. Use `PORTALE_DM=wander`.
- `wander` keeps its turn counter per process, like the scripted DM, and it picks its exit
  with `turn % exits.length`. A second session on the same instance therefore walks a
  different route than the first. Restart the server between map recipes, or assert on room
  counts rather than on which room you end in.
- A legal move into an empty room produces no ruling. It used to: `rules.ts` resolved the
  proposal's target for every op, including `move`, which never reads one, so every walk
  printed `The DM reached for a new character but did not say who they were.` If you see
  that line on a movement turn again, the `opReadsTarget` guard has regressed.
- The map layout is a sketch, not a survey. Rooms are placed breadth first from the player
  and collisions nudge sideways, so geometry is approximate and two runs may draw the same
  dungeon slightly differently. Assert on counts and on which room is current, never on
  coordinates.
- `up`, `down`, `in` and `out` are drawn as diagonal nudges because the map is flat. That is
  deliberate.
- A generated delve is a pure function of its seed. If a fixed seed ever produces a different
  dungeon, that is a serious bug, because the database stores only the scenario id and the
  seed. `packages/app/test/mapgen.test.ts` pins it.
- Generated delves always contain at least one loop. A generated dungeon that is a pure
  corridor is a regression; the generator had that bug and a property test now guards it.
- Visited room ids DO ship in the map payload; it is unvisited rooms that are withheld. An
  assert that no `r_` id appears in `innerText` passes because ids are never rendered as
  text, which is a weaker claim than it looks. Assert on the room count instead.
