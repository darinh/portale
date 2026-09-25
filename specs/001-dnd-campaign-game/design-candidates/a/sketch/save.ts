/**
 * The save: one playthrough of a campaign, and the only thing that outlives a process.
 *
 * Three rules hold it together.
 *
 *   1. The log is the only authority. `apply` stays total and trusting; nothing here
 *      validates, rolls or decides.
 *   2. Content is pinned by digest. A save resolves the exact pack bytes it started with,
 *      so editing a campaign cannot change a game in progress (FR-018). This is also what
 *      makes it safe for the log to record a `MoveId`: the menu that minted it is
 *      reproducible.
 *   3. The hero is a slot on the save, not the owner of progress. Found clues, satisfied
 *      goal terms, clock state, flags and loot belong to the save, so a replacement hero
 *      inherits the campaign's progress by not being where it lives (spec US9 AS2).
 */

import type {
  CampaignId,
  Digest,
  Direction,
  Goal,
  ItemId,
  Library,
  ModuleId,
  NodeId,
  Pack,
} from './contract.ts';
import type { Hero, HeroId } from './hero.ts';
import type { Seed } from './dice.ts';
import type { Band, Director, Move, MoveId, TurnEvent } from './turn.ts';

export type SaveId = string & { readonly __brand: 'SaveId' };
/** Client-minted, so a retry after a dropped response is the same turn, not a second one. */
export type TurnId = string & { readonly __brand: 'TurnId' };

/* ------------------------------------------------------------------ save events */

/**
 * The campaign-scale events, alongside the turn-scale ones from turn.ts. Everything the
 * player does that is not a move in a scene is one of these.
 */
export type SaveEvent =
  | TurnEvent
  | { readonly kind: 'campaignBegun'; readonly campaign: CampaignId; readonly pins: readonly Digest[] }
  | { readonly kind: 'heroJoined'; readonly hero: Hero; readonly why: 'first' | 'succession' }
  | { readonly kind: 'moduleEntered'; readonly module: ModuleId; readonly index: number }
  | { readonly kind: 'moduleWon'; readonly module: ModuleId }
  | { readonly kind: 'campaignWon' }
  | { readonly kind: 'campaignLost' }
  | { readonly kind: 'heroDied'; readonly hero: HeroId; readonly at: NodeId }
  | { readonly kind: 'succession'; readonly from: HeroId; readonly to: HeroId; readonly hook: string };

/**
 * Folded state. Derived entirely from the log plus the pinned library; never stored, and
 * safe to throw away and rebuild, which is the property the restart test actually checks.
 */
export interface SaveState {
  readonly id: SaveId;
  readonly seed: Seed;
  readonly lib: Library;
  readonly campaign: CampaignId;
  /** Append-only roster. The active hero is the last one, so succession is a push. */
  readonly heroes: readonly Hero[];
  readonly moduleIndex: number;
  readonly here: NodeId;
  readonly visited: ReadonlySet<NodeId>;
  readonly foundClues: ReadonlySet<string>;
  readonly flags: ReadonlyMap<string, boolean>;
  readonly clocks: ReadonlyMap<string, { readonly filled: number; readonly done: boolean }>;
  readonly slain: ReadonlySet<string>;
  readonly loot: ReadonlyMap<NodeId, readonly { readonly item: ItemId; readonly count: number }[]>;
  readonly seq: number;
  readonly log: readonly SaveEvent[];
}

/** Total and trusting. Never validates, never rolls, never decides (constitution III). */
export function apply(s: SaveState, e: SaveEvent): SaveState {
  throw new Error('not implemented');
}

export function fold(base: SaveState, events: readonly SaveEvent[]): SaveState {
  throw new Error('not implemented');
}

/* --------------------------------------------------------------------- outcome */

export type Outcome = 'playing' | 'mourning' | 'moduleWon' | 'won' | 'lost';

/**
 * Derived every time, so it cannot disagree with the log. `mourning` is the state between
 * a hero's death and the player's choice of End or Continue; it accepts exactly two
 * commands and no turns.
 */
export function outcomeOf(s: SaveState): Outcome {
  throw new Error('not implemented');
}

/**
 * The module's goal predicate, evaluated against folded state. This is the whole of
 * "a module MUST have an engine-checkable goal" (FR-011), and the whole of the progress
 * bar: `satisfiedTerms / totalTerms` over the same tree. There is no `progressed` event,
 * no `milestone` field for the DM, and no way to narrate the player to the ending.
 */
export function satisfied(goal: Goal, s: SaveState): boolean {
  throw new Error('not implemented');
}

export function progressOf(goal: Goal, s: SaveState): { readonly done: number; readonly total: number } {
  throw new Error('not implemented');
}

/* ------------------------------------------------------------------ persistence */

/**
 * Two append-only tables and one write-once one. Nothing derived is ever stored, so there
 * is nothing to migrate when the rules change and nothing that can go stale.
 */
export interface Store {
  /** Write-once, content addressed. A second write of the same digest is a no-op. */
  putPack(digest: Digest, body: string): void;
  getPack(digest: Digest): string | null;

  createSave(id: SaveId, campaign: CampaignId, seed: Seed, pins: readonly Digest[]): void;
  /**
   * One transaction: the turn's events and the turn marker together. A crash halfway
   * leaves neither, so a retry with the same TurnId replays rather than duplicating
   * (review-claims #1 and #2). Returns false when the TurnId was already recorded.
   */
  appendTurn(id: SaveId, turn: TurnId, events: readonly SaveEvent[]): boolean;
  loadSave(id: SaveId): StoredSave | null;
  listSaves(): readonly SaveSummary[];
  deleteSave(id: SaveId): boolean;
  close(): void;
}

export interface StoredSave {
  readonly id: SaveId;
  readonly campaign: CampaignId;
  readonly seed: Seed;
  readonly pins: readonly Digest[];
  readonly events: readonly SaveEvent[];
  readonly turns: ReadonlySet<TurnId>;
}

/** What the title screen lists. Outcome is derived by rebuilding, never stored (FR-020). */
export interface SaveSummary {
  readonly id: SaveId;
  readonly campaign: string;
  readonly module: string;
  readonly hero: { readonly name: string; readonly klass: string; readonly level: number };
  readonly outcome: Outcome;
  readonly turns: number;
  readonly playedAt: string;
}

/* ------------------------------------------------------------------- the public API */

/**
 * The game's whole public surface. Eight functions hiding SRD 5.2 interpretation, menu
 * derivation, initiative, conditions, concentration, rests, clocks, goals, module
 * transitions, succession, pinning and replay.
 */

export interface StartOptions {
  readonly campaign: CampaignId;
  readonly hero: Hero;
  readonly seed: Seed;
  readonly packs: readonly Pack[];
}

export function loadPacks(ids: readonly string[]): Promise<readonly Pack[]> {
  throw new Error('not implemented');
}

/**
 * Writes each pack body into the content-addressed store, pins the save to their digests,
 * and emits the opening events. After this the save is independent of the files on disk.
 */
export function startCampaign(store: Store, opts: StartOptions): Promise<PlayerView> {
  throw new Error('not implemented');
}

export type TurnInput =
  | { readonly turnId: TurnId; readonly kind: 'say'; readonly text: string }
  | { readonly turnId: TurnId; readonly kind: 'do'; readonly move: MoveId };

export interface TurnResult {
  readonly view: PlayerView;
  readonly breach: string | null;
  /** True when this TurnId had already been recorded. The view is the recorded one. */
  readonly replayed: boolean;
}

/**
 * The turn as a unit of atomicity. Owns three things and nothing else: idempotence, the
 * transaction, and settling the turn whatever the model did.
 *
 * Idempotence by three different routes, because a crash can land in three places:
 *   - turn submission: the TurnId marker, written in the same transaction as the events
 *   - module transition: not a command; the index is `count(moduleEntered)`, so advancing
 *     twice is arithmetic rather than a guard
 *   - replacement hero: the roster is append-only and a succession names the death event
 *     it answers, so the same death cannot mint two heroes
 */
export function takeTurn(store: Store, id: SaveId, input: TurnInput, director: Director): Promise<TurnResult> {
  // TODO
  //  - rebuild (cache is only a cache; drop it on any append failure)
  //  - if input.turnId is in stored.turns: return the recorded view, replayed: true
  //  - outcomeOf must be 'playing'
  //  - menu = legalMoves(sceneOf(state))
  //  - 'do': look the move up in the menu. A stale id is 409 WITH the fresh menu attached,
  //    because the honest cause is that the world moved under the player's thumb.
  //  - 'say': ask the director under buildVoteSchema(menu, null). A transport failure
  //    settles the turn with a diegetic stall and a recorded breach; the model is never
  //    asked to try again (constitution II).
  //  - resolveRound, appendTurn, project
  throw new Error('not implemented');
}

export function viewOf(store: Store, id: SaveId): PlayerView {
  throw new Error('not implemented');
}

/* --------------------------------------------------- module and campaign lifecycle */

/**
 * Called by `takeTurn` when the active module's goal became satisfied, and by the client
 * when the player taps Continue on the victory screen. Idempotent because the target index
 * is derived: if the log already holds `moduleEntered` at that index, this emits nothing.
 *
 * Between modules the hero takes a long rest (FR-012), emitted as ordinary rest events so
 * the transcript reads the same as any other rest.
 */
export function advanceModule(store: Store, id: SaveId): PlayerView {
  throw new Error('not implemented');
}

/** End or Continue, the only two commands a `mourning` save accepts (FR-013). */
export type DeathAnswer =
  | { readonly choice: 'end' }
  | { readonly choice: 'continue'; readonly hero: Hero };

/**
 * Continue pushes the new hero onto the roster and picks a `SuccessorDef` from the module,
 * seeded, so a replay places the same heir for the same reason. The dead hero's gear is
 * left at the node where they fell, as loot, which is a story the world already knows how
 * to tell and introduces no inheritance mechanism.
 *
 * The killer is promoted: its front's portent clock advances one segment.
 */
export function answerDeath(store: Store, id: SaveId, answer: DeathAnswer, director: Director): Promise<PlayerView> {
  throw new Error('not implemented');
}

/* ------------------------------------------------------------------ the projection */

/**
 * The only game state that crosses HTTP. A field that never enters this cannot leak, so
 * DM-only node descriptions, NPC wants, secret clocks, unfound clues and monster tactics
 * have no representation here at all.
 */
export interface PlayerView {
  readonly seq: number;
  readonly outcome: Outcome;
  readonly campaign: string;
  readonly module: { readonly name: string; readonly index: number; readonly of: number };
  readonly scene: string;
  readonly you: ViewHero;
  readonly present: readonly ViewCreature[];
  /** The action bar, verbatim. The same list the DM's enum was built from. */
  readonly moves: readonly ViewMove[];
  readonly exits: readonly Direction[];
  readonly map: readonly ViewRoom[];
  /** Open clocks only. A secret clock is tracked and never shipped. */
  readonly clocks: readonly ViewClock[];
  readonly quest: readonly ViewQuestTerm[];
  readonly leads: readonly ViewLead[];
  readonly transcript: readonly ViewLine[];
  readonly rolls: readonly ViewRoll[];
}

/** The sheet, flattened for a 390px screen. Derived, never stored. */
export interface ViewHero {
  readonly name: string;
  readonly klass: string;
  readonly species: string;
  readonly level: number;
  readonly xp: { readonly now: number; readonly next: number };
  readonly hp: { readonly now: number; readonly max: number; readonly temp: number };
  readonly ac: number;
  readonly abilities: readonly { readonly ability: string; readonly score: number; readonly mod: number }[];
  readonly saves: readonly { readonly ability: string; readonly mod: number }[];
  readonly skills: readonly { readonly name: string; readonly mod: number; readonly expert: boolean }[];
  readonly slots: readonly { readonly level: number; readonly left: number; readonly max: number }[];
  readonly resources: readonly { readonly name: string; readonly left: number; readonly max: number }[];
  readonly hitDice: { readonly left: number; readonly total: number; readonly die: number };
  readonly conditions: readonly string[];
  readonly inventory: readonly { readonly name: string; readonly count: number; readonly equipped: boolean }[];
  readonly deathSaves: { readonly successes: number; readonly failures: number } | null;
}

export interface ViewCreature {
  readonly id: string;
  readonly name: string;
  /** Bloodied / hurt / unharmed, not a number: the player does not read a monster's sheet. */
  readonly condition: 'unharmed' | 'hurt' | 'bloodied' | 'down';
  readonly hostile: boolean;
  readonly conditions: readonly string[];
}

export interface ViewMove {
  readonly id: MoveId;
  readonly label: string;
  readonly detail: string;
  readonly group: Move['group'];
}

export interface ViewRoom {
  readonly id: NodeId;
  readonly name: string;
  readonly here: boolean;
  /** `to` is present only when the far side has been visited. An unexplored exit is a stub. */
  readonly exits: readonly { readonly dir: Direction; readonly to: NodeId | null }[];
}

export interface ViewClock {
  readonly name: string;
  readonly kind: 'danger' | 'progress';
  readonly filled: number;
  readonly segments: number;
}

/** The quest tracker, derived from the goal tree. One line per term the player can know of. */
export interface ViewQuestTerm {
  readonly what: string;
  readonly done: boolean;
}

export interface ViewLead {
  readonly what: string;
}

export interface ViewLine {
  readonly kind: 'dm' | 'you' | 'roll' | 'mech' | 'ruled';
  readonly text: string;
}

export interface ViewRoll {
  readonly die: number;
  readonly face: number;
  readonly mod: number;
  readonly total: number;
  readonly dc: number;
  readonly success: boolean;
  readonly note: string;
}

export function project(s: SaveState): PlayerView {
  // TODO transcript is walked from the log with running counters, the way the current
  // `project` already does, so a clock value in an old line is the value it had then.
  throw new Error('not implemented');
}

/** Raised when a `do` names a move the current menu no longer holds. Carries the new menu. */
export class StaleMenu extends Error {
  readonly menu: readonly ViewMove[];

  constructor(menu: readonly ViewMove[]) {
    super('that action is no longer available');
    this.name = 'StaleMenu';
    this.menu = menu;
  }
}

/** A turn asked of a save that has ended or is waiting on a death answer. */
export class NotPlaying extends Error {
  readonly outcome: Outcome;

  constructor(outcome: Outcome) {
    super(`this save is not taking turns: ${outcome}`);
    this.name = 'NotPlaying';
    this.outcome = outcome;
  }
}

/** Unused by the engine; named here so the HTTP layer has a domain type to map. */
export type BandChoice = Band;
