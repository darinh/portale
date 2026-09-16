/**
 * What a legal world is. This module does not know the model exists.
 *
 * The central claim of the design lives in `Entity`. Every thing in the world
 * carries two columns. `ledger` is closed, typed, invariant-checked and written
 * only by the adjudicator. `lore` is open free text, append-only, written by the
 * model and notarised by the engine. The engine owns everything it can do
 * arithmetic on. The model owns everything it cannot. Marga's hit points are
 * Ledger. Her missing eye and her debt to the harbourmaster are Lore. The
 * engine never needs to know that one-eyed smugglers are legal in order to own
 * the truth about how much blood Marga has left.
 */

import type { Coin, EntityId, EventSeq, FactId, Meter, ObstacleKey, SessionId, Seed } from './ids.ts';
import type { Band } from './proposal.ts';
import type { WorldEvent } from './events.ts';

/**
 * Which drawer of a character sheet a fact occupies. Closed set, chosen so the
 * engine can detect the one class of contradiction it is actually able to
 * detect, which is two incompatible statements about the same slot. The engine
 * cannot read prose and does not pretend to.
 */
export type Aspect = 'appearance' | 'allegiance' | 'wants' | 'secret' | 'history' | 'state';

export const ASPECT_CARDINALITY: Readonly<Record<Aspect, 'single' | 'many'>> = {
  appearance: 'single',
  allegiance: 'single',
  wants: 'single',
  secret: 'many',
  history: 'many',
  state: 'many',
};

/**
 * Whether the player has been told. The DM's brief contains veiled facts. The
 * PlayerView never does. This is the reason PlayerView cannot be `World`.
 */
export type Veil = 'open' | 'veiled';

/**
 * A fact never mutates and never disappears. There is no update operation on
 * canon, only assertion and supersession with a reason. Retconning is a legal
 * and sometimes excellent narrative move, so it is supported, but it is
 * explicit, attributed, and still visible in the log.
 */
export type Standing =
  | { readonly kind: 'current' }
  | { readonly kind: 'superseded'; readonly at: EventSeq; readonly by: FactId; readonly reason: string };

export interface Fact {
  readonly id: FactId;
  readonly subject: EntityId;
  readonly aspect: Aspect;
  /** Free-form. The improvisation surface. */
  readonly text: string;
  readonly veil: Veil;
  readonly establishedAt: EventSeq;
  readonly standing: Standing;
}

export type Condition = 'bleeding' | 'afraid' | 'bound' | 'hidden' | 'poisoned' | 'exhausted';

export type ItemTag = 'weapon' | 'armour' | 'tool' | 'light' | 'coinlike' | 'quest';

/** How an NPC currently feels about the protagonist. Engine-owned so the model cannot flip it for free. */
export type Disposition = 'hostile' | 'wary' | 'neutral' | 'warm' | 'devoted';

/**
 * One improvisation verb covers people, places, things, factions and clocks.
 * The DM inventing a smuggler, a hidden cove, a cursed lantern or a rising
 * alarm all take the same path through the engine.
 */
export type Ledger =
  | {
      readonly kind: 'person';
      readonly vitals: Meter;
      readonly purse: Coin;
      readonly conditions: readonly Condition[];
      readonly disposition: Disposition;
    }
  | { readonly kind: 'place'; readonly connects: readonly EntityId[] }
  | { readonly kind: 'thing'; readonly heldBy: EntityId | null; readonly tags: readonly ItemTag[] }
  | { readonly kind: 'faction'; readonly standing: number }
  | { readonly kind: 'clock'; readonly segments: Meter };

export type EntityKind = Ledger['kind'];

export interface Entity {
  readonly id: EntityId;
  /** Immutable once minted. Renaming is a supersede on an `appearance` fact, not an edit. */
  readonly name: string;
  readonly ledger: Ledger;
  /** Append-only. Includes superseded facts; readers filter by `standing`. */
  readonly lore: readonly Fact[];
  /** The place this entity is in, or null for places and abstractions. */
  readonly at: EntityId | null;
  readonly introducedAt: EventSeq;
}

export function currentLore(_e: Entity, _veil?: Veil): readonly Fact[] {
  throw new Error('not implemented');
}

export type Scene =
  | { readonly mode: 'exploration'; readonly place: EntityId; readonly present: readonly EntityId[] }
  | {
      readonly mode: 'combat';
      readonly place: EntityId;
      readonly present: readonly EntityId[];
      readonly round: number;
      /** Initiative, engine-rolled at `engage`. */
      readonly order: readonly EntityId[];
      readonly turnOf: EntityId;
    };

/**
 * The play mode, first class.
 *
 * Mode is the discriminant of `Scene` rather than a flag beside it, because it
 * decides which ops are offered, and that op list is generated straight into
 * the per-turn JSON Schema as the `op` enum. The enum probe measured a
 * four-member `op` enum correct 8/8 at every room size while a
 * twenty-five-member target enum fell to 3/8, so keeping each mode's op list
 * short is a correctness property rather than tidiness. `AFFORDANCES` in
 * `proposal.ts` is keyed by this type and by nothing else.
 *
 * It remains one contract and one pipeline. Mode changes which ops are offered,
 * what the brief emphasises, and whether the engine advances an initiative
 * order after the turn. Forking into two protocols would duplicate dice, canon,
 * persistence and rulings across two code paths.
 */
export type PlayMode = Scene['mode'];

/**
 * The engine-maintained running summary. Revised by a cheap background model
 * call after a turn commits, off the critical path. If that call fails the
 * recap stays stale and the game is unaffected.
 *
 * `spotlight` is a derived LRU of recently-referenced entities, recomputed by
 * the reducer. It is the index that makes "who is relevant right now" an O(1)
 * lookup instead of a scan.
 */
export interface Recap {
  readonly text: string;
  readonly through: EventSeq;
  readonly spotlight: readonly EntityId[];
}

export interface World {
  readonly session: SessionId;
  readonly seed: Seed;
  readonly seq: EventSeq;
  readonly protagonist: EntityId;
  readonly entities: ReadonlyMap<EntityId, Entity>;
  readonly scene: Scene;
  readonly recap: Recap;
  /**
   * "This lock, picked this way, in this room, was called hard." Remembering it
   * is what stops the DM quietly making a retry routine because it feels bad
   * for the player. A lookup table, not a prompt instruction.
   */
  readonly calibration: ReadonlyMap<ObstacleKey, Band>;
  /** Corrections from the previous turn, rendered for the next brief. Cleared each turn. */
  readonly correction: string | null;
}

/**
 * Total and trusting. `applyEvent` never validates, never rejects, never
 * throws. Events in the log were already adjudicated. Re-checking them here
 * would mean a rules change could stop old sessions from loading.
 *
 * This is the whole reason `world` and `adjudicator` are separate modules. They
 * are split by trust obligation, not by execution order. Per boundary-discipline.
 */
export function applyEvent(_w: World, _e: WorldEvent, _at: EventSeq): World {
  throw new Error('not implemented');
}

export function project(_events: readonly WorldEvent[], _from?: World): World {
  throw new Error('not implemented');
}

/** Used only by tests and by the snapshot self-check. Pure predicate. */
export function invariantsHold(_w: World): boolean {
  throw new Error('not implemented');
}
