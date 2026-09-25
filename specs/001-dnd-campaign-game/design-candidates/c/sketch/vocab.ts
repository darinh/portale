export const ABILITIES = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;
export type Ability = (typeof ABILITIES)[number];

export const SKILLS = [
  'acrobatics',
  'animalHandling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleightOfHand',
  'stealth',
  'survival',
] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
};

export const DC_BANDS = ['veryEasy', 'easy', 'medium', 'hard', 'veryHard'] as const;
export type DcBand = (typeof DC_BANDS)[number];

export const DC_OF: Record<DcBand, number> = {
  veryEasy: 5,
  easy: 10,
  medium: 15,
  hard: 20,
  veryHard: 25,
};

export const DIRECTIONS = ['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder';

export type SlotLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Duration =
  | { readonly kind: 'instant' }
  | { readonly kind: 'rounds'; readonly n: number }
  | { readonly kind: 'concentration' }
  | { readonly kind: 'untilRest'; readonly rest: 'short' | 'long' };

export interface DiceExpr {
  readonly n: number;
  readonly die: number;
  readonly plus: number;
}

export interface Scores {
  readonly strength: number;
  readonly dexterity: number;
  readonly constitution: number;
  readonly intelligence: number;
  readonly wisdom: number;
  readonly charisma: number;
}

export interface Meter {
  readonly now: number;
  readonly max: number;
}

export function meter(now: number, max: number): Meter {
  return { now: Math.max(0, Math.min(now, max)), max };
}

export function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}
