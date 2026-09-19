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

export type ClockId = string & { readonly __brand: 'ClockId' };

export function clockId(s: string): ClockId {
  return s as ClockId;
}

/**
 * A Blades in the Dark progress clock. Pressure you can see, rather than pressure the
 * narrator keeps asserting in adjectives.
 *
 * Named for the OUTCOME, never the method. `harbourmaster_notices`, not
 * `sneak_past_the_guard`, because the player should be able to see what is coming and
 * decide whether another attempt is worth it.
 *
 * The engine owns the segments. The model may only propose a tick on a clock that is
 * currently relevant, which is a closed enum, so it cannot invent pressure or quietly
 * resolve a threat because the moment felt dramatic.
 */
export interface Clock {
  readonly id: ClockId;
  readonly name: string;
  readonly kind: 'danger' | 'progress';
  readonly segments: number;
  readonly filled: number;
  /** A secret clock is tracked but not shown, so dread can build unannounced. */
  readonly visibility: 'open' | 'secret';
  /** What the player is told when it fills. */
  readonly payoff: string;
  readonly done: boolean;
}

export type VowId = string & { readonly __brand: 'VowId' };

export function vowId(s: string): VowId {
  return s as VowId;
}

export type VowRank = 'troublesome' | 'dangerous' | 'formidable';

/** Ironsworn progress: ten boxes of four ticks, and harder vows crawl. */
export const VOW_TICKS = 40;
export const TICKS_PER_MILESTONE: Record<VowRank, number> = {
  troublesome: 12,
  dangerous: 8,
  formidable: 4,
};

/**
 * Why the player is here. Without one, a session is a series of unrelated turns, which is
 * the difference between a game and a conversation with dice.
 *
 * Progress is engine-marked. The DM may claim a turn earned a milestone, but the engine
 * refuses the claim unless something actually happened, so a narrator cannot talk the
 * player toward their goal.
 */
export interface Vow {
  readonly id: VowId;
  readonly what: string;
  readonly rank: VowRank;
  readonly progress: number;
  readonly done: boolean;
}

export type ClueId = string & { readonly __brand: 'ClueId' };

export function clueId(s: string): ClueId {
  return s as ClueId;
}

/**
 * A discoverable piece of information, placed in a room, serving a vow.
 *
 * This exists because of the three-clue rule: a conclusion the player needs to reach
 * should have at least three ways of reaching it, so the session does not deadlock on one
 * missed roll. The engine does not enforce the count, it enforces the thing the count is
 * for, which is that a vow advances on DISCOVERY rather than on any success at all.
 *
 * Before this, winning a fight advanced an investigation. That is yes-manning wearing a
 * progress bar: the player was told they were closer to the truth because they had hit
 * somebody.
 */
export interface Clue {
  readonly id: ClueId;
  /** Player-facing. What they now know. */
  readonly what: string;
  readonly at: LocationId;
  readonly vow: VowId;
  readonly found: boolean;
}

export interface World {
  readonly seq: number;
  readonly seed: Seed;
  readonly mode: Mode;
  readonly scene: string;
  readonly protagonist: EntityId;
  readonly entities: ReadonlyMap<EntityId, Entity>;
  readonly locations: ReadonlyMap<LocationId, Location>;
  readonly clocks: ReadonlyMap<ClockId, Clock>;
  readonly vows: ReadonlyMap<VowId, Vow>;
  readonly clues: ReadonlyMap<ClueId, Clue>;
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
  | { readonly kind: 'ticked'; readonly clock: ClockId; readonly by: number; readonly why: string }
  | { readonly kind: 'filled'; readonly clock: ClockId }
  | { readonly kind: 'progressed'; readonly vow: VowId; readonly by: number; readonly why: string }
  | { readonly kind: 'fulfilled'; readonly vow: VowId }
  | { readonly kind: 'found'; readonly clue: ClueId }
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
    case 'ticked': {
      const c = w.clocks.get(e.clock);
      if (c === undefined || c.done) return next;
      const clocks = new Map(w.clocks);
      clocks.set(e.clock, { ...c, filled: Math.max(0, Math.min(c.filled + e.by, c.segments)) });
      return { ...next, clocks };
    }
    case 'filled': {
      const c = w.clocks.get(e.clock);
      if (c === undefined) return next;
      const clocks = new Map(w.clocks);
      clocks.set(e.clock, { ...c, filled: c.segments, done: true });
      return { ...next, clocks };
    }
    case 'progressed': {
      const v = w.vows.get(e.vow);
      if (v === undefined || v.done) return next;
      const vows = new Map(w.vows);
      vows.set(e.vow, { ...v, progress: Math.max(0, Math.min(v.progress + e.by, VOW_TICKS)) });
      return { ...next, vows };
    }
    case 'fulfilled': {
      const v = w.vows.get(e.vow);
      if (v === undefined) return next;
      const vows = new Map(w.vows);
      vows.set(e.vow, { ...v, progress: VOW_TICKS, done: true });
      return { ...next, vows };
    }
    case 'found': {
      const c = w.clues.get(e.clue);
      if (c === undefined || c.found) return next;
      const clues = new Map(w.clues);
      clues.set(e.clue, { ...c, found: true });
      return { ...next, clues };
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

export interface ViewClock {
  readonly id: ClockId;
  readonly name: string;
  readonly kind: 'danger' | 'progress';
  readonly filled: number;
  readonly segments: number;
  readonly done: boolean;
}

export interface ViewVow {
  readonly id: VowId;
  readonly what: string;
  readonly rank: VowRank;
  /** Filled boxes out of ten. Ironsworn draws ticks; the player reads boxes. */
  readonly boxes: number;
  readonly done: boolean;
}

/** A clue the player has actually found. Undiscovered ones are never shipped. */
export interface ViewLead {
  readonly id: ClueId;
  readonly what: string;
  readonly vow: VowId;
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
  /** Open clocks only. Secret ones are tracked and never shipped. */
  readonly clocks: readonly ViewClock[];
  readonly vows: readonly ViewVow[];
  /** What the player knows. An unfound clue has no entry, so its text cannot leak. */
  readonly leads: readonly ViewLead[];
  readonly transcript: readonly ViewLine[];
}

/** Undiscovered clues in the room the player is standing in. The DM's whole menu. */
export function cluesHere(w: World): readonly Clue[] {
  return [...w.clues.values()].filter((c) => !c.found && c.at === w.here);
}

/** Clues serving this vow that nobody has turned up yet. */
export function unfoundFor(w: World, vow: VowId): readonly Clue[] {
  return [...w.clues.values()].filter((c) => !c.found && c.vow === vow);
}

function nameOf(w: World, id: EntityId): string {
  return w.entities.get(id)?.name ?? 'someone';
}

export function project(w: World): PlayerView {
  const you = w.entities.get(w.protagonist);
  const current = w.locations.get(w.here);

  // Clock values in the transcript have to be replayed, not read off the final world.
  // Reading w.clocks while walking history would stamp today's number onto every tick
  // that ever happened.
  const running = new Map<ClockId, number>();
  const vowRunning = new Map<VowId, number>();

  const transcript: ViewLine[] = [];
  for (const e of w.log) {
    switch (e.kind) {
      case 'began':
        transcript.push({ kind: 'dm', text: e.narration });
        break;
      case 'said':
        transcript.push({ kind: 'you', text: e.text });
        break;
      case 'narrated':
        transcript.push({ kind: 'dm', text: e.text });
        break;
      case 'rolled': {
        const mod = e.roll.face === e.roll.total ? '' : ` (${e.roll.total})`;
        const crit = e.roll.critical === null ? '' : ` · critical ${e.roll.critical}`;
        const who = e.actor === w.protagonist ? '' : `${nameOf(w, e.actor)}: `;
        transcript.push({
          kind: 'roll',
          text: `${who}d${e.roll.die} → ${e.roll.face}${mod} vs DC ${e.roll.dc} · ${e.roll.success ? 'success' : 'failure'}${crit}`,
        });
        break;
      }
      case 'damaged':
        transcript.push({
          kind: 'mech',
          text: e.target === w.protagonist ? `you take ${e.amount}` : `${nameOf(w, e.target)} takes ${e.amount}`,
        });
        break;
      case 'healed':
        transcript.push({ kind: 'mech', text: `${nameOf(w, e.target)} recovers ${e.amount}` });
        break;
      case 'died':
        transcript.push({
          kind: 'mech',
          text: e.target === w.protagonist ? 'you fall' : `${nameOf(w, e.target)} falls`,
        });
        break;
      case 'ruled':
        transcript.push({ kind: 'ruled', text: e.detail });
        break;
      case 'moved':
        transcript.push({
          kind: 'move',
          text: `you go ${e.via}, to ${w.locations.get(e.to)?.name ?? 'somewhere else'}`,
        });
        break;
      case 'ticked': {
        const c = w.clocks.get(e.clock);
        if (c === undefined) break;
        const at = Math.max(0, Math.min((running.get(e.clock) ?? 0) + e.by, c.segments));
        running.set(e.clock, at);
        if (c.visibility === 'open') {
          transcript.push({ kind: 'clock', text: `${c.name}  ${at}/${c.segments}` });
        }
        break;
      }
      case 'filled': {
        const c = w.clocks.get(e.clock);
        if (c === undefined) break;
        running.set(e.clock, c.segments);
        transcript.push({ kind: 'clockdone', text: c.payoff });
        break;
      }
      case 'progressed': {
        const v = w.vows.get(e.vow);
        if (v === undefined) break;
        const at = Math.max(0, Math.min((vowRunning.get(e.vow) ?? 0) + e.by, VOW_TICKS));
        vowRunning.set(e.vow, at);
        transcript.push({
          kind: 'vow',
          text: `${v.what}  ${Math.floor(at / 4)}/10`,
        });
        break;
      }
      case 'fulfilled': {
        const v = w.vows.get(e.vow);
        if (v === undefined) break;
        vowRunning.set(e.vow, VOW_TICKS);
        transcript.push({ kind: 'vowdone', text: `Sworn and done. ${v.what}` });
        break;
      }
      case 'found': {
        const c = w.clues.get(e.clue);
        if (c === undefined) break;
        transcript.push({ kind: 'clue', text: c.what });
        break;
      }
      default:
        break;
    }
  }

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
    // Secret clocks are tracked and never shipped. Dread the player can see is tension;
    // dread they cannot is just an ambush.
    clocks: [...w.clocks.values()]
      .filter((c) => c.visibility === 'open')
      .map((c) => ({ id: c.id, name: c.name, kind: c.kind, filled: c.filled, segments: c.segments, done: c.done })),
    vows: [...w.vows.values()].map((v) => ({
      id: v.id,
      what: v.what,
      rank: v.rank,
      boxes: Math.floor(v.progress / 4),
      done: v.done,
    })),
    present: presentHere(w).map((e) => ({ id: e.id, name: e.name, hp: e.hp, dead: e.dead })),
    // Found clues only. An undiscovered clue has no entry here, so the thing the player
    // has not learned yet cannot be read out of the payload.
    leads: [...w.clues.values()]
      .filter((c) => c.found)
      .map((c) => ({ id: c.id, what: c.what, vow: c.vow })),
    transcript,
  };
}
