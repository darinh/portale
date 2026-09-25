# Portale target architecture

## Problem

Portale is a working one-scenario loop. A 3B local model proposes. Engine code disposes. An event log replays. The browser sees a projection. That loop is the product. It cannot currently be a D&D campaign. A character is hit points and a power number. Every roll is a naked d20. The DM still names damage. A session is one scenario rebuilt from an id and a seed. A filled danger clock is a flag plus flavor text. Vow progress can demand a DM milestone on the same turn as a discovery, so the last clue does not count (review-logic §1). A retried turn rolls again (review-claims §2).

The new game needs 2024 rules from SRD 5.2.1 (research-rules §1), twelve SRD classes plus an original thirteenth class in the Artificer fantasy (research-rules §4), campaigns made of modules, replacement heroes, and a forge that cannot drift from the engine. The production DM is still `qwen2.5:3b-instruct`. Every extra schema field is a chance for it to pick wrong. The constitution still binds. Zero runtime dependencies. No build step. `apply` stays total and trusting.

The non-obvious shape is how to grow the rules without growing the model's job, and how campaign files stay frozen under a save without introducing a second source of truth.

## Usage (caller's view)

Install nothing. Node 24 runs the files.

Game, one declared attack.

```ts
const pin = loadCampaignFile(harbourJson);
const view = await playOneTurn(store, director, pin, fighterDraft, {
  kind: 'act',
  act: { kind: 'attack', weapon: itemInstanceId('w_longsword'), target: entityId('e_marga') },
});
```

The player tapped Attack. The engine rolled against Marga's AC from her stat block, rolled longsword damage from the item, and ran her attack from that block. The director only wrote narration. `view.you.ac` came from `derive`, not from a stored field.

Free text is the other door.

```ts
await applyCommand(store, director, {
  kind: 'turn',
  save: save.id,
  turn: turnId('t2'),
  intent: { kind: 'utter', text: 'I search the crates' },
});
```

The schema still has no `damage` and no integer DC. The model picks `actKind`, a skill, a DC band, a clue in this room, maybe a clock. The engine maps the band through `DC_OF` and the skill through the sheet.

HTTP is a parse, then that command.

```http
POST /api/saves/{id}/turns
{ "turnId": "t2", "intent": { "kind": "utter", "text": "I search the crates" } }
```

The response is `PlayerView`. Never a `World`. A repeated `turnId` returns the first result. It does not roll again.

Reload.

```ts
projectSave(foldSave(store.load(id)));
```

The pin inside the save is the campaign. Editing `data/campaigns/harbour.json` after this does nothing to it.

Forge.

```text
node packages/forge/src/cli.ts new --pitch "harbour smugglers" --seed 1
node packages/forge/src/cli.ts check data/campaigns/harbour.json
```

`check` calls `parseCampaign` and the same lint the game will refuse. A campaign the forge accepts is a campaign `beginCampaign` accepts.

Character death.

```ts
await applyCommand(store, director, {
  kind: 'chooseFate',
  save: save.id,
  turn: turnId('t9'),
  fate: 'replace',
});
```

Creation starts at the dead hero's level. Found clues stay found. The next playing turn is narration that weaves the new name in.

These sites are in `sketch/usage.ts`. The types below exist to serve them.

## Shape

The public surface is four functions. `beginCampaign`, `applyCommand`, `projectSave`, `lint`. Complexity sits behind them. Callers do not build briefs, do not fold events, do not derive AC, do not walk clue graphs.

### Package boundaries

```
packages/contract   parseCampaign, pinCampaign, lint graph rules, CONTRACT_VERSION
packages/srd        vendored JSON plus the CC-BY notice from research-rules §1
packages/engine     world, character, turn, save
packages/app        HTTP and the HTML client
packages/forge      CLI generate and check
```

No npm dependency between them. Node 24 imports `.ts` by relative path. Forge never imports engine. App never imports forge. Both import contract. That is the mechanical sync (FR-016). There is one parser. A mutate test that deletes a required field from `parseCampaign` fails a named fixture test in both trees. `CONTRACT_VERSION` lives on the campaign JSON. A pin stores `thisContractDigest()`. The engine refuses a pin with a different digest. Old saves keep the pin they were born with. Event kinds are additive, so `apply` still folds yesterday's log.

SRD data is JSON in `packages/srd`, vendored from 5e-database and patched to 5.2.1 (research-rules §2). Runtime does not fetch. Attribution is shipped as the suggested notice in that section, including the modification line. Names from `phb2024-only-*.tsv` are a deny-list on director output (research-rules Gotchas).

### Content model

Classes, species, backgrounds, feats, spells, items, monsters, and conditions are data. A `ClassDef` is hit die, saves, skill list, features by level, optional `SpellcastingDef`, subclasses at 3 (research-rules §1, §3). Features and spells are an effect IR (`sketch/effects.ts`). The engine interprets `damage`, `heal`, `save`, `condition`, `resource`, `slot`. The rest is `{ kind: 'code', handler }`. Rage, sneak attack, and second wind are handlers. Wish is not in the first phases.

A custom class and a module-supplied class are `ClassDef` values with `provenance: player` or `campaign`. They take the same path as an SRD class. There is no subclass hook in TypeScript per class. If a feature cannot be expressed, it does not ship until a handler exists. That is the gate that keeps the IR honest.

The thirteenth class is original expression assembled from SRD parts (research-rules §4). Provenance is `original`. The local model never sees the word Artificer. Display naming is an open product question. Feature names are invented. Half-caster slots follow the Paladin and Ranger table, not a copied Artificer progression.

Catalogs are arrays on `Campaign` and overlays on `Module`. `indexPin` / `mergeContent` build maps. A turn never scans arrays for a spell.

### Character model

A hero is `HeroRecord`. An NPC is `Being` plus an optional `MonsterId`. They do not share a sheet. Unifying them would put optional ability scores on every rat.

Stored. Species, background, class, subclass, level, XP, chosen scores, skills, expertise, feats, prepared and known spells, inventory, gold, current HP through `Vitality`, remaining hit dice, remaining slots, remaining resources, inspiration, exhaustion, concentration.

Derived, never stored. Modifiers, proficiency bonus, AC, max HP, speed, save bonuses, spell DC, spell attack, weapon attack bonus (`derive` in `sketch/character.ts`). Background ASI is applied when the draft becomes a record. Scores above 20 cannot be constructed (research-rules §3).

`Vitality` is a sum type. Up, dying with two small counters, stable, or dead-at-level. Dying and dead cannot both be true.

Ability scores. Roll 4d6 drop lowest from the session seed. Point buy 27. Standard array. Free assignment capped at 20 (FR-002). All four go through `applyDraft`.

### The turn

The player submits an `Intent`.

A structured `Act` (attack, cast, use, move, flee, rest, dodge, hide) collapses the director schema to narration plus optional `reveals` and `tick`. Those two remain closed enums from the room. The model does not choose a skill, a DC, a target, or damage. FR-019 is this collapse.

Free text keeps a small interpret schema. `actKind`, `target`, `skill`, `band`, `via`, `rest`, `reveals`, `tick`, `narration`. No `damage`. No integer `difficulty`. Bands map through `DC_OF` (5, 10, 15, 20, 25). The skill's ability is a table (`SKILL_ABILITY`). Expertise doubles PB (FR-006). Out-of-character input collapses further to narration, as today.

Combat. Engine rolls initiative and writes `combatBegan` with the order. Every hostile in the room acts from `MonsterDef.actions` in that order. The model does not pick monster ops. Reprisal is gone as a special case. It is the monster's turn. Advantage is a condition plus a next-roll flag, consumed by the dice helper. Flee is an engine check against a band derived from the strongest hostile, then a `moved` or a failed round.

Death saves are not a player act. On a dying hero the engine rolls at the start of the turn (research-rules §3, same DC 10, a 1 is two failures, a 20 stands up). Three failures emit `died` and the phase becomes `fate`. Structured attacks while dying are dropped with a ruling.

`finish()` still exists. Every exit of `adjudicate` goes through it. It expands a filled clock's `onFill` consequences into primitive events, fires proactive clues after N turns without discovery (research-campaigns §2 G6, §4.2), and asks `goalHolds`. A DM milestone is never required to win.

### Death and replacement

Phase `fate` offers End or Continue. End writes `campaignLost`. Continue writes `fateChosen` and opens `creating` at the dead hero's level with `xpForLevel(level)` (FR-013). The new record is `heroReplaced`. Module progress is the event log, so it is intact. If hostiles are still in the room, the replacement enters there and combat is re-rolled. The next playing turn uses the narrate schema so the model only weaves. Forge data may list a bond NPC as the suggested heir (research-campaigns §4.3). The player still fills the sheet. No Face Death mini-game. The spec is death saves, then End or Continue.

### Campaign and module lifecycle

A campaign is an ordered list of modules (research-campaigns §1.1). A module is a node graph whose edges are clues (research-campaigns §1.3). Episodes are runtime, not authored.

A save is `{ id, seed, pin, events }`. The pin is the campaign JSON plus digests. FR-018 is the pin, not a promise to load current files.

`PlayPhase` is derived from the log. Creating, playing, level-up, fate, between modules, module over, campaign over. Mid-creation and mid-level-up survive restart because the draft events are in the log (SC-004).

Won at module level means `goalHolds`. Lost at module level means the player chose End after death. Won at campaign level means the last module won, then an epilogue narration. Between modules the engine grants a long rest (FR-012) and writes `moduleBegan` for the next.

Title screen is `GET /api/saves` plus three commands. New campaign, continue latest, delete. FR-020.

Old lantern sessions stay loadable through a frozen legacy adapter until the module document ships. They are not translated event-by-event. Generated delves become `Module` values of a generated kind, still a pure function of a seed, then pinned when play starts.

### Clocks, fronts, goals

A clock has 4, 6, or 8 segments and is named for the outcome (research-campaigns §2 C8). `onFill` is data. Spawn, lock, unlock, damage, condition, reveal, fail the module. Adjudication expands it. `apply` only folds the primitives. A filled danger clock therefore has teeth (FR-014).

Fronts are clocks. The engine ticks them. The model may only name a clock that is in the brief.

Goals are a predicate union. Revelation known, entity dead, item held, location reached, clock filled, and/or. Winning does not wait on `milestone`. Discovery still advances vows. Finding the last clue is enough. That is the fix for review-logic §1, encoded as `goalHolds` rather than another special case in `earnedSomething`.

### The forge

CLI in `packages/forge`. `skeleton` is deterministic from pitch and seed. Graph, clue slots, XP budgets from SRD 5.2.1 p. 202 (research-rules §5, research-campaigns §2 S2), clock sizes, start, finale. A 3B model fills one entity per call, neighbors' names only, notes field first (research-campaigns §3.4). It never emits ids, numbers, or edges (research-campaigns §3.2). Repair three times, then a table. `lint` runs G1–G8, S1–S6, C1–C10, A1–A7, P-rules from research-campaigns §2. Errors block. Warns report. Human review remains a step because quest prose is unreliable (research-campaigns §3.1).

Solo budgets use the per-character row times one, with the two-creature cap and no CR above the PC's level for routine fights (research-rules §5 inference). The generator prefers waves. No sidekicks. The spec says one hero.

### Interface depth

Hidden. Schema construction, effect interpretation, initiative, `derive`, goal eval, clock expansion, content maps, director sampling.

Exposed. Commands, `PlayerView`, campaign JSON through `parseCampaign`.

Wire types stop at `app.ts` and the forge CLI. `Intent` is a domain type. The HTTP body is parsed into it (boundary-discipline).

Call chain for a turn. `app` → `applyCommand` → `takeTurn` → `adjudicate`. Three files. `apply` is the fold, not a fourth policy layer.

Idempotence. Client `TurnId` plus `expectedHead` plus one SQLite transaction. Duplicate id returns the stored turn (make-operations-idempotent). Crash before commit leaves the height unchanged. Publish the in-memory cache only after commit (review-claims §1).

One writer per save. The in-flight set stays. Forge does not write saves. Content files are immutable after pin (separate-before-serializing-shared-state).

## Synthesis decision

This is one arena candidate. Synthesis happens later.

## Tradeoffs accepted

- We accept that free-text turns still let a 3B model pick the wrong skill, in exchange for keeping that enum at eighteen plus `none` instead of an open action language.
- We accept an effect IR that cannot express every spell at first, in exchange for one path for SRD, original, custom, and module classes.
- We accept copying the campaign JSON into every save, in exchange for FR-018 without reading live files during `apply`.
- We accept that monster turns are dull (they swing the listed attack), in exchange for not asking the 3B model to run four combatants.
- We accept dropping current `damage` and integer `difficulty` from the proposal, in exchange for engine-owned amounts. Existing director fixtures must change in the same phase.
- We accept no live migration of prototype tavern saves, in exchange for not teaching `apply` to translate a dead schema.
- We accept a thirteenth original class rather than shipping Artificer text, in exchange for staying inside CC-BY-4.0 (research-rules §4).

## Alternatives considered

- Grow today's `Proposal` with spell, slot, item, and damage dice fields. Small public surface in lines of type, huge decoder surface. The 3B history is that deleting an op helped more than prompting. Rejected on interface depth toward the model, which is the real caller of that schema.
- One `Entity` with an optional `HeroRecord`. Callers learn the optional. Every rule branches. Shallow module. Rejected.
- Per-class TypeScript files. Custom and module classes cannot plug in through the same path (FR-015). Rejected.
- Publish `@portale/contract` as a versioned package. Sync becomes a number people forget to bump, and it wants a registry. Rejected. One relative import is the sync.
- Live-load campaign files each turn so authors can hot-patch. Violates FR-018 and constitution III. Rejected.
- Ask the model to pick monster actions. Multi-foe combat explodes the schema. Rejected.

## Open questions and risks

- How many level 1–3 features across thirteen classes fit the IR before `code` handlers become the real system?
- What display name does the thirteenth class get in the UI, given FR-004 says Artificer and research-rules §4 says not to use that name or its feature names?
- Does narrate-only after a structured act keep the 3B model coherent, or does it invent mechanics in the prose that the transcript then contradicts?
- Should a replacement hero inherit half vow progress (research-campaigns §4.3) or keep full progress as FR-013's "intact" implies?
- When a danger clock fills on the same turn the goal holds, which event wins?

## Next implementation step

Delete `damage` and integer `difficulty` from the live proposal, add client `TurnId` with transactional append, and keep the drowned lantern playable under that contract.

## Phased migration

Riskiest first. Each phase ends in a playable game on the real 390x844 surface with a scripted director, then a probe against the 3B model for schema-valid rate (SC-005).

1. **Schema collapse and turn identity.** Intent channel. Structured acts optional, starting with attack and move. No damage field. DC bands. `TurnId` plus one transaction plus cache-after-commit. Lantern and delves still the content. This is the 3B risk. If narrate-only fails in play, stop and redesign the brief before adding rules.

2. **HeroRecord for one class.** Fighter 1–3. Stored scores, derived attack and AC, real skill modifiers. Creation by roll, buy, array, free. Title screen New / Continue / list. Legacy lantern HP maps into `Vitality.up`.

3. **Combat 2024.** Initiative, AC, weapon dice, conditions subset, death saves, flee. Hostiles act from a handwritten block for Marga and delve rats. Multi-foe in one room.

4. **Effect IR plus catalog.** Load SRD JSON. Remaining twelve SRD classes at 1–3, original thirteenth class at 1–3. Spell slots, cantrips, concentration. Inventory, short and long rest with clock teeth on rest. Custom class builder writes `ClassDef` JSON into the save overlay.

5. **Module document.** Lantern becomes campaign `harbour`, module 1. Goals as predicates. Clocks carry `onFill`. Last-clue win path. Delves emit `Module`. Pin on begin. Drop the legacy session adapter.

6. **Campaigns and replacement.** Ordered modules, long rest between, epilogue, fate screen, weave turn. Saves list as campaigns.

7. **Forge.** `skeleton`, fill, lint, pin. Shared `parseCampaign`. Bundled campaigns pass lint (SC-006). Quality rules G1 and S2 as errors first.

Existing tavern content becomes module 1 of the first hand-authored campaign (spec Assumptions). Existing prototype saves stay in a "Tales" list until phase 5, then expire. No event rewriting.

## Constitution check

I. Engine decides rolls, damage, slots, clocks, goals, death. Model proposes remaining interpret fields or narration.
II. Schema rebuilt per turn from live state. Structured acts make mechanics undecodable.
III. Log plus pin. `apply` trusts. Dice from seed and seq.
IV. `projectSave` is the only HTTP game state.
V. Each new rule gets a named test. Contract parse is one of them.
VI. Each phase is done on the real app.
VII. Relative `.ts` imports. TypeScript is the typechecker. Client stays HTML.
