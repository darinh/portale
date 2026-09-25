/**
 * One playthrough. The pin is the content the player actually played.
 * Later file edits cannot change a save. The log is the rest of the truth.
 */

import type { DerivedStats, HeroDraft, HeroRecord } from './character.ts';
import type { ContentIndex, ContentPin, Module } from './content.ts';
import type { CampaignId, HeroId, Level, ModuleId, SaveId, Seed, TurnId } from './ids.ts';
import type { Act, Director, Intent, TurnResult } from './turn.ts';
import type { World, WorldEvent } from './world.ts';

export type PlayPhase =
  | { readonly kind: 'creating'; readonly why: 'new' | 'replace'; readonly atLevel: Level }
  | { readonly kind: 'playing' }
  | { readonly kind: 'levelUp'; readonly to: Level }
  | { readonly kind: 'fate'; readonly dead: HeroId; readonly atLevel: Level }
  | { readonly kind: 'betweenModules'; readonly completed: ModuleId }
  | { readonly kind: 'moduleOver'; readonly result: 'won' | 'lost'; readonly module: ModuleId }
  | { readonly kind: 'campaignOver'; readonly result: 'won' | 'lost' };

export type CampaignEvent =
  | { readonly kind: 'saveBegan'; readonly campaign: CampaignId; readonly seed: Seed }
  | { readonly kind: 'heroCreated'; readonly hero: HeroRecord }
  | { readonly kind: 'heroReplaced'; readonly dead: HeroId; readonly hero: HeroRecord }
  | { readonly kind: 'moduleBegan'; readonly module: ModuleId }
  | { readonly kind: 'moduleWon'; readonly module: ModuleId }
  | { readonly kind: 'moduleLost'; readonly module: ModuleId }
  | { readonly kind: 'fateChosen'; readonly fate: 'end' | 'replace' }
  | { readonly kind: 'levelGained'; readonly to: Level }
  | { readonly kind: 'campaignWon' }
  | { readonly kind: 'campaignLost' };

export type GameEvent = WorldEvent | CampaignEvent;

export interface Save {
  readonly id: SaveId;
  readonly seed: Seed;
  readonly pin: ContentPin;
  readonly events: readonly GameEvent[];
}

export interface Folded {
  readonly save: Save;
  readonly world: World;
  readonly hero: HeroRecord | null;
  readonly derived: DerivedStats | null;
  readonly index: ContentIndex;
  readonly module: Module;
  readonly phase: PlayPhase;
}

export type Command =
  | { readonly kind: 'newCampaign'; readonly pin: ContentPin; readonly seed: Seed }
  | { readonly kind: 'createHero'; readonly save: SaveId; readonly turn: TurnId; readonly draft: HeroDraft }
  | { readonly kind: 'turn'; readonly save: SaveId; readonly turn: TurnId; readonly intent: Intent }
  | { readonly kind: 'chooseFate'; readonly save: SaveId; readonly turn: TurnId; readonly fate: 'end' | 'replace' }
  | { readonly kind: 'advanceModule'; readonly save: SaveId; readonly turn: TurnId }
  | { readonly kind: 'deleteSave'; readonly save: SaveId };

export interface PlayerView {
  readonly seq: number;
  readonly phase: PlayPhase;
  readonly outcome: 'playing' | 'won' | 'lost';
  readonly scene: string;
  readonly you: {
    readonly name: string;
    readonly hp: { readonly now: number; readonly max: number };
    readonly ac: number;
    readonly level: Level;
    readonly defeated: boolean;
  } | null;
  readonly acts: readonly Act[];
  readonly present: readonly { readonly id: string; readonly name: string; readonly hp: { readonly now: number; readonly max: number }; readonly dead: boolean }[];
  readonly exits: readonly string[];
  readonly clocks: readonly { readonly name: string; readonly filled: number; readonly segments: number }[];
  readonly vows: readonly { readonly what: string; readonly boxes: number; readonly done: boolean }[];
  readonly leads: readonly { readonly what: string }[];
  readonly inventory: readonly { readonly name: string; readonly qty: number; readonly equipped: boolean }[];
  readonly transcript: readonly { readonly kind: string; readonly text: string }[];
}

export type AppendResult =
  | { readonly kind: 'committed'; readonly folded: Folded }
  | { readonly kind: 'duplicate'; readonly folded: Folded }
  | { readonly kind: 'conflict' };

export interface Store {
  create(save: Save): void;
  /**
   * One transaction. expectedHead is the event count before this turn.
   * A repeated TurnId returns duplicate with the original events. It does not roll again.
   */
  append(id: SaveId, expectedHead: number, turn: TurnId, events: readonly GameEvent[]): AppendResult;
  load(id: SaveId): Save | null;
  list(): readonly { readonly id: SaveId; readonly title: string; readonly updatedSeq: number }[];
  delete(id: SaveId): boolean;
}

export function foldSave(save: Save): Folded {
  void save;
  // TODO rebuild index from pin, fold campaign events for hero/phase/module,
  // fold world events onto begin(module, seed). Phase is derived, never stored.
  throw new Error('not implemented');
}

export function beginCampaign(id: SaveId, pin: ContentPin, seed: Seed): Save {
  void id;
  void pin;
  void seed;
  throw new Error('not implemented');
}

export function phaseOf(folded: Folded): PlayPhase {
  void folded;
  throw new Error('not implemented');
}

export function projectSave(folded: Folded): PlayerView {
  void folded;
  // TODO PlayerView only. No lore, no secret clocks, no unfound clues, no World.
  throw new Error('not implemented');
}

export async function applyCommand(
  store: Store,
  director: Director,
  command: Command,
): Promise<PlayerView> {
  void store;
  void director;
  void command;
  // TODO parse already happened. Load, fold, branch on phase.
  // createHero / chooseFate / advanceModule / turn each mint events, append with TurnId,
  // publish the cache only after commit. Duplicate TurnId returns the projected duplicate.
  throw new Error('not implemented');
}

export function weaveReplacement(dead: HeroRecord, next: HeroRecord, folded: Folded): readonly GameEvent[] {
  void dead;
  void next;
  void folded;
  // TODO heroReplaced + introduced at folded.world.here.
  // If hostiles remain, combatBegan is re-rolled. Found clues and filled clocks stay.
  // XP is xpForLevel(dead.level). The director narrates on the next playing turn only.
  throw new Error('not implemented');
}

export type { TurnResult };
