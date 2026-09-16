/**
 * The only randomness in the system. Pure, seeded, positional, replayable.
 *
 * There is no RNG object with hidden state. A draw is a pure function of the
 * session seed, the committed log height, the turn id, and an index within the
 * turn. Two consequences fall straight out of that. Audit and replay are exact,
 * because re-folding the log re-derives the same die. And you cannot disconnect
 * to reroll, because a turn commits its events in one transaction, so a process
 * that dies mid-turn leaves the height unchanged and the retry draws the
 * identical number. Reroll-scumming is not policed, it is arithmetically
 * unavailable.
 */

import type { EventSeq, Seed, TurnId, EntityId } from './ids.ts';
import type { Band } from './proposal.ts';
import type { World } from './world.ts';

export interface RollKey {
  readonly seed: Seed;
  readonly height: EventSeq;
  readonly turn: TurnId;
  readonly index: number;
}

export interface Roll {
  readonly faces: 20;
  readonly natural: number;
  /** Engine-derived from approach. Never model-authored. */
  readonly bonus: number;
  readonly total: number;
  /** Engine-derived from Band. */
  readonly target: number;
  readonly key: RollKey;
}

/**
 * Five degrees, two of which the model never has to reason about. The model
 * supplies `onSuccess` and `onFailure` only; the engine derives the middle.
 * Asking a 14B for a third conditional branch buys a worse failure rate than
 * the extra nuance is worth.
 */
export type Degree = 'triumph' | 'success' | 'cost' | 'failure' | 'disaster';

/** Pure. 1..faces. */
export function draw(_key: RollKey, _faces: number): number {
  throw new Error('not implemented');
}

export function resolve(_key: RollKey, _band: Band, _bonus: number): { readonly roll: Roll; readonly degree: Degree } {
  throw new Error('not implemented');
}

/**
 * `cost` means apply the success effects and turn one segment on a clock in the
 * scene. Success at a cost with real teeth, without a third branch in the
 * contract and without the model getting to choose what the cost is.
 *
 * TODO: pick the clock. Nearest unfilled clock in scene, else the scene's
 * default pressure clock, else mint an engine-authored "trouble" clock.
 */
export function costTarget(_w: World): EntityId | null {
  throw new Error('not implemented');
}
