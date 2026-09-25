import type {
	Ability, Catalog, Cell, Die, Duration, Id, Level, Modifier,
	Nonempty, PublicText, Ref, Scores, Selection, Skill, Training,
} from './contracts.ts';

export type AbilityChoice =
	| { readonly kind: 'rolled'; readonly rolls: readonly [Id<'roll'>, Id<'roll'>, Id<'roll'>, Id<'roll'>, Id<'roll'>, Id<'roll'>]; readonly assignment: Readonly<Record<Ability, Id<'roll'>>> }
	| { readonly kind: 'point-buy'; readonly base: Scores }
	| { readonly kind: 'free'; readonly final: Scores };
export interface CharacterChoices {
	readonly name: PublicText;
	readonly species: Ref<'species'>;
	readonly background: Ref<'background'>;
	readonly class: Ref<'class'>;
	readonly abilities: AbilityChoice;
	readonly backgroundIncreases: Readonly<Record<Ability, 0 | 1 | 2>>;
	readonly selections: readonly Selection[];
}
export interface LevelGrant {
	readonly level: Level;
	readonly hpGrowth: { readonly kind: 'fixed'; readonly value: number } | { readonly kind: 'rolled'; readonly roll: Id<'roll'>; readonly value: number };
	readonly selections: readonly Selection[];
}
export type Life =
	| { readonly kind: 'conscious' }
	| { readonly kind: 'dying'; readonly successes: 0 | 1 | 2; readonly failures: 0 | 1 | 2 }
	| { readonly kind: 'stable'; readonly recoverAtMinute: number }
	| { readonly kind: 'dead'; readonly death: Id<'death'> };
export interface ConditionInstance {
	readonly id: Id<'condition-instance'>;
	readonly condition: Ref<'condition'>;
	readonly source: Id<'actor'>;
	readonly duration: Duration;
	readonly beganAt: number;
	readonly stacks: number;
}
export interface Body {
	readonly damageTaken: number;
	readonly temporaryHp: number;
	readonly life: Life;
	readonly conditions: readonly ConditionInstance[];
	readonly concentration: null | { readonly effect: Id<'effect'>; readonly spell: Ref<'spell'> };
}
export interface Position {
	readonly location: Id<'location'>;
	readonly cell: Cell;
}
export type Custody =
	| { readonly kind: 'actor'; readonly actor: Id<'actor'> }
	| { readonly kind: 'ground'; readonly position: Position }
	| { readonly kind: 'quest'; readonly item: Id<'quest-item'> };
export interface ItemInstance {
	readonly id: Id<'item-instance'>;
	readonly item: Ref<'item'>;
	readonly count: number;
	readonly custody: Custody;
	readonly chargesSpent: number;
}
export interface Hero {
	readonly id: Id<'actor'>;
	readonly kind: 'hero';
	readonly choices: CharacterChoices;
	readonly advancement: Nonempty<LevelGrant>;
	readonly xp: number;
	readonly body: Body;
	readonly position: Position;
	readonly resourcesSpent: ReadonlyMap<Id<'resource'>, number>;
	readonly hitDiceSpent: number;
	readonly equipment: ReadonlyMap<'main-hand' | 'off-hand' | 'armor', Id<'item-instance'>>;
	readonly attuned: ReadonlySet<Id<'item-instance'>>;
	readonly copper: number;
	readonly spells: {
		readonly book: ReadonlySet<Ref<'spell'>>;
		readonly prepared: ReadonlySet<Ref<'spell'>>;
	};
	readonly inspiration: boolean;
	readonly lastLongRestEnded: number | null;
}
export interface Npc {
	readonly id: Id<'actor'>;
	readonly kind: 'npc';
	readonly identity: Id<'npc'> | null;
	readonly monster: Ref<'monster'>;
	readonly body: Body;
	readonly position: Position;
	readonly resourcesSpent: ReadonlyMap<Id<'resource'>, number>;
	readonly controller: 'engine' | Id<'actor'>;
	readonly attitude: 'friendly' | 'indifferent' | 'hostile';
}
export type Actor = Hero | Npc;
export interface CharacterSheet {
	readonly name: PublicText;
	readonly level: Level;
	readonly xp: number;
	readonly scores: Scores;
	readonly abilityModifiers: Scores;
	readonly proficiency: number;
	readonly ac: number;
	readonly hp: { readonly now: number; readonly max: number; readonly temporary: number };
	readonly speedFeet: number;
	readonly skills: Readonly<Record<Skill, number>>;
	readonly passivePerception: number;
	readonly saves: Scores;
	readonly training: readonly Training[];
	readonly modifiers: readonly Modifier[];
	readonly resources: readonly { readonly id: Id<'resource'>; readonly capacity: number; readonly remaining: number }[];
	readonly casting: null | {
		readonly ability: Ability;
		readonly attackBonus: number;
		readonly saveDc: number;
		readonly known: readonly Ref<'spell'>[];
		readonly prepared: readonly Ref<'spell'>[];
		readonly slots: readonly { readonly rank: number; readonly capacity: number; readonly remaining: number }[];
	};
}
export interface CombatProfile {
	readonly actor: Id<'actor'>;
	readonly ac: number;
	readonly hpMaximum: number;
	readonly speedFeet: number;
	readonly abilityModifiers: Scores;
	readonly proficiency: number;
	readonly saves: Scores;
	readonly modifiers: readonly Modifier[];
}
export type ChoiceControl =
	| { readonly kind: 'select'; readonly id: Id<'choice'>; readonly label: PublicText; readonly min: number; readonly max: number; readonly options: Nonempty<{ readonly id: Id<'option'>; readonly label: PublicText }> }
	| { readonly kind: 'scores'; readonly id: Id<'choice'>; readonly mode: 'point-buy' | 'free'; readonly cap: number; readonly pool: number | null }
	| { readonly kind: 'text'; readonly id: Id<'choice'>; readonly label: PublicText; readonly maximumLength: number };
export interface CreationDraft {
	readonly id: Id<'creation'>;
	readonly level: Level;
	readonly selections: readonly Selection[];
	readonly rolledAbilities: readonly { readonly roll: Id<'roll'>; readonly dice: readonly [number, number, number, number]; readonly kept: number }[];
	readonly offered: readonly ChoiceControl[];
}
export interface LevelDraft {
	readonly hero: Id<'actor'>;
	readonly level: Level;
	readonly selections: readonly Selection[];
	readonly hpDie: Die;
	readonly hpRoll: Id<'roll'> | null;
	readonly offered: readonly ChoiceControl[];
}
export function sheet(hero: Hero, content: Catalog, items: ReadonlyMap<Id<'item-instance'>, ItemInstance>): CharacterSheet {
	// TODO Derive all modifiers, capacities, AC, HP, and casting from choices and facts.
	// Free scores are final scores; do not apply background increases to them a second time.
	throw new Error('not implemented');
}
export function profile(actor: Actor, content: Catalog, items: ReadonlyMap<Id<'item-instance'>, ItemInstance>): CombatProfile {
	throw new Error('not implemented');
}
