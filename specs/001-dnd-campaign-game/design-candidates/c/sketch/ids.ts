/** Branded ids. Construction is the check. Callers trust the brand. */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type Seed = Brand<number, 'Seed'>;
export type SaveId = Brand<string, 'SaveId'>;
export type TurnId = Brand<string, 'TurnId'>;
export type HeroId = Brand<string, 'HeroId'>;
export type EntityId = Brand<string, 'EntityId'>;
export type LocationId = Brand<string, 'LocationId'>;
export type ClockId = Brand<string, 'ClockId'>;
export type VowId = Brand<string, 'VowId'>;
export type ClueId = Brand<string, 'ClueId'>;
export type NodeId = Brand<string, 'NodeId'>;
export type ModuleId = Brand<string, 'ModuleId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type ClassId = Brand<string, 'ClassId'>;
export type SubclassId = Brand<string, 'SubclassId'>;
export type SpeciesId = Brand<string, 'SpeciesId'>;
export type BackgroundId = Brand<string, 'BackgroundId'>;
export type FeatId = Brand<string, 'FeatId'>;
export type SpellId = Brand<string, 'SpellId'>;
export type ItemId = Brand<string, 'ItemId'>;
export type ItemInstanceId = Brand<string, 'ItemInstanceId'>;
export type MonsterId = Brand<string, 'MonsterId'>;
export type ConditionId = Brand<string, 'ConditionId'>;
export type FeatureId = Brand<string, 'FeatureId'>;
export type ResourceId = Brand<string, 'ResourceId'>;
export type EncounterId = Brand<string, 'EncounterId'>;
export type RevelationId = Brand<string, 'RevelationId'>;
export type HandlerId = Brand<string, 'HandlerId'>;
export type ContentDigest = Brand<string, 'ContentDigest'>;
export type ContractDigest = Brand<string, 'ContractDigest'>;
export type Level = Brand<number, 'Level'>;

export function seed(n: number): Seed {
  return (n >>> 0) as Seed;
}

export function level(n: number): Level {
  const clamped = Math.max(1, Math.min(20, Math.trunc(n)));
  return clamped as Level;
}

export function turnId(s: string): TurnId {
  return s as TurnId;
}

export function saveId(s: string): SaveId {
  return s as SaveId;
}

export function campaignId(s: string): CampaignId {
  return s as CampaignId;
}

export function entityId(s: string): EntityId {
  return s as EntityId;
}

export function heroId(s: string): HeroId {
  return s as HeroId;
}

export function locationId(s: string): LocationId {
  return s as LocationId;
}

export function clockId(s: string): ClockId {
  return s as ClockId;
}

export function clueId(s: string): ClueId {
  return s as ClueId;
}

export function itemInstanceId(s: string): ItemInstanceId {
  return s as ItemInstanceId;
}

export function classId(s: string): ClassId {
  return s as ClassId;
}

export function spellId(s: string): SpellId {
  return s as SpellId;
}

export function moduleId(s: string): ModuleId {
  return s as ModuleId;
}

export function revelationId(s: string): RevelationId {
  return s as RevelationId;
}

export function encounterId(s: string): EncounterId {
  return s as EncounterId;
}

export function handlerId(s: string): HandlerId {
  return s as HandlerId;
}

export function contentDigest(s: string): ContentDigest {
  return s as ContentDigest;
}

export function contractDigest(s: string): ContractDigest {
  return s as ContractDigest;
}
