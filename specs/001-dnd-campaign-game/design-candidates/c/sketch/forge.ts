/**
 * Separate process, same contract module. The model fills local prose.
 * Code owns the graph, the numbers, the ids, and the pass/fail.
 */

import type { Campaign, ParseError } from './content.ts';
import { parseCampaign, pinCampaign, thisContractDigest } from './content.ts';
import type { ContentPin } from './content.ts';
import type { Seed } from './ids.ts';

export interface Pitch {
  readonly title: string;
  readonly logline: string;
  readonly seasons: number;
  readonly startLevel: number;
  readonly tone: string;
}

export interface FillSlot {
  readonly entity: 'location' | 'npc' | 'clue' | 'question' | 'truth';
  readonly facts: string;
  readonly neighborNames: readonly string[];
}

export interface FilledText {
  readonly notes: string;
  readonly text: string;
}

export interface TextFiller {
  fill(slot: FillSlot): Promise<FilledText>;
}

export interface LintHit {
  readonly id: string;
  readonly severity: 'error' | 'warn' | 'info';
  readonly path: string;
  readonly detail: string;
}

export interface LintReport {
  readonly contract: ReturnType<typeof thisContractDigest>;
  readonly parse: readonly ParseError[];
  readonly hits: readonly LintHit[];
  readonly ok: boolean;
}

export function skeleton(pitch: Pitch, seed: Seed): Campaign {
  void pitch;
  void seed;
  // TODO fronts, node graph, clue slots, XP budgets, clock sizes, start/finale.
  // No model. Check G1–G8, S2, C2, C8, A1, A3 on the empty-prose graph.
  throw new Error('not implemented');
}

export async function generate(pitch: Pitch, seed: Seed, fill: TextFiller): Promise<Campaign> {
  void fill;
  const camp = skeleton(pitch, seed);
  // TODO one fill() per entity. Never emit ids. Repair up to 3 times, then table fallback.
  return camp;
}

export function lint(raw: unknown): LintReport {
  const parsed = parseCampaign(raw);
  void parsed;
  // TODO after parse, G1 three clues per critical revelation, G4 Monte Carlo,
  // S2 XP budget vs SRD table, C8 segments, C6 want+clock, A1 arc beat per module.
  // Same parseCampaign the game uses. A second parser is a bug.
  throw new Error('not implemented');
}

export function exportPin(campaign: Campaign): ContentPin {
  return pinCampaign(campaign);
}

export function main(_argv: readonly string[]): number {
  void _argv;
  void thisContractDigest;
  // TODO new | check | pin. Exit 1 on lint.ok === false.
  throw new Error('not implemented');
}
