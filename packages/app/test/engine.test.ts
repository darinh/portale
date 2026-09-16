/**
 * The whole suite runs with no GPU and no model. That is the point of the Director seam:
 * the DM is a constructor argument, so the rules can be driven by a script that cannot
 * vary. Every assertion here is about what the ENGINE does with what the DM proposed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { roll, seed } from '../src/dice.ts';
import { scriptedDirector, briefFor, buildSchema, MINT_SLOTS } from '../src/director.ts';
import type { Proposal } from '../src/director.ts';
import { SCENARIOS, begin, takeTurn } from '../src/engine.ts';
import type { Session } from '../src/engine.ts';
import { adjudicate } from '../src/rules.ts';
import { apply, entityId, fold, meter, project } from '../src/world.ts';

const SCENARIO = SCENARIOS[0]!;
const MARGA = entityId('e_marga');

function proposal(over: Partial<Proposal> = {}): Proposal {
  return {
    narration: 'The lamplight gutters.',
    op: 'attack',
    target: MARGA,
    ability: 'dexterity',
    difficulty: 12,
    damage: 4,
    introduces: null,
    ...over,
  };
}

function session(): Session {
  return { id: 'test', world: begin(SCENARIO, seed(42)) };
}

test('the same seed and turn always produce the same die', () => {
  const a = roll(seed(1234), 7, 20, 0, 12);
  const b = roll(seed(1234), 7, 20, 0, 12);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.face, roll(seed(1234), 8, 20, 0, 12).face);
});

test('a natural 1 fails even when the modifier would clear the DC', () => {
  let found = null;
  for (let t = 0; t < 400 && found === null; t++) {
    const r = roll(seed(9), t, 20, 50, 5);
    if (r.face === 1) found = r;
  }
  assert.ok(found, 'expected a natural 1 within 400 turns');
  assert.equal(found.critical, 'miss');
  assert.equal(found.success, false, 'a natural 1 must fail regardless of modifier');
});

test('hit points cannot be healed above the maximum', () => {
  const w = begin(SCENARIO, seed(1));
  const healed = apply(w, { kind: 'healed', target: w.protagonist, amount: 999 });
  const you = healed.entities.get(w.protagonist)!;
  assert.equal(you.hp.now, you.hp.max);
});

test('hit points cannot be driven below zero', () => {
  const w = begin(SCENARIO, seed(1));
  const hurt = apply(w, { kind: 'damaged', target: w.protagonist, amount: 999 });
  assert.equal(hurt.entities.get(w.protagonist)!.hp.now, 0);
});

test('the engine overrules a difficulty the DM invented outside the band', () => {
  const s = session();
  const brief = briefFor(s.world, 'I pick the simple lock');
  const { rulings, events } = adjudicate(s.world, brief, proposal({ difficulty: 30 }));

  const rewrite = rulings.find((r) => r.kind === 'rewrite');
  assert.ok(rewrite, 'expected the engine to rewrite an out-of-band difficulty');
  assert.match(rewrite.detail, /25/, 'the ruling should name the value the table settled on');

  const rolled = events.find((e) => e.kind === 'rolled');
  assert.ok(rolled && rolled.kind === 'rolled');
  assert.equal(rolled.roll.dc, 25, 'the roll must use the clamped DC, not the one proposed');
});

test('the engine refuses to let the DM damage someone already dead', () => {
  const s = session();
  s.world = apply(s.world, { kind: 'died', target: MARGA });

  const brief = briefFor(s.world, 'I stab her again');
  const { rulings, events, softFail } = adjudicate(s.world, brief, proposal());

  assert.ok(rulings.some((r) => r.kind === 'drop' && r.why === 'already-dead'));
  assert.equal(softFail, true, 'a turn whose only intent was dropped is a soft fail');
  assert.equal(events.some((e) => e.kind === 'damaged'), false, 'no damage may reach the log');
});

test('damage beyond the cap is rewritten rather than trusted', () => {
  const s = session();
  const brief = briefFor(s.world, 'I attack');
  const { events, rulings } = adjudicate(s.world, brief, proposal({ difficulty: 5, damage: 9999 }));

  const damaged = events.find((e) => e.kind === 'damaged');
  if (damaged && damaged.kind === 'damaged') {
    assert.ok(damaged.amount <= 24, `damage should be capped, saw ${damaged.amount}`);
    assert.ok(rulings.some((r) => r.kind === 'rewrite' && r.why === 'damage-out-of-band'));
  }
});

test('an invented character becomes real, persistent and referenceable', async () => {
  const s = session();
  const dm = scriptedDirector([
    proposal({
      op: 'introduce',
      target: MINT_SLOTS[0],
      introduces: { name: 'Sel the dock hand', lore: 'Owes Marga money.', hostile: false },
    }),
  ]);

  const before = s.world.entities.size;
  await takeTurn(s, 'I look around the room', dm);

  assert.equal(s.world.entities.size, before + 1, 'the invented NPC must exist in the world');
  const sel = [...s.world.entities.values()].find((e) => e.name === 'Sel the dock hand');
  assert.ok(sel, 'the invented NPC must be findable by name');
  assert.ok(project(s.world).present.some((p) => p.id === sel.id), 'and visible to the player');
});

test('a mint slot with no lore is dropped rather than inventing a blank person', () => {
  const s = session();
  const brief = briefFor(s.world, 'someone new appears');
  const { rulings } = adjudicate(s.world, brief, proposal({ op: 'introduce', target: MINT_SLOTS[1], introduces: null }));
  assert.ok(rulings.some((r) => r.kind === 'drop' && r.why === 'mint-without-lore'));
});

test('replaying the event log rebuilds exactly the same world', async () => {
  const s = session();
  const dm = scriptedDirector([proposal({ difficulty: 5 })]);
  await takeTurn(s, 'I strike at Marga', dm);
  await takeTurn(s, 'I strike again', dm);

  const base = begin(SCENARIO, seed(42));
  const replayed = fold({ ...base, seq: 0, log: [] }, s.world.log);

  assert.equal(replayed.seq, s.world.seq);
  assert.deepEqual(
    [...replayed.entities.values()].map((e) => [e.id, e.hp.now, e.dead]),
    [...s.world.entities.values()].map((e) => [e.id, e.hp.now, e.dead]),
  );
});

test('the player view never carries DM-only lore', () => {
  const w = begin(SCENARIO, seed(3));
  const view = project(w);
  const serialized = JSON.stringify(view);
  assert.ok(!serialized.includes('owes the harbourmaster'), 'lore must not reach the browser');
});

test('the per-turn schema offers only entities actually in reach', () => {
  const w = begin(SCENARIO, seed(3));
  const brief = briefFor(w, 'I look about');
  const schema = buildSchema(brief) as { properties: { target: { enum: string[] }; op: { enum: string[] } } };

  assert.ok(schema.properties.target.enum.includes('e_marga'));
  assert.ok(!schema.properties.target.enum.includes('e_nobody'));
  for (const slot of MINT_SLOTS) assert.ok(schema.properties.target.enum.includes(slot));
});

test('exploration mode does not offer the attack op at all', () => {
  const w = begin(SCENARIO, seed(3));
  assert.equal(w.mode, 'exploration');
  const schema = buildSchema(briefFor(w, 'hello')) as { properties: { op: { enum: string[] } } };
  assert.ok(!schema.properties.op.enum.includes('attack'), 'attack is undecodable outside combat');
});

test('a turn still settles when the DM is unreachable', async () => {
  const s = session();
  const broken = {
    name: 'broken',
    propose: () => Promise.reject(new Error('connection refused')),
  };

  const before = s.world.seq;
  const result = await takeTurn(s, 'I try the door', broken);

  assert.ok(s.world.seq > before, 'the world must advance even when the model fails');
  assert.ok(result.breach, 'the breach must be reported to the operator');
  assert.ok(result.view.transcript.length > 0, 'the player must still have something to read');
});

test('a meter clamps on construction rather than trusting its caller', () => {
  assert.equal(meter(50, 20).now, 20);
  assert.equal(meter(-5, 20).now, 0);
});
