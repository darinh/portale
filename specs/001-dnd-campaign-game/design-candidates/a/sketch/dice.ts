/**
 * Deterministic dice. A replayed log reproduces the world exactly, so every roll is a
 * pure function of the save's seed and the event sequence number (constitution III).
 *
 * Mirrors the shape already in `packages/app/src/dice.ts`, widened for 2024 rules:
 * advantage and disadvantage, a reroll hook for Heroic Inspiration, and crit ranges.
 */

export type Seed = number & { readonly __brand: 'Seed' };

export function seed(n: number): Seed {
  throw new Error('not implemented');
}

export type Swing = 'flat' | 'advantage' | 'disadvantage';

export interface Roll {
  readonly die: number;
  /** Both faces when the swing was not flat, so the transcript can show the discard. */
  readonly faces: readonly number[];
  readonly face: number;
  readonly mod: number;
  readonly total: number;
  readonly dc: number;
  readonly success: boolean;
  readonly critical: 'hit' | 'miss' | null;
  /** "Dex +2, prof +2 x2" — how the modifier was built, for the player and for a test. */
  readonly note: string;
}

export function d20(s: Seed, seq: number, mod: number, dc: number, swing: Swing, note: string): Roll {
  throw new Error('not implemented');
}

/** `"2d6+3"` parsed at the contract boundary, rolled here. */
export function rollDice(s: Seed, seq: number, spec: string): { readonly total: number; readonly faces: readonly number[] } {
  throw new Error('not implemented');
}

/**
 * Deterministic choice from a list, for successor tables, cast pools and spawn counts.
 * Never `Math.random`, which is why a delve, a succession and a monster's hit points all
 * survive a replay.
 */
export function pick<T>(s: Seed, seq: number, from: readonly T[]): T {
  throw new Error('not implemented');
}
