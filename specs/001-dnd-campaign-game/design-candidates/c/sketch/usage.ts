/**
 * Caller's view. These sites are the spec. The other files exist to make them compile.
 */

import type { HeroDraft } from './character.ts';
import { parseCampaign, pinCampaign } from './content.ts';
import type { Campaign, ContentPin } from './content.ts';
import { generate, lint } from './forge.ts';
import type { Pitch, TextFiller } from './forge.ts';
import { saveId, seed, turnId } from './ids.ts';
import { applyCommand, beginCampaign, foldSave, projectSave } from './save.ts';
import type { Command, PlayerView, Store } from './save.ts';
import type { Director, Intent } from './turn.ts';

/** README quickstart. One save, one hero, one declared attack. */
export async function playOneTurn(
  store: Store,
  director: Director,
  pin: ContentPin,
  draft: HeroDraft,
  attack: Intent,
): Promise<PlayerView> {
  const save = beginCampaign(saveId('s1'), pin, seed(1));
  store.create(save);
  const afterHero = await applyCommand(store, director, {
    kind: 'createHero',
    save: save.id,
    turn: turnId('t0'),
    draft,
  });
  void afterHero;
  return applyCommand(store, director, {
    kind: 'turn',
    save: save.id,
    turn: turnId('t1'),
    intent: attack,
  });
}

/** HTTP adapter. Parse the body, then one command. Never return a World. */
export async function httpTurn(
  store: Store,
  director: Director,
  save: string,
  body: unknown,
): Promise<{ readonly status: number; readonly view: PlayerView | null; readonly error: string | null }> {
  const parsed = parseTurnBody(save, body);
  if (!parsed.ok) return { status: 400, view: null, error: parsed.error };
  const view = await applyCommand(store, director, parsed.command);
  return { status: 200, view, error: null };
}

export function parseTurnBody(
  save: string,
  body: unknown,
): { readonly ok: true; readonly command: Command } | { readonly ok: false; readonly error: string } {
  void save;
  void body;
  // TODO require turnId and intent. Cap utterance length. Brand the ids.
  throw new Error('not implemented');
}

/** Reload proof. Fold the pin and the log. The files on disk are irrelevant. */
export function resume(store: Store, id: ReturnType<typeof saveId>): PlayerView {
  const saved = store.load(id);
  if (saved === null) throw new Error('not implemented');
  return projectSave(foldSave(saved));
}

/** Forge. Same parse the game uses. */
export async function forgeNew(pitch: Pitch, fill: TextFiller): Promise<ContentPin> {
  const campaign: Campaign = await generate(pitch, seed(7), fill);
  const report = lint(campaign);
  if (!report.ok) throw new Error('not implemented');
  return pinCampaign(campaign);
}

export function forgeCheck(raw: unknown): boolean {
  return lint(raw).ok;
}

export function loadCampaignFile(raw: unknown): ContentPin {
  const parsed = parseCampaign(raw);
  if (!parsed.ok) throw new Error('not implemented');
  return pinCampaign(parsed.value);
}
