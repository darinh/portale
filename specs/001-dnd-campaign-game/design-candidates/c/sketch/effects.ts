/**
 * Effect IR. Features, spells, items, and monster actions are data.
 * A handler id is the escape hatch for the few things the IR cannot say.
 * Custom classes and module classes use this same union. There is no second path.
 */

import type { Ability, DamageType, DiceExpr, Duration, SlotLevel } from './vocab.ts';
import type { ConditionId, HandlerId, ResourceId } from './ids.ts';

export type AttackKind = 'melee' | 'ranged' | 'spell';

export type Effect =
  | {
      readonly kind: 'damage';
      readonly dice: DiceExpr;
      readonly type: DamageType;
      readonly attack: AttackKind;
    }
  | { readonly kind: 'heal'; readonly dice: DiceExpr }
  | { readonly kind: 'tempHp'; readonly dice: DiceExpr }
  | { readonly kind: 'condition'; readonly condition: ConditionId; readonly duration: Duration }
  | {
      readonly kind: 'save';
      readonly ability: Ability;
      readonly dc: 'spell' | 'feature';
      readonly onFail: readonly Effect[];
      readonly onSuccess: readonly Effect[];
    }
  | { readonly kind: 'resource'; readonly resource: ResourceId; readonly delta: number }
  | { readonly kind: 'slot'; readonly level: SlotLevel; readonly delta: number }
  | { readonly kind: 'advantage'; readonly on: 'nextAttack' | 'nextCheck' | 'nextSave' }
  | { readonly kind: 'resistance'; readonly type: DamageType; readonly duration: Duration }
  | { readonly kind: 'speed'; readonly deltaFeet: number; readonly duration: Duration }
  | { readonly kind: 'code'; readonly handler: HandlerId };

export function interpret(
  effects: readonly Effect[],
  ctx: unknown,
): never {
  void effects;
  void ctx;
  // TODO fold each effect against the working world. Look up handler(id) only for `code`.
  // Damage dice are rolled here from seed+seq. The model never supplies an amount.
  throw new Error('not implemented');
}
