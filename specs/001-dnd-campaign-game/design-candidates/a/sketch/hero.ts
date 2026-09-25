/**
 * The character model. Choices and consumption are stored; everything else is derived.
 *
 * `Hero` holds only what a player decided and what play has spent. `Sheet` holds armor
 * class, attack bonuses, save DCs, slot maxima and passive scores, recomputed from the
 * `Hero` and the `Library` every time it is needed and never persisted. Two numbers that
 * could disagree are one number and a function, per single-source-of-truth.
 *
 * `Combatant` is the only shape combat code sees. A hero and a monster reach it from
 * opposite directions and combat cannot tell them apart.
 */

import type {
  Ability,
  BackgroundId,
  CharacterLevel,
  ClassId,
  ConditionId,
  DamageType,
  FeatId,
  FeatureId,
  ItemId,
  ItemStack,
  Library,
  ResourceId,
  SkillId,
  SpeciesId,
  SpellId,
  SpellLevel,
  StatBlockId,
  SubclassId,
  Until,
} from './contract.ts';
import type { Seed } from './dice.ts';

export type HeroId = string & { readonly __brand: 'HeroId' };
export type CombatantId = string & { readonly __brand: 'CombatantId' };

/* ------------------------------------------------------------------- the hero */

/**
 * A hero's record. Note what is absent: hit points, armor class, attack bonus, save DCs,
 * proficiency bonus, spell slot maxima, carrying capacity. All derived.
 *
 * Note also what is present in an odd form. `hpLost`, not `hpNow`: levelling moves the
 * maximum, and a stored current value would have to be migrated in step with it. Damage
 * taken cannot disagree with a maximum it does not know about.
 */
export interface Hero {
  readonly id: HeroId;
  readonly name: string;
  readonly species: SpeciesId;
  readonly background: BackgroundId;
  readonly klass: ClassId;
  readonly subclass: SubclassId | null;
  readonly level: CharacterLevel;
  readonly xp: number;

  /** As assigned at creation, before background increases. `sheetOf` applies those. */
  readonly assigned: Readonly<Record<Ability, number>>;
  readonly skills: readonly SkillId[];
  readonly expertise: readonly SkillId[];
  readonly feats: readonly FeatId[];
  readonly masteries: readonly ItemId[];

  readonly inventory: readonly ItemStack[];
  readonly equipped: Equipped;
  readonly coinCp: number;

  readonly preparedSpells: readonly SpellId[];

  /* consumption */
  readonly hpLost: number;
  readonly tempHp: number;
  /** Index i is slots spent at level i+1. Maxima come from the class table. */
  readonly slotsSpent: readonly number[];
  readonly hitDiceSpent: number;
  readonly resourcesSpent: Readonly<Record<string, number>>;
  readonly conditions: readonly ActiveCondition[];
  readonly concentrating: SpellId | null;
  readonly exhaustion: number;
  readonly heroicInspiration: boolean;
  /** Derived from the log in practice; carried here for the projection's convenience. */
  readonly deathSaves: { readonly successes: number; readonly failures: number };
}

export interface Equipped {
  readonly mainHand: ItemId | null;
  readonly offHand: ItemId | null;
  readonly armor: ItemId | null;
  readonly attuned: readonly ItemId[];
}

export interface ActiveCondition {
  readonly condition: ConditionId;
  readonly until: Until;
  readonly source: string;
}

/* ------------------------------------------------------------------ the sheet */

/**
 * Everything derived. Built once per turn and thrown away. Never stored, never sent to
 * the browser as-is, never sent to the model.
 */
export interface Sheet {
  readonly abilities: Readonly<Record<Ability, number>>;
  readonly mods: Readonly<Record<Ability, number>>;
  readonly proficiencyBonus: number;
  readonly armorClass: number;
  readonly hpMax: number;
  readonly hpNow: number;
  readonly hitDice: { readonly die: number; readonly total: number; readonly left: number };
  readonly speed: number;
  readonly initiativeMod: number;
  readonly saveMods: Readonly<Record<Ability, number>>;
  readonly skillMods: ReadonlyMap<SkillId, number>;
  readonly passivePerception: number;
  readonly spellSaveDc: number | null;
  readonly spellAttackMod: number | null;
  readonly slots: readonly { readonly level: SpellLevel; readonly max: number; readonly left: number }[];
  readonly preparedMax: number;
  readonly resources: readonly { readonly id: ResourceId; readonly max: number; readonly left: number }[];
  readonly features: readonly FeatureId[];
  readonly dying: boolean;
  readonly dead: boolean;
}

/**
 * The single derivation. Every number a player sees about their character comes from
 * here, which is why FR-001 can be checked by reading one function.
 */
export function sheetOf(hero: Hero, lib: Library): Sheet {
  // TODO order: abilities (assigned + background increases, capped at 20) -> mods ->
  // proficiency bonus from level -> class/species/feature grants folded in -> equipment
  // (armor sets AC by its own rule; shield adds; unarmored defence is a feature Grant) ->
  // spellcasting table by class progression and level -> conditions applied last, because
  // exhaustion subtracts 2 x level from every d20 test and that must not be double counted.
  throw new Error('not implemented');
}

/** Level from total XP, by the SRD 5.2.1 p.23 table. Pure, and the only such mapping. */
export function levelForXp(xp: number): CharacterLevel {
  throw new Error('not implemented');
}

export function xpForLevel(n: CharacterLevel): number {
  throw new Error('not implemented');
}

/* --------------------------------------------------------------- the combatant */

/**
 * What combat sees. Seven fields hide the difference between a level-3 rogue assembled
 * from six content entities and a Giant Rat read straight out of a stat block.
 */
export interface Combatant {
  readonly id: CombatantId;
  readonly name: string;
  readonly ac: number;
  readonly hpNow: number;
  readonly hpMax: number;
  readonly speed: number;
  readonly initiativeMod: number;
  readonly conditions: readonly ActiveCondition[];
  readonly resistances: readonly DamageType[];
  readonly immunities: readonly (DamageType | ConditionId)[];
  saveMod(ability: Ability): number;
  /** Already filtered to what this creature can do right now. Feeds the menu and the AI. */
  attacks(): readonly AttackOption[];
}

export interface AttackOption {
  readonly name: string;
  readonly item: ItemId | null;
  readonly toHit: number;
  readonly damage: string;
  readonly damageType: DamageType;
  readonly reach: 'melee' | 'ranged';
}

export function combatantOfHero(hero: Hero, sheet: Sheet, lib: Library): Combatant {
  throw new Error('not implemented');
}

export function combatantOfStatBlock(id: StatBlockId, instance: number, lib: Library, seed: Seed): Combatant {
  // TODO hp is rolled from the stat block's dice spec with (seed, instance) so a replay
  // gives the same goblin the same hit points.
  throw new Error('not implemented');
}

/* ------------------------------------------------------------------- creation */

/**
 * The three methods the user asked for, plus the free method that exists because a player
 * "could technically just keep restarting" (spec FR-002). Rolling is seeded so a save
 * replays; the seed is the save's, not the wall clock's.
 */
export type AbilityMethod =
  | { readonly kind: 'roll' }
  | { readonly kind: 'array' }
  | { readonly kind: 'pointBuy'; readonly spend: Readonly<Record<Ability, number>> }
  | { readonly kind: 'free'; readonly scores: Readonly<Record<Ability, number>> };

export interface HeroDraft {
  readonly name: string;
  readonly method: AbilityMethod;
  readonly assignment: readonly Ability[];
  readonly species: SpeciesId;
  readonly background: BackgroundId;
  readonly klass: ClassId;
  readonly skills: readonly SkillId[];
  readonly expertise: readonly SkillId[];
  readonly backgroundIncrease: { readonly plusTwo: Ability; readonly plusOne: Ability } | { readonly spread: true };
  readonly equipmentChoice: readonly ItemId[];
  readonly preparedSpells: readonly SpellId[];
  readonly masteries: readonly ItemId[];
}

export interface DraftProblem {
  readonly field: string;
  readonly message: string;
}

/**
 * Validated once, here. A `Hero` that exists is a legal `Hero`, so nothing downstream
 * re-checks a proficiency count or a point-buy total (boundary-discipline).
 */
export function createHero(draft: HeroDraft, lib: Library, seed: Seed): { readonly hero: Hero } | { readonly problems: readonly DraftProblem[] } {
  throw new Error('not implemented');
}

/**
 * A replacement hero after a death, at the dead hero's level with the XP that level
 * requires (spec US9 AS1). Levelling from 1 to N applies every intermediate choice, which
 * is why `levelUp` and not a shortcut: a level-4 hero built in one step and a level-4 hero
 * who played there must be the same shape.
 */
export function createHeroAtLevel(draft: HeroDraft, atLevel: CharacterLevel, lib: Library, seed: Seed): { readonly hero: Hero } | { readonly problems: readonly DraftProblem[] } {
  throw new Error('not implemented');
}

export interface LevelChoice {
  readonly subclass: SubclassId | null;
  readonly abilityImprovement: readonly [Ability, Ability] | null;
  readonly feat: FeatId | null;
  readonly spellsLearned: readonly SpellId[];
  readonly masterySwap: { readonly drop: ItemId; readonly take: ItemId } | null;
}

/**
 * What the level-up screen must ask before it can proceed. Derived from the class table,
 * so a campaign-supplied class asks its own questions through the same code (US10).
 */
export function pendingChoices(hero: Hero, toLevel: CharacterLevel, lib: Library): readonly string[] {
  throw new Error('not implemented');
}

export function levelUp(hero: Hero, choice: LevelChoice, lib: Library, seed: Seed): Hero {
  // TODO hit points use the fixed value (SRD 5.2.1 p.23) rather than a roll, so a
  // level-up is not a place a save can diverge. hpLost is untouched: gaining a level
  // raises the maximum and heals nothing, which is the rule, and is free here because we
  // store damage rather than current hit points.
  throw new Error('not implemented');
}

/* ------------------------------------------------------------------ the dying */

export type DeathState = 'alive' | 'dying' | 'stable' | 'dead';

/**
 * Derived by counting death-save events since the last stabilisation, not stored, so the
 * log stays the only authority (constitution III).
 */
export function deathStateOf(hero: Hero): DeathState {
  throw new Error('not implemented');
}
