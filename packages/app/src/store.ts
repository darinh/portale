/**
 * Persistence port.
 *
 * The event log is the only authority. A session is rebuilt by folding its events, so
 * there is nothing to migrate when the world shape changes and no snapshot that can go
 * stale. Deleting derived state is always safe because there is none.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WorldEvent } from './world.ts';

export interface StoredSession {
  readonly id: string;
  readonly scenario: string;
  readonly seed: number;
  readonly events: readonly WorldEvent[];
}

export interface ListedSession {
  readonly id: string;
  readonly scenario: string;
  readonly seed: number;
  readonly turns: number;
}

export interface Store {
  create(id: string, scenario: string, seed: number): void;
  append(id: string, events: readonly WorldEvent[]): void;
  load(id: string): StoredSession | null;
  /** Most recently played first. */
  list(): readonly ListedSession[];
  /** True when there was a session to delete. Its events go with it, in one transaction. */
  delete(id: string): boolean;
  close(): void;
}

export function openStore(path: string): Store {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      scenario TEXT NOT NULL,
      seed INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS events (
      session_id TEXT NOT NULL REFERENCES sessions(id),
      seq INTEGER NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (session_id, seq)
    );
  `);

  const insSession = db.prepare('INSERT INTO sessions (id, scenario, seed) VALUES (?, ?, ?)');
  const nextSeq = db.prepare('SELECT COALESCE(MAX(seq), -1) + 1 AS n FROM events WHERE session_id = ?');
  const insEvent = db.prepare('INSERT INTO events (session_id, seq, payload) VALUES (?, ?, ?)');
  const getSession = db.prepare('SELECT id, scenario, seed FROM sessions WHERE id = ?');
  const getEvents = db.prepare('SELECT payload FROM events WHERE session_id = ? ORDER BY seq');
  // Ordered by the newest event row, which is when the tale was last played. created_at has
  // one-second resolution, so two sessions started together tied and listed in any order.
  const listSessions = db.prepare(`
    SELECT s.id AS id,
           s.scenario AS scenario,
           s.seed AS seed,
           COUNT(CASE WHEN json_extract(e.payload, '$.kind') = 'said' THEN 1 END) AS turns
    FROM sessions s LEFT JOIN events e ON e.session_id = s.id
    GROUP BY s.id ORDER BY COALESCE(MAX(e.rowid), 0) DESC, s.rowid DESC
  `);
  const delEvents = db.prepare('DELETE FROM events WHERE session_id = ?');
  const delSession = db.prepare('DELETE FROM sessions WHERE id = ?');

  /**
   * All or nothing. A turn that failed halfway used to leave the player's words saved without
   * the roll that answered them.
   */
  function inTransaction<T>(work: () => T): T {
    db.exec('BEGIN');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  return {
    create(id, scenario, seed) {
      insSession.run(id, scenario, seed);
    },
    append(id, events) {
      inTransaction(() => {
        let seq = Number((nextSeq.get(id) as { n: number }).n);
        for (const e of events) {
          insEvent.run(id, seq, JSON.stringify(e));
          seq += 1;
        }
      });
    },
    load(id) {
      const s = getSession.get(id) as { id: string; scenario: string; seed: number } | undefined;
      if (s === undefined) return null;
      const rows = getEvents.all(id) as { payload: string }[];
      return {
        id: s.id,
        scenario: s.scenario,
        seed: Number(s.seed),
        events: rows.map((r) => JSON.parse(r.payload) as WorldEvent),
      };
    },
    list() {
      return (listSessions.all() as { id: string; scenario: string; seed: number; turns: number }[]).map((r) => ({
        id: r.id,
        scenario: r.scenario,
        seed: Number(r.seed),
        turns: Number(r.turns),
      }));
    },
    delete(id) {
      return inTransaction(() => {
        delEvents.run(id);
        return Number(delSession.run(id).changes) > 0;
      });
    },
    close() {
      db.close();
    },
  };
}
