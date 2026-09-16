/**
 * The only source of randomness in the system.
 *
 * A roll is a pure function of the seed and the turn number, so re-folding a session's
 * log reproduces every die exactly. The model never rolls and never sees a roll before
 * the engine has committed it.
 */

export type Seed = number & { readonly __brand: 'Seed' };

export function seed(n: number): Seed {
  return (n >>> 0) as Seed;
}

/** SplitMix32. Small, fast, and deterministic across platforms. */
function splitmix32(a: number): number {
  a = (a + 0x9e3779b9) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export interface Roll {
  readonly die: number;
  readonly face: number;
  readonly total: number;
  readonly dc: number;
  readonly success: boolean;
  readonly critical: 'hit' | 'miss' | null;
}

export function roll(s: Seed, turn: number, die: number, modifier: number, dc: number): Roll {
  const face = Math.floor(splitmix32(s + turn * 0x9e37) * die) + 1;
  const total = face + modifier;
  const critical = die === 20 && face === 20 ? 'hit' : die === 20 && face === 1 ? 'miss' : null;
  return {
    die,
    face,
    total,
    dc,
    success: critical === 'hit' ? true : critical === 'miss' ? false : total >= dc,
    critical,
  };
}
