/**
 * The turn as a unit of atomicity.
 *
 * The guarantee this module owns and no other can make: the turn always settles. Whatever
 * the model did, the session ends the turn with a consistent world and something to read.
 */

import { seed } from './dice.ts';
import type { Seed } from './dice.ts';
import { DirectorContractBreach, briefFor } from './director.ts';
import type { Director } from './director.ts';
import { adjudicate } from './rules.ts';
import { apply, entityId, meter, project } from './world.ts';
import type { Entity, EntityId, PlayerView, World } from './world.ts';

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly scene: string;
  readonly opening: string;
  readonly cast: readonly Omit<Entity, 'dead'>[];
  readonly mode: World['mode'];
}

const PROTAGONIST = entityId('e_you');

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'lantern',
    title: 'The Drowned Lantern',
    scene: 'The common room of the Drowned Lantern, a smugglers\' tavern on the harbour.',
    opening:
      'Rain hammers the shutters. You have been waiting two hours for a woman who deals in things the harbourmaster would rather not see. The barkeep will not meet your eye, and the one-eyed smuggler in the corner has been watching you since you sat down.',
    mode: 'exploration',
    cast: [
      { id: PROTAGONIST, name: 'You', lore: 'A traveller with more questions than coin.', hp: meter(20, 20), hostile: false, power: 0 },
      { id: entityId('e_marga'), name: 'Marga', lore: 'A one-eyed smuggler. She owes the harbourmaster a debt, and she refers to herself as she.', hp: meter(12, 12), hostile: true, power: 4 },
      { id: entityId('e_olen'), name: 'Olen the barkeep', lore: 'He wipes the same glass over and over. Knows everything, says nothing.', hp: meter(10, 10), hostile: false, power: 0 },
    ],
  },
];

export interface Session {
  readonly id: string;
  world: World;
}

export function begin(scenario: Scenario, s: Seed): World {
  const entities = new Map<EntityId, Entity>();
  for (const c of scenario.cast) entities.set(c.id, { ...c, dead: false });

  const empty: World = {
    seq: 0,
    seed: s,
    mode: scenario.mode,
    scene: scenario.scene,
    protagonist: PROTAGONIST,
    entities,
    log: [],
  };

  return apply(empty, { kind: 'began', scene: scenario.scene, narration: scenario.opening });
}

export interface TurnResult {
  readonly view: PlayerView;
  readonly softFail: boolean;
  readonly breach: string | null;
}

export async function takeTurn(session: Session, utterance: string, director: Director): Promise<TurnResult> {
  const brief = briefFor(session.world, utterance);
  session.world = apply(session.world, { kind: 'said', text: utterance });

  let proposal;
  try {
    proposal = await director.propose(brief);
  } catch (e) {
    // The turn settles anyway. A broken transport is an operator problem, never a dead end
    // for the player, so the world advances with a diegetic stall and the log records why.
    const breach = e instanceof DirectorContractBreach ? e.message : String(e);
    session.world = apply(session.world, {
      kind: 'narrated',
      text: 'The tale falters, as though the teller has lost the thread. Try again.',
    });
    session.world = apply(session.world, { kind: 'ruled', why: 'director-unreachable', detail: breach });
    return { view: project(session.world), softFail: true, breach };
  }

  const { events, softFail } = adjudicate(session.world, brief, proposal);
  session.world = apply(session.world, {
    kind: 'proposed',
    op: proposal.op,
    target: proposal.target,
    difficulty: proposal.difficulty,
    damage: proposal.damage,
  });
  for (const e of events) session.world = apply(session.world, e);

  return { view: project(session.world), softFail, breach: null };
}

export function newSeed(): Seed {
  return seed(Math.floor(Math.random() * 0xffffffff));
}
