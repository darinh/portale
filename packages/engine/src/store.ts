/**
 * Persistence port. Append-only log, compare-and-swap on the head, and an
 * opaque snapshot cache. The storage schema never leaves this module.
 *
 * Single writer per session, enforced by CAS. Two browser tabs on the same
 * session are two actors who might both write, so the question is what happens,
 * and the answer must not be "it depends". `append` takes the head the caller
 * folded from. A mismatch means someone else committed first, and the loser is
 * rejected, not merged. The engine turns that rejection into "replay the
 * winner's turn", which is what the second tab should show.
 * Per separate-before-serializing-shared-state: no shared mutable state, one
 * serialisation point, and it is visible in the signature.
 */

import type { EventSeq, SessionId, TurnId } from './ids.ts';
import type { Recorded, WorldEvent } from './events.ts';

export type AppendResult =
  | { readonly ok: true; readonly head: EventSeq; readonly written: readonly Recorded[] }
  | { readonly ok: false; readonly reason: 'stale-head'; readonly head: EventSeq };

export interface EventStore {
  head(session: SessionId): Promise<EventSeq>;

  /** Ascending from `from` inclusive. Paged for transcript reads. */
  read(session: SessionId, from: EventSeq, limit?: number): Promise<readonly Recorded[]>;

  /** Descending. Used for "last N exchanges" without folding the whole log. */
  readBack(session: SessionId, before: EventSeq, limit: number): Promise<readonly Recorded[]>;

  /** Atomic. All events land together or none do. */
  append(session: SessionId, expectedHead: EventSeq, events: readonly WorldEvent[]): Promise<AppendResult>;

  /**
   * Idempotency. A client retrying a turn after a dropped connection sends the
   * same TurnId. If the turn already committed, the engine replays the stored
   * one instead of rolling fresh dice and spending the gold twice.
   * Per make-operations-idempotent.
   */
  findTurn(session: SessionId, turn: TurnId): Promise<Recorded | null>;

  /**
   * Opaque bytes. The store does not know what a World is, so a change to the
   * snapshot format is not a migration. And the snapshot has no authority.
   * `DELETE FROM snapshots` must be a safe operation whose only cost is a
   * colder first load.
   */
  snapshot(session: SessionId): Promise<{ readonly at: EventSeq; readonly blob: Uint8Array } | null>;
  putSnapshot(session: SessionId, at: EventSeq, blob: Uint8Array): Promise<void>;
}

export function sqliteStore(_url: string): EventStore {
  throw new Error('not implemented');
}

export function memoryStore(): EventStore {
  throw new Error('not implemented');
}
