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
 * Rulings reach the log the instant they are decided. An earlier version collected them in
 * a local array and converted them to events in a trailing loop, which three early returns
 * jumped straight over, so every dropped intent was ruled on and then silently discarded.
 * Emitting at the decision point is what makes "refusals are telemetry" true rather than
 * aspirational.
 */

import { roll } from './dice.ts';
import type { Proposal, SceneBrief } from './director.ts';
import { apply, entityId } from './world.ts';
import type { Entity, EntityId, World, WorldEvent } from './world.ts';

/**
 * Bookkeeping tokens the model sometimes copies into player-facing prose. Observed live:
 * a narration that opened with "~new3 introduces.", naming a slot that does not even
 * exist. Asking the model not to is necessary and not sufficient, so the engine scrubs
 * them on the way out. This is the boundary doing its job rather than trusting the input.
 */
function scrubTokens(text: string, w: World): string {
  let out = text;
  for (const e of w.entities.values()) out = out.split(e.id).join(e.name);
  return out
    // Matches any slot-shaped token, not only the slots that exist. The model invented
    // "~new3" in real play, and scrubbing only the declared slots let it straight through.
    .replace(/~new\d+/gi, 'someone')
    .replace(/\be_[a-z0-9_]+\b/gi, 'someone')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

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

const DC_FLOOR = 5;
const DC_CEILING = 25;
const MAX_DAMAGE = 12;
const MINTED_HP = 8;

/**
 * Minted ids derive from the world's own seed and event count, never from wall clock time
 * or module-level state. A counter reset by a server restart, or a timestamp that wraps,
 * would let two sessions collide and would break replay determinism.
 */
function mintId(w: World): EntityId {
  return entityId(`e_m${w.seed.toString(36)}_${w.seq.toString(36)}`);
}

export function adjudicate(w: World, _brief: SceneBrief, proposal: Proposal): Adjudication {
  const events: WorldEvent[] = [];
  const rulings: Ruling[] = [];

  // The working world absorbs each event as it is produced, so a lookup later in this
  // function sees an NPC introduced earlier in the same turn.
  let working = w;

  function emit(e: WorldEvent): void {
    events.push(e);
    working = apply(working, e);
  }

  function rule(r: Exclude<Ruling, { kind: 'applied' }>): void {
    rulings.push(r);
    emit({ kind: 'ruled', why: r.why, detail: r.detail });
  }

  emit({ kind: 'narrated', text: scrubTokens(proposal.narration, w) });

  let targetId: EntityId | null = null;

  if (proposal.target === '~new1' || proposal.target === '~new2') {
    if (proposal.introduces === null) {
      rule({
        kind: 'drop',
        why: 'mint-without-lore',
        detail: 'The DM reached for a new character but did not say who they were.',
      });
    } else {
      const entity: Entity = {
        id: mintId(working),
        name: proposal.introduces.name,
        lore: proposal.introduces.lore,
        hp: { now: MINTED_HP, max: MINTED_HP },
        hostile: proposal.introduces.hostile,
        dead: false,
      };
      emit({ kind: 'introduced', entity });
      targetId = entity.id;
    }
  } else {
    const named = working.entities.get(proposal.target);
    if (named === undefined) {
      rule({ kind: 'drop', why: 'absent-target', detail: 'The DM named someone who is not here.' });
    } else if (named.dead && proposal.op === 'attack') {
      rule({ kind: 'drop', why: 'already-dead', detail: `${named.name} has already fallen.` });
    } else {
      targetId = named.id;
    }
  }

  if (proposal.op === 'engage') {
    if (targetId === null) return { events, rulings, softFail: true };
    const foe = working.entities.get(targetId);
    if (foe === undefined || !foe.hostile || foe.dead) {
      rule({
        kind: 'drop',
        why: 'nothing-to-fight',
        detail: 'There is no one here willing to trade blows.',
      });
      return { events, rulings, softFail: true };
    }
    if (working.mode !== 'combat') emit({ kind: 'mode', to: 'combat' });
    // Deliberately falls through to resolution. Entering combat and then discarding the
    // blow that started it would drop the player's action just as surely as the old
    // narrate_only path did, only less visibly, because the DM narrates a wound that the
    // world never takes.
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
    rule({
      kind: 'rewrite',
      why: 'difficulty-out-of-band',
      detail: `The DM called for ${dc}; the table settles on ${clamped}.`,
    });
    dc = clamped;
  }

  const outcome = roll(w.seed, w.seq, 20, 0, dc);
  emit({ kind: 'rolled', roll: outcome, actor: w.protagonist, why: proposal.ability });

  if (!outcome.success) {
    return { events, rulings, softFail: false };
  }

  if (proposal.op === 'attack' || proposal.op === 'engage') {
    let damage = proposal.damage;
    if (damage > MAX_DAMAGE) {
      rule({
        kind: 'rewrite',
        why: 'damage-out-of-band',
        detail: `The DM swung for ${damage}; the table caps it at ${MAX_DAMAGE}.`,
      });
      damage = MAX_DAMAGE;
    }
    if (damage <= 0) damage = 1;
    if (outcome.critical === 'hit') damage *= 2;

    const target = working.entities.get(targetId);
    emit({ kind: 'damaged', target: targetId, amount: damage });

    if (target !== undefined && target.hp.now - damage <= 0) {
      emit({ kind: 'died', target: targetId });

      const foesLeft = [...working.entities.values()].some(
        (e) => e.id !== working.protagonist && e.hostile && !e.dead,
      );
      if (working.mode === 'combat' && !foesLeft) emit({ kind: 'mode', to: 'exploration' });
    }
  }

  return { events, rulings, softFail: false };
}
