/**
 * The seam. The only module that knows an LLM exists, the only one that does
 * network IO for the model, and the only one that ever holds a wire type.
 *
 * Measured, not assumed. Probe of qwen2.5:3b-instruct via Ollama, 8 trials per
 * mode. Unconstrained prompt, 0/8 engine-valid. `format: "json"`, 0/8
 * engine-valid despite parsing 8/8, because it capitalised "Narration" and
 * omitted the required `intent` object. `format: <json schema>`, 8/8.
 *
 * Two conclusions point in opposite directions. Syntax and shape are solved at
 * the transport layer, so this module has no parse-repair loop, no retry
 * ladder, and no attempts counter. And the schema is enforced per request, so
 * it can be built per turn, which is the part worth exploiting rather than
 * merely accommodating. Every closed set the engine already knows goes into the
 * schema and stops being a rules check at all. See `proposalSchema`.
 *
 * What constrained decoding does not buy is stated in `adjudicator.ts`. The
 * probe's own schema declared `difficulty` as an integer from 5 to 30, so
 * difficulty 30 for a rusted cellar lock was one of the 8/8 successes.
 *
 * Two methods, and the split between them is load-bearing. `propose` has
 * authority, emits schema-constrained JSON, and runs before any die exists.
 * `recount` has no authority, streams prose, and runs after the outcome is a
 * committed fact in its own prompt. The model therefore never observes a die
 * while it still has authority, and never holds authority while writing prose.
 */

import type { SceneBrief } from './brief.ts';
import { MAX_IN_REACH } from './brief.ts';
import type { ContractBreachReason, Proposal, Told } from './proposal.ts';

/**
 * How many entities the DM may introduce in one turn.
 *
 * Two, not four, and the reason is the enum finding rather than the fiction.
 * Mint slots share the target enum with entities in reach, so the enum the
 * decoder actually sees is `MAX_IN_REACH + MINT_SLOTS` members long. At four
 * slots that total is ten, which is exactly the condition the probe measured at
 * 4/8 correct. At two it is eight. A DM that needs three new things in one
 * breath is writing a bad beat, and introducing across two turns costs the
 * fiction nothing.
 */
export const MINT_SLOTS = 2;
export type MintSlot = '~new1' | '~new2';

/**
 * The bound the per-turn schema must never exceed. Asserted in
 * `proposalSchema`, because an overflow here is invisible to every validity
 * metric the system has.
 */
export const MAX_TARGET_ENUM = MAX_IN_REACH + MINT_SLOTS;

export interface Director {
  /**
   * Structured, authoritative, small. Returns a Proposal or throws
   * `DirectorContractBreach`. It does not return a partial result, a repair
   * count, or a confidence. Against a conforming runtime, shape failure is not
   * a state this function can be in.
   */
  propose(brief: SceneBrief, signal: AbortSignal): Promise<Proposal>;

  /** Non-authoritative streaming prose. Free to retry, free to be wrong. */
  recount(brief: SceneBrief, told: Told, signal: AbortSignal): AsyncIterable<string>;

  /** Cheap tier, off the critical path. Optional; the recap simply stalls without it. */
  summarise?(instruction: string, signal: AbortSignal): Promise<string>;
}

/**
 * Builds the JSON Schema handed to `format` for this turn, from this world.
 * Two sources, both authoritative, neither hand-maintained. The domain unions
 * in `proposal.ts` supply op names, aspects, bands and approaches. The brief
 * supplies the live sets, which are the ids in reach, the current fact ids, the
 * mode's affordances, and whose initiative turn it is.
 *
 * The dividing rule, applicable to any field added later. A closed set known
 * before the model speaks goes in the schema. Anything that depends on a value
 * the model is about to choose, on arithmetic, or on history stays in the
 * adjudicator.
 *
 * What that rule moves into the decoder, meaning things that stop being
 * sayable: an op outside this mode's affordances, a target not in reach, a
 * `retire` naming a superseded or absent fact, an actor other than the one
 * whose initiative turn it is, and any band, aspect, approach or condition
 * outside its enum.
 *
 * What it deliberately leaves behind. "Forlorn requires a citation" is a
 * conditional, and conditional schemas measurably degrade small-model output
 * while moving game policy into a format string. "Amount is at most the purse"
 * depends on a field the model has not chosen yet and compounds across effects
 * inside one proposal, because two individually affordable payments can be
 * jointly bankrupt, and a per-field `maximum` cannot see the conjunction. The
 * calibration memo keys off an obstacle phrase the model invents in the same
 * breath, so there is nothing to enumerate.
 *
 * TODO: assert at construction that every arm of the `Effect` union appears, so
 * adding an op fails the build rather than silently becoming undecodable.
 *
 * TODO: assert the target enum is at most `MAX_TARGET_ENUM` members. The enum
 * probe measured correctness, not validity, falling from 8/8 to 3/8 as this
 * list grew, while in-enum validity stayed 24/24. Nothing downstream can
 * detect the overflow, so the assertion is the only guard there is.
 */
export function proposalSchema(_brief: SceneBrief): object {
  throw new Error('not implemented');
}

/**
 * Wire to domain. Not a validation gate. With a conforming runtime the shape is
 * already guaranteed, and the probe's middle row shows a gate that only checks
 * parseability is worthless anyway. This exists to do the one thing a schema
 * cannot, which is turn strings into branded domain types. An entity id string
 * becomes `{ known }` and a mint slot becomes `{ fresh }`.
 * Per boundary-discipline: parse at the boundary, trust the types inside.
 *
 * A failure here means the runtime ignored `format`. That is a deployment
 * fault, not a gameplay event, so the caller raises `DirectorContractBreach`
 * rather than producing a refusal.
 */
export function parseProposal(
  _raw: unknown,
  _brief: SceneBrief,
): { readonly ok: true; readonly proposal: Proposal } | { readonly ok: false; readonly reason: ContractBreachReason } {
  throw new Error('not implemented');
}

export interface LocalDirectorOptions {
  /** Ollama-style, OpenAI-compatible. */
  readonly endpoint: string;
  readonly model: string;
  readonly timeoutMs?: number;
}

/**
 * TODO - propose():
 *   1. render(brief) to a prompt. Current lore verbatim, so the model reads
 *      canon instead of recalling it. Entities in `cast` but not in `inReach`
 *      are described as scenery, because the schema will not let the model act
 *      on them and the prompt should not imply otherwise.
 *   2. POST with `format: proposalSchema(brief)` and `stream: false`.
 *   3. parseProposal, then brand. On failure, throw DirectorContractBreach.
 *   There is no step 4. The absence of a repair loop is the design decision,
 *   not an omission.
 *
 * Note the absent option. There is no `constrainDecoding` flag, because
 * unconstrained and JSON mode both measured 0/8, so a switch to turn the schema
 * off would only ever be a switch to break the game. Capability is checked once
 * at boot by `directorContract`, not negotiated per turn.
 */
export function localDirector(_opts: LocalDirectorOptions): Director {
  throw new Error('not implemented');
}

/**
 * Takes raw wire proposals, the exact JSON a constrained model emits, and runs
 * them through `parseProposal`. Deliberate, because every unit test in the
 * codebase then exercises the real branding boundary for free instead of
 * injecting pre-branded domain objects that could never have come off a wire.
 *
 * It is also the only way to test the breach path without a live model. Feed it
 * a target that was never in `brief.inReach` and the engine must raise rather
 * than refuse.
 */
export function scriptedDirector(_wire: readonly unknown[]): Director {
  throw new Error('not implemented');
}

/** Replays captured real-model sessions from checked-in JSONL fixtures. */
export function replayDirector(_fixture: string): Director {
  throw new Error('not implemented');
}

/**
 * The adversary, and note what it is not allowed to generate. It emits only
 * schema-valid proposals, because that is the real threat model. Malformed JSON
 * is the runtime's problem and is measured solved, while a perfectly shaped
 * `{ op: 'pay', amount: 999999 }` is the engine's problem forever. Fuzzing
 * malformed bytes here would be testing Ollama.
 *
 * So it generates against `proposalSchema`, which also means the fuzzer cannot
 * drift from the contract, and attacks the arithmetic. Top-of-range difficulty
 * for a trivial lock, healing 10^9, paying gold the player lacks, two payments
 * individually affordable and jointly bankrupt, `forlorn` with a null citation,
 * `reveal` onto an occupied single-slot aspect, amending a fact superseded
 * three turns ago, re-banding the same obstacle downward on retry, and a target
 * killed by an earlier effect in the same proposal.
 *
 * The property is total and never mentions model quality. For any sequence of
 * schema-valid proposals, every turn settles, `invariantsHold(world)` stays
 * true, no `DirectorContractBreach` is raised, and re-folding the log
 * reproduces the same world.
 */
export declare const hostileDirector: {
  /** Generates against `proposalSchema`, so the fuzzer cannot drift from the contract. */
  arbitraryProposal(brief: SceneBrief): unknown;
  director(seed: number): Director;
};

/**
 * Optional decorator. Content policy for a locally hosted, unaligned model
 * belongs at this boundary and nowhere else, so the engine stays a rules engine.
 */
export function warden(_inner: Director, _policy: unknown): Director {
  throw new Error('not implemented');
}

/**
 * Conformance suite every Director must pass. Includes a live boot check that
 * the configured runtime actually honours `format`, asked once at startup
 * rather than per turn, because whether a server constrains decoding is a
 * deployment fact and not a turn-level uncertainty. Failing it should stop the
 * process rather than degrade the game.
 */
export function directorContract(_make: () => Director): void {
  throw new Error('not implemented');
}
