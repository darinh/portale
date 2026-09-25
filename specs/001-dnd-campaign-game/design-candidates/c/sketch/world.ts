/**
 * A legal world, and the total fold that produces one.
 * apply never rolls, never looks up live files, never rejects. Events were judged when written.
 */

import type { Goal } from './content.ts';
import type {
  ClockId,
  ClueId,
  EntityId,
  HeroId,
  LocationId,
  ModuleId,
  MonsterId,
  Seed,
  VowId,
} from './ids.ts';
import type { Direction, Meter } from './vocab.ts';

export type Mode = 'exploration' | 'combat';

export interface Being {
  readonly id: EntityId;
  readonly name: string;
  readonly lore: string;
  readonly at: LocationId;
  readonly hp: Meter;
  readonly hostile: boolean;
  readonly dead: boolean;
  readonly monster: MonsterId | null;
}

export interface Location {
  readonly id: LocationId;
  readonly name: string;
  readonly description: string;
  readonly exits: ReadonlyMap<Direction, LocationId>;
  readonly visited: boolean;
}

export interface Clock {
  readonly id: ClockId;
  readonly name: string;
  readonly kind: 'danger' | 'progress';
  readonly segments: 4 | 6 | 8;
  readonly filled: number;
  readonly visibility: 'open' | 'secret';
  readonly payoff: string;
  readonly done: boolean;
}

export interface Vow {
  readonly id: VowId;
  readonly what: string;
  readonly rank: 'troublesome' | 'dangerous' | 'formidable';
  readonly progress: number;
  readonly done: boolean;
}

export interface Clue {
  readonly id: ClueId;
  readonly what: string;
  readonly at: LocationId;
  readonly found: boolean;
}

export interface CombatOrder {
  readonly round: number;
  readonly order: readonly EntityId[];
  readonly whose: number;
}

export interface World {
  readonly seq: number;
  readonly seed: Seed;
  readonly mode: Mode;
  readonly module: ModuleId;
  readonly scene: string;
  readonly hero: HeroId;
  readonly protagonist: EntityId;
  readonly beings: ReadonlyMap<EntityId, Being>;
  readonly locations: ReadonlyMap<LocationId, Location>;
  readonly clocks: ReadonlyMap<ClockId, Clock>;
  readonly vows: ReadonlyMap<VowId, Vow>;
  readonly clues: ReadonlyMap<ClueId, Clue>;
  readonly here: LocationId;
  readonly combat: CombatOrder | null;
  readonly turnsWithoutDiscovery: number;
  readonly log: readonly WorldEvent[];
}

export type WorldEvent =
  | { readonly kind: 'began'; readonly scene: string; readonly narration: string }
  | { readonly kind: 'said'; readonly text: string }
  | { readonly kind: 'narrated'; readonly text: string }
  | { readonly kind: 'proposed'; readonly actKind: string; readonly target: string; readonly band: string }
  | { readonly kind: 'rolled'; readonly face: number; readonly die: number; readonly total: number; readonly dc: number; readonly success: boolean; readonly why: string; readonly actor: EntityId }
  | { readonly kind: 'damaged'; readonly target: EntityId; readonly amount: number }
  | { readonly kind: 'healed'; readonly target: EntityId; readonly amount: number }
  | { readonly kind: 'died'; readonly target: EntityId }
  | { readonly kind: 'dying'; readonly target: EntityId }
  | { readonly kind: 'stabilised'; readonly target: EntityId }
  | { readonly kind: 'introduced'; readonly being: Being }
  | { readonly kind: 'moved'; readonly to: LocationId; readonly via: Direction }
  | { readonly kind: 'ticked'; readonly clock: ClockId; readonly by: number; readonly why: string }
  | { readonly kind: 'filled'; readonly clock: ClockId }
  | { readonly kind: 'progressed'; readonly vow: VowId; readonly by: number; readonly why: string }
  | { readonly kind: 'fulfilled'; readonly vow: VowId }
  | { readonly kind: 'found'; readonly clue: ClueId }
  | { readonly kind: 'mode'; readonly to: Mode }
  | { readonly kind: 'combatBegan'; readonly order: readonly EntityId[] }
  | { readonly kind: 'turnAdvanced'; readonly whose: EntityId; readonly round: number }
  | { readonly kind: 'itemTaken'; readonly item: string; readonly qty: number }
  | { readonly kind: 'itemUsed'; readonly item: string }
  | { readonly kind: 'rested'; readonly rest: 'short' | 'long' }
  | { readonly kind: 'ruled'; readonly why: string; readonly detail: string };

export function apply(w: World, e: WorldEvent): World {
  void w;
  void e;
  throw new Error('not implemented');
}

export function fold(initial: World, events: readonly WorldEvent[]): World {
  return events.reduce(apply, initial);
}

export function presentHere(w: World): readonly Being[] {
  void w;
  throw new Error('not implemented');
}

export function goalHolds(w: World, goal: Goal): boolean {
  void w;
  void goal;
  // TODO recursive eval. Winning is this predicate, not a DM milestone claim.
  throw new Error('not implemented');
}
