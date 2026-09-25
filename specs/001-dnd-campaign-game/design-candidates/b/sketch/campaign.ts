import type {
	AdmittedCampaign, Catalog, Definition, Digest, Die, Id, Level,
	Nonempty, PublicText, Ref, Revision, Selection,
} from './contracts.ts';
import type {
	Actor, CharacterChoices, CharacterSheet, ConditionInstance, CreationDraft,
	Custody, ItemInstance, LevelDraft, LevelGrant, Life, Position,
} from './character.ts';
import type { ActionOffer, PlayerCommand, TurnState } from './turn.ts';

export interface RulesRoll {
	readonly id: Id<'roll'>;
	readonly stream: 'creation' | 'rules';
	readonly firstDraw: number;
	readonly die: Die;
	readonly faces: Nonempty<number>;
	readonly keptIndexes: readonly number[];
	readonly modifiers: readonly { readonly source: PublicText; readonly amount: number }[];
	readonly total: number;
	readonly purpose:
		| { readonly kind: 'attack'; readonly ac: number; readonly critical: 'hit' | 'miss' | null; readonly success: boolean }
		| { readonly kind: 'save' | 'check'; readonly dc: number; readonly success: boolean }
		| { readonly kind: 'death-save'; readonly result: 'success' | 'failure' | 'double-failure' | 'recover' }
		| { readonly kind: 'damage' | 'healing' | 'initiative' | 'ability' | 'hit-points' | 'stable-recovery' };
}
export type Lifecycle =
	| { readonly kind: 'creation'; readonly draft: CreationDraft }
	| { readonly kind: 'playing'; readonly module: Id<'module'>; readonly hero: Id<'actor'>; readonly turn: TurnState }
	| { readonly kind: 'leveling'; readonly module: Id<'module'>; readonly hero: Id<'actor'>; readonly draft: LevelDraft; readonly resume: TurnState }
	| { readonly kind: 'death-choice'; readonly module: Id<'module'>; readonly hero: Id<'actor'>; readonly death: Id<'death'> }
	| { readonly kind: 'replacement'; readonly module: Id<'module'>; readonly previousHero: Id<'actor'>; readonly death: Id<'death'>; readonly draft: CreationDraft }
	| { readonly kind: 'between-modules'; readonly completed: Id<'module'>; readonly next: Id<'module'>; readonly hero: Id<'actor'> }
	| { readonly kind: 'ended'; readonly outcome: 'won' | 'lost'; readonly epilogue: PublicText };
export interface CampaignFacts {
	readonly discovered: ReadonlySet<Id<'clue'>>;
	readonly learned: ReadonlySet<Id<'conclusion'>>;
	readonly visited: ReadonlySet<Id<'location'>>;
	readonly overcome: ReadonlySet<Id<'encounter'>>;
	readonly delivered: ReadonlyMap<Id<'quest-item'>, Id<'location'>>;
	readonly asserted: ReadonlySet<Id<'fact'>>;
	readonly rewardsClaimed: ReadonlySet<Id<'reward'>>;
	readonly triggersFired: ReadonlySet<Id<'trigger-firing'>>;
	readonly clocks: ReadonlyMap<Id<'clock'>, number>;
	readonly openExits: ReadonlySet<Id<'exit'>>;
}
export interface CommandRequest {
	readonly operation: Id<'operation'>;
	readonly expected: Revision;
	readonly command: PlayerCommand;
}
export interface PendingOperation {
	readonly operation: Id<'operation'>;
	readonly acceptedAt: Revision;
	readonly base: Revision;
	readonly fingerprint: Digest;
	readonly command: PlayerCommand;
	readonly director: 'not-started' | 'started' | 'unneeded';
}
export interface CampaignWorld {
	readonly save: Id<'save'>;
	readonly revision: Revision;
	readonly seed: number;
	readonly rulesRevision: Id<'rules-revision'>;
	readonly content: AdmittedCampaign;
	readonly catalog: Catalog;
	readonly lifecycle: Lifecycle;
	readonly actors: ReadonlyMap<Id<'actor'>, Actor>;
	readonly items: ReadonlyMap<Id<'item-instance'>, ItemInstance>;
	readonly facts: CampaignFacts;
	readonly elapsedMinutes: number;
	readonly draws: Readonly<Record<'creation' | 'rules', number>>;
	readonly pending: PendingOperation | null;
	readonly events: readonly GameEvent[];
}
export interface ContentArchive {
	readonly digest: Digest;
	readonly canonicalInput: string;
	readonly format: number;
}
export type GameEvent =
	| { readonly kind: 'campaign-created'; readonly save: Id<'save'>; readonly seed: number; readonly archive: ContentArchive; readonly rulesRevision: Id<'rules-revision'>; readonly eventVersion: number }
	| { readonly kind: 'content-added'; readonly definitions: Nonempty<Definition>; readonly digest: Digest }
	| { readonly kind: 'command-accepted'; readonly request: CommandRequest; readonly fingerprint: Digest }
	| { readonly kind: 'director-started'; readonly operation: Id<'operation'> }
	| { readonly kind: 'director-breached'; readonly operation: Id<'operation'>; readonly code: 'unreachable' | 'invalid-shape' | 'interrupted'; readonly operatorDetail: string }
	| { readonly kind: 'proposed'; readonly operation: Id<'operation'>; readonly candidate: Id<'candidate'> }
	| { readonly kind: 'ruled'; readonly reason: string; readonly text: PublicText }
	| { readonly kind: 'said' | 'narrated'; readonly text: PublicText }
	| { readonly kind: 'rolled'; readonly actor: Id<'actor'>; readonly roll: RulesRoll }
	| { readonly kind: 'hero-created'; readonly actor: Id<'actor'>; readonly creation: Id<'creation'>; readonly choices: CharacterChoices; readonly levels: Nonempty<LevelGrant>; readonly initialXp: number; readonly at: Position }
	| { readonly kind: 'npc-created'; readonly actor: Id<'actor'>; readonly monster: Ref<'monster'>; readonly identity: Id<'npc'> | null; readonly at: Position; readonly attitude: 'friendly' | 'indifferent' | 'hostile' }
	| { readonly kind: 'attitude-changed'; readonly actor: Id<'actor'>; readonly attitude: 'friendly' | 'indifferent' | 'hostile' }
	| { readonly kind: 'creation-started'; readonly draft: Id<'creation'>; readonly level: Level; readonly death: Id<'death'> | null }
	| { readonly kind: 'creation-selected'; readonly draft: Id<'creation'>; readonly selections: readonly Selection[] }
	| { readonly kind: 'level-offered'; readonly hero: Id<'actor'>; readonly level: Level }
	| { readonly kind: 'level-selected'; readonly hero: Id<'actor'>; readonly selections: readonly Selection[] }
	| { readonly kind: 'level-granted'; readonly hero: Id<'actor'>; readonly grant: LevelGrant }
	| { readonly kind: 'damage-applied' | 'healing-applied'; readonly actor: Id<'actor'>; readonly amount: number }
	| { readonly kind: 'temporary-hp-set'; readonly actor: Id<'actor'>; readonly amount: number }
	| { readonly kind: 'life-changed'; readonly actor: Id<'actor'>; readonly life: Life }
	| { readonly kind: 'condition-applied'; readonly actor: Id<'actor'>; readonly condition: ConditionInstance }
	| { readonly kind: 'condition-ended'; readonly actor: Id<'actor'>; readonly condition: Id<'condition-instance'> }
	| { readonly kind: 'concentration-started'; readonly actor: Id<'actor'>; readonly effect: Id<'effect'>; readonly spell: Ref<'spell'> }
	| { readonly kind: 'concentration-ended'; readonly actor: Id<'actor'>; readonly effect: Id<'effect'> }
	| { readonly kind: 'resource-spent' | 'resource-recovered'; readonly actor: Id<'actor'>; readonly resource: Id<'resource'>; readonly amount: number }
	| { readonly kind: 'hit-dice-spent' | 'hit-dice-recovered'; readonly actor: Id<'actor'>; readonly amount: number }
	| { readonly kind: 'spells-chosen'; readonly actor: Id<'actor'>; readonly category: 'book' | 'prepared'; readonly spells: readonly Ref<'spell'>[] }
	| { readonly kind: 'inspiration-set'; readonly actor: Id<'actor'>; readonly available: boolean }
	| { readonly kind: 'item-created'; readonly item: ItemInstance }
	| { readonly kind: 'item-moved'; readonly item: Id<'item-instance'>; readonly custody: Custody }
	| { readonly kind: 'item-consumed'; readonly item: Id<'item-instance'>; readonly count: number }
	| { readonly kind: 'item-charges-spent' | 'item-charges-recovered'; readonly item: Id<'item-instance'>; readonly amount: number }
	| { readonly kind: 'equipped'; readonly actor: Id<'actor'>; readonly slot: 'main-hand' | 'off-hand' | 'armor'; readonly item: Id<'item-instance'> | null }
	| { readonly kind: 'attunement-changed'; readonly actor: Id<'actor'>; readonly items: readonly Id<'item-instance'>[] }
	| { readonly kind: 'gold-changed'; readonly actor: Id<'actor'>; readonly copper: number }
	| { readonly kind: 'moved'; readonly actor: Id<'actor'>; readonly to: Position }
	| { readonly kind: 'turn-paused'; readonly turn: TurnState }
	| { readonly kind: 'time-elapsed'; readonly minutes: number }
	| { readonly kind: 'long-rest-completed'; readonly hero: Id<'actor'>; readonly atMinute: number }
	| { readonly kind: 'discovered'; readonly clue: Id<'clue'> }
	| { readonly kind: 'conclusion-learned'; readonly conclusion: Id<'conclusion'> }
	| { readonly kind: 'encounter-overcome'; readonly encounter: Id<'encounter'> }
	| { readonly kind: 'quest-item-delivered'; readonly item: Id<'quest-item'>; readonly to: Id<'location'> }
	| { readonly kind: 'fact-asserted'; readonly fact: Id<'fact'> }
	| { readonly kind: 'access-changed'; readonly exit: Id<'exit'>; readonly open: boolean }
	| { readonly kind: 'clock-advanced'; readonly clock: Id<'clock'>; readonly amount: number }
	| { readonly kind: 'trigger-fired'; readonly firing: Id<'trigger-firing'>; readonly clock: Id<'clock'> | null }
	| { readonly kind: 'reward-claimed'; readonly hero: Id<'actor'>; readonly reward: Id<'reward'>; readonly xp: number }
	| { readonly kind: 'module-entered'; readonly module: Id<'module'>; readonly hero: Id<'actor'>; readonly at: Position }
	| { readonly kind: 'module-won'; readonly module: Id<'module'>; readonly hero: Id<'actor'> }
	| { readonly kind: 'module-lost'; readonly module: Id<'module'>; readonly death: Id<'death'> }
	| { readonly kind: 'replacement-installed'; readonly death: Id<'death'>; readonly hero: Id<'actor'>; readonly at: Position; readonly reason: PublicText }
	| { readonly kind: 'campaign-ended'; readonly outcome: 'won' | 'lost'; readonly epilogue: PublicText }
	| { readonly kind: 'command-settled'; readonly operation: Id<'operation'>; readonly status: 'applied' | 'refused' | 'stalled' };
export type BoundaryCommand =
	| { readonly kind: 'creation'; readonly draft: Id<'creation'>; readonly selections: readonly Selection[]; readonly confirm: boolean }
	| { readonly kind: 'level'; readonly hero: Id<'actor'>; readonly selections: readonly Selection[]; readonly confirm: boolean }
	| { readonly kind: 'next-module'; readonly completed: Id<'module'> }
	| { readonly kind: 'end-after-death'; readonly death: Id<'death'> }
	| { readonly kind: 'replace'; readonly death: Id<'death'> };
export interface ViewLine {
	readonly kind: 'player' | 'narration' | 'rule' | 'roll' | 'result';
	readonly text: PublicText;
}
export type SaveScreen =
	| { readonly kind: 'creation' | 'replacement'; readonly choices: CreationDraft['offered']; readonly level: Level }
	| { readonly kind: 'leveling'; readonly choices: LevelDraft['offered']; readonly level: Level }
	| { readonly kind: 'adventure'; readonly mode: TurnState['kind']; readonly scene: PublicText; readonly activeActor: PublicText | null }
	| { readonly kind: 'death-choice'; readonly level: Level }
	| { readonly kind: 'between-modules'; readonly completed: PublicText; readonly next: PublicText }
	| { readonly kind: 'ended'; readonly outcome: 'won' | 'lost'; readonly epilogue: PublicText };
export interface SaveView {
	readonly kind: 'save';
	readonly save: Id<'save'>;
	readonly revision: Revision;
	readonly screen: SaveScreen;
	readonly sheet: CharacterSheet | null;
	readonly offers: readonly ActionOffer[];
	readonly pending: boolean;
	readonly transcript: readonly ViewLine[];
	readonly discovered: readonly PublicText[];
	readonly clocks: readonly { readonly name: PublicText; readonly filled: number; readonly segments: number }[];
	readonly map: readonly { readonly name: PublicText; readonly here: boolean; readonly exits: readonly { readonly label: PublicText; readonly destination: PublicText | null }[] }[];
}
export interface TitleView {
	readonly kind: 'title';
	readonly continueSave: Id<'save'> | null;
	readonly saves: readonly { readonly id: Id<'save'>; readonly title: PublicText; readonly status: PublicText; readonly lastSettled: Revision }[];
	readonly campaigns: readonly { readonly id: Id<'campaign'>; readonly title: PublicText; readonly supportedLevels: readonly [Level, Level] }[];
}
export type PlayerView = SaveView | TitleView;
export type ProjectionSource =
	| { readonly kind: 'save'; readonly world: CampaignWorld }
	| { readonly kind: 'title'; readonly worlds: readonly CampaignWorld[]; readonly campaigns: readonly AdmittedCampaign[] };
export function apply(world: CampaignWorld | null, event: GameEvent): CampaignWorld | null {
	// TODO Fold trusted version-decoded outcomes. Never validate, roll, call a model, or run rules.
	// Unknown versions and invalid genesis input fail at the journal boundary before this fold.
	throw new Error('not implemented');
}
export function project(source: ProjectionSource): PlayerView {
	// TODO Release only disclosed text. Exclude archives, secret definitions, raw proposals,
	// operator errors, unvisited rooms, and unrevealed clock metadata from every view variant.
	throw new Error('not implemented');
}
export function transition(world: CampaignWorld, command: BoundaryCommand): Nonempty<GameEvent> {
	// TODO Match lifecycle; grant a level only with complete choices; install a successor once
	// per death; settle module recovery and entry together; preserve all campaign facts.
	throw new Error('not implemented');
}
