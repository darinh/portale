/**
 * The hero's sheet is stored. AC, attack bonus, save DC, slots, and max HP are derived.
 * NPCs do not use this type. They are stat-block instances on the world.
 */

import type { ContentIndex } from './content.ts';
import type {
  BackgroundId,
  ClassId,
  FeatId,
  HeroId,
  ItemId,
  ItemInstanceId,
  Level,
  ResourceId,
  SpeciesId,
  SpellId,
  SubclassId,
} from './ids.ts';
import type { Ability, Meter, Scores, Skill, SlotLevel } from './vocab.ts';

export type AbilityMethod =
  | { readonly kind: 'roll' }
  | { readonly kind: 'buy' }
  | { readonly kind: 'array' }
  | { readonly kind: 'free' };

export interface ItemInstance {
  readonly id: ItemInstanceId;
  readonly def: ItemId;
  readonly qty: number;
  readonly equipped: boolean;
}

export type Vitality =
  | { readonly kind: 'up'; readonly hp: Meter }
  | { readonly kind: 'dying'; readonly hp: Meter; readonly successes: 0 | 1 | 2; readonly failures: 0 | 1 | 2 }
  | { readonly kind: 'stable'; readonly hp: Meter }
  | { readonly kind: 'dead'; readonly hp: Meter; readonly atLevel: Level };

export interface HeroRecord {
  readonly id: HeroId;
  readonly name: string;
  readonly species: SpeciesId;
  readonly background: BackgroundId;
  readonly classId: ClassId;
  readonly subclass: SubclassId | null;
  readonly level: Level;
  readonly xp: number;
  readonly method: AbilityMethod;
  readonly scores: Scores;
  readonly skills: readonly Skill[];
  readonly expertise: readonly Skill[];
  readonly feats: readonly FeatId[];
  readonly prepared: readonly SpellId[];
  readonly known: readonly SpellId[];
  readonly inventory: readonly ItemInstance[];
  readonly gold: number;
  readonly vitality: Vitality;
  readonly hitDice: Meter;
  readonly slots: ReadonlyMap<SlotLevel, Meter>;
  readonly resources: ReadonlyMap<ResourceId, Meter>;
  readonly inspiration: boolean;
  readonly exhaustion: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly conditions: readonly string[];
  readonly concentrating: SpellId | null;
}

export interface HeroDraft {
  readonly name: string;
  readonly species: SpeciesId;
  readonly background: BackgroundId;
  readonly classId: ClassId;
  readonly method: AbilityMethod;
  readonly scores: Scores;
  readonly skills: readonly Skill[];
  readonly feats: readonly FeatId[];
  readonly prepared: readonly SpellId[];
  readonly known: readonly SpellId[];
  readonly equipment: readonly ItemId[];
}

export interface DerivedStats {
  readonly pb: number;
  readonly mods: Scores;
  readonly ac: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly proficiency: ReadonlySet<Skill>;
  readonly saveBonus: Record<Ability, number>;
  readonly spellDc: number | null;
  readonly spellAttack: number | null;
  readonly attackBonus: (weapon: ItemInstanceId) => number;
}

export function rollScores(seed: number, seq: number): Scores {
  void seed;
  void seq;
  // TODO six times 4d6 drop lowest, same dice module as play. Replay must match.
  throw new Error('not implemented');
}

export function pointBuy(scores: Scores): boolean {
  void scores;
  // TODO 27 points, 8-15, costs from SRD 5.2.1 p. 21. True iff legal.
  throw new Error('not implemented');
}

export function applyDraft(draft: HeroDraft, index: ContentIndex, at: Level, seqXp: number): HeroRecord {
  void draft;
  void index;
  void at;
  void seqXp;
  // TODO construct a record. Max HP from hit die + con. Slots from class table.
  // Free assignment capped at 20. Background ASI applied here, never stored twice.
  throw new Error('not implemented');
}

export function derive(hero: HeroRecord, index: ContentIndex): DerivedStats {
  void hero;
  void index;
  // TODO single source. Callers read DerivedStats, never recompute a bonus by hand.
  throw new Error('not implemented');
}

export function checkBonus(hero: HeroRecord, derived: DerivedStats, skill: Skill): number {
  void hero;
  void derived;
  void skill;
  throw new Error('not implemented');
}

export function xpForLevel(n: Level): number {
  void n;
  // TODO SRD 5.2.1 p. 23 table. One array, both gain and replacement use it.
  throw new Error('not implemented');
}

export function replacementXp(dead: HeroRecord): number {
  return xpForLevel(dead.level);
}
