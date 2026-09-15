/**
 * What the DM is allowed to know right now, what it is allowed to name, and how
 * both stay bounded forever.
 *
 * The prompt is a query over state, not a window over history. That single
 * sentence is the answer to resumption. There is no resume code path. Turn 1
 * and turn 400 after a three-day gap build their brief the same way, from the
 * same fold, in the same amount of context. A locally hosted model is stateless
 * per request anyway, so rebuilding is not an overhead we are paying. It is
 * simply what happens, made honest.
 *
 * `assemble` is pure. Its scoping policy is real domain knowledge with real
 * consequences, and it is tested without a GPU like everything else.
 */

import type { EntityId, FactId } from './ids.ts';
import type { Entity, PlayMode, Scene, Veil, World } from './world.ts';
import type { Approach, Band, EffectOp } from './proposal.ts';
import type { Exchange } from './events.ts';

/** One entity as the DM sees it. Includes veiled facts, because the DM knows the secrets. */
export interface Dossier {
  readonly id: EntityId;
  readonly name: string;
  readonly kind: Entity['ledger']['kind'];
  /** Rendered from the Ledger. Numbers the DM must not contradict. */
  readonly ledgerLine: string;
  /** Current facts only, superseded ones excluded, newest first. */
  readonly lore: readonly { readonly id: string; readonly aspect: string; readonly text: string; readonly veil: Veil }[];
}

export interface TokenBudget {
  readonly total: number;
  readonly recent: number;
  readonly cast: number;
}

/**
 * The hard cap on how many entities the model may be offered as targets in one
 * turn. A correctness invariant, not a context budget.
 *
 * The enum probe held the scene fixed and unambiguous, with exactly one
 * defensible target, and varied only the size of the target enum.
 *
 *     3 entities    in-enum 8/8    correct 8/8
 *    10 entities    in-enum 8/8    correct 4/8
 *    25 entities    in-enum 8/8    correct 3/8
 *
 * Validity never broke. It was 24/24 across every condition. Correctness fell
 * to 37%, and the most common wrong pick was an unarmed old woman knitting by
 * the fire rather than the smuggler who had drawn a knife. A generous `inReach`
 * is actively harmful, and it is harmful in a way no validity metric will ever
 * report.
 *
 * Six is the default because 3 was measured perfect and 10 was already a coin
 * flip, so the cap has to sit nearer 3 than 10, and 6 is the largest value that
 * still holds a whole tactical scene: the protagonist, three foes, and two
 * things worth reaching for. Linear interpolation between the two measured
 * points puts 6 around 75% on the weakest model we tested, and the production
 * target is stronger.
 *
 * The number is only half the mitigation. The mechanism is distractor removal,
 * so the priority order in `scopeCast` carries as much weight as the cap. The
 * knitting old woman has to be the entity that falls off the list, and the
 * smuggler the player just named has to be the one that never does.
 *
 * Re-measure with `tools/model-probe/probe-enum.mjs` on the production host
 * before trusting this specific number.
 */
export const MAX_IN_REACH = 6;

/**
 * The same cap applied to citable and amendable facts, which is the other live
 * enum in the per-turn schema.
 *
 * Extrapolated, not measured. The probe varied target-enum length and nothing
 * else. Twelve is chosen to keep this enum in the same order of magnitude as
 * the target enum rather than from evidence, and a wrong citation is a milder
 * failure than a wrong stabbing. Treat it as a guess with a bound on it.
 */
export const MAX_CITABLE_FACTS = 12;

/**
 * Everything and only what the model sees, and every closed set it is allowed
 * to choose from. One object in, prompt and JSON Schema out.
 *
 * Holding both here is deliberate. The scope computation that decides "Marga is
 * relevant" and the enum that decides "Marga is nameable" are the same
 * decision. Splitting them across two modules would mean two places to change
 * when the scoping rule moves, and a class of bug where the prompt mentions
 * someone the schema forbids naming. Per laziness-protocol: consolidate the
 * decision, pass the result.
 *
 * It remains a domain type. No messages, no roles, no strings with braces.
 * `director.ts` turns it into whatever the local endpoint wants.
 *
 * The brief is also the record of what the model was permitted to say, which is
 * what lets the adjudicator tell a rules event apart from a transport breach.
 * A value outside these sets was never offered, so it could not have been
 * chosen by a conforming runtime.
 */
export interface SceneBrief {
  readonly protagonist: Dossier;
  readonly place: Dossier;
  /** Context. Everything the DM may mention. Larger than `inReach`, and bounded by the token budget. */
  readonly cast: readonly Dossier[];
  readonly scene: Scene;
  readonly mode: PlayMode;
  /** Engine-maintained running summary. Bounded. Never the raw transcript. */
  readonly recap: string;
  /** Last N exchanges verbatim, for voice and immediate continuity. */
  readonly recent: readonly Exchange[];
  readonly utterance: string;
  /** Last turn's rulings in plain language. The model's only feedback channel. */
  readonly correction: string | null;
  readonly approaches: readonly { readonly approach: Approach; readonly bonus: number }[];
  readonly bandsNeedingCitation: readonly Band[];

  /** Ops this mode offers. `affordances(mode)`, verbatim. */
  readonly affordances: readonly EffectOp[];
  /**
   * Targetable right now, and never longer than `MAX_IN_REACH`.
   *
   * Not the same set as `cast`. An absent Marga can be in scope for context
   * because the player asked about her, while being out of reach for a knife.
   * Conflating them is how "kill an NPC two towns away" gets in. Capping it is
   * how "stab the old woman instead of the smuggler" gets out.
   *
   * Everything in `cast` and not in `inReach` is scenery. The prompt may name
   * it. The schema will not let the model act on it.
   */
  readonly inReach: readonly EntityId[];
  /** Current, non-superseded facts on entities in scope. Never longer than `MAX_CITABLE_FACTS`. */
  readonly citableFacts: readonly FactId[];
  /** In combat, the single id whose initiative turn it is. Else null. */
  readonly actingNow: EntityId | null;
}

/** Pure. Deterministic. Bounded by construction, not by trimming after the fact. */
export function assemble(
  _w: World,
  _recent: readonly Exchange[],
  _utterance: string,
  _budget: TokenBudget,
): SceneBrief {
  throw new Error('not implemented');
}

/**
 * The two scoped sets, computed together because they are one decision.
 *
 * TODO: `cast` priority, highest first. Everything above the token budget line
 * ships and the rest is dropped.
 *
 *   1. protagonist and place              never dropped
 *   2. scene.present                      never dropped; if this alone blows the
 *                                         budget, drop their lore before them,
 *                                         because a nameless present NPC is
 *                                         worse than a thin one
 *   3. entities named in the utterance     case-insensitive name match, which is
 *                                         how "I ask Marga about the debt"
 *                                         pulls an absent Marga into context
 *   4. recap.spotlight, most recent first
 *   5. any clock with segments > 0        pressure must never silently vanish
 *
 * TODO: `inReach` priority, highest first, truncated hard at MAX_IN_REACH. This
 * ordering is the mitigation. The cap only helps if the entity that falls off
 * the end is the one the player could not have meant.
 *
 *   1. the protagonist                    always, so self-directed ops exist
 *   2. entities named in the utterance     the player just pointed at them
 *   3. in combat, `scene.order`            foes and allies in initiative order
 *   4. entities that acted in the last exchange
 *   5. items held by anyone already in the list
 *   6. remaining `scene.present`, most recently referenced first
 *
 * TODO: assert `inReach.length <= MAX_IN_REACH` and
 * `citableFacts.length <= MAX_CITABLE_FACTS` at the end of `assemble`. These are
 * the invariants the whole enum finding rests on, and a silent overflow would
 * be invisible in every validity metric the system has.
 */
export function scopeCast(
  _w: World,
  _utterance: string,
  _budget: TokenBudget,
): { readonly cast: readonly EntityId[]; readonly inReach: readonly EntityId[] } {
  throw new Error('not implemented');
}

/**
 * Revision of the running summary, run after a turn commits, off the critical
 * path, against the cheap tier. Failure is harmless. The recap stays stale, the
 * next turn is still correct, and the job retries next turn. Idempotent by
 * `through`, so re-running it for the same seq range is a no-op.
 */
export function recapRequest(
  _w: World,
  _sinceRecap: readonly Exchange[],
): { readonly instruction: string; readonly through: number } | null {
  throw new Error('not implemented');
}
