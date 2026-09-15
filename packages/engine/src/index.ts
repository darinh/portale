/**
 * The public surface of `@portale/engine`. Everything not re-exported here is
 * private, including every wire type, every storage schema, and the entire
 * `World`. Application code, meaning the HTTP routes and the client, imports
 * only from this file. Tests may additionally import the test doubles from
 * `./director.ts` and `./store.ts`.
 *
 * Domain vocabulary is shared with the client per FIXED constraint 5, because
 * these are domain types rather than transport types. `Band`, `Approach`,
 * `Degree`, `Condition` and `TurnOutcome` all render in the UI and all mean the
 * same thing on both sides.
 */

export { createEngine } from './engine.ts';
export type { Engine, EngineDeps, PlayerView, TurnEvent, TurnOutcome, TurnRequest, BeginRequest } from './engine.ts';

// Identity. Each name is both a type and its validating constructor, so the
// client cannot pass a bare string and cannot mint one without validation.
export { SessionId, TurnId, Seed } from './ids.ts';
export type { EventSeq, Coin, Meter } from './ids.ts';

// Shared vocabulary the UI renders.
export type { Approach, Band } from './proposal.ts';
export type { Degree, Roll } from './dice.ts';
export type { Condition, Disposition, EntityKind, PlayMode, Veil } from './world.ts';
export type { Exchange } from './events.ts';

/**
 * Operational, not diegetic. Exported so the host application can catch it,
 * page on it, and tell an operator that the model or its runtime was swapped
 * for one that does not honour grammar constraints. It is the one failure in
 * the system a player is never shown.
 *
 * `ContractBreachReason` is deliberately all strings, so this export carries no
 * domain vocabulary with it.
 */
export { DirectorContractBreach } from './proposal.ts';
export type { ContractBreachReason } from './proposal.ts';

// Ports, so the host application can choose implementations.
export type { Director } from './director.ts';
export type { EventStore } from './store.ts';

// Not exported, deliberately:
//   World, Entity, Fact, Ledger, Recap          the DM's private truth
//   Effect, Proposal, Move, CheckRequest, Told  the model contract
//   WorldEvent, Recorded                        the log
//   SceneBrief, Dossier                         the prompt input
//   Refusal, Ruling, Adjudication               the rules' internals
//   proposalSchema, parseProposal               transport and the shape gate
//
// Each of those, once public, becomes something a UI change can be blocked on.
// The client needs to render a game, not to understand how the DM is governed.
