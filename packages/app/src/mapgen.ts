/**
 * Generates a delve: a connected graph of rooms with loops, a goal placed far from the
 * entrance, and prose drawn from authored tables.
 *
 * Graph first, geometry second. The research on this is blunt: the thing that makes a
 * dungeon worth exploring is its TOPOLOGY, not its floorplan. A spanning tree produces a
 * corridor you walk down and back; the loops are what create choice, flanking, and the
 * feeling of a place rather than a queue. That is Jaquaysing, and it costs one extra pass.
 *
 * Everything is a pure function of the seed, so a generated scenario rebuilds identically
 * from its id and seed. That matters more here than anywhere else in the codebase: the
 * store persists a scenario id and a seed, not the rooms, so a session that regenerated a
 * different dungeon on reload would lose the player's world.
 *
 * Randomness is curated, not raw. Rooms draw their prose from tables keyed by the role the
 * graph gave them, which is the difference between a table that produces a story and one
 * that produces noise.
 */

import type { Seed } from './dice.ts';
import { locationId, entityId, clockId, clueId, vowId, meter } from './world.ts';
import type { Direction, Entity, LocationId } from './world.ts';
import type { ClockDef, ClueDef, LocationDef, Scenario, VowDef } from './engine.ts';

/** Deterministic stream. Same seed, same delve, forever. */
function stream(s: Seed): () => number {
  let a = (s ^ 0x6d2b79f5) >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cell = { readonly x: number; readonly y: number };

const key = (c: Cell) => `${c.x},${c.y}`;

const HEADINGS: readonly { readonly dir: Direction; readonly dx: number; readonly dy: number }[] = [
  { dir: 'north', dx: 0, dy: -1 },
  { dir: 'south', dx: 0, dy: 1 },
  { dir: 'east', dx: 1, dy: 0 },
  { dir: 'west', dx: -1, dy: 0 },
];

const OPPOSITE: Record<Direction, Direction> = {
  north: 'south', south: 'north', east: 'west', west: 'east',
  up: 'down', down: 'up', in: 'out', out: 'in',
};

/** Role comes from the graph, and prose comes from the role. Noise becomes character. */
type Role = 'entrance' | 'junction' | 'passage' | 'deadend' | 'goal';

const ROOMS: Record<Role, readonly { readonly name: string; readonly description: string }[]> = {
  entrance: [
    { name: 'The collapsed stair', description: 'Daylight, or something like it, leaks through the rubble you came down. Going back up is not an option worth considering twice.' },
    { name: 'The flooded landing', description: 'Ankle-deep water, cold as a debt. Your own ripples keep moving after you stop.' },
  ],
  junction: [
    { name: 'The cistern', description: 'A drum of a room. Every footfall comes back to you a half-second late, and from the wrong direction.' },
    { name: 'The broken rotunda', description: 'Pillars that used to hold something up. Whatever it was has been carried off in pieces.' },
    { name: 'The knot', description: 'Ways out in more directions than the place seems wide enough to allow.' },
  ],
  passage: [
    { name: 'The weeping corridor', description: 'Salt runs down the walls in slow white lines. It has been doing so for a very long time.' },
    { name: 'The lamp room', description: 'Brackets for a dozen lamps and oil for none. Someone stripped this place carefully.' },
    { name: 'The low crawl', description: 'You go through on your hands. Whatever made this passage was not walking.' },
    { name: 'The counting room', description: 'Ledger shelves, all empty, all recently dusted. That is the part that bothers you.' },
  ],
  deadend: [
    { name: 'The bricked arch', description: 'A doorway filled in from the far side. The mortar is newer than the wall.' },
    { name: 'The dry well', description: 'It goes down further than your light goes. Nothing answers when you speak into it.' },
    { name: 'The store', description: 'Crates, mostly broken open. Someone was looking for one specific thing and did not care about the rest.' },
  ],
  goal: [
    { name: "The harbourmaster's other office", description: 'Not the one on the pier. This one has the real ledgers, and a chair set facing the door.' },
    { name: 'The strongroom', description: 'A door built to keep people out, standing open. That is worse than finding it locked.' },
  ],
};

const FOES: readonly { readonly name: string; readonly lore: string; readonly hp: number; readonly power: number }[] = [
  { name: 'A wharf-rat with a knife', lore: 'Paid in coin so small it insults them. They are still going to try.', hp: 8, power: 3 },
  { name: 'The ledger-keeper', lore: 'Neat, unarmed-looking, and entirely willing. Knows exactly who you are.', hp: 12, power: 4 },
  { name: 'Something that was a dockhand', lore: 'It still wears the coat. It does not still wear the face.', hp: 14, power: 5 },
];

export interface DelveOptions {
  readonly rooms?: number;
  /** Extra edges beyond a spanning tree, as a fraction. Zero makes a boring corridor. */
  readonly loopiness?: number;
}

export function generateDelve(s: Seed, opts: DelveOptions = {}): Scenario {
  const rnd = stream(s);
  const want = opts.rooms ?? 9;
  const loopiness = opts.loopiness ?? 0.35;
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

  // 1. Grow a COMPACT blob. Each step considers several candidate positions and prefers the
  //    one already touching the most existing rooms.
  //
  //    Naive growth produced snake-shaped blobs with no spare adjacencies, so the later
  //    Jaquays pass had nothing to work with and 38 seeds in 400 came out as pure trees. A
  //    property test caught it; compactness is what actually fixes it, because loops need
  //    somewhere to exist before they can be added.
  const cells: Cell[] = [{ x: 0, y: 0 }];
  const taken = new Set([key(cells[0]!)]);
  const neighbourCount = (c: Cell) =>
    HEADINGS.filter((h) => taken.has(key({ x: c.x + h.dx, y: c.y + h.dy }))).length;

  while (cells.length < want) {
    let best: Cell | null = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 8; attempt++) {
      const from = cells[Math.floor(rnd() * cells.length)]!;
      const h = HEADINGS[Math.floor(rnd() * HEADINGS.length)]!;
      const next = { x: from.x + h.dx, y: from.y + h.dy };
      if (taken.has(key(next))) continue;
      const score = neighbourCount(next);
      if (score > bestScore) {
        bestScore = score;
        best = next;
      }
    }
    if (best === null) continue;
    taken.add(key(best));
    cells.push(best);
  }

  // 2. Spanning tree first, so the delve is always fully connected.
  const edges = new Set<string>();
  const linked = new Set([key(cells[0]!)]);
  const edgeKey = (a: Cell, b: Cell) => [key(a), key(b)].sort().join('|');

  while (linked.size < cells.length) {
    const outside = cells.filter((c) => !linked.has(key(c)));
    let joined = false;
    for (const c of outside) {
      const neighbours = HEADINGS
        .map((h) => ({ x: c.x + h.dx, y: c.y + h.dy }))
        .filter((n) => linked.has(key(n)));
      if (neighbours.length === 0) continue;
      edges.add(edgeKey(c, pick(neighbours)));
      linked.add(key(c));
      joined = true;
      break;
    }
    // A cell with no linked neighbour cannot be reached; drop it rather than loop forever.
    if (!joined) break;
  }
  const reachable = cells.filter((c) => linked.has(key(c)));
  // 3. Jaquays pass. Extra edges turn a corridor into a place with choices in it.
  const candidateEdges = () => {
    const out: [Cell, Cell][] = [];
    for (const c of reachable) {
      for (const h of HEADINGS) {
        const n = { x: c.x + h.dx, y: c.y + h.dy };
        if (!linked.has(key(n))) continue;
        if (edges.has(edgeKey(c, n))) continue;
        out.push([c, n]);
      }
    }
    return out;
  };

  let candidates = candidateEdges();

  // Compact growth makes spare adjacencies almost certain, but "almost" left one seed in
  // two thousand as a pure corridor. When there is genuinely nowhere to put a loop, bolt on
  // one more room that touches two existing ones, which creates a loop by construction.
  if (candidates.length === 0 && loopiness > 0) {
    const bridge = [...taken]
      .flatMap((k) => {
        const [x, y] = k.split(',').map(Number) as [number, number];
        return HEADINGS.map((h) => ({ x: x + h.dx, y: y + h.dy }));
      })
      .filter((c) => !taken.has(key(c)))
      .find((c) => HEADINGS.filter((h) => linked.has(key({ x: c.x + h.dx, y: c.y + h.dy }))).length >= 2);

    if (bridge !== undefined) {
      taken.add(key(bridge));
      linked.add(key(bridge));
      reachable.push(bridge);
      for (const h of HEADINGS) {
        const n = { x: bridge.x + h.dx, y: bridge.y + h.dy };
        if (linked.has(key(n))) edges.add(edgeKey(bridge, n));
      }
      candidates = candidateEdges();
    }
  }
  // At least one extra edge whenever any is available. Rounding a small candidate count
  // down to zero silently produced a spanning tree on some seeds, which is a corridor you
  // walk down and back rather than a place with choices in it. A property test caught it.
  const extra = loopiness <= 0 ? 0 : Math.max(1, Math.floor(candidates.length * loopiness));
  for (let i = 0; i < extra && candidates.length > 0; i++) {
    const [a, b] = candidates.splice(Math.floor(rnd() * candidates.length), 1)[0]!;
    edges.add(edgeKey(a, b));
  }

  // 4. Degree decides role, and role decides prose.
  const degree = new Map<string, number>();
  for (const e of edges) for (const half of e.split('|')) degree.set(half, (degree.get(half) ?? 0) + 1);

  const start = reachable[0]!;
  const far = farthest(start, edges, reachable);

  const used = new Set<string>();
  const uniquePick = (role: Role) => {
    const pool = ROOMS[role].filter((r) => !used.has(r.name));
    const chosen = pool.length > 0 ? pick(pool) : pick(ROOMS[role]);
    used.add(chosen.name);
    return chosen;
  };

  const idOf = new Map<string, LocationId>();
  reachable.forEach((c, i) => idOf.set(key(c), locationId(`l_${i}`)));

  const rooms: LocationDef[] = reachable.map((c) => {
    const k = key(c);
    const d = degree.get(k) ?? 0;
    const role: Role =
      k === key(start) ? 'entrance' : k === key(far) ? 'goal' : d >= 3 ? 'junction' : d === 1 ? 'deadend' : 'passage';
    const flavour = uniquePick(role);

    const exits: [Direction, LocationId][] = [];
    for (const h of HEADINGS) {
      const n = { x: c.x + h.dx, y: c.y + h.dy };
      if (!edges.has(edgeKey(c, n))) continue;
      const to = idOf.get(key(n));
      if (to !== undefined) exits.push([h.dir, to]);
    }

    return { id: idOf.get(k)!, name: flavour.name, description: flavour.description, exits };
  });

  // 5. Populate. The protagonist at the entrance, one foe deeper in, never in the doorway.
  const startId = idOf.get(key(start))!;
  const goalId = idOf.get(key(far))!;
  const elsewhere = reachable.filter((c) => key(c) !== key(start));

  const cast: Omit<Entity, 'dead'>[] = [
    { id: entityId('e_you'), name: 'You', lore: 'A traveller with more questions than coin.', hp: meter(20, 20), hostile: false, power: 0, at: startId },
  ];
  const foeCount = Math.max(1, Math.round(reachable.length / 5));
  for (let i = 0; i < foeCount && elsewhere.length > 0; i++) {
    const spot = elsewhere.splice(Math.floor(rnd() * elsewhere.length), 1)[0]!;
    const f = pick(FOES);
    cast.push({
      id: entityId(`e_foe${i}`),
      name: f.name,
      lore: f.lore,
      hp: meter(f.hp, f.hp),
      hostile: true,
      power: f.power,
      at: idOf.get(key(spot))!,
    });
  }

  const clocks: ClockDef[] = [
    {
      id: clockId('c_pursuit'),
      name: 'Something below notices you',
      kind: 'danger',
      segments: 6,
      visibility: 'open',
      payoff: 'The noise behind you stops pretending to be water.',
    },
  ];

  const vows: VowDef[] = [
    {
      id: vowId('v_ledger'),
      what: 'Find the real ledgers and learn who the harbourmaster answers to',
      rank: 'dangerous',
    },
  ];

  /**
   * Three clues, in three different rooms, never in the entrance.
   *
   * Three is the floor the three-clue rule sets, and it is a floor for a structural
   * reason rather than a stylistic one: the vow cannot advance without a discovery, so a
   * generator that placed one clue would build delves that deadlock whenever the player
   * misses that single room. Placing them in distinct rooms is the half that matters,
   * since three clues in one room is one room's worth of chances.
   */
  const clueSpots = [...elsewhere];
  const CLUE_TEXT = [
    'A ledger leaf, water-blurred but legible: the same cargo entered this port twice and left once.',
    'A tally scratched into the wall counts deliveries nobody recorded upstairs.',
    'A signet pressed into old wax, and it is not the harbourmaster\u2019s mark.',
  ];
  const clues: ClueDef[] = [];
  for (let i = 0; i < CLUE_TEXT.length && clueSpots.length > 0; i++) {
    const spot = clueSpots.splice(Math.floor(rnd() * clueSpots.length), 1)[0]!;
    clues.push({
      id: clueId(`c_lead_${i + 1}`),
      what: CLUE_TEXT[i]!,
      at: idOf.get(key(spot))!,
      vow: vowId('v_ledger'),
    });
  }

  const opening = rooms.find((r) => r.id === startId)!;

  return {
    id: 'delve',
    title: 'The undercroft',
    scene: opening.name,
    opening: `${opening.description} Somewhere below and ahead of you are the ledgers you came for, and the way out is not the way you came in.`,
    mode: 'exploration',
    start: startId,
    rooms,
    clocks,
    vows,
    clues,
    cast,
    // Kept so a caller can assert the goal is reachable and distant, which is the whole
    // point of placing it by graph distance rather than at random.
    goal: goalId,
  };
}

/** Breadth-first, so the goal sits as many doors from the entrance as the graph allows. */
function farthest(from: Cell, edges: ReadonlySet<string>, cells: readonly Cell[]): Cell {
  const byKey = new Map(cells.map((c) => [key(c), c]));
  const seen = new Map<string, number>([[key(from), 0]]);
  const queue: Cell[] = [from];
  let best = from;

  while (queue.length > 0) {
    const c = queue.shift()!;
    const d = seen.get(key(c)) ?? 0;
    if (d > (seen.get(key(best)) ?? 0)) best = c;
    for (const h of HEADINGS) {
      const n = { x: c.x + h.dx, y: c.y + h.dy };
      const nk = key(n);
      if (seen.has(nk) || !byKey.has(nk)) continue;
      if (!edges.has([key(c), nk].sort().join('|'))) continue;
      seen.set(nk, d + 1);
      queue.push(byKey.get(nk)!);
    }
  }
  return best;
}

export { OPPOSITE };
