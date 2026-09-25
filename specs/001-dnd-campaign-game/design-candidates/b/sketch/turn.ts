import type { Ability, Band, Cell, Effect, Id, Nonempty, PublicText, Ref, Revision, Selection, Skill } from './contracts.ts';
import type { ChoiceControl } from './character.ts';
import type { CampaignWorld, GameEvent, RulesRoll } from './campaign.ts';

export type Action =
	| { readonly kind: 'attack'; readonly weapon: Id<'item-instance'>; readonly target: Id<'actor'> }
	| { readonly kind: 'cast'; readonly spell: Ref<'spell'>; readonly rank: number; readonly targets: readonly Id<'actor'>[]; readonly aim: Cell | null; readonly ritual: boolean }
	| { readonly kind: 'feature'; readonly feature: Ref<'feature'>; readonly targets: readonly Id<'actor'>[]; readonly selections: readonly Selection[] }
	| { readonly kind: 'item'; readonly item: Id<'item-instance'>; readonly targets: readonly Id<'actor'>[] }
	| { readonly kind: 'inventory'; readonly item: Id<'item-instance'>; readonly operation: 'take' | 'drop' | 'equip' | 'unequip' | 'attune' }
	| { readonly kind: 'check'; readonly interaction: Id<'interaction'>; readonly ability: Ability; readonly skill: Skill | null; readonly band: Band; readonly target: Id<'actor'> | null }
	| { readonly kind: 'talk'; readonly npc: Id<'npc'> }
	| { readonly kind: 'move'; readonly path: Nonempty<Cell>; readonly exit: Id<'exit'> | null }
	| { readonly kind: 'flee'; readonly exit: Id<'exit'>; readonly method: 'move' | 'dash' | 'disengage' }
	| { readonly kind: 'rest'; readonly duration: 'short' | 'long'; readonly hitDice: number }
	| { readonly kind: 'end-turn' | 'wait' }
	| { readonly kind: 'reaction'; readonly decision: Id<'decision'>; readonly option: Id<'option'> }
	| { readonly kind: 'inspiration'; readonly decision: Id<'decision'>; readonly dieIndex: number | null };
export type PlayerCommand =
	| { readonly kind: 'choose'; readonly offer: Id<'offer'>; readonly selections: readonly Selection[] }
	| { readonly kind: 'text'; readonly text: string; readonly focus: Id<'actor'> | Id<'interaction'> | null }
	| { readonly kind: 'aside'; readonly text: string };
export interface ActionOffer {
	readonly id: Id<'offer'>;
	readonly revision: Revision;
	readonly category: 'attack' | 'cast' | 'feature' | 'item' | 'inventory' | 'check' | 'talk' | 'move' | 'flee' | 'rest' | 'turn' | 'creation' | 'level' | 'campaign' | 'replacement';
	readonly label: PublicText;
	readonly consequence: PublicText;
	readonly controls: readonly ChoiceControl[];
}
export interface Budget {
	readonly action: 'available' | 'spent';
	readonly bonus: 'available' | 'spent';
	readonly reaction: 'available' | 'spent';
	readonly movementRemainingFeet: number;
	readonly attacksRemaining: number;
	readonly lightAttack: 'unavailable' | 'available' | 'spent';
	readonly slotSpentThisTurn: boolean;
}
export type Continuation =
	| { readonly kind: 'attack'; readonly actor: Id<'actor'>; readonly target: Id<'actor'>; readonly roll: Id<'roll'>; readonly remaining: readonly Effect[] }
	| { readonly kind: 'movement'; readonly actor: Id<'actor'>; readonly remaining: Nonempty<Cell>; readonly exit: Id<'exit'> | null }
	| { readonly kind: 'effects'; readonly actor: Id<'actor'>; readonly targets: readonly Id<'actor'>[]; readonly remaining: Nonempty<Effect> };
export type PendingDecision =
	| { readonly kind: 'reaction'; readonly id: Id<'decision'>; readonly actor: Id<'actor'>; readonly choices: Nonempty<ActionOffer>; readonly continuation: Continuation }
	| { readonly kind: 'inspiration'; readonly id: Id<'decision'>; readonly roll: RulesRoll; readonly continuation: Continuation };
export type TurnState =
	| { readonly kind: 'exploration' }
	| {
		readonly kind: 'combat';
		readonly initiative: Nonempty<{ readonly actor: Id<'actor'>; readonly total: number }>;
		readonly cursor: number;
		readonly round: number;
		readonly budgets: ReadonlyMap<Id<'actor'>, Budget>;
		readonly pending: PendingDecision | null;
	}
	| {
		readonly kind: 'resting';
		readonly rest: 'short' | 'long';
		readonly startedAtMinute: number;
		readonly accumulatedMinutes: number;
		readonly interruptions: number;
		readonly hitDiceRequested: number;
	};
export interface Candidate {
	readonly id: Id<'candidate'>;
	readonly label: PublicText;
	readonly action: Action;
}
export interface DecisionContext {
	readonly operation: Id<'operation'>;
	readonly revision: Revision;
	readonly utterance: string;
	readonly publicFacts: readonly PublicText[];
	readonly candidates: Nonempty<{ readonly id: Id<'candidate'>; readonly label: PublicText }>;
}
export interface OutcomeContext {
	readonly operation: Id<'operation'>;
	readonly publicFacts: readonly PublicText[];
	readonly results: Nonempty<PublicText>;
}
export interface DirectorChoice {
	readonly candidate: Id<'candidate'>;
	readonly narration: string;
}
export interface Director {
	readonly name: string;
	select(context: DecisionContext): Promise<DirectorChoice>;
	narrate(context: OutcomeContext): Promise<string>;
}
export type AdjudicationInput =
	| { readonly kind: 'structured'; readonly action: Action }
	| { readonly kind: 'proposal'; readonly candidates: Nonempty<Candidate>; readonly choice: DirectorChoice }
	| { readonly kind: 'aside'; readonly narration: string };
export interface Adjudication {
	readonly events: readonly GameEvent[];
	readonly results: Nonempty<PublicText>;
	readonly stopped: 'player-decision' | 'exploration' | 'lifecycle';
}
export function options(world: CampaignWorld): readonly ActionOffer[] {
	// TODO Bind offers and option IDs to the committed revision; project only visible choices.
	throw new Error('not implemented');
}
export function candidates(world: CampaignWorld, text: string, focus: Id<'actor'> | Id<'interaction'> | null): readonly Candidate[] {
	// TODO Keep exact named actions; if a bounded menu cannot resolve the intent, offer clarification.
	throw new Error('not implemented');
}
export function adjudicate(world: CampaignWorld, input: AdjudicationInput): Adjudication {
	// TODO Decide legality here, emit every rewrite or drop, then drain deterministic rules
	// and pressure until a player decision or lifecycle boundary. Never persist or call a model.
	throw new Error('not implemented');
}
export function offlineDirector(): Director {
	throw new Error('not implemented');
}
