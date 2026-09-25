# Portale target architecture: the engine mints the ballot

Candidate A. Design package for turning Portale into a solo D&D 2024 campaign game with a
separate campaign forge.

## Problem

Portale today is a small, coherent machine: one `World`, one `adjudicate`, one schema rebuilt per
turn, one append-only log. It works because the model's decision is tiny — eleven fields, four of
them closed enums — and the engine clamps the rest. The ask explodes the action space by three
orders of magnitude: 339 spells, 330 stat blocks, 258 magic items, thirteen classes, fifteen
conditions, rests, inventory, levels, campaigns made of modules, and a tool that generates more.

The constraint that makes the shape non-obvious is that the model must not grow with the game.
`qwen2.5:3b-instruct` under constrained decoding binds a described NPC to the right id between 37%
and 75% of the time (`tools/model-probe/README.md`, quoted in research-campaigns §3.1), and
Portale's own history says deleting an op fixed more than any prompt rule. Meanwhile the
constitution forbids the two escapes a bigger game would normally take: no runtime dependency, no
build step, and no asking the model to try again. `apply` must stay total and trusting, the store
must hold only identifiers, seeds and events, and a replay must reproduce the world exactly — which
now has to hold while the world is a function of several hundred kilobytes of editable content.

Three existing invariants crossed into this design and constrain it. The DM proposes and the engine
disposes, so no new content format may hand the model a number. The event log is the only authority,
so anything derived — armor class, spell slots, vow progress, module outcome — must be computed, not
stored. `project` is the only state that crosses HTTP, so every new secret (a monster's tactics, an
unfound clue, a module's finale) has to be reachable only from the private side.

The review reports name what the current shape already fails at: a filled danger clock does nothing
(review-gaps #15), a vow only advances if the DM claims a milestone on the same turn as a discovery
(#14, #20), a discovery proposed on a move turn is always refused (#17), the UI offers exits the
engine refuses (#18), and a turn is not atomic against a crash mid-append (review-claims #1, #2).
Those are not four bugs and a race. They are one bug: **the model is being asked to nominate
mechanical state changes through side-channel fields, and the engine is left to referee claims it
should never have invited.**

## Usage (caller's view)

### README quickstart

```text
# Play
node --run play                 # http://127.0.0.1:8787, phone-sized, no build step
node --run play -- --dm scripted   # deterministic DM, no GPU, for tests

# Author
node tools/forge new  "A whaling town that sold its drowned to something"  --modules 3
node tools/forge fill campaigns/saltbound        # small model fills prose, cached by seed
node tools/forge check campaigns/saltbound       # contract + 31 quality lints; exit 1 on error
node tools/forge sim   campaigns/saltbound -n 1000   # engine-driven playthroughs, no model
node tools/forge pack  campaigns/saltbound       # -> content/campaigns/saltbound.pack.json
```

`forge check` is the mechanical sync gate. It runs **the game's own parser**, not a copy of it, then
adds the quality lints on top. There is one validator in the repository and both programs call it.

### Call site 1 — a named rules test drives a whole module

```ts
import { loadPacks, startCampaign, takeTurn, viewOf } from '../src/game.ts';
import { scriptedDirector } from '../src/director.ts';
import { rolledHero } from '../src/hero.ts';
import { seed } from '../src/dice.ts';

test('a rogue with expertise in Stealth adds twice the proficiency bonus', async () => {
  const packs = await loadPacks(['srd-5.2', 'portale-original', 'campaigns/harbour']);
  const hero = rolledHero(packs, {
    method: { kind: 'array' },
    species: id('sp_halfling'), background: id('bg_criminal'), klass: id('cl_rogue'),
    skills: [id('sk_stealth'), id('sk_perception')],
    expertise: [id('sk_stealth')],
  }, seed(7));

  const save = await startCampaign({ campaign: id('cam_harbour'), hero, seed: seed(7), packs });

  // The menu is the engine's, not the UI's and not the model's.
  const stealth = viewOf(save).moves.find((m) => m.label.startsWith('Sneak'))!;
  const turn = await takeTurn(save, { kind: 'do', move: stealth.id, turnId: 't1' }, scriptedDirector([
    { narration: 'You fold into the smoke and the step does not creak.' },
  ]));

  expect(turn.view.rolls.at(-1)).toMatchObject({ die: 20, mod: +7, note: 'Dex +2, prof +2 x2' });
});
```

Two things the caller never does: name a difficulty, or tell the DM anything. It picks a move the
engine offered and reads the roll the engine made.

### Call site 2 — the browser, which is the whole client

```js
// public/index.html
const r = await fetch(`/api/save/${id}/turn`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ turnId, say: text }),      // or { turnId, move: 'attack:e_marga:it_longsword' }
});
const { view } = await r.json();
render(view);                                        // view.moves are the buttons, verbatim
```

`view.moves` is the action bar. The same array, by id, is the enum the DM decodes into. A button the
UI can draw is a move the engine will accept, because they are one list (review-gaps #18 becomes
unrepresentable). A repeat POST with the same `turnId` returns the same view and takes no second
turn.

### Call site 3 — a module author, and a module that ships a class

```ts
// content/campaigns/saltbound/module-02.ts  (or the JSON the forge emits; same types)
export const theTideHouse: ModuleDef = {
  id: id('mod_tide_house'),
  levels: [2, 3],
  start: id('nd_quay'),
  goal: { kind: 'all', of: [
    { kind: 'revealed', revelation: id('rv_who_signed') },
    { kind: 'any', need: 1, of: [
      { kind: 'defeated', role: id('ro_tidewarden') },
      { kind: 'flag', flag: id('fl_bargain_struck') },
    ] },
  ] },
  clocks: [{
    id: id('ck_tide'), name: 'The tide comes in', segments: 6, visibility: 'open',
    triggers: [{ on: 'rest' }, { on: 'turnsElapsed', every: 8 }],
    payoff: [
      { kind: 'setFlag', flag: id('fl_lower_level_flooded'), value: true },
      { kind: 'spawn', statBlock: id('mb_swarm_of_rats'), count: '1d3', at: 'here' },
    ],
  }],
  // ... nodes, npcs, clues, revelations, encounters, finale, epilogue, successors
};
```

A clock's payoff is `Effect[]`, not a sentence. That is the whole of review-gaps #15: pressure that
fills now *does* something, and the something is data the forge can lint and the engine can apply.

```ts
// A campaign-supplied class goes through exactly the path an SRD class does.
export const tideSinger: ClassDef = {
  id: id('cl_tide_singer'), provenance: 'campaign:saltbound',
  hitDie: 8, savingThrows: ['con', 'cha'],
  spellcasting: { ability: 'cha', progression: 'half', prepared: 'table', list: id('sl_tide') },
  featuresByLevel: { 1: [id('ft_tide_touched')], 2: [id('ft_undertow')], 3: [id('ft_subclass')] },
};
```

No `scripted` effects are permitted in a campaign pack, so this class is pure data the engine
interprets, and the player's own custom class is authored through the same `ClassDef` (FR-015).

### Call site 4 — the forge, used as a library by its own tests

```ts
import { skeleton, lint, packOf } from '../src/forge.ts';

const draft = skeleton({ pitch, modules: 3, levels: [1, 5], seed: seed(11) });   // deterministic
const report = lint(draft, packs);                                               // shared with the game
expect(report.errors.map((e) => e.rule)).toEqual(['G1']);                        // one conclusion, one clue
expect(report.errors[0]!.at).toBe('mod_tide_house/rv_who_signed');
```

## Shape

### The one idea

**The engine mints the ballot; the DM votes; the engine counts.**

Every turn the engine computes `legalMoves(scene)`: a closed, ordered list of fully-specified legal
actions for this character in this scene. One list serves three consumers that used to disagree:

| Consumer | Uses the list as |
| --- | --- |
| The browser | The action bar. `view.moves[]` are the buttons. |
| The DM model | The `move` enum in the per-turn JSON Schema. |
| The rules | The lookup table. A turn resolves `menu.find(m => m.id === chosen)`. |

This is the design's whole answer to "the action space grows enormously but the model's per-turn
decision must stay small". The decision stays a single enum pick forever, because the engine has
already pruned to *legal and present*. A wizard with 12 prepared spells and no slots left sees no
`cast` moves. A hero pinned in melee sees `flee` but not `move`. A clue whose notice DC exceeds
passive Perception and whose gate is unmet is not in the list. Adding the entire SRD spell list adds
zero fields to the schema.

The per-turn schema collapses from eleven fields to three, and to one when the player tapped a
button:

```
free text  ->  { move: enum(menu ids), band?: enum(five DC labels), narration: string }
a button   ->  { narration: string }
```

`tick`, `milestone`, `reveals`, `target`, `direction`, `ability`, `difficulty`, `damage` and
`introduces` all go. Not because they were wrong, but because each one was the model nominating a
state change the engine then had to referee. Per **subtract-before-you-add**: the failures the review
found are refereeing failures, so delete the invitation. The model never emits a number again, which
makes FR-001 a property of the schema rather than a property of `adjudicate`'s clamps.

What the model still chooses: which move, the DC *band* (a label, never an integer) for an
improvised check, which walk-on NPC from the module's cast pool speaks, and the prose. What it never
chooses: any number, any absent target, any clock, any progress, any discovery not in reach, and
whether the world strikes back.

### Data structures, and the access patterns traced through them

**Content is a pinned, content-addressed pack.**

```
Pack = { manifest: { id, version, provenance, contractVersion, contractDigest }, entries }
```

`parsePack(unknown) -> Pack | PackErrors` is the single boundary where JSON becomes domain types with
branded ids (**boundary-discipline**). Nothing downstream re-validates. `digestOf(pack)` is a stable
hash over the parsed, canonically-ordered entries — over meaning, not over whitespace.

The store gains one table and the rest follows:

```sql
packs (digest TEXT PRIMARY KEY, body TEXT NOT NULL)          -- immutable, write-once
saves (id TEXT PRIMARY KEY, seed INTEGER, pins TEXT)         -- pins = [digest,...]
events(save_id, seq, payload, PRIMARY KEY (save_id, seq))
turns (save_id, turn_id, first_seq, last_seq, PRIMARY KEY (save_id, turn_id))
```

*Access pattern: resume a save.* Read `pins`, load each pack body by digest, `parsePack` once, fold
events. FR-018 falls out: editing a campaign writes a *new* digest, so the running save keeps
resolving the bytes it started with. No versioned migration, no content diffing, no "saved game
changed under the player". The pack store is append-only for the same reason the event log is.

*Access pattern: the turn.* `Scene` is built once per turn from `(packs, foldedState)` and holds
direct references — the current `Node`, the `Combatant[]` present, the hero's `Sheet`, the unfound
`Clue[]` here, the live `Clock[]`. Every lookup the turn needs is a field access on `Scene`, not a
scan. There is no index to add later because `Scene` *is* the index, rebuilt each turn from state
that is small (one node, one hero, a handful of foes).

*Access pattern: the transcript.* Projected by walking the log, as today, with running counters —
the existing approach in `project` is right and survives.

**The hero stores choices and consumption; everything else is derived.**

```
Hero  = origin choices + level + ability assignment + proficiency picks
      + inventory + prepared spells
      + hpLost + slotsSpent + resourcesSpent + conditions + deathSaves + xp
Sheet = sheetOf(hero, packs)   // AC, attack bonus, save mods, DCs, slot maxima, passives, speed
```

`hpLost` rather than `hpNow` is deliberate. Levelling raises `hpMax`; storing current HP means two
numbers that can disagree the moment the max moves. One number that is *damage taken* cannot
(**single source of truth per invariant**). The same trick for slots and class resources: store
`spent`, derive `max` from the class table, and a level-up is arithmetic rather than a migration.
`Sheet` is never persisted and never crosses HTTP. Death-save counts are derived by counting
`death_save` events since the last `stabilised`, so the log stays the only authority.

**Heroes and monsters are different types that project into one.**

A `StatBlock` is authored and flat: AC, HP, attacks, saves, CR, XP, tactics tag. A `Hero` is choices.
Unifying them would force monsters to carry a class and heroes to carry an authored AC. Instead both
project into a narrow `Combatant` — `{ id, ac, hp, saveMod(), attacks, conditions, speed,
initiative }` — and every line of combat code sees only `Combatant`. That is interface depth in the
small: one seven-field interface hides two entirely unlike sources, and the SRD import never has to
invent class levels for a Giant Rat.

**Content interpretation is a closed effect vocabulary plus one guarded escape hatch.**

Eighteen `Effect` verbs (`damage`, `heal`, `tempHp`, `condition`, `attackRoll`, `save`, `resource`,
`slot`, `reveal`, `advanceClock`, `spawn`, `loot`, `setFlag`, …) cover the head of the distribution:
almost every SRD spell, every weapon, every mastery property, every clock payoff, every class
feature at levels 1–3. The tail gets `{ kind: 'scripted'; script: ScriptId }`, which names a
handwritten handler in engine code — research-rules §2 is explicit that "effects such as Polymorph or
Wish need handwritten handlers". The invariant that makes the escape hatch safe rather than a hole:

> A pack whose provenance is a campaign or the player may not contain a `scripted` effect.
> `parsePack` rejects it.

So module-supplied and player-built content is *by construction* pure data on the same path as the
SRD, which is the honest version of FR-015 and US10's independent test. An LLM-written spell cannot
reach engine code.

**Progress is derived from the goal predicate, not accumulated by claims.**

```ts
type Goal =
  | { kind: 'revealed'; revelation } | { kind: 'defeated'; role } | { kind: 'reached'; node }
  | { kind: 'flag'; flag }           | { kind: 'clockFilled'; clock }
  | { kind: 'all'; of: Goal[] }      | { kind: 'any'; of: Goal[]; need: number };
```

`outcomeOf(save)` evaluates the active module's `Goal` against folded state; the vow's progress bar
is `satisfiedTerms / totalTerms` over the same tree. There is no `progressed` event, no `milestone`
field, no `unearned-milestone` ruling, and no way for a narrator to talk the player toward the
ending, because narration is not a term in the predicate. review-gaps #13, #14 and #20 stop being
bugs and become states the type system cannot express. A module's goal is engine-checkable by
construction, which is FR-011, and the forge can lint it (is every term reachable?) precisely
because it is data.

**Clocks and fronts have engine-owned triggers and effectful payoffs.**

`ClockTrigger` is `{ on: 'rest' } | { on: 'turnsElapsed', every } | { on: 'checkFailed', at } |
{ on: 'noDiscovery', turns } | { on: 'nodeEntered', node } | { on: 'clockFilled', clock }`. The
engine fires them; the DM has no `tick` field. `{ on: 'noDiscovery', turns: n }` is also how the
Alexandrian's proactive node arrives (research-campaigns §4.2: the engine "can detect that as N turns
without a discovery and fire the trigger itself"), so one mechanism satisfies lint G6 and fixes the
stall the review measured over forty turns. A front is a clock plus a cast; a faction goal is a
clock. One shape, per **model-the-domain**.

**Passive perception is load-bearing, not flavour.** On entering a node the engine auto-reveals every
unfound clue whose `noticeDC <= passivePerception`. This is US3's stated requirement and it is also
the pressure valve that makes "one move per turn" survivable — the design otherwise refuses a
discovery on a move turn (review-gaps #17), which would be worse than today.

### How the turn flows

```
takeTurn(save, input, director)
  guard: outcomeOf(save) === 'playing', turnId not already recorded
  scene  = sceneOf(save)                    // private; holds secrets
  menu   = legalMoves(scene)                // the ballot
  choice = input.kind === 'do'
             ? lookup(menu, input.move)     // 409 + fresh menu if stale
             : await director.pick(buildTurnSchema(menu), renderBrief(scene, menu))
  events = resolveRound(scene, choice, band)  // hero acts; foes act in initiative order;
                                              // triggers fire; goal is evaluated; death saves roll
  store.appendTurn(save.id, input.turnId, events)   // one transaction, log + turn marker
  return project(fold(save, events))
```

Three files to trace input to output: `turn.ts`, `save.ts`, `contract.ts`. `resolveRound` is a pure
function of `(Scene, Move, Band, Seed, Seq)`; the shell in `takeTurn` does transport, atomicity and
idempotence and nothing else (**boundary-discipline**, short call chains).

**Idempotence** is required in exactly three places and gets a different answer in each, per
**make-operations-idempotent**:

- *Turn submission.* Client-minted `turnId`, `UNIQUE(save_id, turn_id)`, and one transaction that
  writes the events and the marker together. A retry after a crash mid-append either finds the
  marker (return the recorded view) or finds nothing (replay the turn). review-claims #1 and #2
  close; the live cache stops being able to contradict the log because it is dropped on any append
  failure and rebuilt from it.
- *Module transition.* Not a command at all. The active module index is *derived* — the count of
  `module_entered` events — so advancing twice is a no-op by arithmetic rather than by a guard.
  Deriving instead of syncing gives idempotence for free.
- *Replacement character.* `heroes` on the save is an append-only roster and `activeHero` is derived
  as `heroes.length - 1`. Rolling a replacement twice for the same death is refused by comparing the
  death event's sequence, which is in the log.

### Death, dying, and the story absorbing a new hero

At 0 HP the hero is `dying`; each of their turns rolls a death save (DC 10, 1 is two failures, 20
restores 1 HP, damage at 0 is a failure — research-rules §1). Three failures emit `hero_died` and the
save enters `mourning`, which accepts exactly two commands: `end` or `continue`.

`end` -> campaign `lost`, epilogue rendered from the module's failure resolution.

`continue` -> `createHero` at the dead hero's level with the XP that level requires (spec US9 AS1),
then a `Succession` drawn deterministically from the module's authored `successors` table
(research-campaigns §4.3 says the successor table is human-authored because "it carries the
campaign's stakes"): a bond NPC, a debtor, a rival. The engine places the new hero at the campaign
hub or the module's start, emits the succession event, and hands the DM a one-field narration schema.

The decisive structural point is that **the hero is a slot on the save, not the owner of progress**.
Found clues, satisfied goal terms, clock state, node flags and loot all live on the save. So spec
US9 AS2 — "discovered clues and completed goals are still discovered and completed" — needs no code:
nothing was attached to the dead hero to lose. Their gear drops as loot at the node where they fell,
which is diegetic, engine-checkable, and introduces no inheritance mechanism.

The killer is promoted: its front's clock advances one segment (research-campaigns §4.3, pattern 4).

### Package boundaries and the sync gate

```
packages/contract/   types + parsePack + digestOf + CONTRACT_VERSION + contractDigest()
                     + conformance/  (golden packs: valid, and invalid with expected error codes)
packages/rules/      SRD interpretation: sheetOf, legalMoves, resolveRound, conditions, rests
packages/app/        engine, director, http, store, public/     (today's package, slimmed)
packages/forge/      skeleton, fill, lint, sim, pack            (CLI + library)
content/             srd-5.2.pack.json, portale-original.pack.json, campaigns/*.pack.json
```

Cross-package resolution uses Node's subpath imports in the root `package.json`
(`"imports": { "#contract/*": "./packages/contract/src/*" }`), which needs no dependency and no build
step. Relative `../../contract/src/*.ts` paths are the fallback if type stripping and subpath imports
disagree (see risks).

Sync is enforced by three mechanisms, none of which is discipline:

1. **One validator.** `parsePack` lives in `contract` and the forge calls it. The forge has no parser
   of its own — only *lints on top*. "Anything the forge accepts the game accepts" is true because
   they run the same function (**single source of truth**; avoids the information-leakage red flag of
   two copies of a schema).
2. **A frozen digest test.** `contractDigest()` hashes the contract's own declared field table at
   runtime. `contract.test.ts` asserts it equals a checked-in constant. Any change to the contract
   fails that test until the constant and `CONTRACT_VERSION` are bumped in the same commit.
3. **A pin check at load.** Every packed file records `{ contractVersion, contractDigest }`. The game
   refuses a pack whose digest it does not know, so a forge run from an older checkout produces a
   pack that fails loudly instead of drifting (spec US11 AS2). The conformance corpus in
   `contract/conformance/` is run by both programs' test suites.

### The forge

Deterministic code owns the plan; the model owns short local prose; the validator owns the verdict.
That split is the direct reading of research-campaigns §3.1–§3.2: plans need external verification
(Kambhampati), and the model "binds names to ids unreliably", so "ids, cross-references, numbers:
code, always."

```
skeleton(seed, pitch) -> Draft      pure. graph template, node kinds, revelations, clue slots
                                    satisfying G1–G3/G5/G6, clocks sized 4/6/8, XP budgets from
                                    SRD 5.2.1 p.202, wave-shaped difficulty, finale, epilogue
fill(draft, filler)   -> Draft      one model call per entity, tiny flat schema, neighbours' display
                                    names only; memoised by (promptDigest, seed) into fill-cache.json
lint(draft, packs)    -> Report     parsePack errors + 31 quality rules (G1–G8, S1–S6, C1–C10,
                                    A1–A7, P1–P4) each with id, severity, and a location
sim(draft, n)         -> SimReport  engine-driven Monte Carlo: G4 reachability, P3 minutes/episode,
                                    SC-002 (never unwinnable while alive)
packOf(draft)         -> Pack       canonical order, digest, provenance stamp
```

Because `fill` is cached by seed, `forge check` and the whole test suite run with no GPU and no
network (constitution V). `sim` reuses the game engine, so the forge cannot accept a module the
engine cannot play — the same-function argument again, one level up.

### Interface depth, judged

The game's public surface is eight functions — `loadPacks`, `startCampaign`, `takeTurn`, `viewOf`,
`listSaves`, `deleteSave`, `createHero`, `answerDeath` — behind which sit SRD 5.2 interpretation,
menu derivation, initiative and rounds, conditions, concentration, rests, clocks, goals, module
transitions, succession, pinning and replay. A caller who learns those eight names does not then
have to learn the implementation, which is the depth test. The contract's surface is four values plus
types. The one thing deliberately exposed is `Move`, because its `id` and `label` are the shared
vocabulary of the three consumers; exposing it is what removes a whole class of disagreement.

Deliberately not done: multiple party members, a tactical grid (nodes and "in reach" only), 3D
positioning, levels above the phase's supported band, counterspell-style reactions in phase 1, and
any model call that is not one per turn.

## Synthesis decision

*To be filled in by arena.*

## Tradeoffs accepted

- We accept a capped, ranked menu (and therefore the chance a player's exotic intent has no button)
  in exchange for a model decision whose size never grows with the game. Free text still maps onto
  the menu, and `check:<skill>` improvisation moves keep the open-ended path alive.
- We accept one action per turn — so a discovery and a move cannot happen on the same turn — in
  exchange for the turn matching D&D's own action economy. Passive perception on node entry is the
  compensating mechanism, and it is a rule the SRD already has.
- We accept storing whole pack bodies in the database, keyed by digest, in exchange for FR-018 being
  structural rather than a migration policy. A few hundred kilobytes per distinct content version is
  cheap next to a save that changes under the player.
- We accept losing DM-invented NPCs with invented stats in exchange for closed enums everywhere.
  Modules ship a cast pool; the model picks an id from it. The mint-slot bugs the current code
  carries (`~new1`, `mint-without-lore`, the invented `~new3`) stop being possible.
- We accept that the vow progress bar is now a derived fraction of a goal predicate rather than an
  Ironsworn tick track, in exchange for deleting the entire unearned-milestone adjudication surface.
- We accept vendoring and auditing SRD data (research-rules §2 recommends 5e-bits/5e-database pinned,
  plus a count validator and four sets of patches) rather than converting Foundry's richer 5.2.1
  packs, in exchange for plain JSON that Node imports natively with no YAML parser.
- We accept that legacy saved sessions become read-only transcripts rather than being migrated. The
  world shape changes far past what a trusting fold can absorb, and the log format's promise is that
  *a rules change never invalidates a save*, not that a redesign never does.

## Alternatives considered

**Grow the proposal (the status quo, scaled).** Add `spell`, `slot`, `item`, `bonusAction`,
`condition` fields and clamp each one. Loses on interface depth in the worst way: the public surface
(the schema) grows linearly with the content while hiding no additional complexity, and every new
field is a new refereeing burden in `adjudicate` and a new way for a 3B model to be wrong. Portale's
own measured history — "deleting an op fixed more than any prompt rule ever did" — is the argument
against it.

**A two-call DM: a planner call then a narrator call.** Hides more from the caller and would let the
mechanics field be decided with narration-quality context. Loses on the machine budget (one local 3B
model, 30–60 minute phone sessions, one turn in flight) and on evidence: autoregressive models
"cannot, by themselves, do planning or self-verification" (Kambhampati et al., via
research-campaigns §3.1). A second call buys a second sample, not a correction, which the constitution
already rejects.

**Content as code: one TypeScript module per spell, class feature and item.** Maximum expressive
power, no effect vocabulary to design, no interpreter. Loses because a campaign could then ship
executable code, which makes FR-015 a security and review problem, and because the forge could not
generate or lint content it cannot inspect. The effect vocabulary with a provenance-gated `scripted`
escape keeps the expressive power where it is needed (engine-owned SRD oddities) and denies it where
it is dangerous.

**Separate forge repository with a published JSON Schema as the contract.** The most conventional
answer to "keep them in sync". Loses because it turns one function into two implementations of one
schema — the information-leakage red flag exactly — and because zero-dependency means hand-rolling a
JSON Schema validator on both sides. Shipping the forge inside the repo and having it import the
game's parser makes drift impossible in-tree and detectable out-of-tree via the pinned digest.

**Keep vow/clock claims but add engine verification.** The smallest change from today: keep `tick`
and `milestone`, make the engine check harder. Rejected because the review's four progress bugs are
all failures of refereeing a claim, and a better referee is a point fix inside a shape that keeps
producing them. Deriving the outcome from a predicate removes the claim.

## Open questions and risks

1. **How many labelled options can `qwen2.5:3b-instruct` choose correctly from?** This is the
   assumption the whole design rests on. The existing probe measured 37–75% id binding with bare ids,
   and the probe README's own untested hypothesis was that human-readable labels beside ids would
   help. Should phase 1 cap the menu at 8, 12, or 20 by a deterministic relevance ranking, and is a
   wrong-but-legal move an acceptable failure mode given that every wrong move is still a legal
   D&D action the player can see in the transcript?
2. **Does a short scratch field before the `move` enum help or repeat the narration-first disaster?**
   dottxt's rerun of Tam et al. found a reasoning field placed before the constrained answer improved
   results, but the smallest model either side tested had 8B parameters, and Portale measured
   narration-first scoring `narrate_only` ten times out of ten. Do we ship a 120-character `read`
   field, off by default, and let a probe decide?
3. **Do Node 24's subpath imports resolve `.ts` files under type stripping?** If not, cross-package
   relative paths work and the only cost is ugliness. Worth verifying before the package split
   lands, because it is cheap to check and expensive to unwind.
4. **Is one move per turn the right granularity, or should a turn be a full D&D turn** (action +
   bonus action + move)? A full turn is more faithful and fewer round-trips per minute, but it
   multiplies the menu combinatorially. The sketch models `ActionCost` so the choice can be made
   later without reshaping `Move`; should phase 2 settle it?
5. **How much SRD data must be audited before phase 4 ships?** research-rules §2 flags the monster
   dataset as three days old, generated from a gist, and self-described as untested. Is "spot-check
   every stat block a bundled campaign actually spawns" enough, or do we need the full 330-row
   comparison first?
6. **What is the right ceiling on supported levels per phase?** The spec assumes 1–3 first. Levels 5
   and 11 bring subclass breadth and spell tiers whose effects strain the vocabulary; should the
   vocabulary be re-examined at the level-5 boundary as a planned checkpoint rather than a surprise?
7. **Should `Move` labels be player-facing prose or terse mechanical strings?** The UI wants prose;
   the model may bind better on terse ids with a label; the transcript wants past tense. The sketch
   carries `label` and `detail`, but the split has not been playtested on a 390px screen.

## Next implementation step

Write `legalMoves(scene)` and `buildTurnSchema(menu)` against today's `World`, with the existing
tavern and no D&D rules at all, and run `tools/model-probe` against `qwen2.5:3b-instruct` to measure
menu-pick accuracy at menu sizes 8, 12 and 20 — because if the ballot does not survive contact with a
3B model, every later phase changes shape.

---

# Migration plan

Nine phases, riskiest first, each ending in a game a person can play on a phone. Every phase lands on
its own `feat/` branch in a worktree, adds its own named tests, and ends with a verify-portale run
(constitution VI).

### Phase 1 — The ballot (riskiest, cheapest to falsify)

Replace the eleven-field proposal with `{ move, band?, narration }` over `legalMoves`, on the
*current* world model. No D&D yet. Delete `tick`, `milestone`, `reveals`, `target`, `direction`,
`ability`, `difficulty`, `damage`, `introduces` and the mint slots. Add the action bar to
`public/index.html` rendered from `view.moves`. Add `turnId` idempotence and the `turns` table.

*Ends playable:* the tavern, same content, with buttons and a DM that can only pick legal actions.
*Proves:* menu-pick accuracy against the real model; that review-gaps #17 and #18 are gone; that a
crash mid-append no longer loses a turn (review-claims #1, #2).
*Kill criterion:* if accuracy at menu size 12 is worse than today's op accuracy, stop and redesign
before phase 2.

### Phase 2 — The sheet

`Hero`, `sheetOf`, `Combatant`, ability scores by all three methods, skills, proficiency, expertise,
saving throws, AC, attack rolls, initiative, multi-foe rounds, conditions, death saves, flee. One
class (Fighter, levels 1–3) authored as a `ClassDef` through the real data path so the path is proven
before twelve more arrive.

*Ends playable:* the tavern fought by the 2024 rules with a real character sheet.
*Proves:* US2, US3; FR-005, FR-006; that the `Combatant` projection carries both sides.

### Phase 3 — The contract, packs and saves

`packages/contract`, `parsePack`, `digestOf`, `CONTRACT_VERSION`, `contractDigest`, the conformance
corpus, the `packs` table, pinning, the title screen, continue and delete. The tavern is re-authored
as module 1 of `campaigns/harbour`. Legacy sessions become read-only transcripts.

*Ends playable:* multiple saves, resumable across restarts, content pinned.
*Proves:* US1 AS4, US12; FR-016, FR-018, FR-020; SC-004.

### Phase 4 — Content

Vendor and audit SRD 5.2 data (research-rules §2: 5e-bits pinned, count validator against the frozen
lists, patches for the fifteen 5.2.1 items and the Octopus, transcribed invocations and metamagic).
Twelve classes plus the original artificer-like class at levels 1–3, nine species, four backgrounds,
seventeen feats, spells, items with masteries, monsters, the fifteen conditions. Spell slots,
concentration, rituals, inventory, short and long rests.

*Ends playable:* every class playable through the tavern module.
*Proves:* US4, US5, US6; FR-003, FR-004, FR-007, FR-008, FR-009.

### Phase 5 — Modules with teeth

Nodes, NPCs with wants, clues, revelations, engine-checkable `Goal`, clocks with `Effect` payoffs and
engine triggers, fronts, encounters built from the XP budget table, passive perception reveals, XP,
level-up including the subclass at 3.

*Ends playable:* a module that can be won, lost, and that pushes back on its own.
*Proves:* US7; FR-010, FR-011, FR-014; review-gaps #13, #14, #15, #16, #20 closed by construction.

### Phase 6 — Campaigns and succession

Ordered modules, carry-over with a long rest between, epilogue, `mourning`, End or Continue,
replacement at level with the successor table, killer promotion, gear-as-loot.

*Ends playable:* a two-module campaign end to end, including a death and a new hero.
*Proves:* US8, US9; FR-012, FR-013.

### Phase 7 — The forge

`skeleton`, `lint` (31 rules), `sim`, `pack`, `fill` with its seed-keyed cache. Bundled campaigns are
regenerated through it and must pass. The deliberately-broken-clue-chain fixture must fail with `G1`
and name the conclusion.

*Ends playable:* unchanged for the player; a new campaign can be produced in an afternoon.
*Proves:* US11; FR-017; SC-006.

### Phase 8 — Content of your own

In-game custom class builder over `ClassDef`; campaign- and module-scoped classes, species,
backgrounds, items, spells and monsters; the provenance gate on `scripted`.

*Ends playable:* a class built in the game and a class shipped in a module both level and play
through the same code.
*Proves:* US10; FR-015.

### Phase 9 — Pressure, pacing and polish

The generated delve becomes a module template; intensity-driven pacing after peaks
(research-campaigns §4.2); SC-001 (creation under three minutes on a phone), SC-005 (95% usable
turns), SC-007 (30–60 minute modules) measured rather than asserted.
