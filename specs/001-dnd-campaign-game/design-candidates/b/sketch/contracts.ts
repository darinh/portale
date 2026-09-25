export type Id<K extends string> = string & { readonly idKind: K };
export type Digest = Id<'digest'>;
export type Revision = number & { readonly revision: true };
export type Level = number & { readonly level: true };
export type PublicText = string & { readonly publishable: true };
export type SecretText = string & { readonly secret: true };
export type Nonempty<T> = readonly [T, ...T[]];
export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Scores = Readonly<Record<Ability, number>>;
export type Die = 4 | 6 | 8 | 10 | 12 | 20 | 100;
export type Skill =
	| 'acrobatics' | 'animal-handling' | 'arcana' | 'athletics'
	| 'deception' | 'history' | 'insight' | 'intimidation'
	| 'investigation' | 'medicine' | 'nature' | 'perception'
	| 'performance' | 'persuasion' | 'religion' | 'sleight-of-hand'
	| 'stealth' | 'survival';
export type Band = 'very-easy' | 'easy' | 'moderate' | 'hard' | 'very-hard' | 'nearly-impossible';
export type DamageType =
	| 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning'
	| 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant'
	| 'slashing' | 'thunder';
export type StandardCondition =
	| 'blinded' | 'charmed' | 'deafened' | 'exhaustion' | 'frightened'
	| 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified'
	| 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious';
export type DefinitionKind =
	| 'class' | 'subclass' | 'species' | 'background' | 'feat'
	| 'feature' | 'spell' | 'item' | 'monster' | 'condition';
export type Ref<K extends DefinitionKind> = Id<`content:${K}`>;
export type Provenance =
	| { readonly kind: 'srd'; readonly edition: '5.2' | '5.2.1'; readonly page: number; readonly notice: Id<'notice'> }
	| { readonly kind: 'original'; readonly author: string; readonly record: string };
export type Scope =
	| { readonly kind: 'base' }
	| { readonly kind: 'campaign'; readonly campaign: Id<'campaign'> }
	| { readonly kind: 'module'; readonly module: Id<'module'> }
	| { readonly kind: 'personal'; readonly owner: Id<'save'> };
export interface DefinitionBase<K extends DefinitionKind> {
	readonly kind: K;
	readonly id: Ref<K>;
	readonly name: PublicText;
	readonly description: PublicText;
	readonly provenance: Provenance;
	readonly scope: Scope;
}
export type Scalar =
	| { readonly kind: 'constant'; readonly value: number }
	| { readonly kind: 'ability-modifier'; readonly ability: Ability }
	| { readonly kind: 'proficiency' }
	| { readonly kind: 'class-level' }
	| { readonly kind: 'spell-rank' }
	| { readonly kind: 'sum'; readonly terms: Nonempty<Scalar> }
	| { readonly kind: 'table'; readonly by: 'class-level' | 'spell-rank'; readonly rows: Nonempty<number> };
export interface Dice {
	readonly count: Scalar;
	readonly die: Die;
	readonly add: Scalar;
}
export type Training =
	| { readonly kind: 'skill'; readonly skill: Skill; readonly rank: 'proficient' | 'expert' }
	| { readonly kind: 'save'; readonly ability: Ability }
	| { readonly kind: 'weapon' | 'armor' | 'tool' | 'language'; readonly category: Id<'training'> };
export interface Resource {
	readonly id: Id<'resource'>;
	readonly capacity: Scalar;
	readonly recovery: 'short-rest' | 'long-rest' | 'dawn' | 'explicit';
}
export type Modifier =
	| { readonly kind: 'ac'; readonly amount: Scalar }
	| { readonly kind: 'ability'; readonly ability: Ability; readonly amount: Scalar; readonly cap: number }
	| { readonly kind: 'test'; readonly test: 'attack' | 'save' | 'check'; readonly ability: Ability | null; readonly amount: Scalar }
	| { readonly kind: 'advantage' | 'disadvantage'; readonly test: 'attack' | 'save' | 'check' | 'initiative' }
	| { readonly kind: 'resistance' | 'immunity' | 'vulnerability'; readonly damage: DamageType }
	| { readonly kind: 'speed'; readonly feet: Scalar };
export type Duration =
	| { readonly kind: 'instant' }
	| { readonly kind: 'rounds'; readonly count: number; readonly boundary: 'start' | 'end' }
	| { readonly kind: 'minutes'; readonly count: number }
	| { readonly kind: 'until-rest'; readonly rest: 'short' | 'long' };
export type Intrinsic =
	| { readonly kind: 'transform'; readonly policy: 'wild-shape' | 'replace-stat-block'; readonly forms: Nonempty<Ref<'monster'>>; readonly duration: Duration }
	| { readonly kind: 'summon'; readonly creature: Ref<'monster'>; readonly control: 'commanded' | 'independent'; readonly duration: Duration }
	| { readonly kind: 'delayed-spell'; readonly spell: Ref<'spell'>; readonly trigger: 'on-hit' | 'on-enter'; readonly duration: Duration };
export type Effect =
	| { readonly kind: 'damage'; readonly dice: Dice; readonly damage: DamageType }
	| { readonly kind: 'heal'; readonly dice: Dice }
	| { readonly kind: 'temporary-hp'; readonly amount: Scalar }
	| { readonly kind: 'condition'; readonly condition: Ref<'condition'>; readonly duration: Duration }
	| { readonly kind: 'remove-condition'; readonly condition: Ref<'condition'> }
	| { readonly kind: 'move'; readonly feet: Scalar; readonly mode: 'push' | 'pull' | 'teleport' }
	| { readonly kind: 'recover'; readonly resource: Id<'resource'>; readonly amount: Scalar }
	| { readonly kind: 'intrinsic'; readonly operation: Intrinsic };
export type Resolution =
	| { readonly kind: 'automatic'; readonly effects: Nonempty<Effect> }
	| { readonly kind: 'attack'; readonly ability: Ability; readonly hit: Nonempty<Effect>; readonly miss: readonly Effect[] }
	| { readonly kind: 'save'; readonly ability: Ability; readonly dc: Scalar; readonly failure: Nonempty<Effect>; readonly success: readonly Effect[] };
export type Timing =
	| { readonly kind: 'action' | 'bonus-action' }
	| { readonly kind: 'reaction'; readonly trigger: 'hit' | 'damaged' | 'spell-cast' | 'leaves-reach' }
	| { readonly kind: 'minutes'; readonly count: number };
export interface ActionRecipe {
	readonly timing: Timing;
	readonly targets: { readonly relation: 'self' | 'ally' | 'enemy' | 'any'; readonly count: Scalar; readonly rangeFeet: number };
	readonly area: null | { readonly shape: 'cone' | 'cube' | 'cylinder' | 'emanation' | 'line' | 'sphere'; readonly feet: number };
	readonly costs: readonly { readonly resource: Id<'resource'>; readonly amount: Scalar }[];
	readonly resolution: Resolution;
}
export type ChoiceValue =
	| { readonly kind: 'options'; readonly options: readonly Id<'option'>[] }
	| { readonly kind: 'scores'; readonly scores: Scores }
	| { readonly kind: 'text'; readonly text: string };
export interface Selection {
	readonly choice: Id<'choice'>;
	readonly value: ChoiceValue;
}
export type Grant =
	| { readonly kind: 'feature'; readonly feature: Ref<'feature'> }
	| { readonly kind: 'feat'; readonly feat: Ref<'feat'> }
	| { readonly kind: 'spell'; readonly spell: Ref<'spell'>; readonly ability: Ability; readonly mode: 'known' | 'always-prepared' | 'innate' }
	| { readonly kind: 'mastery'; readonly weapon: Ref<'item'> }
	| { readonly kind: 'training'; readonly training: Training }
	| { readonly kind: 'resource'; readonly resource: Resource }
	| { readonly kind: 'modifier'; readonly modifier: Modifier }
	| { readonly kind: 'choice'; readonly choice: Id<'choice'>; readonly count: number; readonly options: Nonempty<{ readonly id: Id<'option'>; readonly grants: Nonempty<Grant> }> };
export interface Casting {
	readonly ability: Ability;
	readonly spells: Nonempty<Ref<'spell'>>;
	readonly progression: Nonempty<{
		readonly level: Level;
		readonly cantrips: number;
		readonly prepared: number;
		readonly slots: readonly { readonly rank: number; readonly count: number }[];
	}>;
	readonly pool: 'spellcasting' | 'pact-magic';
	readonly replace: 'one-on-level' | 'one-on-long-rest' | 'all-on-long-rest';
	readonly rituals: 'prepared' | 'spellbook';
}
export interface ClassDefinition extends DefinitionBase<'class'> {
	readonly hitDie: 6 | 8 | 10 | 12;
	readonly training: readonly Training[];
	readonly saveProficiencies: readonly [Ability, Ability];
	readonly levels: Nonempty<{ readonly level: Level; readonly grants: readonly Grant[] }>;
	readonly subclasses: Nonempty<Ref<'subclass'>>;
	readonly casting: Casting | null;
}
export interface SubclassDefinition extends DefinitionBase<'subclass'> {
	readonly class: Ref<'class'>;
	readonly levels: Nonempty<{ readonly level: Level; readonly grants: readonly Grant[] }>;
}
export interface SpeciesDefinition extends DefinitionBase<'species'> {
	readonly speedFeet: number;
	readonly size: 'small' | 'medium';
	readonly traits: readonly Grant[];
}
export interface BackgroundDefinition extends DefinitionBase<'background'> {
	readonly abilities: readonly [Ability, Ability, Ability];
	readonly originFeat: Ref<'feat'>;
	readonly training: readonly Training[];
	readonly startingItems: readonly Ref<'item'>[];
}
export interface FeatDefinition extends DefinitionBase<'feat'> {
	readonly prerequisites: readonly ({ readonly kind: 'level'; readonly atLeast: Level } | { readonly kind: 'ability'; readonly ability: Ability; readonly atLeast: number })[];
	readonly grants: Nonempty<Grant>;
}
export interface FeatureDefinition extends DefinitionBase<'feature'> {
	readonly behavior:
		| { readonly kind: 'passive'; readonly modifiers: Nonempty<Modifier> }
		| { readonly kind: 'active'; readonly action: ActionRecipe }
		| { readonly kind: 'triggered'; readonly on: 'attack-hit' | 'damaged' | 'turn-start' | 'turn-end'; readonly limit: 'once-per-turn' | 'once-per-round'; readonly action: ActionRecipe };
}
export interface SpellDefinition extends DefinitionBase<'spell'> {
	readonly rank: number;
	readonly ritual: boolean;
	readonly concentration: boolean;
	readonly components: readonly ('verbal' | 'somatic' | 'material')[];
	readonly material: null | { readonly copper: number; readonly consumed: boolean; readonly item: Ref<'item'> | null };
	readonly duration: Duration;
	readonly action: ActionRecipe;
}
export type ItemForm =
	| { readonly kind: 'weapon'; readonly ability: 'str' | 'dex' | 'finesse'; readonly damage: Dice; readonly damageType: DamageType; readonly properties: readonly ('light' | 'heavy' | 'reach' | 'thrown' | 'two-handed' | 'loading' | 'ammunition' | 'versatile')[]; readonly mastery: 'cleave' | 'graze' | 'nick' | 'push' | 'sap' | 'slow' | 'topple' | 'vex'; readonly range: readonly [number, number] }
	| { readonly kind: 'armor'; readonly baseAc: number; readonly dexCap: number | null; readonly training: Id<'training'> }
	| { readonly kind: 'shield'; readonly ac: number }
	| { readonly kind: 'gear' };
export interface ItemDefinition extends DefinitionBase<'item'> {
	readonly form: ItemForm;
	readonly activation: ActionRecipe | null;
	readonly consumed: boolean;
	readonly charges: Resource | null;
	readonly attunement: boolean;
	readonly grants: readonly Grant[];
	readonly priceCopper: number;
}
export interface MonsterDefinition extends DefinitionBase<'monster'> {
	readonly scores: Scores;
	readonly ac: number;
	readonly hp: number;
	readonly speedFeet: number;
	readonly initiative: number;
	readonly cr: number;
	readonly xp: number;
	readonly training: readonly Training[];
	readonly traits: readonly Grant[];
	readonly actions: Nonempty<ActionRecipe>;
	readonly tactics: 'guard' | 'aggressive' | 'capture';
	readonly downedTarget: 'leave' | 'capture' | 'attack';
}
export interface ConditionDefinition extends DefinitionBase<'condition'> {
	readonly rules:
		| { readonly kind: 'standard'; readonly condition: StandardCondition }
		| { readonly kind: 'original'; readonly modifiers: Nonempty<Modifier> };
}
export type Definition =
	| ClassDefinition | SubclassDefinition | SpeciesDefinition | BackgroundDefinition
	| FeatDefinition | FeatureDefinition | SpellDefinition | ItemDefinition
	| MonsterDefinition | ConditionDefinition;
export type Predicate =
	| { readonly kind: 'always' }
	| { readonly kind: 'all' | 'any'; readonly terms: Nonempty<Predicate> }
	| { readonly kind: 'discovered'; readonly clue: Id<'clue'> }
	| { readonly kind: 'conclusion'; readonly conclusion: Id<'conclusion'> }
	| { readonly kind: 'overcome'; readonly encounter: Id<'encounter'> }
	| { readonly kind: 'delivered'; readonly item: Id<'quest-item'>; readonly to: Id<'location'> }
	| { readonly kind: 'carrying'; readonly item: Id<'quest-item'> }
	| { readonly kind: 'alive'; readonly npc: Id<'npc'> }
	| { readonly kind: 'fact'; readonly fact: Id<'fact'> };
export type Consequence =
	| { readonly kind: 'spawn'; readonly encounter: Id<'encounter'>; readonly at: Id<'location'> }
	| { readonly kind: 'disclose'; readonly clue: Id<'clue'> }
	| { readonly kind: 'access'; readonly exit: Id<'exit'>; readonly open: boolean }
	| { readonly kind: 'advance-clock'; readonly clock: Id<'clock'>; readonly amount: number }
	| { readonly kind: 'hazard'; readonly at: Id<'location'>; readonly action: ActionRecipe }
	| { readonly kind: 'secure-entry'; readonly at: Id<'location'>; readonly moveHostilesTo: Id<'location'> }
	| { readonly kind: 'fact'; readonly fact: Id<'fact'> };
export type Trigger =
	| { readonly kind: 'elapsed'; readonly everyMinutes: number }
	| { readonly kind: 'event'; readonly on: 'combat-start' | 'discovery' | 'rest-start' }
	| { readonly kind: 'stall'; readonly worldActions: number };
export interface ClockDefinition {
	readonly id: Id<'clock'>;
	readonly name: PublicText;
	readonly visibility: 'open' | 'secret';
	readonly segments: 4 | 6 | 8;
	readonly activeWhen: Predicate;
	readonly trigger: Trigger;
	readonly filled: Nonempty<Consequence>;
	readonly announcement: PublicText;
}
export interface Cell {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}
export interface LocationDefinition {
	readonly id: Id<'location'>;
	readonly name: PublicText;
	readonly description: PublicText;
	readonly question: PublicText;
	readonly grid: { readonly width: number; readonly height: number; readonly blocked: readonly Cell[]; readonly cover: readonly { readonly cell: Cell; readonly kind: 'half' | 'three-quarters' | 'total' }[] };
	readonly exits: readonly { readonly id: Id<'exit'>; readonly cell: Cell; readonly to: Id<'location'>; readonly requires: Predicate | null }[];
	readonly interactions: readonly { readonly id: Id<'interaction'>; readonly label: PublicText; readonly skills: Nonempty<Skill>; readonly bands: Nonempty<Band>; readonly success: readonly Consequence[]; readonly failure: readonly Consequence[] }[];
}
export interface ClueDefinition {
	readonly id: Id<'clue'>;
	readonly conclusion: Id<'conclusion'>;
	readonly text: SecretText;
	readonly delivery:
		| { readonly kind: 'placed'; readonly at: Id<'location'>; readonly interaction: Id<'interaction'> | null }
		| { readonly kind: 'proactive'; readonly trigger: Trigger }
		| { readonly kind: 'reactive'; readonly method: 'research' | 'canvass' | 'divination'; readonly at: Id<'location'> };
}
export interface ConclusionDefinition {
	readonly id: Id<'conclusion'>;
	readonly statement: SecretText;
	readonly leadsTo: Id<'location'> | null;
}
export interface EncounterDefinition {
	readonly id: Id<'encounter'>;
	readonly at: Id<'location'>;
	readonly question: PublicText;
	readonly difficulty: 'low' | 'moderate' | 'high';
	readonly creatures: Nonempty<{ readonly monster: Ref<'monster'>; readonly count: number }>;
	readonly overcomeWhen: Predicate;
	readonly reward: Id<'reward'>;
}
export interface NpcDefinition {
	readonly id: Id<'npc'>;
	readonly at: Id<'location'>;
	readonly name: PublicText;
	readonly appearance: PublicText;
	readonly voice: PublicText;
	readonly want: SecretText;
	readonly secret: SecretText | null;
	readonly plan: Id<'clock'> | null;
	readonly monster: Ref<'monster'>;
	readonly attitude: 'friendly' | 'indifferent' | 'hostile';
	readonly faction: Id<'faction'> | null;
}
export interface RewardDefinition {
	readonly id: Id<'reward'>;
	readonly when: Predicate;
	readonly xp: number;
	readonly copper: number;
	readonly items: readonly Ref<'item'>[];
	readonly clue: Id<'clue'> | null;
}
export interface ModuleDefinition {
	readonly id: Id<'module'>;
	readonly title: PublicText;
	readonly levels: readonly [Level, Level];
	readonly theme: string;
	readonly start: Id<'location'>;
	readonly locations: Nonempty<LocationDefinition>;
	readonly npcs: readonly NpcDefinition[];
	readonly clues: readonly ClueDefinition[];
	readonly conclusions: readonly ConclusionDefinition[];
	readonly encounters: readonly EncounterDefinition[];
	readonly clocks: readonly ClockDefinition[];
	readonly rewards: readonly RewardDefinition[];
	readonly questItems: readonly {
		readonly id: Id<'quest-item'>;
		readonly item: Ref<'item'>;
		readonly at: Id<'location'>;
		readonly custody: 'campaign' | 'recoverable-on-body';
	}[];
	readonly goal: Predicate;
	readonly finale: {
		readonly at: Id<'location'>;
		readonly success: Nonempty<Consequence>;
		readonly failure: Nonempty<Consequence>;
		readonly epilogue: PublicText;
	};
	readonly successor: {
		readonly anchors: Nonempty<{ readonly at: Id<'location'>; readonly safeWhen: Predicate; readonly reason: PublicText }>;
		readonly fallback: { readonly at: Id<'location'>; readonly rescue: Nonempty<Consequence>; readonly reason: PublicText };
	};
}
export interface CampaignBook {
	readonly id: Id<'campaign'>;
	readonly title: PublicText;
	readonly premise: PublicText;
	readonly mode: 'episodic' | 'serialized';
	readonly truths: readonly PublicText[];
	readonly hub: Id<'location'>;
	readonly startingLevel: Level;
	readonly modules: Nonempty<ModuleDefinition>;
	readonly definitions: readonly Definition[];
	readonly conclusions: readonly ConclusionDefinition[];
	readonly clocks: readonly ClockDefinition[];
	readonly factions: readonly {
		readonly id: Id<'faction'>;
		readonly name: PublicText;
		readonly want: SecretText;
		readonly clocks: Nonempty<Id<'clock'>>;
	}[];
	readonly fronts: readonly {
		readonly id: Id<'front'>;
		readonly clocks: Nonempty<Id<'clock'>>;
		readonly stakes: Nonempty<SecretText>;
	}[];
	readonly goal: Predicate;
	readonly epilogue: PublicText;
	readonly notices: readonly { readonly id: Id<'notice'>; readonly text: string }[];
}
export interface AdmissionContract {
	readonly format: number;
	readonly mechanics: number;
	readonly quality: number;
	readonly fingerprint: Digest;
}
export interface Support {
	readonly rulesRevision: Id<'rules-revision'>;
	readonly contract: AdmissionContract;
	readonly intrinsics: ReadonlySet<Intrinsic['kind']>;
	readonly levels: readonly [Level, Level];
	readonly requiredBundledClasses: ReadonlySet<Ref<'class'>>;
}
declare const admitted: unique symbol;
export interface AdmittedCampaign {
	readonly [admitted]: true;
	readonly digest: Digest;
	readonly book: CampaignBook;
	readonly support: Support;
}
export interface Issue {
	readonly rule: string;
	readonly severity: 'error' | 'warning' | 'info';
	readonly path: string;
	readonly reference: string | null;
	readonly message: string;
	readonly repair: string;
	readonly supportGrade: 'A' | 'B' | 'C' | 'F' | 'engine';
}
export type Admission =
	| { readonly kind: 'accepted'; readonly campaign: AdmittedCampaign; readonly issues: readonly Issue[] }
	| { readonly kind: 'rejected'; readonly issues: Nonempty<Issue> };
export interface Catalog {
	readonly definitions: ReadonlyMap<Definition['id'], Definition>;
	readonly modules: ReadonlyMap<Id<'module'>, ModuleDefinition>;
	readonly locations: ReadonlyMap<Id<'location'>, LocationDefinition>;
	readonly conclusions: ReadonlyMap<Id<'conclusion'>, ConclusionDefinition>;
	readonly clocks: ReadonlyMap<Id<'clock'>, ClockDefinition>;
	readonly cluesByLocation: ReadonlyMap<Id<'location'>, readonly ClueDefinition[]>;
	readonly cluesByConclusion: ReadonlyMap<Id<'conclusion'>, Nonempty<ClueDefinition>>;
	readonly goalsByFact: ReadonlyMap<Id<'fact'> | Id<'clue'> | Id<'conclusion'> | Id<'encounter'>, readonly Id<'module'>[]>;
	readonly clocksByTrigger: ReadonlyMap<Trigger['kind'], readonly ClockDefinition[]>;
}
export function admit(bytes: Uint8Array, support: Support): Admission {
	// TODO Parse the private file format; verify fingerprint, provenance, bounded expressions,
	// reference closure, supported effects, goal reachability, and the shared quality policy.
	throw new Error('not implemented');
}
export function catalog(campaign: AdmittedCampaign): Catalog {
	throw new Error('not implemented');
}
