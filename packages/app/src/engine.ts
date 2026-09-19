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
import { apply, clockId, entityId, locationId, meter, project, vowId } from './world.ts';
import type { Clock, ClockId, Direction, Entity, EntityId, Location, LocationId, PlayerView, Vow, VowId, VowRank, World } from './world.ts';
import { generateDelve } from './mapgen.ts';

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly scene: string;
  readonly opening: string;
  readonly cast: readonly Omit<Entity, 'dead'>[];
  readonly rooms: readonly LocationDef[];
  readonly clocks: readonly ClockDef[];
  readonly vows: readonly VowDef[];
  readonly start: LocationId;
  readonly mode: World['mode'];
  /** Where the generator put the payoff. Absent for hand-authored scenarios. */
  readonly goal?: LocationId;
}

/** A vow as an author writes it. Always starts unmarked. */
export interface VowDef {
  readonly id: VowId;
  readonly what: string;
  readonly rank: VowRank;
}

/** A clock as an author writes it. Always starts empty. */
export interface ClockDef {
  readonly id: ClockId;
  readonly name: string;
  readonly kind: Clock['kind'];
  readonly segments: number;
  readonly visibility: Clock['visibility'];
  readonly payoff: string;
}

/** A room as an author writes it. Exits are plain pairs so a generator can emit them. */
export interface LocationDef {
  readonly id: LocationId;
  readonly name: string;
  readonly description: string;
  readonly exits: readonly (readonly [Direction, LocationId])[];
}

const PROTAGONIST = entityId('e_you');

const COMMON = locationId('l_common');
const CELLAR = locationId('l_cellar');
const YARD = locationId('l_yard');
const DOCK = locationId('l_dock');

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'lantern',
    title: 'The Drowned Lantern',
    scene: 'The common room of the Drowned Lantern',
    opening:
      'Rain hammers the shutters. You have been waiting two hours for a woman who deals in things the harbourmaster would rather not see. The barkeep will not meet your eye, and the one-eyed smuggler in the corner has been watching you since you sat down.',
    mode: 'exploration',
    start: COMMON,
    clocks: [
      {
        id: clockId('c_harbourmaster'),
        name: 'The harbourmaster takes an interest',
        kind: 'danger',
        segments: 6,
        visibility: 'open',
        payoff: "Boots on the step. The harbourmaster's men are here, and they are not knocking.",
      },
      {
        id: clockId('c_marga'),
        name: 'Marga decides you are worth talking to',
        kind: 'progress',
        segments: 4,
        visibility: 'open',
        payoff: 'Marga pulls out the other chair with her boot. "Sit. You have earned five minutes."',
      },
    ],
    rooms: [
      {
        id: COMMON,
        name: 'The common room of the Drowned Lantern',
        description:
          "A smugglers' tavern on the harbour. Low beams, wet coats steaming by the fire, and a bar that has seen a great deal it will not discuss. Stairs go down to the cellar, and a door lets out into the yard.",
        exits: [
          ['down', CELLAR],
          ['out', YARD],
        ],
      },
      {
        id: CELLAR,
        name: 'The cellar',
        description:
          'Barrels, most of them honest. Salt water seeps between the flagstones and something has been dragged across the floor recently. The only way out is back up.',
        exits: [['up', COMMON]],
      },
      {
        id: YARD,
        name: 'The rain-struck yard',
        description:
          'Mud, broken crates, and the smell of fish and tar. The tavern door is behind you and the harbour road runs north toward the docks.',
        exits: [
          ['in', COMMON],
          ['north', DOCK],
        ],
      },
      {
        id: DOCK,
        name: 'The harbour dock',
        description:
          'Black water slapping at the pilings. A customs lamp burns at the end of the pier, and the harbourmaster keeps a office nobody visits twice. The yard is back to the south.',
        exits: [['south', YARD]],
      },
    ],
    vows: [
      {
        id: vowId('v_debt'),
        what: 'Learn who really holds Marga\u2019s debt, and why the harbourmaster wants it kept quiet',
        rank: 'dangerous',
      },
    ],
    cast: [
      { id: PROTAGONIST, name: 'You', lore: 'A traveller with more questions than coin.', hp: meter(20, 20), hostile: false, power: 0, at: COMMON },
      { id: entityId('e_marga'), name: 'Marga', lore: 'A one-eyed smuggler. She owes the harbourmaster a debt, and she refers to herself as she.', hp: meter(12, 12), hostile: true, power: 4, at: COMMON },
      { id: entityId('e_olen'), name: 'Olen the barkeep', lore: 'He wipes the same glass over and over. Knows everything, says nothing.', hp: meter(10, 10), hostile: false, power: 0, at: COMMON },
      { id: entityId('e_customs'), name: 'A customs officer', lore: 'Bored, damp, and very interested in anyone who walks the pier after dark.', hp: meter(14, 14), hostile: false, power: 3, at: DOCK },
    ],
  },
];

export interface Session {
  readonly id: string;
  world: World;
}

/** Scenario ids a caller may ask for. Generated ones are built from the session seed. */
export const SCENARIO_IDS = ['lantern', 'delve'] as const;

/**
 * Resolves a scenario by id. A generated scenario is a pure function of the seed, which is
 * what makes it safe to persist only the id and the seed and rebuild the world later.
 */
export function scenarioFor(id: string, s: Seed): Scenario {
  if (id === 'delve') return generateDelve(s);
  return SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0]!;
}

export function begin(scenario: Scenario, s: Seed): World {
  const entities = new Map<EntityId, Entity>();
  for (const c of scenario.cast) entities.set(c.id, { ...c, dead: false });

  const locations = new Map<LocationId, Location>();
  for (const r of scenario.rooms) {
    locations.set(r.id, {
      id: r.id,
      name: r.name,
      description: r.description,
      exits: new Map(r.exits),
      visited: r.id === scenario.start,
    });
  }

  const clocks = new Map<ClockId, Clock>();
  for (const c of scenario.clocks) clocks.set(c.id, { ...c, filled: 0, done: false });

  const vows = new Map<VowId, Vow>();
  for (const v of scenario.vows) vows.set(v.id, { ...v, progress: 0, done: false });

  const empty: World = {
    seq: 0,
    seed: s,
    mode: scenario.mode,
    scene: scenario.scene,
    protagonist: PROTAGONIST,
    entities,
    locations,
    clocks,
    vows,
    here: scenario.start,
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
