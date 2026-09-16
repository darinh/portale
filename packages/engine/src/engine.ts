/**
 * The public surface. Three methods. Canon, dice, calibration, rulings, context
 * budgeting, snapshots, idempotency, initiative and streaming are all behind
 * them.
 *
 * A caller who learns these three signatures needs to know nothing about the
 * implementation to build the entire product. There is no options bag exposing
 * an internal stage, no method that must be called before another, and no order
 * to get right. The one thing the caller must supply is a TurnId, and that is
 * not a leak. It is the caller's half of an idempotency contract only the
 * caller can uphold.
 *
 * `takeTurn` is not a pass-through. It owns the turn as a unit of atomicity:
 * idempotency, the single commit, the fallback when the model is unreachable or
 * dishonest, and the guarantee that the stream always ends in `settled`.
 */

import type { Coin, EventSeq, Meter, SessionId, Seed, TurnId } from './ids.ts';
import type { Condition, Disposition, World } from './world.ts';
import type { Approach, Band, DirectorContractBreach } from './proposal.ts';
import type { Degree, Roll } from './dice.ts';
import type { Exchange } from './events.ts';
import type { Terminal } from './adjudicator.ts';
import type { Director } from './director.ts';
import type { EventStore } from './store.ts';
import type { TokenBudget } from './brief.ts';

/**
 * Not `World`. A projection, because the World contains veiled facts, NPC
 * dispositions, hidden clocks and the calibration table, all of which are the
 * DM's business and none of which are the player's. Shipping `World` to the
 * browser would leak the secrets the game is made of.
 * Shared with the client as a type, per FIXED constraint 5.
 */
export interface PlayerView {
  readonly session: SessionId;
  readonly at: EventSeq;
  readonly you: {
    readonly name: string;
    readonly vitals: Meter;
    readonly coin: Coin;
    readonly conditions: readonly Condition[];
    readonly carrying: readonly { readonly id: string; readonly name: string }[];
    readonly approaches: readonly { readonly approach: Approach; readonly bonus: number }[];
  };
  readonly here: {
    readonly place: string;
    readonly present: readonly {
      readonly id: string;
      readonly name: string;
      readonly disposition: Disposition | null;
      readonly known: readonly string[];
      /**
       * Whether the engine offered this entity to the DM as a target this turn.
       * The client uses it to decide what the player can tap. Scenery is named
       * in the fiction and is not actionable, which is the same cap `inReach`
       * puts on the DM.
       */
      readonly inReach: boolean;
    }[];
  };
  readonly scene: { readonly mode: 'exploration' } | { readonly mode: 'combat'; readonly round: number; readonly yourTurn: boolean };
  /** Only clocks the player has been shown. Pressure the DM is hiding stays hidden. */
  readonly clocks: readonly { readonly name: string; readonly filled: number; readonly size: number }[];
  readonly log: readonly Exchange[];
  readonly more: boolean;
}

/**
 * How the turn came out, in the vocabulary the UI renders. `soft-fail` is the
 * one the client has to do something about, because it is the cue to invite a
 * rephrase. Everything else it can render as ordinary play.
 */
export type TurnOutcome = Terminal['kind'];

/**
 * Note the absence of an `error` variant. Not an oversight and not optimism.
 * `adjudicate` is total and the engine has a state-neutral fallback, so there
 * is no reachable state in which a turn fails to settle. Giving the type a
 * failure case would force every caller to write a branch that can never
 * execute.
 *
 * `strained` is the honest middle. An advisory that the DM is struggling, which
 * does not terminate the stream. Both reasons are infrastructure faults, not
 * model faults. The server is down, or the server ignored `format` and the
 * engine raised a `DirectorContractBreach`. There is no repairing reason and no
 * attempt counter, because there is no retry ladder to report on.
 *
 * The order is the order of a real table. The DM calls for a roll, then the die
 * lands, then you hear what it meant. `check` is emitted before `rolled`
 * because by then the stakes are already committed and immutable.
 */
export type TurnEvent =
  | { readonly kind: 'deliberating' }
  | { readonly kind: 'strained'; readonly why: 'unreachable' | 'contract-breach' }
  | { readonly kind: 'asked'; readonly question: string }
  | {
      readonly kind: 'check';
      readonly approach: Approach;
      readonly obstacle: string;
      readonly band: Band;
      readonly stakes: { readonly onSuccess: string; readonly onFailure: string };
    }
  | { readonly kind: 'rolled'; readonly roll: Roll; readonly degree: Degree }
  | { readonly kind: 'prose'; readonly delta: string }
  | { readonly kind: 'settled'; readonly view: PlayerView; readonly outcome: TurnOutcome };

export interface TurnRequest {
  readonly session: SessionId;
  /** Client-minted. Resending the same one replays instead of re-rolling. */
  readonly turn: TurnId;
  readonly utterance: string;
  readonly signal?: AbortSignal;
}

export interface BeginRequest {
  readonly scenario: string;
  readonly seed: Seed;
  readonly protagonistName: string;
}

export interface Engine {
  begin(req: BeginRequest): Promise<PlayerView>;
  takeTurn(req: TurnRequest): AsyncIterable<TurnEvent>;
  view(session: SessionId, page?: { readonly logBefore?: EventSeq }): Promise<PlayerView>;

  /** Test-only. Not exported from index.ts. */
  debugWorld(session: SessionId): Promise<World>;
  debugReproject(session: SessionId): Promise<World>;
}

export interface EngineDeps {
  readonly store: EventStore;
  readonly director: Director;
  readonly budget?: TokenBudget;
  readonly now?: () => number;
  /**
   * Where a contract breach goes. The player never sees one, so the operator
   * has to, or a swapped model silently degrades into stalled turns that look
   * like bad luck. Defaults to an error-level log. Page on it.
   */
  readonly onBreach?: (breach: DirectorContractBreach) => void;
}

export function createEngine(_deps: EngineDeps): Engine {
  throw new Error('not implemented');
}

// TODO - takeTurn, written out because this is the one place sequencing is a
// real responsibility rather than an accident of module layout.
//
// async *takeTurn({ session, turn, utterance, signal }):
//
//   // 1. IDEMPOTENCY. Before any work, before any dice.
//   prior = await store.findTurn(session, turn)
//   if prior: yield replayOf(prior); yield settled(await view(session), prior.terminal.kind); return
//
//   // 2. FOLD. Snapshot plus tail. The snapshot is a cache; if it is missing or
//   //    its blob fails to decode, fold from zero and carry on.
//   world = await load(session)
//   recent = await lastExchanges(session, budget.recent)
//   brief = assemble(world, recent, utterance, budget)     // pure, and capped
//
//   yield { kind: 'deliberating' }
//
//   // 3. PROPOSE. Shape is the runtime's problem. localDirector hands the
//   //    per-turn schema to `format`, so this either returns a well-shaped
//   //    Proposal or the infrastructure is broken. No repair round, no retry,
//   //    no attempt counter.
//   try { proposal = await director.propose(brief, signal) }
//   catch (e) {
//     if (e instanceof DirectorContractBreach) { onBreach(e); why = 'contract-breach' }
//     else { why = 'unreachable' }
//     yield { kind: 'strained', why }
//     adj = stall(world, turn, why)                        // state-neutral
//   }
//
//   // 4. ADJUDICATE. Pure, total, offline. The only place a proposal can be
//   //    rejected, and the only layer the runtime cannot close for us. Dice
//   //    land here, keyed off world.seq, the COMMITTED height.
//   adj = adjudicate(world, brief, turn, proposal)
//
//   // 4b. A breach found by the adjudicator means the transport lied about a
//   //     set the engine itself generated. Same handling as a parse breach:
//   //     raise to the operator, stall in voice, commit nothing but the turn
//   //     record. Never narrated, never counted as a refusal.
//   if (adj.breaches.length) {
//     for (b of adj.breaches) onBreach(new DirectorContractBreach(b))
//     yield { kind: 'strained', why: 'contract-breach' }
//   }
//
//   if (adj.check) {
//     yield { kind: 'check', ... }      // stakes are already immutable
//     yield { kind: 'rolled', roll: adj.check.roll, degree: adj.check.degree }
//   }
//   if (adj.terminal.kind === 'asked') yield { kind: 'asked', question: adj.terminal.question }
//
//   // 5. NARRATE. No authority. Streamed. If it throws or stalls, fall back to
//   //    an engine-authored line and the turn still settles. On a soft-fail the
//   //    narrator is told the beat did not land, so the prose says so and the
//   //    client's rephrase prompt is not the only signal the player gets.
//   told = { reading, applied: appliedEffects(adj.rulings), check: adj.check,
//            corrections: renderCorrections(world, adj.rulings), minted }
//   prose = ''
//   for await (delta of director.recount(brief, told, signal)) {
//     prose += delta; yield { kind: 'prose', delta }
//   }
//
//   // 6. COMMIT. ONE transaction, at the END, after the prose exists. A crash
//   //    before this point means nothing happened, and because the RNG key is a
//   //    function of the committed height, the retry draws the SAME die. You
//   //    cannot pull the plug to reroll.
//   res = await store.append(session, world.seq,
//           [...adj.events, { t: 'turn-recorded', turn, utterance, proposal,
//                             rulings: adj.rulings, terminal: adj.terminal,
//                             bindings: [...adj.bindings].map(([ref, id]) => ({ ref, id })),
//                             prose, at: now() }])
//
//   if (!res.ok) {                      // another tab won the race
//     yield { kind: 'settled', view: await view(session), outcome: 'resolved' }
//     return
//   }
//
//   // 7. AFTER. Off the critical path, failure harmless.
//   void maybeSnapshot(session, res.head)
//   void maybeRecap(session)
//
//   yield { kind: 'settled', view: await view(session), outcome: adj.terminal.kind }
//
// Every yield above is reachable, and there is no path out of this generator
// that does not end in `settled` or a caller-triggered abort.
