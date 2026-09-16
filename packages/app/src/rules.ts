/**
 * Layer 2. The rules, and the only place a proposal may be rejected.
 *
 * Constrained decoding already guarantees shape, so nothing here re-checks field names or
 * enum membership. What it cannot guarantee is legality. A schema-valid proposal can still
 * try to heal past max, hit a corpse, or set an absurd difficulty for a trivial act.
 *
 * The engine's ruling is authoritative and one-shot. The model is never asked to try
 * again. The shape win came from a forcing function inside the decoder and semantics has
 * no equivalent, so re-drawing from the same sampler is another sample, not a correction.
 *
 * Rulings are narrated rather than hidden, and they stay in the log. A rising refusal rate
 * is how you find a bad prompt, so refusals are telemetry rather than an error channel.
 */

import { roll } from './dice.ts';
import type { Proposal, SceneBrief } from './director.ts';
import { entityId } from './world.ts';
import type { Entity, EntityId, World, WorldEvent } from './world.ts';

export type Ruling =
  | { readonly kind: 'applied' }
  | { readonly kind: 'rewrite'; readonly why: string; readonly detail: string }
  | { readonly kind: 'drop'; readonly why: string; readonly detail: string };

export interface Adjudication {
  readonly events: readonly WorldEvent[];
  readonly rulings: readonly Ruling[];
  /** True when every part of the proposal was dropped and the turn produced no mechanics. */
  readonly softFail: boolean;
}

/** Difficulty the DM is allowed to set. Beyond this the engine pulls it back. */
const DC_FLOOR = 5;
const DC_CEILING = 25;
const MAX_DAMAGE = 12;

let mintCounter = 0;

function mint(): EntityId {
  mintCounter += 1;
  return entityId(`e_m${mintCounter.toString(36)}${Date.now().toString(36).slice(-4)}`);
}

export function resetMintCounterForTests(): void {
  mintCounter = 0;
}

export function adjudicate(w: World, brief: SceneBrief, proposal: Proposal): Adjudication {
  const events: WorldEvent[] = [];
  const rulings: Ruling[] = [];

  events.push({ kind: 'narrated', text: proposal.narration });

  let targetId: EntityId | null = null;

  if (proposal.target === '~new1' || proposal.target === '~new2') {
    if (proposal.introduces === null) {
      rulings.push({
        kind: 'drop',
        why: 'mint-without-lore',
        detail: 'The DM reached for a new character but did not say who they were.',
      });
    } else {
      const entity: Entity = {
        id: mint(),
        name: proposal.introduces.name,
        lore: proposal.introduces.lore,
        hp: { now: 8, max: 8 },
        hostile: proposal.introduces.hostile,
        dead: false,
      };
      events.push({ kind: 'introduced', entity });
      targetId = entity.id;
    }
  } else {
    const named = w.entities.get(proposal.target);
    if (named === undefined) {
      rulings.push({
        kind: 'drop',
        why: 'absent-target',
        detail: 'The DM named someone who is not here.',
      });
    } else if (named.dead && proposal.op === 'attack') {
      rulings.push({
        kind: 'drop',
        why: 'already-dead',
        detail: `${named.name} has already fallen.`,
      });
    } else {
      targetId = named.id;
    }
  }

  if (proposal.op === 'narrate_only' || proposal.op === 'introduce' || proposal.op === 'talk') {
    return { events, rulings, softFail: false };
  }

  if (targetId === null) {
    return { events, rulings, softFail: true };
  }

  let dc = proposal.difficulty;
  if (dc < DC_FLOOR || dc > DC_CEILING) {
    const clamped = Math.max(DC_FLOOR, Math.min(dc, DC_CEILING));
    rulings.push({
      kind: 'rewrite',
      why: 'difficulty-out-of-band',
      detail: `The DM called for ${dc}; the table settles on ${clamped}.`,
    });
    dc = clamped;
  }

  const outcome = roll(w.seed, w.seq, 20, 0, dc);
  events.push({ kind: 'rolled', roll: outcome, actor: w.protagonist, why: proposal.ability });

  if (!outcome.success) {
    return { events, rulings, softFail: false };
  }

  if (proposal.op === 'attack') {
    let damage = proposal.damage;
    if (damage > MAX_DAMAGE) {
      rulings.push({
        kind: 'rewrite',
        why: 'damage-out-of-band',
        detail: `The DM swung for ${damage}; the table caps it at ${MAX_DAMAGE}.`,
      });
      damage = MAX_DAMAGE;
    }
    if (damage <= 0) damage = 1;
    if (outcome.critical === 'hit') damage *= 2;

    const target = w.entities.get(targetId);
    events.push({ kind: 'damaged', target: targetId, amount: damage });
    if (target !== undefined && target.hp.now - damage <= 0) {
      events.push({ kind: 'died', target: targetId });
      if (w.mode === 'combat') {
        const othersAlive = [...w.entities.values()].some(
          (e) => e.id !== w.protagonist && e.id !== targetId && e.hostile && !e.dead,
        );
        if (!othersAlive) events.push({ kind: 'mode', to: 'exploration' });
      }
    }
  }

  for (const r of rulings) {
    if (r.kind !== 'applied') {
      events.push({ kind: 'ruled', why: r.why, detail: r.detail });
    }
  }

  return { events, rulings, softFail: false };
}
