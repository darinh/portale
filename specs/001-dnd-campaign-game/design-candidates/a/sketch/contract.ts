/**
 * The shared data contract. The ONLY place JSON becomes domain types.
 *
 * Both the game and the forge import this module. There is no second parser and no second
 * schema, so "the forge and the game stay in sync" is a property of the call graph rather
 * than of anyone's discipline. Drift out of tree is caught by the digest a pack records.
 *
 * Nothing here knows how to play D&D. It knows what a legal pack *is*.
 */

/* ------------------------------------------------------------------ identity */

/**
 * Every content id is branded and namespaced by prefix (`cl_` class, `sp_` species,
 * `sl_` spell, `mb_` monster, `it_` item, `nd_` node, `ck_` clock, ...). The prefix is
 * checked once, in `parsePack`, and trusted everywhere after.
 */
export type ContentId<K extends string> = string & { readonly __content: K };

export type ClassId = ContentId<'class'>;
export type SubclassId = ContentId<'subclass'>;
export type SpeciesId = ContentId<'species'>;
export type BackgroundId = ContentId<'background'>;
export type FeatId = ContentId<'feat'>;
export type FeatureId = ContentId<'feature'>;
export type SpellId = ContentId<'spell'>;
export type SpellListId = ContentId<'spellList'>;
export type ItemId = ContentId<'item'>;
export type StatBlockId = ContentId<'statBlock'>;
export type ConditionId = ContentId<'condition'>;
export type SkillId = ContentId<'skill'>;
export type ResourceId = ContentId<'resource'>;
export type NodeId = ContentId<'node'>;
export type NpcId = ContentId<'npc'>;
export type RoleId = ContentId<'role'>;
export type ClueId = ContentId<'clue'>;
export type RevelationId = ContentId<'revelation'>;
export type ClockId = ContentId<'clock'>;
export type FrontId = ContentId<'front'>;
export type FlagId = ContentId<'flag'>;
export type EncounterId = ContentId<'encounter'>;
export type ModuleId = ContentId<'module'>;
export type CampaignId = ContentId<'campaign'>;
export type PackId = ContentId<'pack'>;

/** Names a handwritten handler in engine code. Campaign packs may not use one. */
export type ScriptId = string & { readonly __brand: 'ScriptId' };

/** A stable hash over a pack's parsed, canonically ordered entries. Over meaning, not bytes. */
export type Digest = string & { readonly __brand: 'Digest' };

/** `"2d6+3"`, validated once at the boundary. Never re-parsed downstream. */
export type DiceSpec = string & { readonly __brand: 'DiceSpec' };

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type SpellLevel = (typeof SPELL_LEVELS)[number];

/** 1..20. Narrowed at the boundary so no downstream code range-checks a level. */
export type CharacterLevel = number & { readonly __brand: 'CharacterLevel' };

export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/* ---------------------------------------------------------------- provenance */

/**
 * Licensing and trust in one field. `parsePack` refuses a `scripted` effect in anything
 * that is not `srd-5.2` or `portale-original`, so module- and player-authored content is
 * pure data by construction (FR-015) and an LLM-written spell cannot reach engine code.
 *
 * research-rules section 4 step 6: tag provenance on every rules entity and have a build
 * check reject anything else.
 */
export type Provenance =
  | { readonly of: 'srd-5.2'; readonly cite: string }
  | { readonly of: 'portale-original' }
  | { readonly of: 'campaign'; readonly campaign: CampaignId }
  | { readonly of: 'player'; readonly save: string };

export function isTrusted(p: Provenance): boolean {
  throw new Error('not implemented');
}

/* -------------------------------------------------------------------- effects */

/**
 * The closed vocabulary the engine interprets. Eighteen verbs cover almost every SRD
 * spell, every weapon and mastery, every class feature at levels 1-3, and every clock
 * payoff. The tail gets `scripted`, which research-rules section 2 says is unavoidable
 * ("effects such as Polymorph or Wish need handwritten handlers").
 *
 * Effects are a TREE, not a script: `attackRoll` and `save` carry their own branches, so
 * there is no control flow to interpret and no way for content to loop.
 */
export type Effect =
  | { readonly kind: 'damage'; readonly to: Ref; readonly dice: DiceSpec; readonly damageType: DamageType }
  | { readonly kind: 'heal'; readonly to: Ref; readonly dice: DiceSpec }
  | { readonly kind: 'tempHp'; readonly to: Ref; readonly dice: DiceSpec }
  | { readonly kind: 'condition'; readonly to: Ref; readonly condition: ConditionId; readonly until: Until }
  | { readonly kind: 'removeCondition'; readonly to: Ref; readonly condition: ConditionId }
  | {
      readonly kind: 'attackRoll';
      readonly to: Ref;
      readonly using: 'weapon' | 'spell';
      readonly onHit: readonly Effect[];
      readonly onMiss: readonly Effect[];
    }
  | {
      readonly kind: 'save';
      readonly by: Ref;
      readonly ability: Ability;
      readonly dc: DcSource;
      readonly onFail: readonly Effect[];
      readonly onPass: readonly Effect[];
    }
  | { readonly kind: 'resource'; readonly who: Ref; readonly resource: ResourceId; readonly delta: number }
  | { readonly kind: 'slot'; readonly who: Ref; readonly level: SpellLevel; readonly delta: number }
  | { readonly kind: 'grantAdvantage'; readonly to: Ref; readonly on: RollTag; readonly until: Until }
  | { readonly kind: 'concentrate'; readonly spell: SpellId; readonly while: readonly Effect[] }
  | { readonly kind: 'spawn'; readonly statBlock: StatBlockId; readonly count: DiceSpec; readonly at: Placement }
  | { readonly kind: 'relocate'; readonly who: Ref; readonly to: NodeId }
  | { readonly kind: 'reveal'; readonly clue: ClueId }
  | { readonly kind: 'advanceClock'; readonly clock: ClockId; readonly by: number }
  | { readonly kind: 'setFlag'; readonly flag: FlagId; readonly value: boolean }
  | { readonly kind: 'loot'; readonly items: readonly ItemStack[]; readonly at: Placement }
  | { readonly kind: 'scripted'; readonly script: ScriptId; readonly args: Readonly<Record<string, number | string>> };

/** Who an effect lands on. Resolved against the turn, never against a stored id. */
export type Ref =
  | { readonly of: 'self' }
  | { readonly of: 'target' }
  | { readonly of: 'everyHostileHere' }
  | { readonly of: 'everyoneHere' };

export type Placement = { readonly at: 'here' } | { readonly at: 'node'; readonly node: NodeId };

/** Where a save DC comes from. Content never writes the integer. */
export type DcSource =
  | { readonly from: 'casterSpellSave' }
  | { readonly from: 'casterAbility'; readonly ability: Ability }
  | { readonly from: 'fixed'; readonly dc: 5 | 10 | 15 | 20 | 25 | 30 };

export type Until =
  | { readonly on: 'endOfTurn' }
  | { readonly on: 'endOfNextTurn' }
  | { readonly on: 'saveEnds'; readonly ability: Ability }
  | { readonly on: 'rest'; readonly which: 'short' | 'long' }
  | { readonly on: 'concentrationEnds' }
  | { readonly on: 'never' };

export type RollTag = 'attack' | 'check' | 'save' | 'initiative';

export interface ItemStack {
  readonly item: ItemId;
  readonly count: number;
}

/* ------------------------------------------------------------- rules content */

export interface ClassDef {
  readonly id: ClassId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly hitDie: 6 | 8 | 10 | 12;
  readonly savingThrows: readonly [Ability, Ability];
  readonly skillChoices: { readonly from: readonly SkillId[]; readonly pick: number };
  readonly startingEquipment: readonly ItemStack[];
  readonly weaponMasteries: number;
  readonly spellcasting: SpellcastingDef | null;
  /** Level -> features granted. Level 3 always includes the subclass choice (2024). */
  readonly featuresByLevel: Readonly<Record<number, readonly FeatureId[]>>;
  readonly subclasses: readonly SubclassId[];
}

/**
 * A caster's whole progression as a table lookup. `progression` selects the SRD slot
 * table; there is no per-class slot array to keep in step with it.
 */
export interface SpellcastingDef {
  readonly ability: Ability;
  readonly progression: 'full' | 'half' | 'third' | 'pact';
  readonly list: SpellListId;
  /** How prepared spells are chosen and when they may be swapped (2024 differs per class). */
  readonly prepared: { readonly table: readonly number[]; readonly swap: 'longRest' | 'levelUp' | 'any' };
  readonly cantripsByLevel: readonly number[];
  readonly ritualsFromList: boolean;
}

/**
 * One class feature. Passive features are `always`; usable ones become Moves on the
 * menu when their resource is available. Nothing here is prose the engine interprets.
 */
export interface FeatureDef {
  readonly id: FeatureId;
  readonly name: string;
  readonly text: string;
  readonly provenance: Provenance;
  readonly grants: readonly Grant[];
  readonly action: FeatureAction | null;
}

export type Grant =
  | { readonly gives: 'resource'; readonly resource: ResourceId; readonly max: readonly number[]; readonly recharge: 'short' | 'long' }
  | { readonly gives: 'proficiency'; readonly skill: SkillId }
  | { readonly gives: 'expertise'; readonly skill: SkillId }
  | { readonly gives: 'passive'; readonly effects: readonly Effect[] }
  | { readonly gives: 'spells'; readonly spells: readonly SpellId[]; readonly always: boolean };

export interface FeatureAction {
  readonly cost: ActionCost;
  readonly spend: { readonly resource: ResourceId; readonly amount: number } | null;
  readonly effects: readonly Effect[];
}

export type ActionCost = 'action' | 'bonus' | 'reaction' | 'free';

export interface SpellDef {
  readonly id: SpellId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly level: SpellLevel;
  readonly school: string;
  readonly ritual: boolean;
  readonly concentration: boolean;
  readonly cost: ActionCost;
  readonly range: 'self' | 'touch' | 'near' | 'far';
  readonly effects: readonly Effect[];
  /** How the spell grows when cast from a higher slot, and how a cantrip scales by level. */
  readonly scaling: { readonly per: 'slotLevel' | 'characterLevel'; readonly add: readonly Effect[] } | null;
}

export interface ItemDef {
  readonly id: ItemId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly kind: 'weapon' | 'armor' | 'shield' | 'consumable' | 'gear' | 'wondrous';
  readonly weapon: WeaponDef | null;
  readonly armorClass: ArmorDef | null;
  readonly use: FeatureAction | null;
  readonly attunement: boolean;
  readonly valueCp: number;
}

export interface WeaponDef {
  readonly category: 'simple' | 'martial';
  readonly melee: boolean;
  readonly damage: DiceSpec;
  readonly damageType: DamageType;
  readonly properties: readonly WeaponProperty[];
  readonly mastery: Mastery;
  readonly versatile: DiceSpec | null;
}

export const WEAPON_PROPERTIES = [
  'ammunition', 'finesse', 'heavy', 'light', 'loading', 'reach', 'thrown', 'twoHanded', 'versatile',
] as const;
export type WeaponProperty = (typeof WEAPON_PROPERTIES)[number];

/** The eight 2024 masteries (research-rules section 1). Resolved in engine code, not data. */
export const MASTERIES = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'] as const;
export type Mastery = (typeof MASTERIES)[number];

export type ArmorDef =
  | { readonly how: 'flat'; readonly base: number; readonly dexCap: number | null; readonly strengthMin: number | null }
  | { readonly how: 'shield'; readonly bonus: number };

/**
 * An authored monster. Flat and complete, unlike a Hero, which is a set of choices.
 * Both project into `Combatant`, which is the only thing combat code ever sees.
 */
export interface StatBlockDef {
  readonly id: StatBlockId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly cr: number;
  readonly xp: number;
  readonly ac: number;
  readonly hp: DiceSpec;
  readonly speed: number;
  readonly abilities: Readonly<Record<Ability, number>>;
  readonly saveProficiencies: readonly Ability[];
  readonly immunities: readonly (DamageType | ConditionId)[];
  readonly resistances: readonly DamageType[];
  readonly initiativeMod: number;
  readonly actions: readonly FeatureAction[];
  /** SRD 5.2.1 p.255 "Running a Monster", as a policy the engine follows so the DM cannot. */
  readonly tactics: 'brute' | 'skirmisher' | 'caster' | 'ambusher' | 'leader';
  readonly loot: readonly ItemStack[];
}

export interface ConditionDef {
  readonly id: ConditionId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly text: string;
  readonly effects: readonly ConditionRule[];
}

export type ConditionRule =
  | { readonly rule: 'disadvantage'; readonly on: RollTag }
  | { readonly rule: 'advantageAgainst'; readonly on: RollTag }
  | { readonly rule: 'autoFailSave'; readonly ability: Ability }
  | { readonly rule: 'speed'; readonly to: number }
  | { readonly rule: 'cannotAct' }
  | { readonly rule: 'immuneTo'; readonly damageType: DamageType };

export interface SpeciesDef {
  readonly id: SpeciesId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly size: 'small' | 'medium';
  readonly speed: number;
  readonly traits: readonly FeatureId[];
}

/** 2024: the ability increases live here, not on the species (research-rules section 3). */
export interface BackgroundDef {
  readonly id: BackgroundId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly abilities: readonly [Ability, Ability, Ability];
  readonly originFeat: FeatId;
  readonly skills: readonly [SkillId, SkillId];
  readonly equipment: readonly ItemStack[];
}

/* ------------------------------------------------------------ campaign content */

export interface ModuleDef {
  readonly id: ModuleId;
  readonly name: string;
  readonly premise: string;
  readonly levels: readonly [number, number];
  readonly start: NodeId;
  /** Engine-checkable. There is no other definition of "won" (FR-011). */
  readonly goal: Goal;
  readonly nodes: readonly NodeDef[];
  readonly npcs: readonly NpcDef[];
  readonly roles: readonly RoleDef[];
  readonly revelations: readonly RevelationDef[];
  readonly clues: readonly ClueDef[];
  readonly clocks: readonly ClockDef[];
  readonly fronts: readonly FrontDef[];
  readonly encounters: readonly EncounterDef[];
  /** Walk-on characters the DM may introduce. A closed enum, so no minting, no invented stats. */
  readonly castPool: readonly NpcDef[];
  readonly finale: { readonly node: NodeId; readonly resolutions: readonly ResolutionDef[] };
  readonly epilogue: readonly ResolutionDef[];
  /** Who steps in when the hero dies here. Human-authored; research-campaigns section 4.3. */
  readonly successors: readonly SuccessorDef[];
}

/**
 * A module is won when this predicate holds. The vow progress bar the player reads is
 * `satisfied(goal) / terms(goal)` over the same tree, so there is nothing to accumulate,
 * nothing for the DM to claim, and no unearned-milestone adjudication to get wrong.
 */
export type Goal =
  | { readonly kind: 'revealed'; readonly revelation: RevelationId }
  | { readonly kind: 'defeated'; readonly role: RoleId }
  | { readonly kind: 'reached'; readonly node: NodeId }
  | { readonly kind: 'flag'; readonly flag: FlagId }
  | { readonly kind: 'clockFilled'; readonly clock: ClockId }
  | { readonly kind: 'all'; readonly of: readonly Goal[] }
  | { readonly kind: 'any'; readonly need: number; readonly of: readonly Goal[] };

export interface NodeDef {
  readonly id: NodeId;
  readonly name: string;
  /** DM-only. Never enters PlayerView; the DM narrates from it. */
  readonly description: string;
  readonly question: string;
  readonly aspects: readonly [string, string, string];
  readonly interactives: readonly string[];
  readonly exits: readonly { readonly dir: Direction; readonly to: NodeId; readonly locked: FlagId | null }[];
  readonly npcs: readonly NpcId[];
  readonly encounter: EncounterId | null;
  readonly loot: readonly ItemStack[];
  readonly restable: boolean;
}

export const DIRECTIONS = ['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface NpcDef {
  readonly id: NpcId;
  readonly name: string;
  readonly appearance: string;
  readonly quote: string;
  readonly roleplaying: readonly string[];
  /** DM-only. What they want, which is what makes them act. */
  readonly want: string;
  readonly keyInfo: readonly string[];
  readonly statBlock: StatBlockId | null;
  readonly role: RoleId | null;
}

/** A named part the module's goal can refer to, so a goal survives a recast NPC. */
export interface RoleDef {
  readonly id: RoleId;
  readonly name: string;
  readonly filledBy: NpcId;
}

export interface RevelationDef {
  readonly id: RevelationId;
  readonly scope: 'module' | 'campaign';
  readonly statement: string;
  readonly leadsTo: NodeId | null;
}

export interface ClueDef {
  readonly id: ClueId;
  readonly revelation: RevelationId;
  /** Player-facing, one sentence. What they now know. */
  readonly what: string;
  readonly at: NodeId;
  /** Below passive Perception it is noticed on entry; otherwise it needs the gated move. */
  readonly noticeDc: number;
  readonly gate: { readonly skill: SkillId; readonly dc: number } | null;
}

export interface ClockDef {
  readonly id: ClockId;
  readonly name: string;
  readonly segments: 4 | 6 | 8;
  readonly visibility: 'open' | 'secret';
  /** The engine fires these. There is no `tick` field on the DM's schema any more. */
  readonly triggers: readonly ClockTrigger[];
  /** What actually happens. Prose alone was review-gaps #15: a filled clock that did nothing. */
  readonly payoff: readonly Effect[];
  readonly payoffText: string;
}

export type ClockTrigger =
  | { readonly on: 'rest'; readonly which: 'short' | 'long' | 'either' }
  | { readonly on: 'turnsElapsed'; readonly every: number }
  | { readonly on: 'checkFailed'; readonly at: NodeId | null }
  /** Also how a proactive node arrives (research-campaigns section 4.2, lint G6). */
  | { readonly on: 'noDiscovery'; readonly turns: number }
  | { readonly on: 'nodeEntered'; readonly node: NodeId }
  | { readonly on: 'clockFilled'; readonly clock: ClockId };

export interface FrontDef {
  readonly id: FrontId;
  readonly name: string;
  readonly impulse: string;
  readonly doom: string;
  /** Grim portents are a clock. One shape for all off-screen pressure. */
  readonly portents: ClockId;
  readonly cast: readonly NpcId[];
}

export interface EncounterDef {
  readonly id: EncounterId;
  readonly node: NodeId;
  readonly question: string;
  readonly difficulty: 'low' | 'moderate' | 'high';
  readonly creatures: readonly { readonly statBlock: StatBlockId; readonly count: number }[];
  /** An exit must exist for a `high` encounter. Lint S4/P-series check it. */
  readonly escape: { readonly via: Direction; readonly dc: number } | null;
}

export interface ResolutionDef {
  readonly when: Goal | { readonly kind: 'otherwise' };
  readonly text: string;
  readonly effects: readonly Effect[];
}

export interface SuccessorDef {
  readonly from: NpcId | null;
  readonly hook: string;
  readonly enterAt: NodeId | 'hub';
}

export interface CampaignDef {
  readonly id: CampaignId;
  readonly name: string;
  readonly pitch: string;
  readonly truths: readonly string[];
  readonly startingLevel: number;
  readonly mode: 'episodic' | 'serialized';
  readonly hub: NodeId | null;
  readonly modules: readonly ModuleId[];
  readonly revelations: readonly RevelationDef[];
  readonly fronts: readonly FrontDef[];
  readonly epilogue: readonly ResolutionDef[];
}

/* ------------------------------------------------------------------- the pack */

export interface PackManifest {
  readonly id: PackId;
  readonly name: string;
  readonly version: string;
  readonly provenance: Provenance;
  readonly contractVersion: number;
  readonly contractDigest: Digest;
  readonly attribution: string;
  readonly requires: readonly PackId[];
}

/**
 * A parsed pack. Maps, not arrays, because every access pattern downstream is by id:
 * the menu asks "what does this item do", the sheet asks "what does this class grant at
 * level 3", the forge asks "does this clue's revelation exist". There is no later index
 * to add.
 */
export interface Pack {
  readonly manifest: PackManifest;
  readonly classes: ReadonlyMap<ClassId, ClassDef>;
  readonly features: ReadonlyMap<FeatureId, FeatureDef>;
  readonly species: ReadonlyMap<SpeciesId, SpeciesDef>;
  readonly backgrounds: ReadonlyMap<BackgroundId, BackgroundDef>;
  readonly spells: ReadonlyMap<SpellId, SpellDef>;
  readonly items: ReadonlyMap<ItemId, ItemDef>;
  readonly statBlocks: ReadonlyMap<StatBlockId, StatBlockDef>;
  readonly conditions: ReadonlyMap<ConditionId, ConditionDef>;
  readonly modules: ReadonlyMap<ModuleId, ModuleDef>;
  readonly campaigns: ReadonlyMap<CampaignId, CampaignDef>;
}

/**
 * Several packs resolved into one lookup, with later packs shadowing earlier ones by id.
 * The game never holds a `Pack` after start-up; it holds a `Library` pinned by digests.
 */
export interface Library {
  readonly pins: readonly Digest[];
  class(id: ClassId): ClassDef | undefined;
  feature(id: FeatureId): FeatureDef | undefined;
  spell(id: SpellId): SpellDef | undefined;
  item(id: ItemId): ItemDef | undefined;
  statBlock(id: StatBlockId): StatBlockDef | undefined;
  condition(id: ConditionId): ConditionDef | undefined;
  module(id: ModuleId): ModuleDef | undefined;
  campaign(id: CampaignId): CampaignDef | undefined;
  /** Everything a creation screen may offer, already filtered by campaign scope (US10). */
  optionsFor(campaign: CampaignId): CreationOptions;
}

export interface CreationOptions {
  readonly classes: readonly ClassDef[];
  readonly species: readonly SpeciesDef[];
  readonly backgrounds: readonly BackgroundDef[];
}

/* ------------------------------------------------------------- the sync gate */

/** Bumped in the same commit as any contract change. See `FROZEN_CONTRACT_DIGEST`. */
export const CONTRACT_VERSION = 1;

/**
 * A hash over the contract's own declared field table, computed at runtime. A test asserts
 * it equals a checked-in constant, so changing this file without bumping the version fails
 * the suite. Out of tree, a pack carries the digest it was built against and the loader
 * refuses one it does not know (spec US11 AS2).
 */
export function contractDigest(): Digest {
  // TODO: walk a declared FIELD_TABLE (one row per type, listing field names and kinds),
  // canonicalise, hash with node:crypto. Do NOT hash the source text: comments would
  // churn the digest and reformatting would be a breaking change.
  throw new Error('not implemented');
}

export interface PackError {
  readonly code: string;
  /** `module/entity/field`, good enough to open a file at (FR-017). */
  readonly at: string;
  readonly message: string;
}

export type ParseResult =
  | { readonly ok: true; readonly pack: Pack }
  | { readonly ok: false; readonly errors: readonly PackError[] };

/**
 * The only door. Validates shape, id prefixes, cross-references, dice strings, level
 * ranges, the `scripted` provenance gate, and the contract digest, then hands back domain
 * types nothing downstream re-checks.
 */
export function parsePack(raw: unknown): ParseResult {
  // TODO order matters: manifest and contract digest first (a version mismatch should not
  // produce five hundred field errors), then entities, then cross-references, then the
  // provenance gate. Collect every error; never throw on the first.
  throw new Error('not implemented');
}

export function digestOf(pack: Pack): Digest {
  // TODO canonical order by id within each map, stable JSON, hash. Two forge runs from the
  // same seed must produce the same digest or pinning is worthless.
  throw new Error('not implemented');
}

export function libraryOf(packs: readonly Pack[]): Library {
  throw new Error('not implemented');
}

/** Boundary constructor for dice. The only place a dice string is validated. */
export function dice(s: string): DiceSpec {
  throw new Error('not implemented');
}

export function level(n: number): CharacterLevel {
  throw new Error('not implemented');
}

/** Raised only by the host when a pinned digest is missing from the pack store. */
export class UnknownPack extends Error {
  readonly digest: Digest;

  constructor(digest: Digest) {
    super(`this save was played against content that is not in the store: ${digest}`);
    this.name = 'UnknownPack';
    this.digest = digest;
  }
}
