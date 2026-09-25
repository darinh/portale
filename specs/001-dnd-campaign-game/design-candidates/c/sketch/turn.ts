/**
 * One turn. The player declares an intent. The engine decides. The model narrates.
 * Damage, DC numbers, reprisal, initiative, and monster actions are not in the proposal.
 */

import type { DerivedStats, HeroRecord } from './character.ts';
import type { ContentIndex } from './content.ts';
import type { ClockId, ClueId, EntityId, ItemInstanceId, SpellId, TurnId } from './ids.ts';
import type { DcBand, Direction, Skill, SlotLevel } from './vocab.ts';
import type { World, WorldEvent } from './world.ts';

export type Act =
  | { readonly kind: 'attack'; readonly weapon: ItemInstanceId; readonly target: EntityId }
  | { readonly kind: 'cast'; readonly spell: SpellId; readonly slot: SlotLevel; readonly targets: readonly EntityId[] }
  | { readonly kind: 'useItem'; readonly item: ItemInstanceId; readonly target: EntityId | null }
  | { readonly kind: 'move'; readonly via: Direction }
  | { readonly kind: 'flee'; readonly via: Direction }
  | { readonly kind: 'rest'; readonly rest: 'short' | 'long'; readonly hitDice: number }
  | { readonly kind: 'dodge' }
  | { readonly kind: 'disengage' }
  | { readonly kind: 'hide' }
  | { readonly kind: 'help'; readonly target: EntityId }
  | { readonly kind: 'dash' }
  | { readonly kind: 'ooc'; readonly text: string };

export type Intent =
  | { readonly kind: 'utter'; readonly text: string }
  | { readonly kind: 'act'; readonly act: Act };

export type ActKind = 'check' | 'talk' | 'attack' | 'move' | 'engage' | 'rest' | 'flee' | 'narrate';

/**
 * Free-text leftover. Closed enums, no amounts.
 * Structured acts do not use this. They use NarrationProposal.
 */
export interface InterpretProposal {
  readonly actKind: ActKind;
  readonly target: EntityId | 'none';
  readonly skill: Skill | 'none';
  readonly band: DcBand;
  readonly via: Direction | 'none';
  readonly rest: 'short' | 'long' | 'none';
  readonly reveals: ClueId | 'none';
  readonly tick: ClockId | 'none';
  readonly narration: string;
}

export interface NarrationProposal {
  readonly reveals: ClueId | 'none';
  readonly tick: ClockId | 'none';
  readonly narration: string;
}

export type Proposal = InterpretProposal | NarrationProposal;

export interface SceneBrief {
  readonly scene: string;
  readonly mode: World['mode'];
  readonly utterance: string;
  readonly schema: 'interpret' | 'narrate';
  readonly inReach: readonly { readonly id: EntityId; readonly name: string; readonly lore: string }[];
  readonly exits: readonly Direction[];
  readonly clocks: readonly { readonly id: ClockId; readonly name: string }[];
  readonly cluesHere: readonly { readonly id: ClueId; readonly what: string }[];
  readonly reprisalBy: EntityId | null;
  readonly outOfCharacter: boolean;
}

export interface Director {
  readonly name: string;
  propose(brief: SceneBrief): Promise<Proposal>;
}

export type Ruling =
  | { readonly kind: 'applied' }
  | { readonly kind: 'rewrite'; readonly why: string; readonly detail: string }
  | { readonly kind: 'drop'; readonly why: string; readonly detail: string };

export interface Adjudication {
  readonly events: readonly WorldEvent[];
  readonly rulings: readonly Ruling[];
  readonly softFail: boolean;
}

export function legalActs(world: World, hero: HeroRecord, derived: DerivedStats, index: ContentIndex): readonly Act[] {
  void world;
  void hero;
  void derived;
  void index;
  // TODO enumerate attacks, casts, items, exits, rest, flee from live state.
  // The browser renders this list. The model never sees it whole.
  throw new Error('not implemented');
}

export function briefFor(world: World, intent: Intent): SceneBrief {
  void world;
  void intent;
  // TODO schema is `narrate` for Act and for dying/death-save turns.
  // schema is `interpret` only for free text while up.
  // OOC collapses to narrate. Combat interpret enum omits rest.
  throw new Error('not implemented');
}

export function buildSchema(brief: SceneBrief): object {
  void brief;
  // TODO field order mechanics then narration. No `damage`. No integer DC.
  // interpret: actKind, target, skill, band, via, rest, reveals, tick, narration.
  // narrate: reveals, tick, narration. Tick/reveals still closed enums from the brief.
  throw new Error('not implemented');
}

export function adjudicate(
  world: World,
  hero: HeroRecord,
  derived: DerivedStats,
  index: ContentIndex,
  brief: SceneBrief,
  intent: Intent,
  proposal: Proposal,
): Adjudication {
  void world;
  void hero;
  void derived;
  void index;
  void brief;
  void intent;
  void proposal;
  // TODO
  // 1. If vitality is dying, roll the death save first. Three failures emit died. Ignore declared attacks.
  // 2. If intent is act, resolve that act from the sheet. Drop proposal.actKind if present.
  // 3. If intent is utter, map proposal.actKind through clamps. Skill bonus from derive. DC from DC_OF[band].
  // 4. Hostiles act from MonsterDef.actions in initiative order. The proposal does not name them.
  // 5. finish(): clock ticks already chosen, fill expands ClockDef.onFill into primitive events,
  //    proactive clues fire when turnsWithoutDiscovery hits the delivery threshold,
  //    goalHolds emits a campaign event via the caller, combat ends when no living hostile is here.
  throw new Error('not implemented');
}

export interface TurnInput {
  readonly turn: TurnId;
  readonly intent: Intent;
}

export interface TurnResult {
  readonly events: readonly WorldEvent[];
  readonly softFail: boolean;
  readonly breach: string | null;
}

export async function takeTurn(
  world: World,
  hero: HeroRecord,
  derived: DerivedStats,
  index: ContentIndex,
  input: TurnInput,
  director: Director,
): Promise<TurnResult> {
  void world;
  void hero;
  void derived;
  void index;
  void input;
  void director;
  // TODO briefFor, director.propose, adjudicate. On transport failure emit stall + ruled, never retry the model.
  throw new Error('not implemented');
}
