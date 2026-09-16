/**
 * The DM's contract. This is the entire vocabulary in which the model is
 * allowed to change the world, and it is small on purpose, because rules
 * density is the error surface of a 14B model. Fourteen ops, three move kinds,
 * five difficulty bands, six approaches.
 *
 * Note what the model gets total freedom over. `name`, `facts[]`, `obstacle`,
 * `because` and the prose are strings, and they are where every good thing
 * about this product lives. The model can invent anything it can name.
 *
 * These are the domain types. On the wire a target is a plain string, either an
 * entity id or one of the pre-allocated mint slots. `director.ts` owns that
 * translation and nothing outside `director.ts` ever sees the wire shape.
 * Per boundary-discipline.
 */

import type { EntityId, FactId, Ref } from './ids.ts';
import type { Aspect, Condition, Disposition, EntityKind, PlayMode, Veil } from './world.ts';
import type { Degree, Roll } from './dice.ts';

/** Branded at the wire to domain step. Inside the engine a target is never ambiguous. */
export type Target = { readonly known: EntityId } | { readonly fresh: Ref };

/**
 * PbtA-style, deliberately not a stat block. Six approaches means the model
 * picks from six tokens instead of reasoning about a character sheet it will
 * get wrong. The protagonist has a small bonus per approach; NPCs do not roll.
 */
export type Approach = 'force' | 'finesse' | 'wits' | 'charm' | 'grit' | 'notice';

/**
 * The model names a band. The engine owns the numbers. This is the single
 * mechanism that prevents "DC 2 because I like you". There is no place in the
 * contract to write a number.
 */
export type Band = 'routine' | 'tricky' | 'hard' | 'daunting' | 'forlorn';

/** Engine-owned. Not exported through index.ts; the client learns bands, not targets. */
export const BAND_TARGET: Readonly<Record<Band, number>> = {
  routine: 8,
  tricky: 11,
  hard: 15,
  daunting: 18,
  forlorn: 21,
};

/**
 * Bands at the extremes must be grounded in canon. You may not declare
 * something forlorn, or trivially routine, out of thin air. You must point at
 * an established, current, non-superseded fact about the actor or the obstacle
 * that makes it so. The engine cannot judge whether the justification is good,
 * but it can check that the citation exists and is current, which is enough to
 * stop difficulty being invented at whim in either direction.
 */
export const BAND_REQUIRES_CITATION: Readonly<Record<Band, boolean>> = {
  routine: true,
  tricky: false,
  hard: false,
  daunting: false,
  forlorn: true,
};

export type Effect =
  /**
   * Improvisation. The one verb that makes Marga real. The model supplies a
   * name and free-text traits; the engine mints the id. The model never gets to
   * author identity, because a weak model will happily reuse, misspell or
   * hallucinate an id, and every reference after that would be silently wrong.
   *
   * `ref` is one of the pre-allocated slots, not a name the model invents. That
   * keeps every target field a closed enum in the per-turn schema instead of an
   * enum-or-pattern union a grammar engine may not honour.
   */
  | {
      readonly op: 'introduce';
      readonly ref: Ref;
      readonly kind: EntityKind;
      readonly name: string;
      readonly facts: readonly { readonly aspect: Aspect; readonly text: string; readonly veil: Veil }[];
      readonly at: Target | null;
    }
  /** Assert new canon about someone. Append-only. */
  | { readonly op: 'reveal'; readonly subject: Target; readonly aspect: Aspect; readonly text: string; readonly veil: Veil }
  /** Retcon, explicitly. Requires naming the fact being retired and why. */
  | { readonly op: 'amend'; readonly retire: FactId; readonly text: string; readonly because: string }
  /** Lift a veil. The player now knows something the DM already knew. */
  | { readonly op: 'disclose'; readonly fact: FactId }
  | { readonly op: 'harm'; readonly subject: Target; readonly amount: number; readonly from: string }
  | { readonly op: 'mend'; readonly subject: Target; readonly amount: number }
  | {
      readonly op: 'afflict';
      readonly subject: Target;
      readonly add: readonly Condition[];
      readonly clear: readonly Condition[];
    }
  | { readonly op: 'pay'; readonly from: Target; readonly to: Target; readonly amount: number }
  | { readonly op: 'hand'; readonly item: Target; readonly to: Target }
  | { readonly op: 'go'; readonly who: Target; readonly to: Target }
  | { readonly op: 'regard'; readonly subject: Target; readonly toward: Disposition }
  /** Advance an improvised clock. The DM creates pressure; only the engine turns it. */
  | { readonly op: 'mark'; readonly clock: Target; readonly segments: number }
  | { readonly op: 'engage'; readonly foes: readonly Target[] }
  | { readonly op: 'disengage' };

export type EffectOp = Effect['op'];

/**
 * Which ops each mode offers. Keyed by `PlayMode` and by nothing else, so the
 * mode discriminant is what selects the `op` enum handed to the decoder.
 *
 * Two consumers, one decision. The brief states the affordances in prose and
 * `director.proposalSchema` turns the same array into the `op` enum, so an op
 * that is illegal in this mode is not refused, it is undecodable.
 *
 * `engage` and `disengage` are the mode transitions, and each is legal only in
 * the mode it leaves. That is the whole state machine.
 *
 * Honest limit. Mode gating cuts the combat list from fourteen to ten and the
 * exploration list to thirteen. The enum probe measured a four-member `op` enum
 * correct 8/8 at every room size and never measured a thirteen-member one, so
 * the exploration list is the largest enum this design ships without evidence.
 * See the open question in `docs/design/dm-contract.md`.
 */
export const AFFORDANCES: Readonly<Record<PlayMode, readonly EffectOp[]>> = {
  exploration: [
    'introduce',
    'reveal',
    'amend',
    'disclose',
    'harm',
    'mend',
    'afflict',
    'pay',
    'hand',
    'go',
    'regard',
    'mark',
    'engage',
  ],
  combat: ['introduce', 'reveal', 'disclose', 'harm', 'mend', 'afflict', 'hand', 'regard', 'mark', 'disengage'],
};

export function affordances(mode: PlayMode): readonly EffectOp[] {
  return AFFORDANCES[mode];
}

/**
 * Stakes before the die. The DM declares what success and failure each cost
 * before the engine rolls, because it is the oldest good habit at a real table
 * and because it makes fudging structurally impossible. By the time the outcome
 * exists, the model has no authority left to spend.
 */
export interface CheckRequest {
  readonly actor: Target;
  readonly approach: Approach;
  /** Free text. The fiction. "the corroded harbour-office lock". */
  readonly obstacle: string;
  readonly band: Band;
  readonly because: string;
  /** Required for `routine` and `forlorn`. Must name a current fact. */
  readonly justifiedBy: FactId | null;
  readonly onSuccess: readonly Effect[];
  readonly onFailure: readonly Effect[];
}

export type Move =
  /** Something just happens. No uncertainty, no roll. Most turns are this. */
  | { readonly kind: 'narrate'; readonly effects: readonly Effect[] }
  /** Uncertainty with a cost either way. The only path to the dice. */
  | { readonly kind: 'check'; readonly check: CheckRequest }
  /** The DM needs the player to be more specific. Explicitly state-neutral. */
  | { readonly kind: 'ask'; readonly question: string };

export interface Proposal {
  /** What the DM understood the player to be attempting. Audit and misread detection. */
  readonly reading: string;
  readonly move: Move;
}

/**
 * The second half of the turn. The narrator is told what actually happened and
 * writes prose about it. It has no authority. `recount` cannot emit effects,
 * cannot roll, cannot mint. That is why retrying it is free and why a bad
 * narration is a quality bug, never a correctness bug.
 */
export interface Told {
  readonly reading: string;
  readonly applied: readonly Effect[];
  readonly check: { readonly request: CheckRequest; readonly roll: Roll; readonly degree: Degree } | null;
  /**
   * Plain-language notes about what the engine rewrote or dropped, written for
   * the narrator so the prose matches the ledger. "They tried to spend 50 coin
   * and hold 12. The purchase did not happen. Narrate the shortfall."
   */
  readonly corrections: readonly string[];
  readonly minted: readonly { readonly ref: Ref; readonly id: EntityId; readonly name: string }[];
}

/**
 * A breach of this contract by the transport, not a move by the DM.
 *
 * Every arm below names a condition the per-turn JSON Schema already made
 * undecodable. Against a runtime that honours `format`, none of them can
 * happen. The checks are kept anyway, because a rules engine that assumes its
 * transport is honest becomes unsound the day someone points it at a different
 * server or swaps the model for one whose runtime ignores grammar constraints.
 *
 * Reaching one of these means the infrastructure is broken. It is not a
 * gameplay event and it never becomes fiction. The player sees the turn stall
 * in voice. The operator sees `DirectorContractBreach`.
 *
 * Every field is a raw string on purpose. A breach is exactly the case where
 * the wire carried a value that is not a domain value, so typing these as
 * `EntityId` or `EffectOp` would assert the thing that just failed.
 */
export type ContractBreachReason =
  /** The decoded object did not match the schema at all. The runtime ignored `format`. */
  | { readonly kind: 'shape'; readonly detail: string }
  /** A closed set was violated. `field` is the schema path, `value` is what arrived. */
  | { readonly kind: 'out-of-enum'; readonly field: string; readonly value: string }
  /** A target that was in no enum offered this turn, neither in reach nor a mint slot. */
  | { readonly kind: 'unknown-target'; readonly raw: string }
  /** An op outside this mode's affordances. */
  | { readonly kind: 'illegal-in-mode'; readonly op: string; readonly mode: PlayMode }
  /** A `retire` naming a fact that was absent or already superseded when the brief was built. */
  | { readonly kind: 'stale-amend'; readonly retire: string }
  /** An actor other than the one whose initiative turn it is. */
  | { readonly kind: 'wrong-turn'; readonly subject: string };

/**
 * Loud, operational, never diegetic. Carried to `EngineDeps.onBreach` and
 * logged at error level. Not retried, because retrying a misconfigured server
 * is only a way to be wrong more slowly.
 */
export class DirectorContractBreach extends Error {
  readonly reason: ContractBreachReason;

  constructor(reason: ContractBreachReason) {
    super(`director contract breach: ${reason.kind}`);
    this.name = 'DirectorContractBreach';
    this.reason = reason;
  }
}
