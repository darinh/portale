/**
 * Branded identity and bounded arithmetic. Every semantic string in the system
 * is a distinct type, so a FactId can never be passed where an EntityId is
 * expected. Per type-system-discipline: brand semantic primitives, validate
 * once at creation, trust the type downstream.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** One playthrough. The unit of persistence, of the RNG seed, and of write serialisation. */
export type SessionId = Brand<string, 'SessionId'>;

/** Client-minted, per player utterance. The idempotency key for a turn. */
export type TurnId = Brand<string, 'TurnId'>;

/** An engine-minted ULID. The model never authors one of these. */
export type EntityId = Brand<string, 'EntityId'>;

/** An engine-minted ULID for one piece of canon. */
export type FactId = Brand<string, 'FactId'>;

/** Position in the session's append-only log. Monotone, gapless, per session. */
export type EventSeq = Brand<number, 'EventSeq'>;

/**
 * A pre-allocated mint slot the model uses to refer to something it is creating
 * in the same proposal. Slots are pre-allocated rather than invented so every
 * target field stays a closed enum in the per-turn JSON Schema. Lives for
 * exactly one turn and is resolved to an EntityId by the adjudicator.
 */
export type Ref = Brand<string, 'Ref'>;

/** The session's RNG root. Fixed at `begin`, never changes, stored in the log. */
export type Seed = Brand<string, 'Seed'>;

/**
 * Engine-derived key identifying "this obstacle, attempted this way, here".
 * Deliberately not model-authored. The calibration memo that stops the DM
 * softening a difficulty on retry would be trivially defeated if the model
 * could pick the key.
 */
export type ObstacleKey = Brand<string, 'ObstacleKey'>;

/** Non-negative integer currency. Construction clamps; there is no negative Coin. */
export type Coin = Brand<number, 'Coin'>;

/**
 * A bounded counter: hit points, clock segments, a lantern's oil. The pair is
 * branded so it can only be produced by `meter` or `shift`, both of which
 * clamp. Healing past max HP is therefore not a rule the engine enforces. It is
 * a value the type system cannot construct.
 */
export type Meter = Brand<{ readonly at: number; readonly max: number }, 'Meter'>;

export function SessionId(_raw: string): SessionId {
  throw new Error('not implemented');
}

export function TurnId(_raw: string): TurnId {
  throw new Error('not implemented');
}

export function Seed(_raw: string): Seed {
  throw new Error('not implemented');
}

/** ULID, time-ordered, so `introducedAt` ordering survives a seq rewrite. */
export function mintEntityId(): EntityId {
  throw new Error('not implemented');
}

export function mintFactId(): FactId {
  throw new Error('not implemented');
}

/** Clamps `at` into [0, max]. Total. */
export function meter(_max: number, _at?: number): Meter {
  throw new Error('not implemented');
}

/** Clamps into [0, max]. Total: `shift(m, +999)` is `max`, `shift(m, -999)` is 0. */
export function shift(_m: Meter, _by: number): Meter {
  throw new Error('not implemented');
}

export function isEmpty(_m: Meter): boolean {
  throw new Error('not implemented');
}

export function isFull(_m: Meter): boolean {
  throw new Error('not implemented');
}

/** Clamps at 0. Fractional input is floored. Total. */
export function coin(_n: number): Coin {
  throw new Error('not implemented');
}

/**
 * Checked debit. Returns null when the purse is short, because silently
 * clamping a payment to what the player can afford would hand out free goods.
 * Contrast with `shift`, which clamps because over-healing costs nobody
 * anything. The asymmetry is the point. Clamp what is harmless, refuse what is
 * not.
 */
export function debit(_purse: Coin, _amount: Coin): Coin | null {
  throw new Error('not implemented');
}

export function credit(_purse: Coin, _amount: Coin): Coin {
  throw new Error('not implemented');
}
