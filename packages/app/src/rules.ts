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
import { apply, clockId, clueId, entityId, presentHere, reprisalActor, unfoundFor, vowId, TICKS_PER_MILESTONE, VOW_TICKS } from './world.ts';
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
const MINTED_POWER = 3;

/** How far one nominated tick moves a clock. The engine decides this, never the model. */
const TICK_SIZE = 1;

/** How hard it is for a hostile to land a blow on the player. */
export const PLAYER_DEFENCE = 12;

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

  /**
   * The DM may nominate one clock to advance. The engine decides by how much, and whether
   * the clock is real, so the model cannot invent pressure or resolve a threat early.
   */
  function applyTick(): void {
    if (proposal.tick === 'none') return;

    const target = working.clocks.get(clockId(proposal.tick));
    if (target === undefined) {
      rule({
        kind: 'drop',
        why: 'no-such-clock',
        detail: 'The DM reached for a pressure that is not in play.',
      });
      return;
    }
    // Split from the check above so each half can be mutation-tested on its own. This one
    // is what makes a clock fire its payoff exactly once however hard the DM pushes.
    if (target.done) {
      rule({
        kind: 'drop',
        why: 'clock-already-spent',
        detail: 'That threat has already arrived; it cannot arrive again.',
      });
      return;
    }

    emit({ kind: 'ticked', clock: target.id, by: TICK_SIZE, why: proposal.op });

    const after = working.clocks.get(target.id);
    if (after !== undefined && after.filled >= after.segments) {
      emit({ kind: 'filled', clock: after.id });
    }
  }

  /**
   * The world's turn. Every exit from this function goes through here, because a reprisal
   * that only runs on the success path is the rulings bug again: important behaviour
   * stranded behind an early return. The enemy acts whether or not the player's swing
   * landed, which is the entire point of having an enemy.
   */
  /**
   * A milestone claim is only honoured when the turn actually produced something. Without
   * this a narrator could walk the player to their goal on pure prose, which is the
   * yes-manning failure wearing a progress bar.
   */
  function earnedSomething(): boolean {
    return events.some(
      (e) =>
        (e.kind === 'rolled' && e.roll.success && e.actor === w.protagonist) ||
        e.kind === 'damaged' ||
        e.kind === 'died' ||
        e.kind === 'filled' ||
        e.kind === 'moved',
    );
  }

  function foundSomething(): boolean {
    return events.some((e) => e.kind === 'found');
  }

  /**
   * Reveal a clue, if the DM named one that is actually here and actually unfound.
   *
   * Runs before the milestone check, because finding a thing is what earns ground on a
   * vow that still has things to find.
   */
  function applyReveal(): void {
    if (proposal.reveals === 'none') return;

    /**
     * Mode as it was at the START of the turn, which is the mode the DM was briefed on.
     * Reading `working` instead would refuse the discovery on the very turn a fight
     * begins, because `engage` has already flipped the mode by the time this runs, and
     * the DM would be punished for an answer the schema had offered it.
     *
     * Checked before the clue is resolved at all: if there is no time to look for
     * anything, which thing was named does not matter, and "no time" is the more useful
     * thing to tell the player than "not here".
     */
    if (w.mode === 'combat') {
      rule({
        kind: 'drop',
        why: 'no-searching-mid-fight',
        detail: 'There is no time to go looking for anything with this going on.',
      });
      return;
    }

    const clue = working.clues.get(clueId(proposal.reveals));
    if (clue === undefined || clue.found) {
      rule({
        kind: 'drop',
        why: 'no-such-clue',
        detail: 'The DM offered up something that was not there to find.',
      });
      return;
    }
    // Split from the check above so each half is mutation-testable on its own. This one
    // is what stops the DM handing over evidence from a room the player is not in.
    if (clue.at !== working.here) {
      rule({
        kind: 'drop',
        why: 'clue-elsewhere',
        detail: 'That is not something you could have found here.',
      });
      return;
    }

    emit({ kind: 'found', clue: clue.id });
  }

  function applyMilestone(): void {
    if (proposal.milestone === 'none') return;

    const vow = working.vows.get(vowId(proposal.milestone));
    if (vow === undefined || vow.done) {
      rule({
        kind: 'drop',
        why: 'no-such-vow',
        detail: 'The DM claimed ground on something you never swore to.',
      });
      return;
    }
    /**
     * The three-clue rule, enforced. While a vow still has clues waiting to be found,
     * the ONLY thing that advances it is finding one. Winning a fight does not teach you
     * who holds the debt.
     *
     * Once every clue is found the vow falls back to the general earned-something test,
     * because by then the remaining work is acting on what you know rather than learning
     * more, and there is nothing left to discover.
     */
    const stillHidden = unfoundFor(working, vow.id).length > 0;
    if (stillHidden && !foundSomething()) {
      rule({
        kind: 'drop',
        why: 'unearned-milestone',
        detail: 'You are no closer. Nothing you did this turn told you anything new.',
      });
      return;
    }
    if (!stillHidden && !earnedSomething()) {
      rule({
        kind: 'drop',
        why: 'unearned-milestone',
        detail: 'Talking about it is not the same as doing it.',
      });
      return;
    }

    emit({
      kind: 'progressed',
      vow: vow.id,
      by: TICKS_PER_MILESTONE[vow.rank],
      why: proposal.op,
    });

    const after = working.vows.get(vow.id);
    if (after !== undefined && after.progress >= VOW_TICKS) {
      emit({ kind: 'fulfilled', vow: after.id });
    }
  }

  function finish(softFail: boolean): Adjudication {
    // Clocks advance before the world's turn, so a tick that fills a danger clock lands
    // before the foe swings rather than after the dust has settled.
    applyTick();
    // Discovery before milestones, because finding a thing is what earns ground on a vow
    // that still has things to find.
    applyReveal();
    // Milestones last, because they judge what the rest of the turn produced.
    applyMilestone();

    if (working.mode === 'combat') {
      const you = working.entities.get(working.protagonist);
      if (you !== undefined && !you.dead) {
        const foe = reprisalActor(working);
        if (foe !== undefined) {
          const swing = roll(working.seed, working.seq, 20, 0, PLAYER_DEFENCE);
          emit({ kind: 'rolled', roll: swing, actor: foe.id, why: 'reprisal' });

          if (swing.success) {
            const base = Math.max(1, Math.min(foe.power, MAX_DAMAGE));
            const hurt = swing.critical === 'hit' ? base * 2 : base;
            emit({ kind: 'damaged', target: working.protagonist, amount: hurt });

            const left = working.entities.get(working.protagonist);
            if (left !== undefined && left.hp.now <= 0) {
              emit({ kind: 'died', target: working.protagonist });
              emit({ kind: 'mode', to: 'exploration' });
            }
          }
        }
      }
    }
    return { events, rulings, softFail };
  }

  emit({ kind: 'narrated', text: scrubTokens(proposal.narration, w) });

  /**
   * `move` and `narrate_only` do not act on anybody. The schema still forces the target
   * field to be filled, so whatever sits in it on those turns is noise, and resolving it
   * produced a ruling on every walk into an empty room. Ruling on a field the op never
   * reads trains the player to scroll past rulings, which costs the one mechanism that
   * makes the engine's authority visible.
   */
  const opReadsTarget = proposal.op !== 'move' && proposal.op !== 'narrate_only';

  let targetId: EntityId | null = null;

  if (opReadsTarget) {
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
          power: proposal.introduces.hostile ? MINTED_POWER : 0,
          at: working.here,
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
  }

  if (proposal.op === 'engage') {
    if (targetId === null) return finish(true);
    const foe = working.entities.get(targetId);
    if (foe === undefined || !foe.hostile || foe.dead) {
      rule({
        kind: 'drop',
        why: 'nothing-to-fight',
        detail: 'There is no one here willing to trade blows.',
      });
      return finish(true);
    }
    if (working.mode !== 'combat') emit({ kind: 'mode', to: 'combat' });
    // Deliberately falls through to resolution. Entering combat and then discarding the
    // blow that started it would drop the player's action just as surely as the old
    // narrate_only path did, only less visibly, because the DM narrates a wound that the
    // world never takes.
  }

  if (proposal.op === 'move') {
    const place = working.locations.get(working.here);
    const dest = place?.exits.get(proposal.direction);
    if (dest === undefined) {
      rule({
        kind: 'drop',
        why: 'no-such-exit',
        detail: `There is no way ${proposal.direction} from here.`,
      });
      return finish(true);
    }
    // Named rather than inline so the mutation harness can target this rule specifically.
    // The bare mode check appears three times in this file.
    const pinned = working.mode === 'combat';
    if (pinned) {
      rule({
        kind: 'drop',
        why: 'pinned-in-combat',
        detail: 'You are too closely engaged to simply walk away.',
      });
      return finish(true);
    }
    emit({ kind: 'moved', to: dest, via: proposal.direction });
    return finish(false);
  }

  if (proposal.op === 'narrate_only' || proposal.op === 'introduce' || proposal.op === 'talk') {
    return finish(false);
  }

  // Only violence needs a real target. A skill check is the player attempting something
  // against a difficulty, so a bad target should not cost them the turn. Telemetry showed
  // the DM picking a mint slot for a quiet bribe and the whole turn being thrown away.
  if (targetId === null && (proposal.op === 'attack' || proposal.op === 'engage')) {
    return finish(true);
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
    return finish(false);
  }

  if ((proposal.op === 'attack' || proposal.op === 'engage') && targetId !== null) {
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

  return finish(false);
}
