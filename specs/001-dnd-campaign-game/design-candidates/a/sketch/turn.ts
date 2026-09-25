/**
 * The turn. The engine mints the ballot, the DM votes, the engine counts.
 *
 * `legalMoves` is the single list that the action bar, the DM's response schema and the
 * rules lookup all read. A button the browser can draw is therefore a move the engine
 * will accept, and a move the model can decode is one it is legal to take. The old class
 * of bug where the UI offered an exit the engine refused is not expressible.
 *
 * This is also how the model's per-turn decision stays the same size forever. The action
 * space grows by hundreds of spells and items; the schema stays three fields, because the
 * engine has already pruned to legal-and-present before the model is asked anything.
 */

import type {
  Ability,
  ClockId,
  ClueId,
  ConditionId,
  Direction,
  Effect,
  EncounterId,
  ItemId,
  Library,
  NodeDef,
  NodeId,
  NpcDef,
  NpcId,
  SkillId,
  SpellId,
  SpellLevel,
} from './contract.ts';
import type { Combatant, CombatantId, Hero, Sheet } from './hero.ts';
import type { Roll, Seed } from './dice.ts';

/* -------------------------------------------------------------------- the scene */

/**
 * Everything the engine knows about right now, assembled once per turn. Private: it holds
 * the node's DM-only description, unfound clues, secret clocks and NPC wants. Nothing here
 * crosses HTTP; `project` in save.ts builds the player's view separately.
 *
 * Every lookup the turn needs is a field on this object. There is no scan and no index to
 * add later, because the scene is the index and it is small: one node, one hero, a handful
 * of combatants.
 */
export interface Scene {
  readonly seed: Seed;
  readonly seq: number;
  readonly lib: Library;
  readonly node: NodeDef;
  readonly hero: Hero;
  readonly sheet: Sheet;
  readonly you: Combatant;
  readonly present: readonly Combatant[];
  readonly npcsHere: readonly NpcDef[];
  readonly inCombat: boolean;
  /** Initiative order, decided when combat began and replayed from the log. */
  readonly order: readonly CombatantId[];
  readonly turnOf: CombatantId;
  readonly unfoundClues: readonly { readonly id: ClueId; readonly noticeDc: number; readonly gate: { readonly skill: SkillId; readonly dc: number } | null }[];
  readonly liveClocks: readonly { readonly id: ClockId; readonly name: string; readonly filled: number; readonly segments: number; readonly secret: boolean }[];
  readonly encounter: EncounterId | null;
  readonly castPool: readonly NpcDef[];
  readonly restable: boolean;
  /** Turns since the last discovery. Feeds the `noDiscovery` clock trigger. */
  readonly sinceDiscovery: number;
}

/* --------------------------------------------------------------------- the move */

export type MoveId = string & { readonly __brand: 'MoveId' };

/**
 * A legal, fully specified action. The model sees `id` and `label` and nothing else. The
 * browser sees `label`, `detail` and `group`. The rules read `payload`.
 *
 * The payload is never recorded. The log records the chosen `id` and `label`, and the
 * *outcomes* as events. So a later rules change cannot retroactively alter an old save:
 * replay folds recorded outcomes, it does not re-resolve recorded commands.
 */
export interface Move {
  readonly id: MoveId;
  readonly label: string;
  readonly detail: string;
  readonly group: 'fight' | 'magic' | 'explore' | 'talk' | 'body' | 'other';
  readonly cost: 'turn' | 'action' | 'bonus' | 'free';
  /** True only for an improvised check, the one place the DM may still pick a difficulty. */
  readonly needsBand: boolean;
  readonly payload: MovePayload;
}

export type MovePayload =
  | { readonly kind: 'attack'; readonly target: CombatantId; readonly weapon: ItemId; readonly offHand: boolean }
  | { readonly kind: 'cast'; readonly spell: SpellId; readonly slot: SpellLevel; readonly targets: readonly CombatantId[]; readonly ritual: boolean }
  | { readonly kind: 'useItem'; readonly item: ItemId; readonly target: CombatantId | null }
  | { readonly kind: 'feature'; readonly feature: string; readonly target: CombatantId | null }
  | { readonly kind: 'check'; readonly skill: SkillId; readonly about: string }
  | { readonly kind: 'search'; readonly clue: ClueId; readonly skill: SkillId; readonly dc: number }
  | { readonly kind: 'talk'; readonly npc: NpcId; readonly about: 'want' | 'keyInfo' | 'threat' | 'barter' }
  | { readonly kind: 'introduce'; readonly npc: NpcId }
  | { readonly kind: 'walk'; readonly dir: Direction; readonly to: NodeId }
  | { readonly kind: 'flee'; readonly dir: Direction; readonly to: NodeId }
  | { readonly kind: 'rest'; readonly which: 'short' | 'long'; readonly hitDice: number }
  | { readonly kind: 'stand' }
  | { readonly kind: 'dodge' }
  | { readonly kind: 'disengage' }
  | { readonly kind: 'hide' }
  | { readonly kind: 'deathSave' }
  | { readonly kind: 'pass' };

/** Never exceeded. The 3B model's accuracy against menu size is the design's top risk. */
export const MAX_MOVES = 12;

/**
 * The ballot. A pure function of the scene, so the browser, the model and the rules can
 * all be handed the same list without any of them deriving it again.
 *
 * Ordering is deterministic and meaning-carrying, because the top of a constrained-decoding
 * enum is the cheapest option to pick: the encounter's obvious action first, then the rest
 * by group. `pass` is always last and always present, so the enum is never empty and the
 * model always has a legal way to do nothing.
 */
export function legalMoves(scene: Scene): readonly Move[] {
  // TODO build, then rank, then truncate to MAX_MOVES keeping at least one move per group
  // that has any, so the menu never collapses to twelve flavours of attack.
  //
  //   dying            -> [deathSave] only. Nothing else is legal and nothing else is offered.
  //   prone            -> stand, plus attacks at disadvantage
  //   combat           -> attack per equipped weapon per living hostile here
  //                       cast per prepared spell with a slot left (cantrips always)
  //                       feature per class feature with a charge left
  //                       useItem per consumable
  //                       flee per exit (a contested attempt, not a free walk)
  //                       dodge, disengage, hide, pass
  //   exploration      -> walk per unlocked exit
  //                       search per unfound clue here whose gate the sheet can attempt
  //                       talk per NPC here, one move per topic they will discuss
  //                       introduce per cast-pool NPC not yet introduced (closed enum, so
  //                         there is no minting and the model never writes a stat line)
  //                       rest when scene.restable and no hostile is present (FR-009)
  //                       check per proficient skill, as the improvised catch-all, the only
  //                         move with needsBand
  //                       ritual casts, useItem, pass
  throw new Error('not implemented');
}

/* ------------------------------------------------------------------ the director */

/** The five SRD difficulty bands, as labels. The engine owns the integers (FR-006). */
export const BANDS = ['very easy', 'easy', 'medium', 'hard', 'very hard'] as const;
export type Band = (typeof BANDS)[number];

export function dcForBand(b: Band): 5 | 10 | 15 | 20 | 25 {
  throw new Error('not implemented');
}

/**
 * What the DM returns. Three fields when the player typed, one when they tapped.
 *
 * There is no number here and no id the engine did not mint. Compare the eleven-field
 * proposal this replaces, nine of whose fields existed only so `adjudicate` could referee
 * them afterwards.
 */
export interface Vote {
  readonly move: MoveId;
  readonly band: Band | null;
  readonly narration: string;
}

export interface DirectorBrief {
  readonly scene: string;
  readonly node: string;
  readonly present: readonly string[];
  readonly recent: readonly string[];
  readonly utterance: string;
  readonly menu: readonly { readonly id: MoveId; readonly label: string }[];
  readonly outOfCharacter: boolean;
}

export interface Director {
  readonly name: string;
  vote(brief: DirectorBrief, schema: object): Promise<Vote>;
}

/**
 * Field order is load-bearing: constrained decoding commits in declaration order, so the
 * mechanical choice is made first and the prose is written to fit it. Portale measured the
 * reverse ordering scoring `narrate_only` ten times out of ten.
 *
 * `band` is omitted entirely unless some move needs it, so the schema shrinks when the
 * decision does. When the player tapped a button the schema is `{ narration }` alone,
 * which is FR-019 read literally: a structured action leaves the DM only the narration.
 */
export function buildVoteSchema(menu: readonly Move[], forced: MoveId | null): object {
  throw new Error('not implemented');
}

export class DirectorContractBreach extends Error {
  readonly detail: unknown;

  constructor(message: string, detail: unknown) {
    super(message);
    this.name = 'DirectorContractBreach';
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ resolution */

/**
 * One round: the hero's move, then every other combatant in initiative order, then the
 * engine's own bookkeeping. Pure. Takes a scene and returns events; touches no database,
 * no clock and no network.
 *
 * Everything that used to be a field on the DM's proposal happens here instead, decided by
 * engine code: who strikes back, how hard, which clock advances, what was discovered, and
 * whether the module is over.
 */
export function resolveRound(scene: Scene, move: Move, band: Band | null): readonly TurnEvent[] {
  // TODO sequence, and the sequence is the rules:
  //  1. the hero's move -> effects -> events
  //  2. mastery riders (vex, topple, sap...) that the weapon carries
  //  3. concentration check if the hero took damage during 1 or 2
  //  4. each other combatant in initiative order, skipping the dead and the incapacitated,
  //     acting by its stat block's tactics tag (SRD 5.2.1 p.255 as engine policy, so the
  //     DM never decides whether the world strikes back)
  //  5. condition expiry for everything whose `until` elapsed
  //  6. clock triggers: rest, turnsElapsed, checkFailed, noDiscovery, nodeEntered,
  //     clockFilled. A clock that fills applies its payoff EFFECTS, not a sentence.
  //  7. passive reveals: any unfound clue here with noticeDc <= passivePerception. This is
  //     what keeps one-move-per-turn from starving discovery.
  //  8. death saves for anyone at 0 hit points
  //  9. goal evaluation -> `module_won`, and `hero_died` if three failures landed
  //
  // Each step appends to a local array and folds into a working state so a later step sees
  // an earlier one, the way `adjudicate` already does. Do not collect and convert at the
  // end: an early return would strand the conversion, which is a bug this codebase has
  // already paid for once.
  throw new Error('not implemented');
}

/**
 * The outcome vocabulary. Events are OUTCOMES, never commands, which is what lets `apply`
 * stay total and trusting while the rules underneath it change.
 */
export type TurnEvent =
  | { readonly kind: 'said'; readonly text: string }
  | { readonly kind: 'narrated'; readonly text: string }
  /** The move the turn took, with the label frozen so an old transcript never re-derives. */
  | { readonly kind: 'chose'; readonly move: MoveId; readonly label: string; readonly by: CombatantId }
  | { readonly kind: 'rolled'; readonly roll: Roll; readonly by: CombatantId; readonly why: string }
  | { readonly kind: 'damaged'; readonly to: CombatantId; readonly amount: number; readonly damageType: string }
  | { readonly kind: 'healed'; readonly to: CombatantId; readonly amount: number }
  | { readonly kind: 'tempHp'; readonly to: CombatantId; readonly amount: number }
  | { readonly kind: 'conditionOn'; readonly to: CombatantId; readonly condition: ConditionId }
  | { readonly kind: 'conditionOff'; readonly to: CombatantId; readonly condition: ConditionId }
  | { readonly kind: 'spent'; readonly by: CombatantId; readonly what: 'slot' | 'resource' | 'hitDie'; readonly which: string; readonly amount: number }
  | { readonly kind: 'concentrationBroke'; readonly by: CombatantId; readonly spell: SpellId }
  | { readonly kind: 'downed'; readonly who: CombatantId }
  | { readonly kind: 'deathSave'; readonly who: CombatantId; readonly outcome: 'success' | 'failure' | 'crit' | 'fumble' }
  | { readonly kind: 'stabilised'; readonly who: CombatantId }
  | { readonly kind: 'slain'; readonly who: CombatantId }
  | { readonly kind: 'spawned'; readonly who: CombatantId; readonly statBlock: string; readonly at: NodeId }
  | { readonly kind: 'walked'; readonly to: NodeId; readonly via: Direction }
  | { readonly kind: 'fledFailed' }
  | { readonly kind: 'found'; readonly clue: ClueId; readonly how: 'passive' | 'searched' }
  | { readonly kind: 'clockAdvanced'; readonly clock: ClockId; readonly by: number; readonly why: string }
  | { readonly kind: 'clockFilled'; readonly clock: ClockId }
  | { readonly kind: 'flagSet'; readonly flag: string; readonly value: boolean }
  | { readonly kind: 'looted'; readonly items: readonly { readonly item: ItemId; readonly count: number }[] }
  | { readonly kind: 'rested'; readonly which: 'short' | 'long'; readonly interrupted: boolean }
  | { readonly kind: 'xp'; readonly amount: number; readonly why: string }
  | { readonly kind: 'levelled'; readonly to: number }
  | { readonly kind: 'initiative'; readonly order: readonly CombatantId[] }
  | { readonly kind: 'combat'; readonly on: boolean }
  /** The engine overruled something. Kept because refusals are telemetry (constitution I). */
  | { readonly kind: 'ruled'; readonly why: string; readonly detail: string };

/* ------------------------------------------------- applying content effects */

/**
 * The effect interpreter. Closed vocabulary in, outcome events out. The one place a
 * `scripted` effect is dispatched, and the one place that dispatch can be audited.
 */
export function applyEffects(scene: Scene, source: CombatantId, target: CombatantId | null, effects: readonly Effect[]): readonly TurnEvent[] {
  // TODO `scripted` looks up SCRIPTS[id] and throws a named error if absent, which is a
  // loud engine bug rather than a silently skipped spell. Campaign packs cannot reach here
  // because parsePack refuses `scripted` outside trusted provenance.
  throw new Error('not implemented');
}

export const SCRIPTS: Readonly<Record<string, (scene: Scene, args: Readonly<Record<string, number | string>>) => readonly TurnEvent[]>> = {};

/* ----------------------------------------------------------------- monster turns */

/**
 * What a monster does on its turn. Engine policy from the stat block's `tactics` tag, so
 * the DM never chooses whether or how the world strikes back (constitution I). Deterministic
 * in (seed, seq), so a replay produces the same fight.
 */
export function monsterMove(scene: Scene, who: Combatant): Move {
  throw new Error('not implemented');
}

/* ----------------------------------------------------- checks and saving throws */

export function abilityCheck(scene: Scene, who: Combatant, skill: SkillId, dc: number): Roll {
  throw new Error('not implemented');
}

export function savingThrow(scene: Scene, who: Combatant, ability: Ability, dc: number): Roll {
  throw new Error('not implemented');
}
