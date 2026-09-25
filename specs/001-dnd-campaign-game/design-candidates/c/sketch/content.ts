/**
 * Campaign and rules content. Authored as JSON, parsed once, pinned into the save.
 * Edges come from clues. Goals and clock fills are predicates and consequences, not prose.
 */

import type { Effect } from './effects.ts';
import type {
  BackgroundId,
  CampaignId,
  ClassId,
  ClockId,
  ClueId,
  ConditionId,
  ContentDigest,
  ContractDigest,
  EncounterId,
  EntityId,
  FeatId,
  FeatureId,
  ItemId,
  Level,
  LocationId,
  ModuleId,
  MonsterId,
  NodeId,
  ResourceId,
  RevelationId,
  SpeciesId,
  SpellId,
  SubclassId,
  VowId,
} from './ids.ts';
import { contractDigest } from './ids.ts';
import type { Ability, DamageType, DiceExpr, Direction, Scores, Skill, SlotLevel } from './vocab.ts';

export type {
  Ability,
  DamageType,
  DcBand,
  DiceExpr,
  Direction,
  Duration,
  Scores,
  Skill,
  SlotLevel,
} from './vocab.ts';
export { ABILITIES, DC_BANDS, DC_OF, DIRECTIONS, SKILLS } from './vocab.ts';

export type Provenance =
  | { readonly kind: 'srd'; readonly page: number }
  | { readonly kind: 'original' }
  | { readonly kind: 'campaign'; readonly campaign: CampaignId }
  | { readonly kind: 'player' };

export type ParseError = { readonly path: string; readonly rule: string; readonly detail: string };

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly ParseError[] };

export interface ResourceDef {
  readonly id: ResourceId;
  readonly name: string;
  readonly maxFrom: 'levelTable' | 'pb' | 'fixed';
  readonly fixed: number;
  readonly recharge: 'short' | 'long' | 'dawn' | 'none';
}

export interface FeatureDef {
  readonly id: FeatureId;
  readonly name: string;
  readonly level: Level;
  readonly resource: ResourceDef | null;
  readonly effects: readonly Effect[];
}

export interface SpellcastingDef {
  readonly ability: Ability;
  readonly kind: 'full' | 'half' | 'pact';
  readonly prepare: 'list' | 'known' | 'book';
  readonly swapOn: 'level' | 'longRest' | 'none';
  readonly ritual: boolean;
  readonly list: readonly SpellId[];
}

export interface ClassDef {
  readonly id: ClassId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly hitDie: 6 | 8 | 10 | 12;
  readonly saves: readonly [Ability, Ability];
  readonly skillCount: number;
  readonly skillList: readonly Skill[];
  readonly features: readonly FeatureDef[];
  readonly spellcasting: SpellcastingDef | null;
  readonly subclassAt: 3;
  readonly subclasses: readonly SubclassDef[];
}

export interface SubclassDef {
  readonly id: SubclassId;
  readonly name: string;
  readonly features: readonly FeatureDef[];
}

export interface SpeciesDef {
  readonly id: SpeciesId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly speed: number;
  readonly traits: readonly FeatureDef[];
}

export interface BackgroundDef {
  readonly id: BackgroundId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly abilities: readonly [Ability, Ability, Ability];
  readonly originFeat: FeatId;
  readonly skills: readonly [Skill, Skill];
}

export interface SpellDef {
  readonly id: SpellId;
  readonly name: string;
  readonly level: SlotLevel;
  readonly school: string;
  readonly provenance: Provenance;
  readonly ritual: boolean;
  readonly concentration: boolean;
  readonly effects: readonly Effect[];
}

export interface ItemDef {
  readonly id: ItemId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly kind: 'weapon' | 'armor' | 'shield' | 'gear' | 'potion' | 'wondrous';
  readonly damage: DiceExpr | null;
  readonly damageType: DamageType | null;
  readonly armor: number | null;
  readonly mastery: string | null;
  readonly effects: readonly Effect[];
}

export interface MonsterDef {
  readonly id: MonsterId;
  readonly name: string;
  readonly provenance: Provenance;
  readonly cr: string;
  readonly xp: number;
  readonly hp: DiceExpr;
  readonly ac: number;
  readonly speed: number;
  readonly scores: Scores;
  readonly actions: readonly MonsterAction[];
}

export interface MonsterAction {
  readonly name: string;
  readonly effects: readonly Effect[];
}

export type Goal =
  | { readonly kind: 'revelation'; readonly id: RevelationId }
  | { readonly kind: 'entityDead'; readonly id: EntityId }
  | { readonly kind: 'hasItem'; readonly item: ItemId }
  | { readonly kind: 'at'; readonly location: LocationId }
  | { readonly kind: 'clockFilled'; readonly clock: ClockId }
  | { readonly kind: 'and'; readonly of: readonly Goal[] }
  | { readonly kind: 'or'; readonly of: readonly Goal[] };

export type Consequence =
  | { readonly kind: 'spawn'; readonly encounter: EncounterId; readonly at: LocationId }
  | { readonly kind: 'advanceClock'; readonly clock: ClockId; readonly by: number }
  | { readonly kind: 'lock'; readonly from: LocationId; readonly via: Direction }
  | { readonly kind: 'unlock'; readonly from: LocationId; readonly via: Direction }
  | { readonly kind: 'damageHero'; readonly dice: DiceExpr }
  | { readonly kind: 'condition'; readonly condition: ConditionId }
  | { readonly kind: 'reveal'; readonly clue: ClueId }
  | { readonly kind: 'failModule' }
  | { readonly kind: 'narrate' };

export type ClueDelivery =
  | { readonly kind: 'static'; readonly at: NodeId; readonly gate: Skill | null }
  | { readonly kind: 'flexible'; readonly at: NodeId }
  | { readonly kind: 'proactive'; readonly afterTurnsWithoutDiscovery: number }
  | { readonly kind: 'reactive'; readonly method: 'research' | 'canvass' };

export interface Revelation {
  readonly id: RevelationId;
  readonly scope: 'module' | 'campaign';
  readonly statement: string;
  readonly leadsTo: NodeId | null;
}

export interface AuthoredClue {
  readonly id: ClueId;
  readonly revelation: RevelationId;
  readonly text: string;
  readonly delivery: ClueDelivery;
}

export interface ClockDef {
  readonly id: ClockId;
  readonly name: string;
  readonly kind: 'danger' | 'progress';
  readonly segments: 4 | 6 | 8;
  readonly visibility: 'open' | 'secret';
  readonly payoff: string;
  readonly onFill: readonly Consequence[];
}

export interface LocationDef {
  readonly id: LocationId;
  readonly name: string;
  readonly description: string;
  readonly node: NodeId;
  readonly exits: readonly (readonly [Direction, LocationId])[];
}

export interface EncounterDef {
  readonly id: EncounterId;
  readonly difficulty: 'low' | 'moderate' | 'high';
  readonly monsters: readonly MonsterId[];
  readonly question: string;
}

export interface Module {
  readonly id: ModuleId;
  readonly season: number;
  readonly title: string;
  readonly levelBand: readonly [Level, Level];
  readonly premise: string;
  readonly start: LocationId;
  readonly finale: NodeId;
  readonly goal: Goal;
  readonly rooms: readonly LocationDef[];
  readonly clocks: readonly ClockDef[];
  readonly vows: readonly { readonly id: VowId; readonly what: string; readonly rank: 'troublesome' | 'dangerous' | 'formidable' }[];
  readonly revelations: readonly Revelation[];
  readonly clues: readonly AuthoredClue[];
  readonly encounters: readonly EncounterDef[];
  readonly npcs: readonly { readonly id: EntityId; readonly name: string; readonly lore: string; readonly at: LocationId; readonly monster: MonsterId | null; readonly hostile: boolean }[];
  readonly classes: readonly ClassDef[];
  readonly spells: readonly SpellDef[];
  readonly items: readonly ItemDef[];
  readonly monsters: readonly MonsterDef[];
}

export interface Campaign {
  readonly id: CampaignId;
  readonly title: string;
  readonly contractVersion: number;
  readonly startLevel: Level;
  readonly modules: readonly Module[];
  readonly classes: readonly ClassDef[];
  readonly species: readonly SpeciesDef[];
  readonly backgrounds: readonly BackgroundDef[];
  readonly feats: readonly { readonly id: FeatId; readonly name: string; readonly provenance: Provenance; readonly effects: readonly Effect[] }[];
  readonly spells: readonly SpellDef[];
  readonly items: readonly ItemDef[];
  readonly monsters: readonly MonsterDef[];
  readonly conditions: readonly { readonly id: ConditionId; readonly name: string }[];
}

export interface ContentPin {
  readonly contract: ContractDigest;
  readonly digest: ContentDigest;
  readonly campaign: Campaign;
}

export interface ContentIndex {
  readonly classes: ReadonlyMap<ClassId, ClassDef>;
  readonly species: ReadonlyMap<SpeciesId, SpeciesDef>;
  readonly backgrounds: ReadonlyMap<BackgroundId, BackgroundDef>;
  readonly spells: ReadonlyMap<SpellId, SpellDef>;
  readonly items: ReadonlyMap<ItemId, ItemDef>;
  readonly monsters: ReadonlyMap<MonsterId, MonsterDef>;
  readonly modules: ReadonlyMap<ModuleId, Module>;
}

/** Bump when parseCampaign's accepted shape changes. Pins store this digest. */
export const CONTRACT_VERSION = 1;

export function thisContractDigest(): ContractDigest {
  return contractDigest(`portale-contract-v${String(CONTRACT_VERSION)}`);
}

export function parseCampaign(raw: unknown): ParseResult<Campaign> {
  void raw;
  // TODO validate contractVersion, branded ids, clue→revelation→node edges,
  // clock segments in {4,6,8}, goal reachability, no dangling content refs.
  throw new Error('not implemented');
}

export function pinCampaign(campaign: Campaign): ContentPin {
  void campaign;
  // TODO canonical JSON stringify, sha-256, wrap. The pin is a value. Files are gone.
  throw new Error('not implemented');
}

export function indexPin(pin: ContentPin): ContentIndex {
  void pin;
  // TODO one Map per catalog. Lookups during a turn never scan arrays.
  throw new Error('not implemented');
}

export function mergeContent(pin: ContentPin, module: Module): ContentIndex {
  void pin;
  void module;
  // TODO campaign catalogs plus module overlays. Module ids win on collision inside this module.
  throw new Error('not implemented');
}
