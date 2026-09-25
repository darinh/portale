/**
 * The forge. A separate program, not a separate contract.
 *
 * It imports the game's `parsePack` rather than shipping a second schema, so "anything the
 * forge accepts the game accepts" is true by call graph. What it adds on top is the thing
 * the game has no business knowing: whether a module is any GOOD. Those are the quality
 * rules from research-campaigns section 2, each with an id, a severity and a location.
 *
 * The split of labour follows the evidence in research-campaigns section 3.2. Code owns
 * ids, cross-references, graph structure, counts and every number. The model owns short
 * local prose with a neighbour's display name in front of it. The validator owns the
 * verdict, and a model never passes anything.
 */

import type {
  CampaignDef,
  ClassDef,
  Digest,
  Library,
  ModuleDef,
  Pack,
  PackError,
  SpellDef,
  StatBlockDef,
} from './contract.ts';
import type { Seed } from './dice.ts';

/* ----------------------------------------------------------------- the draft */

/**
 * A campaign under construction. The same types the game reads, minus the guarantee that
 * it parses: prose fields may be empty until `fill` runs, and `lint` says which.
 *
 * Deliberately not a separate "forge model". A second representation of a module would be
 * the information-leakage red flag wearing a hat: two places that both encode what a clue
 * is, drifting apart one field at a time.
 */
export interface Draft {
  readonly seed: Seed;
  readonly campaign: CampaignDef;
  readonly modules: readonly ModuleDef[];
  readonly classes: readonly ClassDef[];
  readonly spells: readonly SpellDef[];
  readonly statBlocks: readonly StatBlockDef[];
  /** Which fields are still placeholders, so `fill` knows what to ask for. */
  readonly holes: readonly Hole[];
}

export interface Hole {
  /** `mod_tide_house/nd_quay/aspects`, the same locator lint reports use. */
  readonly at: string;
  readonly want: 'name' | 'description' | 'aspects' | 'interactives' | 'quote' | 'roleplaying' | 'clueText' | 'question' | 'payoffText' | 'hook';
  /** Everything the model is given: the neighbours' display names and nothing more. */
  readonly context: readonly string[];
  readonly maxChars: number;
}

/* -------------------------------------------------------------- 1. the skeleton */

export interface Pitch {
  readonly title: string;
  readonly pitch: string;
  readonly truths: readonly string[];
  readonly modules: number;
  readonly levels: readonly [number, number];
  readonly tone: readonly string[];
  readonly contentLines: readonly string[];
  readonly mode: 'episodic' | 'serialized';
}

/**
 * Deterministic. Same pitch and seed, same skeleton, every time. Builds the node graph,
 * the revelations, the clue slots that satisfy G1 to G3, G5 and G6, the 4/6/8 segment
 * clocks, the wave-shaped difficulty along the critical path, the encounters from the
 * SRD 5.2.1 p.202 XP budget for one character, the rewards, the finale and the epilogue.
 *
 * No model is involved. A module graph is a plan, and research-campaigns section 3.1 is
 * blunt that models "cannot, by themselves, do planning or self-verification".
 */
export function skeleton(pitch: Pitch, lib: Library, seed: Seed): Draft {
  // TODO per module, pick a template (5-node mystery, five-room beats, xandered delve,
  // free node web) from the seed, then deal clue slots so every critical-path revelation
  // has three clues in at least two nodes, and at least one proactive trigger exists.
  throw new Error('not implemented');
}

/* ------------------------------------------------------------------ 2. the fill */

/** One model call per hole, under a flat schema, with only that hole's context. */
export interface Filler {
  readonly name: string;
  fill(hole: Hole, schema: object): Promise<Readonly<Record<string, string | readonly string[]>>>;
}

/**
 * Memoised by (hole locator, prompt digest, seed) into `fill-cache.json`, which is checked
 * in alongside the campaign. Two consequences, both required: regenerating a campaign is
 * reproducible, and `forge check` plus the whole test suite run with no GPU and no network
 * (constitution V).
 */
export function fill(draft: Draft, filler: Filler, cache: FillCache): Promise<Draft> {
  throw new Error('not implemented');
}

export interface FillCache {
  get(key: string): Readonly<Record<string, string | readonly string[]>> | undefined;
  put(key: string, value: Readonly<Record<string, string | readonly string[]>>): void;
  save(): Promise<void>;
}

/**
 * Repair is bounded: re-ask only the fields that failed, with the failure reason in the
 * prompt and a fixed seed, at most three times, then fall back to a table entry. The model
 * is never asked to fix the structure, only its own sentence.
 */
export function repair(draft: Draft, report: Report, filler: Filler, cache: FillCache): Promise<Draft> {
  throw new Error('not implemented');
}

/* ------------------------------------------------------------------- 3. the lint */

export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  /** `G1`, `S2`, `C7`, `A4`, `P3` — the rule ids from research-campaigns section 2. */
  readonly rule: RuleId;
  readonly severity: Severity;
  /** `mod_tide_house/rv_who_signed`, precise enough to open a file at (FR-017). */
  readonly at: string;
  readonly message: string;
}

export interface Report {
  readonly parse: readonly PackError[];
  readonly errors: readonly Finding[];
  readonly warnings: readonly Finding[];
  readonly infos: readonly Finding[];
  readonly ok: boolean;
}

/**
 * The rule ids, closed. A rule that is not in this union cannot be reported, which keeps
 * the lint auditable against the research that justified each one and stops folklore
 * (a fixed difficulty curve, pillar ratios, one item per session) creeping into the error
 * tier.
 */
export type RuleId =
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8'
  | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6'
  | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10'
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7'
  | 'P1' | 'P2' | 'P3' | 'P4';

export interface Rule {
  readonly id: RuleId;
  readonly severity: Severity;
  readonly says: string;
  /** Pure. A rule that needs prose runs after `fill`; a rule that needs only structure runs before. */
  readonly needs: 'structure' | 'prose' | 'simulation';
  check(draft: Draft, lib: Library): readonly Finding[];
}

export const RULES: readonly Rule[] = [];

/**
 * Runs `parsePack` first, then the rules. A parse error suppresses the quality rules,
 * because linting the style of something that is not a module produces noise.
 */
export function lint(draft: Draft, lib: Library): Report {
  throw new Error('not implemented');
}

/* -------------------------------------------------------------- 4. the simulation */

export interface SimReport {
  readonly runs: number;
  /** G4: the finale is reachable even from a player who misses clues. */
  readonly reachedFinale: number;
  /** SC-002: never a live hero in a state where the goal can no longer be met. */
  readonly deadlocked: number;
  readonly won: number;
  readonly lost: number;
  /** P3 and SC-007: minutes per module, estimated from turn counts. */
  readonly minutes: { readonly p50: number; readonly p90: number };
  readonly byModule: readonly { readonly module: string; readonly won: number; readonly lost: number }[];
}

/**
 * Plays the draft with the real engine and a wandering director, many times, from many
 * seeds. The forge cannot accept a module the engine cannot play, because the forge's
 * acceptance test IS the engine. No model, so it runs in CI.
 */
export function sim(draft: Draft, lib: Library, runs: number): Promise<SimReport> {
  throw new Error('not implemented');
}

/* ----------------------------------------------------------------- 5. the package */

/**
 * Canonical order, stamped provenance, the contract version and digest, then the content
 * digest that saves pin to. Two runs of the same pitch and seed must produce the same
 * digest, or pinning is worthless.
 */
export function packOf(draft: Draft): { readonly pack: Pack; readonly body: string; readonly digest: Digest } {
  throw new Error('not implemented');
}

/* ------------------------------------------------------------------ the CLI shell */

export type Command =
  | { readonly cmd: 'new'; readonly pitch: Pitch; readonly out: string }
  | { readonly cmd: 'fill'; readonly dir: string }
  | { readonly cmd: 'check'; readonly dir: string }
  | { readonly cmd: 'sim'; readonly dir: string; readonly runs: number }
  | { readonly cmd: 'pack'; readonly dir: string };

/** Exit code 0 when the report has no errors, 1 otherwise. That is the sync gate. */
export function run(argv: readonly string[]): Promise<number> {
  throw new Error('not implemented');
}
