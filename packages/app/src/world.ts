/**
 * What a legal world is, and the fold that produces one.
 *
 * `apply` is total and trusting. It never validates and never rejects. Events in the log
 * were adjudicated when they were written, so re-checking them on replay would mean a
 * rules change tomorrow could stop a session saved today from loading.
 */

import type { Roll, Seed } from './dice.ts';

export type EntityId = string & { readonly __brand: 'EntityId' };

export function entityId(s: string): EntityId {
  return s as EntityId;
}

export interface Meter {
  readonly now: number;
  readonly max: number;
}

/** Construction, not a check. A Meter cannot hold a value outside its bounds. */
export function meter(now: number, max: number): Meter {
  return { now: Math.max(0, Math.min(now, max)), max };
}

export function shift(m: Meter, by: number): Meter {
  return meter(m.now + by, m.max);
}

export interface Entity {
  readonly id: EntityId;
  readonly name: string;
  /** What the DM may say about them. Invented entities carry their own lore. */
  readonly lore: string;
  readonly hp: Meter;
  readonly hostile: boolean;
  readonly dead: boolean;
}

export type Mode = 'exploration' | 'combat';

export interface World {
  readonly seq: number;
  readonly seed: Seed;
  readonly mode: Mode;
  readonly scene: string;
  readonly protagonist: EntityId;
  readonly entities: ReadonlyMap<EntityId, Entity>;
  readonly log: readonly WorldEvent[];
}

export type WorldEvent =
  | { readonly kind: 'began'; readonly scene: string; readonly narration: string }
  /** What the player typed. In the log because a transcript without it is unreadable. */
  | { readonly kind: 'said'; readonly text: string }
  | { readonly kind: 'narrated'; readonly text: string }
  /**
   * What the DM actually asked for, recorded before the engine judged it. Never shown to
   * the player. Without this the log cannot answer why a session had no mechanics, which
   * is exactly the question a real ten-turn transcript raised and the log could not answer.
   */
  | {
      readonly kind: 'proposed';
      readonly op: string;
      readonly target: string;
      readonly difficulty: number;
      readonly damage: number;
    }
  | { readonly kind: 'rolled'; readonly roll: Roll; readonly actor: EntityId; readonly why: string }
  | { readonly kind: 'damaged'; readonly target: EntityId; readonly amount: number }
  | { readonly kind: 'healed'; readonly target: EntityId; readonly amount: number }
  | { readonly kind: 'died'; readonly target: EntityId }
  | { readonly kind: 'introduced'; readonly entity: Entity }
  | { readonly kind: 'mode'; readonly to: Mode }
  /** The engine overruled the DM. Kept in the log because refusals are telemetry. */
  | { readonly kind: 'ruled'; readonly why: string; readonly detail: string };

export function apply(w: World, e: WorldEvent): World {
  const next: World = { ...w, seq: w.seq + 1, log: [...w.log, e] };
  switch (e.kind) {
    case 'began':
      return { ...next, scene: e.scene };
    case 'introduced': {
      const entities = new Map(w.entities);
      entities.set(e.entity.id, e.entity);
      return { ...next, entities };
    }
    case 'damaged':
    case 'healed': {
      const target = w.entities.get(e.target);
      if (target === undefined) return next;
      const entities = new Map(w.entities);
      const delta = e.kind === 'damaged' ? -e.amount : e.amount;
      entities.set(e.target, { ...target, hp: shift(target.hp, delta) });
      return { ...next, entities };
    }
    case 'died': {
      const target = w.entities.get(e.target);
      if (target === undefined) return next;
      const entities = new Map(w.entities);
      entities.set(e.target, { ...target, dead: true, hp: meter(0, target.hp.max) });
      return { ...next, entities };
    }
    case 'mode':
      return { ...next, mode: e.to };
    default:
      return next;
  }
}

export function fold(initial: World, events: readonly WorldEvent[]): World {
  return events.reduce(apply, initial);
}

export interface ViewEntity {
  readonly id: EntityId;
  readonly name: string;
  readonly hp: Meter;
  readonly dead: boolean;
}

export interface ViewLine {
  readonly kind: string;
  readonly text: string;
}

/** What the browser is allowed to see. Never the World, which holds DM-only lore. */
export interface PlayerView {
  readonly seq: number;
  readonly mode: Mode;
  readonly scene: string;
  readonly you: { readonly name: string; readonly hp: Meter };
  readonly present: readonly ViewEntity[];
  readonly transcript: readonly ViewLine[];
}

function nameOf(w: World, id: EntityId): string {
  return w.entities.get(id)?.name ?? 'someone';
}

export function project(w: World): PlayerView {
  const you = w.entities.get(w.protagonist);
  return {
    seq: w.seq,
    mode: w.mode,
    scene: w.scene,
    you: { name: you?.name ?? 'you', hp: you?.hp ?? meter(0, 0) },
    present: [...w.entities.values()]
      .filter((e) => e.id !== w.protagonist)
      .map((e) => ({ id: e.id, name: e.name, hp: e.hp, dead: e.dead })),
    transcript: w.log.flatMap((e): ViewLine[] => {
      switch (e.kind) {
        case 'began':
          return [{ kind: 'dm', text: e.narration }];
        case 'said':
          return [{ kind: 'you', text: e.text }];
        case 'narrated':
          return [{ kind: 'dm', text: e.text }];
        case 'rolled': {
          const mod = e.roll.face === e.roll.total ? '' : ` (${e.roll.total})`;
          const crit = e.roll.critical === null ? '' : ` · critical ${e.roll.critical}`;
          return [
            {
              kind: 'roll',
              text: `d${e.roll.die} → ${e.roll.face}${mod} vs DC ${e.roll.dc} · ${e.roll.success ? 'success' : 'failure'}${crit}`,
            },
          ];
        }
        case 'damaged':
          return [{ kind: 'mech', text: `${nameOf(w, e.target)} takes ${e.amount}` }];
        case 'healed':
          return [{ kind: 'mech', text: `${nameOf(w, e.target)} recovers ${e.amount}` }];
        case 'died':
          return [{ kind: 'mech', text: `${nameOf(w, e.target)} falls` }];
        case 'ruled':
          return [{ kind: 'ruled', text: e.detail }];
        default:
          return [];
      }
    }),
  };
}
