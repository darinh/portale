<!--
Sync Impact Report
Version change: template -> 1.0.0 (first ratification)
Principles defined: I. The DM Proposes, The Engine Disposes; II. Shape Is Undecodable, Legality Is
Adjudicated; III. The Event Log Is The Only Authority; IV. The Player Sees A Projection; V. Every Rule
Has Its Own Named Test; VI. Prove It On The Real Surface; VII. Zero Dependencies, No Build
Added sections: Additional Constraints, Development Workflow
Removed sections: none
Templates: .specify/templates/tasks-template.md updated (tests are mandatory, not optional);
plan-template.md and spec-template.md need no change (the Constitution Check reads this file)
Deferred: none
-->

# Portale Constitution

## Core Principles

### I. The DM Proposes, The Engine Disposes (NON-NEGOTIABLE)

The model's output is a proposal and never a decision. Every mechanical outcome MUST be decided by
engine code: rolls, hit points, damage, clock segments, vow progress, discoveries, items, experience,
levels, movement, and whether a session has ended. Adjudication is the only place a proposal may be
accepted, rewritten or dropped. The DM MUST NOT choose whether the world strikes back. Every rewrite
or drop MUST emit a `ruled` event that the player reads in the fiction, because a silent correction
is indistinguishable from a bug.

### II. Shape Is Undecodable, Legality Is Adjudicated

The response schema MUST be rebuilt every turn from live world state. Any choice the engine can
enumerate (targets, exits, clocks, vows, clues, items, ops by mode) MUST be a closed enum, so an
illegal choice cannot be decoded rather than being rejected afterwards. Mechanics fields MUST precede
`narration` in the schema, because constrained decoding commits in declaration order. The engine MUST
NOT ask the model to try again. A transport failure settles the turn with a diegetic stall and a
recorded breach.

### III. The Event Log Is The Only Authority

`apply` MUST stay total and trusting: it never validates, rolls or decides. A session MUST rebuild
by folding its stored events, and the store MUST persist only identifiers, seeds and events, never
derived state. Dice and procedural generation MUST be pure functions of seed and sequence, so a
replayed log reproduces the world exactly. State that spans sessions (a character, a campaign) obeys
the same rule.

### IV. The Player Sees A Projection

`project` builds `PlayerView`, and it MUST be the only game state that crosses HTTP. DM-only lore,
secret clocks, undiscovered clues and items, and unvisited rooms MUST NOT enter it. A field that
never enters the projection cannot leak.

### V. Every Rule Has Its Own Named Test

Tests are mandatory. A rule counts as covered only when deleting it makes the test named for it fail,
which `tools/mutate/run.mjs` checks one rule and one named test at a time. A new test MUST fail
against the unfixed source before it is trusted, and its fixture MUST contain the adversarial detail
its name claims. The suite MUST run with no GPU and no network.

### VI. Prove It On The Real Surface

A change is done when it has been driven through the real app: the browser through
`.github/skills/verify-portale/` for anything a player sees, `tools/api-cli` for server behaviour.
The side effect MUST also be checked in the database, and persistence MUST be proven by a real reload
or restart. Assertions that name a number MUST use a deterministic director (`scripted` or `wander`).
Against the live model, assert invariants only.

### VII. Zero Dependencies, No Build

Node 24 runs the TypeScript directly. The only package is TypeScript, for typechecking. The client is
plain HTML with no framework and no bundler. Adding a runtime dependency or a build step requires an
amendment to this constitution.

## Additional Constraints

- The production DM is a small local model (`qwen2.5:3b-instruct` through Ollama). A design that only
  works on a larger model is not done.
- Mobile first. The reference viewport is 390x844.
- One turn in flight per session. Request bodies and utterances are capped at the HTTP boundary.
- The browser never talks to the model and never receives a `World`.

## Development Workflow

- All work happens in a git worktree under `.worktrees/`, on a `feat/`, `fix/`, `docs/`, `test/` or
  `chore/` branch, merged into `main` with `--no-ff`. Conventional commits.
- `decisions.tsv` gets a row for every real decision, with evidence a reviewer can re-run.
- `docs/design/module-map.md` MUST match the live exports, and the verify-portale feature map MUST
  list every user entry point.
- Specifications live under `specs/`. After implementation a spec describes what IS, with file and
  symbol references, never what should be.

## Governance

This constitution supersedes other practice in this repository. An amendment is a branch that edits
this file and every dependent template in the same change, with a Sync Impact Report. Versioning is
semantic: MAJOR for removing or redefining a principle, MINOR for adding one or materially expanding
guidance, PATCH for wording. Every plan runs the Constitution Check before design and again after
it, and every merge is reviewed against these principles.

**Version**: 1.0.0 | **Ratified**: 2026-09-24 | **Last Amended**: 2026-09-24
