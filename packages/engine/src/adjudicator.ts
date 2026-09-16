/**
 * The rules. One pure, total function turns a proposal into a list of events.
 *
 * There are exactly two layers between the model and the world, and they are
 * not variations of each other.
 *
 * Layer 1 is syntax and shape, and it belongs to the runtime. Ollama's
 * `format: <json schema>` constrains decoding, measured 8/8 engine-valid on a
 * 3B where JSON mode scored 0/8 despite parsing 8/8. `director.proposalSchema`
 * builds that schema per turn and pushes every closed set the engine already
 * knows into its enums, so out-of-reach targets, off-mode ops, stale fact ids
 * and out-of-initiative actors are undecodable rather than refused. Nothing in
 * this file is the last line of defence against a missing brace.
 *
 * Layer 2 is semantic and rules legality, and it is owned here and only here. A
 * schema-valid proposal can still be illegal. The probe's own schema proves it,
 * because it declared `difficulty` as an integer from 5 to 30 and would have
 * blessed 30 for a rusted cellar lock, cleanly, 8/8. Arithmetic, conjunctions
 * of effects inside one proposal, and history are not expressible as a closed
 * set known before the model speaks, so no decoder can help.
 *
 * `adjudicate` never throws and never fails. A turn in which the model proposed
 * eleven illegal things produces zero events and eleven drops, and the game
 * continues. The turn always settles. Encoding that as a total function rather
 * than a convention means no caller has a failure branch to forget.
 */

import type { EntityId, ObstacleKey, Ref, TurnId } from './ids.ts';
import type { World } from './world.ts';
import type { Band, CheckRequest, ContractBreachReason, Effect, EffectOp, Proposal } from './proposal.ts';
import type { SceneBrief } from './brief.ts';
import type { Degree, Roll } from './dice.ts';
import type { WorldEvent } from './events.ts';

/**
 * A rules objection to something the model was genuinely entitled to say.
 *
 * Every arm here is invisible to a decoder because it depends on arithmetic, on
 * a conjunction of effects inside one proposal, or on history. Layer-1
 * conditions are not in this union. They are `ContractBreachReason` in
 * `proposal.ts`, because a value outside an enum the engine itself generated is
 * an infrastructure fault rather than DM behaviour, and the two must not share
 * a channel. A refusal becomes fiction. A breach pages an operator.
 *
 * Refusals are the system's primary quality signal, not its error log. A rising
 * `insufficient-coin` rate means the brief is not showing the purse clearly
 * enough. A rising `recalibrated` rate means the DM is going soft. Both are
 * prompt problems discovered by a rules counter.
 */
export type Refusal =
  /** Over-healing, over-marking a clock, damage past zero. Harmless to clamp. */
  | { readonly kind: 'clamped'; readonly op: EffectOp; readonly subject: EntityId; readonly asked: number; readonly applied: number }
  | { readonly kind: 'insufficient-coin'; readonly subject: EntityId; readonly asked: number; readonly held: number }
  | { readonly kind: 'not-held'; readonly item: EntityId; readonly by: EntityId }
  /**
   * In reach when the brief was built, not in reach by the time this effect ran.
   * The residue Layer 1 structurally cannot cover, because it is a change the
   * proposal itself caused: an NPC killed by an earlier effect in the same
   * breath. This is a rules event, not a breach.
   */
  | { readonly kind: 'gone'; readonly subject: EntityId }
  /** A mint slot used as a target without an `introduce` earlier in the same proposal. */
  | { readonly kind: 'unbound-ref'; readonly ref: Ref }
  /** History-dependent. No decoder can see it. */
  | { readonly kind: 'recalibrated'; readonly asked: Band; readonly used: Band }
  /** Conditional on a field the model chooses in the same breath. Stays here on purpose. */
  | { readonly kind: 'uncited-band'; readonly asked: Band; readonly used: Band }
  /** Depends on which subject was chosen, so not enumerable up front. */
  | { readonly kind: 'fact-conflict'; readonly subject: EntityId; readonly aspect: string; readonly standing: string };

/**
 * What the rules did with one thing the model proposed. Named rather than
 * implied, so the all-dropped case has somewhere to be counted.
 *
 * Which arm applies is decided by one question. Does honouring this partially
 * transfer value the player did not earn? No means rewrite. Yes means drop.
 */
export type Ruling =
  | { readonly kind: 'applied'; readonly effect: Effect }
  /**
   * Clamped and continued. `as` is the effect as it actually landed, or null
   * when what was rewritten was the check's band rather than an effect.
   */
  | { readonly kind: 'rewrite'; readonly as: Effect | null; readonly refusal: Refusal }
  /** Never became an event. Nothing moved. */
  | { readonly kind: 'drop'; readonly refusal: Refusal };

/**
 * How the turn came out. The arm that earns this union is `soft-fail`.
 *
 * `asked` and `soft-fail` both produce zero events, and they must never be
 * confused. The DM asking a question is a good beat that the player answers
 * next turn. Everything being dropped is a beat that failed, and the player has
 * to be invited to rephrase or they will retype the same sentence.
 */
export type Terminal =
  /** At least one effect landed or was rewritten. */
  | { readonly kind: 'resolved' }
  /** The DM asked for specifics. State-neutral by construction. */
  | { readonly kind: 'asked'; readonly question: string }
  /** Every proposed effect was dropped. The turn settles with prose and an invitation to rephrase. */
  | { readonly kind: 'soft-fail' }
  /** The DM never spoke usably. Infrastructure, not fiction. */
  | { readonly kind: 'stalled'; readonly why: 'unreachable' | 'contract-breach' };

export interface Adjudication {
  readonly terminal: Terminal;
  /** In order. Appended in one transaction, or not at all. */
  readonly events: readonly WorldEvent[];
  /** One per proposed effect, plus one per check-level rewrite. Exhaustive over what the model asked for. */
  readonly rulings: readonly Ruling[];
  /**
   * Non-empty means the transport broke its contract. The engine raises
   * `DirectorContractBreach` and stalls the turn. Always empty against a
   * conforming runtime.
   */
  readonly breaches: readonly ContractBreachReason[];
  readonly check: { readonly request: CheckRequest; readonly roll: Roll; readonly degree: Degree } | null;
  readonly bindings: ReadonlyMap<Ref, EntityId>;
}

/**
 * Pure. Total. No IO, no clock, no randomness beyond `dice.draw` keyed off the
 * arguments. This signature is the reason FIXED constraint 4 is satisfiable.
 * Every rule in the game can be tested on a laptop with no GPU, because the
 * model is upstream of this function and never inside it.
 *
 * It takes the brief as well as the world because those are two different
 * questions and the difference is the whole of graft 1. The world is what is
 * true. The brief is what the model was offered. A value that contradicts the
 * world is a rules event. A value that was never in the brief is a transport
 * breach, because the engine generated those enums itself and a conforming
 * decoder could not have produced anything outside them.
 */
export function adjudicate(_w: World, _brief: SceneBrief, _turn: TurnId, _proposal: Proposal): Adjudication {
  throw new Error('not implemented');
}

/** The effects that actually landed, for the narrator. `applied` plus every non-null `rewrite.as`. */
export function appliedEffects(_rulings: readonly Ruling[]): readonly Effect[] {
  throw new Error('not implemented');
}

/**
 * Engine-derived, deliberately not model-supplied. Normalises the obstacle text
 * and keys it with the place and approach. If the model could author this key
 * it could defeat the calibration memo by describing the same lock slightly
 * differently each time.
 *
 * TODO: normalisation must be stable enough to match paraphrase but loose
 * enough not to collide two genuinely different obstacles in one room. Start
 * with place plus approach plus the longest noun phrase, and log collisions.
 */
export function calibrationKey(_w: World, _req: CheckRequest): ObstacleKey {
  throw new Error('not implemented');
}

/**
 * Human-readable, written for the narrator and for the next brief. Exhaustive
 * over `Ruling`, so adding an arm breaks the build here, which is where you
 * want reminding.
 *
 * This is the channel that makes a ruling diegetic instead of silent. "They
 * reached for 50 coin and hold 12. The purchase did not happen. Narrate the
 * shortfall." The engine's ruling reaches the player as fiction, which is what
 * a referee at a table sounds like.
 *
 * It renders rulings only. Breaches never come through here, because a breach
 * must not become fiction.
 */
export function renderCorrections(_w: World, _rulings: readonly Ruling[]): readonly string[] {
  throw new Error('not implemented');
}

/**
 * The floor. When the director is unreachable or breached its contract, the
 * engine adjudicates this instead. State-neutral, always legal, in voice. "The
 * moment hangs. What do you do?"
 */
export function stall(_w: World, _turn: TurnId, _why: 'unreachable' | 'contract-breach'): Adjudication {
  throw new Error('not implemented');
}

// TODO - the shape of adjudicate, written out so the contract is unambiguous.
//
// adjudicate(w, brief, turn, proposal):
//   bindings = new Map<Ref, EntityId>()
//   events = []; rulings = []; breaches = []
//
//   // 0. CONTRACT. Every check here is against the BRIEF, not the world, and
//   //    every one of them is unreachable against a conforming runtime. A hit
//   //    means the transport is broken, so the whole proposal is discarded
//   //    rather than partially honoured. You do not keep trusting a source
//   //    that just proved it is not the one you configured.
//   if proposal.move.kind === 'narrate' or 'check':
//       for each effect:
//           if effect.op not in brief.affordances:
//               breaches.push({ kind:'illegal-in-mode', op: effect.op, mode: brief.mode })
//           for each target { known: id } in effect:
//               if id not in brief.inReach:
//                   breaches.push({ kind:'unknown-target', raw: id })
//           if effect.op === 'amend' and effect.retire not in brief.citableFacts:
//               breaches.push({ kind:'stale-amend', retire: effect.retire })
//       if move is 'check' and brief.actingNow and req.actor is not brief.actingNow:
//           breaches.push({ kind:'wrong-turn', subject: req.actor })
//   if breaches.length:
//       return { terminal:{ kind:'stalled', why:'contract-breach' },
//                events: [], rulings: [], breaches, check: null, bindings }
//
//   switch proposal.move.kind:
//
//     'ask':
//       return { terminal:{ kind:'asked', question }, events: [], rulings: [],
//                breaches: [], check: null, bindings }
//       // deliberately produces NO events beyond the turn record the caller
//       // appends. An unanswered question must not advance the fiction, and it
//       // is not a soft-fail.
//
//     'narrate':
//       for each effect: applyEffect(...)
//
//     'check':
//       req = move.check
//       // 1. calibration BEFORE anything else, so an uncited or softened band
//       //    is corrected before the die is keyed.
//       key = calibrationKey(w, req)
//       band = req.band
//       if BAND_REQUIRES_CITATION[band] and not currentFact(w, req.justifiedBy):
//           band = 'tricky'
//           rulings.push({ kind:'rewrite', as: null,
//                          refusal:{ kind:'uncited-band', asked:req.band, used:band } })
//       remembered = w.calibration.get(key)
//       if remembered and remembered !== band:
//           rulings.push({ kind:'rewrite', as: null,
//                          refusal:{ kind:'recalibrated', asked:band, used:remembered } })
//           band = remembered
//       else if not remembered:
//           events.push({ t:'calibrated', key, band })
//
//       // 2. roll. The key is a pure function of committed height, so this is
//       //    reproducible and unaffected by how many times the turn was tried.
//       bonus = approachBonus(w, req.actor, req.approach)
//       { roll, degree } = resolve({ seed:w.seed, height:w.seq, turn, index:0 }, band, bonus)
//       events.push({ t:'check-resolved', ... })
//
//       // 3. the ENGINE picks the branch. The model, having already spent its
//       //    authority, is not consulted.
//       branch = degree is 'failure'|'disaster' ? req.onFailure : req.onSuccess
//       for each effect in branch: applyEffect(...)
//       if degree === 'cost':     mark one segment on costTarget(w)
//       if degree === 'disaster': mark two
//
//   // mode post-step. NOT a second pipeline: one branch, here.
//   if w.scene.mode === 'combat' and the protagonist just acted:
//       events.push({ t:'scene-set', scene: advanceInitiative(w.scene) })
//
//   terminal = rulings.some(r => r.kind !== 'drop') ? { kind:'resolved' }
//            : { kind:'soft-fail' }
//   // soft-fail is reachable with a non-empty `events` list, because a check
//   // resolves and calibrates even when both branches drop entirely. The
//   // invitation to rephrase is about the fiction not moving, not about the
//   // log being empty.
//
//   return { terminal, events, rulings, breaches: [], check, bindings }
//
//
// applyEffect(effect):
//   resolve(target):
//     { fresh: ref }  -> bindings.get(ref) ?? drop 'unbound-ref'
//     { known: id }   -> w.entities.has(id) and still present ? id : drop 'gone'
//
//   'introduce' -> id = mintEntityId(); bindings.set(slot, id)
//                  emit entity-minted + one fact-asserted per trait
//                  minting is always legal. The engine has no opinion on whether
//                  a one-eyed smuggler may exist. That is the Lore column.
//   'reveal'    -> if ASPECT_CARDINALITY[aspect] === 'single' and a current fact
//                  already occupies it -> drop 'fact-conflict', keep the
//                  original. The correction tells the model what canon says.
//   'amend'     -> the retired fact must still be current, else 'gone'
//   'harm'/'mend' -> shift(vitals, +/-amount). CLAMPS, so this is a rewrite.
//                  Over-heal is not an error, it is unrepresentable; the ruling
//                  is recorded so the narrator does not describe a healing that
//                  did not happen.
//   'pay'       -> debit() returns null -> drop 'insufficient-coin', nothing
//                  moves. Does NOT clamp, because a partial payment is a free
//                  good. Two individually affordable payments in one proposal
//                  are checked against the running purse, which is why this
//                  cannot be a schema `maximum`.
//   'hand'      -> item.heldBy must equal the giver, else drop 'not-held'
//   'mark'      -> shift(segments, +n), clamps. A full clock is a fact the next
//                  brief carries loudly.
//   'engage'    -> roll initiative for every foe (indices 1..n off the same key)
//                  and emit scene-set with mode 'combat'
//   'disengage' -> emit scene-set with mode 'exploration'
//   everything else -> emit the corresponding *-set event with the RESULT
