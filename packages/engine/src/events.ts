/**
 * The log. The source of truth. World state is a fold over this, the transcript
 * is a projection of `turn-recorded`, and snapshots are a disposable cache with
 * zero authority. Deleting every snapshot in the database must be a no-op
 * beyond a cold start. That property is what stops derived state from quietly
 * becoming a second source of truth.
 *
 * Events record outcomes, not commands. `meter-set` carries the resulting
 * Meter, not "apply 6 damage". This is the answer to the event-sourcing
 * versioning trap. When the rules change next quarter, every old session still
 * folds to exactly the state it had, because no rule is re-run during replay.
 * The provenance needed for audit rides along in `turn-recorded`, where nothing
 * reads it during projection.
 */

import type { Coin, EntityId, EventSeq, FactId, Meter, ObstacleKey, Ref, Seed, SessionId, TurnId } from './ids.ts';
import type { Condition, Disposition, Fact, Ledger, Scene } from './world.ts';
import type { Band, Proposal } from './proposal.ts';
import type { Degree, Roll } from './dice.ts';
import type { Ruling, Terminal } from './adjudicator.ts';

export type WorldEvent =
  | { readonly t: 'begun'; readonly scenario: string; readonly seed: Seed; readonly protagonist: EntityId }
  | { readonly t: 'entity-minted'; readonly id: EntityId; readonly name: string; readonly ledger: Ledger; readonly at: EntityId | null }
  | { readonly t: 'fact-asserted'; readonly fact: Fact }
  | { readonly t: 'fact-superseded'; readonly retired: FactId; readonly by: FactId; readonly reason: string }
  | { readonly t: 'fact-disclosed'; readonly fact: FactId }
  | { readonly t: 'meter-set'; readonly subject: EntityId; readonly to: Meter }
  | { readonly t: 'purse-set'; readonly subject: EntityId; readonly to: Coin }
  | { readonly t: 'conditions-set'; readonly subject: EntityId; readonly to: readonly Condition[] }
  | { readonly t: 'holder-set'; readonly item: EntityId; readonly to: EntityId | null }
  | { readonly t: 'placed'; readonly who: EntityId; readonly at: EntityId }
  | { readonly t: 'disposition-set'; readonly subject: EntityId; readonly to: Disposition }
  /** Carries the whole scene, so a mode change is one event and the reducer never computes a mode. */
  | { readonly t: 'scene-set'; readonly scene: Scene }
  | {
      readonly t: 'check-resolved';
      readonly approach: string;
      readonly obstacle: string;
      readonly band: Band;
      readonly roll: Roll;
      readonly degree: Degree;
    }
  | { readonly t: 'calibrated'; readonly key: ObstacleKey; readonly band: Band }
  | { readonly t: 'recap-revised'; readonly text: string; readonly through: EventSeq }
  /**
   * One per player utterance. Closes the turn. Carries everything needed to
   * rebuild the transcript and to audit the DM, and nothing the reducer reads
   * except to clear `correction`.
   *
   * `rulings` replaces the applied-plus-refused pair a looser design would
   * keep. One exhaustive list means an effect cannot appear in neither, which
   * is the failure mode that makes an audit lie.
   *
   * Contract breaches are deliberately absent. They are operational facts about
   * the deployment, not events in this world, and the transcript is projected
   * from this log. A breach reaches the operator through `EngineDeps.onBreach`
   * and the process log. `terminal` records that the turn stalled and nothing
   * more.
   */
  | {
      readonly t: 'turn-recorded';
      readonly turn: TurnId;
      readonly utterance: string;
      /** Null when the model was unreachable or breached its contract. */
      readonly proposal: Proposal | null;
      readonly rulings: readonly Ruling[];
      readonly terminal: Terminal;
      readonly bindings: readonly { readonly ref: Ref; readonly id: EntityId }[];
      readonly prose: string;
      /** Wall clock, for "days later" UI only. */
      readonly at: number;
    };

export type EventType = WorldEvent['t'];

/** A log entry as it comes back from the store. */
export interface Recorded {
  readonly seq: EventSeq;
  readonly session: SessionId;
  readonly event: WorldEvent;
}

/** One player and DM exchange, derived from `turn-recorded`. The transcript is never stored separately. */
export interface Exchange {
  readonly turn: TurnId;
  readonly at: EventSeq;
  readonly utterance: string;
  readonly prose: string;
  readonly check: { readonly obstacle: string; readonly band: Band; readonly degree: Degree } | null;
  /** Lets scrollback keep showing the rephrase invitation on a soft-failed turn. */
  readonly outcome: Terminal['kind'];
}

export function toExchange(_rec: Recorded): Exchange | null {
  throw new Error('not implemented');
}
