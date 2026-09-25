/**
 * Property tests for the delve generator.
 *
 * A generator is tested by properties, not examples. "Room 3 is called the cistern" is
 * worthless; "every room is reachable and the graph has loops" is the thing that decides
 * whether the place is worth walking through.
 *
 * Determinism gets the most attention here because the store persists only a scenario id
 * and a seed. If the same seed produced a different dungeon, a player's world would change
 * under them on reload.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seed } from '../src/dice.ts';
import { generateDelve } from '../src/mapgen.ts';
import { briefFor, buildSchema, wanderingDirector } from '../src/director.ts';
import type { Director, Proposal, SceneBrief } from '../src/director.ts';
import { begin, scenarioFor, takeTurn } from '../src/engine.ts';
import { project } from '../src/world.ts';
import type { Direction, LocationId } from '../src/world.ts';

const OPPOSITE: Record<string, Direction> = {
  north: 'south', south: 'north', east: 'west', west: 'east',
};

const SEEDS = [1, 2, 7, 42, 1234, 20260919, 999999];

test('the wandering DM can drive any scenario, including generated ones', async () => {
  // scriptedDirector returns fixed proposals, so its script is welded to one scenario.
  // Pointed at a delve it names a smuggler who is not there and every turn is refused.
  // This one reads the brief, so it works anywhere.
  const delve = scenarioFor('delve', seed(4242));
  const s = { id: 't', world: begin(delve, seed(4242)) };
  const dm = wanderingDirector();

  let refusals = 0;
  for (let i = 0; i < 8; i++) {
    const before = s.world.log.length;
    await takeTurn(s, 'onward', dm);
    refusals += s.world.log
      .slice(before)
      .filter((e) => e.kind === 'ruled' && (e.why === 'absent-target' || e.why === 'no-such-clock')).length;
  }

  assert.equal(refusals, 0, 'a brief-reading DM should never name something that is not there');
  assert.ok(
    s.world.log.some((e) => e.kind === 'moved') || s.world.log.some((e) => e.kind === 'rolled'),
    'and it should actually do something',
  );

  // The specific thing reading the brief buys: it fights what is actually in the room.
  // Without that it merely wanders, which passes every check above.
  const tavern = { id: 't2', world: begin(scenarioFor('lantern', seed(9)), seed(9)) };
  await takeTurn(tavern, 'I face her', wanderingDirector());
  assert.ok(
    tavern.world.log.some((e) => e.kind === 'mode' && e.to === 'combat'),
    'a hostile in the room must be engaged, not walked past',
  );
});

test('no delve pins the player in a fight with nobody left to fight', async () => {
  const pinned: number[] = [];
  for (let n = 1; n <= 60; n++) {
    const s = seed(n * 7919);
    const session = { id: 't', world: begin(scenarioFor('delve', s), s) };
    const dm = wanderingDirector();
    for (let turn = 0; turn < 40 && project(session.world).outcome === 'playing'; turn++) {
      await takeTurn(session, 'onward', dm);
      const w = session.world;
      const foeHere = [...w.entities.values()].some((e) => e.hostile && !e.dead && e.at === w.here);
      if (w.mode === 'combat' && !foeHere) {
        pinned.push(n);
        break;
      }
    }
  }
  assert.deepEqual(pinned, [], 'a fight with no foe in the room is a softlock, since moving is refused mid-fight');
});

function schemaBreaches(brief: SceneBrief, p: Proposal): string[] {
  const props = (buildSchema(brief) as { properties: Record<string, { enum?: readonly unknown[] }> }).properties;
  const fields = ['op', 'target', 'direction', 'ability', 'tick', 'milestone', 'reveals'] as const;
  return fields.filter((f) => !props[f]!.enum!.includes(p[f])).map((f) => `${f}=${String(p[f])} (${brief.mode}${brief.outOfCharacter ? ', aside' : ''})`);
}

test('the wandering DM never proposes what the schema would forbid', async () => {
  const breaches: string[] = [];
  const says = ['onward', 'I search the walls', '// wait, where am I?', 'I strike', 'ooc: what was that noise?'];
  const worlds = [
    { id: 'l', world: begin(scenarioFor('lantern', seed(9)), seed(9)) },
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `d${n}`, world: begin(scenarioFor('delve', seed(n * 131)), seed(n * 131)) })),
  ];
  for (const s of worlds) {
    const inner = wanderingDirector();
    const dm: Director = {
      name: 'checked',
      async propose(brief) {
        const p = await inner.propose(brief);
        breaches.push(...schemaBreaches(brief, p));
        return p;
      },
    };
    for (let turn = 0; turn < 30 && project(s.world).outcome === 'playing'; turn++) {
      await takeTurn(s, says[turn % says.length]!, dm);
    }
  }
  assert.deepEqual([...new Set(breaches)], [], 'a model-free DM that breaks the schema tests a game the real one cannot play');
});

test('the wandering DM stays inside the schema in a fight it cannot find', async () => {
  const w = begin(scenarioFor('lantern', seed(9)), seed(9));
  const alone = { ...w, mode: 'combat' as const, entities: new Map([[w.protagonist, w.entities.get(w.protagonist)!]]) };
  const brief = briefFor(alone, 'I look for them');
  const p = await wanderingDirector().propose(brief);
  assert.deepEqual(schemaBreaches(brief, p), []);
});

test('the same seed always produces the same delve', () => {
  for (const s of SEEDS) {
    const a = generateDelve(seed(s));
    const b = generateDelve(seed(s));
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), `seed ${s} drifted`);
  }
});

test('different seeds produce different delves', () => {
  const shapes = new Set(SEEDS.map((s) => JSON.stringify(generateDelve(seed(s)).rooms)));
  assert.ok(shapes.size > 1, 'the generator must actually vary');
});

test('every room is reachable from the entrance', () => {
  for (const s of SEEDS) {
    const d = generateDelve(seed(s));
    const byId = new Map(d.rooms.map((r) => [r.id, r]));

    const seen = new Set<LocationId>([d.start]);
    const queue: LocationId[] = [d.start];
    while (queue.length > 0) {
      for (const [, to] of byId.get(queue.shift()!)?.exits ?? []) {
        if (seen.has(to)) continue;
        seen.add(to);
        queue.push(to);
      }
    }

    assert.equal(seen.size, d.rooms.length, `seed ${s} stranded ${d.rooms.length - seen.size} room(s)`);
  }
});

test('exits are symmetric, so you can always walk back', () => {
  for (const s of SEEDS) {
    const d = generateDelve(seed(s));
    const byId = new Map(d.rooms.map((r) => [r.id, r]));

    for (const room of d.rooms) {
      for (const [dir, to] of room.exits) {
        const other = byId.get(to);
        assert.ok(other, `seed ${s}: ${room.id} exits to a room that does not exist`);
        const back = other.exits.find(([d2, t2]) => t2 === room.id && d2 === OPPOSITE[dir]);
        assert.ok(back, `seed ${s}: ${room.id} goes ${dir} to ${to}, but there is no way back`);
      }
    }
  }
});

test('compact growth buys real loops, not just the one the fallback guarantees', () => {
  // The bridge fallback guarantees at least one loop, so "has a loop" cannot tell whether
  // growth is compact. What compactness actually buys is MORE ways round, so measure that.
  let richer = 0;
  const sample = 300;
  for (let s = 1; s <= sample; s++) {
    const d = generateDelve(seed(s));
    const edges = d.rooms.reduce((n, r) => n + r.exits.length, 0) / 2;
    if (edges - (d.rooms.length - 1) >= 2) richer++;
  }
  assert.ok(
    richer > sample * 0.3,
    `only ${richer}/${sample} delves had two or more ways round, which means growth stopped being compact`,
  );
});

test('the graph has loops, because a spanning tree is a corridor', () => {
  // Deliberately wide. The first version of this test used seven seeds and passed while
  // 38 seeds in 400 were still producing pure corridors. A generator property needs a
  // sample big enough to catch the rare shape, not a handful of convenient ones.
  let trees = 0;
  for (let s = 1; s <= 600; s++) {
    const d = generateDelve(seed(s));
    const edges = d.rooms.reduce((n, r) => n + r.exits.length, 0) / 2;
    if (edges <= d.rooms.length - 1) trees++;
  }
  assert.equal(trees, 0, `${trees} of 600 seeds produced a corridor rather than a place`);
});

test('every room is reachable across a wide sample, not just a lucky few', () => {
  for (let s = 1; s <= 300; s++) {
    const d = generateDelve(seed(s));
    const byId = new Map(d.rooms.map((r) => [r.id, r]));
    const seen = new Set<LocationId>([d.start]);
    const queue: LocationId[] = [d.start];
    while (queue.length > 0) {
      for (const [, to] of byId.get(queue.shift()!)?.exits ?? []) {
        if (seen.has(to)) continue;
        seen.add(to);
        queue.push(to);
      }
    }
    assert.equal(seen.size, d.rooms.length, `seed ${s} stranded a room`);
  }
});

test('the goal is placed far from the door, not next to it', () => {
  for (const s of SEEDS) {
    const d = generateDelve(seed(s));
    assert.ok(d.goal, 'the generator must say where the payoff is');
    assert.notEqual(d.goal, d.start, `seed ${s} put the goal in the entrance`);

    const byId = new Map(d.rooms.map((r) => [r.id, r]));
    const dist = new Map<LocationId, number>([[d.start, 0]]);
    const queue: LocationId[] = [d.start];
    while (queue.length > 0) {
      const at = queue.shift()!;
      for (const [, to] of byId.get(at)?.exits ?? []) {
        if (dist.has(to)) continue;
        dist.set(to, (dist.get(at) ?? 0) + 1);
        queue.push(to);
      }
    }
    assert.ok((dist.get(d.goal) ?? 0) >= 2, `seed ${s} put the goal ${dist.get(d.goal)} door(s) away`);
  }
});

test('the player starts at the entrance and nothing hostile shares it', () => {
  for (const s of SEEDS) {
    const d = generateDelve(seed(s));
    const you = d.cast.find((c) => c.id === 'e_you');
    assert.ok(you, 'there must be a protagonist');
    assert.equal(you.at, d.start);

    const ambush = d.cast.filter((c) => c.hostile && c.at === d.start);
    assert.equal(ambush.length, 0, `seed ${s} put a foe in the doorway`);
  }
});

test('a delve has something to fight and something to achieve', () => {
  for (const s of SEEDS) {
    const d = generateDelve(seed(s));
    assert.ok(d.cast.some((c) => c.hostile), `seed ${s} has no opposition`);
    assert.ok(d.vows.length > 0, `seed ${s} has no point`);
    assert.ok(d.clocks.length > 0, `seed ${s} has no pressure`);
  }
});

test('room prose is drawn from the tables rather than repeated', () => {
  const d = generateDelve(seed(4242), { rooms: 9 });
  const names = d.rooms.map((r) => r.name);
  assert.equal(new Set(names).size, names.length, 'a delve should not reuse a room name');
  for (const r of d.rooms) {
    assert.ok(r.description.length > 40, `${r.name} has no prose worth reading`);
  }
});

test('a generated scenario rebuilds identically from its id and seed', () => {
  // This is the property the persistence layer depends on. The store keeps only these two
  // values, so if this drifts a player's world changes under them on reload.
  for (const s of SEEDS) {
    const first = project(begin(scenarioFor('delve', seed(s)), seed(s)));
    const again = project(begin(scenarioFor('delve', seed(s)), seed(s)));
    assert.deepEqual(first, again, `seed ${s} rebuilt into a different world`);
  }
});

test('the map still only shows where the player has been', () => {
  const d = generateDelve(seed(77));
  const view = project(begin(d, seed(77)));
  assert.equal(view.map.length, 1, 'a fresh delve reveals exactly the room you stand in');
  assert.equal(view.map[0]!.here, true);
  assert.ok(view.exits.length > 0, 'and there is somewhere to go');
});

test('loopiness zero really does produce a tree, so the knob works', () => {
  const d = generateDelve(seed(5), { loopiness: 0 });
  const edges = d.rooms.reduce((n, r) => n + r.exits.length, 0) / 2;
  assert.equal(edges, d.rooms.length - 1, 'with no extra edges the graph must be a spanning tree');
});
