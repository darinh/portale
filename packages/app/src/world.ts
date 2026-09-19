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
  /**
   * How hard they hit when they strike back. Zero means they never do.
   *
   * Before this existed the protagonist could only ever be the roller, never a target, so
   * a player could stab the same smuggler forever and take nothing in return. A world that
   * cannot hurt you is the "yes-manning" failure every AI DM gets accused of, made
   * structural.
   */
  readonly power: number;
  /** Where they are. The DM may only reference entities standing where the player is. */
  readonly at: LocationId;
}

export type Mode = 'exploration' | 'combat';

export type LocationId = string & { readonly __brand: 'LocationId' };

export function locationId(s: string): LocationId {
  return s as LocationId;
}

export const DIRECTIONS = ['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface Location {
  readonly id: LocationId;
  readonly name: string;
  /** What a person standing here perceives. Given to the DM, not shown raw to the player. */
  readonly description: string;
  readonly exits: ReadonlyMap<Direction, LocationId>;
  /** True once the player has been here. Drives what the map is allowed to show. */
  readonly visited: boolean;
}

export interface World {
  readonly seq: number;
  readonly seed: Seed;
  readonly mode: Mode;
  readonly scene: string;
  readonly protagonist: EntityId;
  readonly entities: ReadonlyMap<EntityId, Entity>;
  readonly locations: ReadonlyMap<LocationId, Location>;
  /** Where the player is standing. Everything the DM may reference hangs off this. */
  readonly here: LocationId;
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
  | { readonly kind: 'moved'; readonly to: LocationId; readonly via: Direction }
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
    case 'moved': {
      const dest = w.locations.get(e.to);
      if (dest === undefined) return next;

      const locations = new Map(w.locations);
      locations.set(e.to, { ...dest, visited: true });

      // The protagonist is an entity like any other, so moving the player means moving
      // their record too. Leaving it behind would let a foe in the old room keep swinging.
      const entities = new Map(w.entities);
      const you = w.entities.get(w.protagonist);
      if (you !== undefined) entities.set(w.protagonist, { ...you, at: e.to });

      return { ...next, here: e.to, locations, entities, scene: dest.name };
    }
    default:
      return next;
  }
}

export function fold(initial: World, events: readonly WorldEvent[]): World {
  return events.reduce(apply, initial);
}

/**
 * Who strikes back this turn. The engine chooses, not the model, so the world pushes back
 * whether or not the DM thought to mention it. Deterministic: the most dangerous living
 * hostile, ties broken by insertion order, so a replay picks the same foe.
 *
 * Lives here rather than in the rules because "who in this room is dangerous" is world
 * knowledge, and both the adjudicator and the scene brief need the same answer. Two copies
 * would be two places to change, and the DM would narrate one foe while another swung.
 */
export function reprisalActor(w: World): Entity | undefined {
  let best: Entity | undefined;
  for (const e of w.entities.values()) {
    if (e.id === w.protagonist || !e.hostile || e.dead || e.power <= 0) continue;
    // Location matters. Without this, walking away from a fight leaves the foe swinging at
    // you from the previous room.
    if (e.at !== w.here) continue;
    if (best === undefined || e.power > best.power) best = e;
  }
  return best;
}

/** Everyone standing where the player is, excluding the player. */
export function presentHere(w: World): readonly Entity[] {
  return [...w.entities.values()].filter((e) => e.id !== w.protagonist && e.at === w.here);
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

export interface MapRoom {
  readonly id: LocationId;
  readonly name: string;
  readonly here: boolean;
  /**
   * `to` is present only when the room on the far side has been visited. An unexplored
   * exit is drawn as a stub, which tells the player there is more that way without
   * handing them the shape of it.
   */
  readonly exits: readonly { readonly dir: Direction; readonly to: LocationId | null }[];
}

/** What the browser is allowed to see. Never the World, which holds DM-only lore. */
export interface PlayerView {
  readonly seq: number;
  readonly mode: Mode;
  readonly scene: string;
  readonly you: { readonly name: string; readonly hp: Meter; readonly defeated: boolean };
  readonly present: readonly ViewEntity[];
  readonly exits: readonly Direction[];
  /** Only rooms the player has actually stood in. The unexplored stays unexplored. */
  readonly map: readonly MapRoom[];
  readonly transcript: readonly ViewLine[];
}

function nameOf(w: World, id: EntityId): string {
  return w.entities.get(id)?.name ?? 'someone';
}

export function project(w: World): PlayerView {
  const you = w.entities.get(w.protagonist);
  const current = w.locations.get(w.here);

  return {
    seq: w.seq,
    mode: w.mode,
    scene: w.scene,
    you: {
      name: you?.name ?? 'you',
      hp: you?.hp ?? meter(0, 0),
      defeated: you?.dead ?? false,
    },
    exits: current === undefined ? [] : [...current.exits.keys()],
    // Only visited rooms. Shipping the whole graph would hand the player the dungeon.
    map: [...w.locations.values()]
      .filter((l) => l.visited)
      .map((l) => ({
        id: l.id,
        name: l.name,
        here: l.id === w.here,
        exits: [...l.exits.entries()].map(([dir, to]) => ({
          dir,
          to: w.locations.get(to)?.visited === true ? to : null,
        })),
      })),
    present: presentHere(w).map((e) => ({ id: e.id, name: e.name, hp: e.hp, dead: e.dead })),
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
          const who = e.actor === w.protagonist ? '' : `${nameOf(w, e.actor)}: `;
          return [
            {
              kind: 'roll',
              text: `${who}d${e.roll.die} → ${e.roll.face}${mod} vs DC ${e.roll.dc} · ${e.roll.success ? 'success' : 'failure'}${crit}`,
            },
          ];
        }
        case 'damaged':
          return [
            {
              kind: 'mech',
              text:
                e.target === w.protagonist
                  ? `you take ${e.amount}`
                  : `${nameOf(w, e.target)} takes ${e.amount}`,
            },
          ];
        case 'healed':
          return [{ kind: 'mech', text: `${nameOf(w, e.target)} recovers ${e.amount}` }];
        case 'died':
          return [
            {
              kind: 'mech',
              text: e.target === w.protagonist ? 'you fall' : `${nameOf(w, e.target)} falls`,
            },
          ];
        case 'ruled':
          return [{ kind: 'ruled', text: e.detail }];
        case 'moved': {
          const dest = w.locations.get(e.to);
          return [{ kind: 'move', text: `you go ${e.via}, to ${dest?.name ?? 'somewhere else'}` }];
        }
        default:
          return [];
      }
    }),
  };
}
