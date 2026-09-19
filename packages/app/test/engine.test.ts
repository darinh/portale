/**
 * The whole suite runs with no GPU and no model. That is the point of the Director seam:
 * the DM is a constructor argument, so the rules can be driven by a script that cannot
 * vary. Every assertion here is about what the ENGINE does with what the DM proposed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { roll, seed } from '../src/dice.ts';
import { scriptedDirector, briefFor, buildSchema, isOutOfCharacter, MINT_SLOTS } from '../src/director.ts';
import type { Proposal } from '../src/director.ts';
import { SCENARIOS, begin, takeTurn } from '../src/engine.ts';
import type { Session } from '../src/engine.ts';
import { adjudicate } from '../src/rules.ts';
import { apply, clockId, entityId, fold, meter, project, vowId, TICKS_PER_MILESTONE } from '../src/world.ts';

const SCENARIO = SCENARIOS[0]!;
const MARGA = entityId('e_marga');

function proposal(over: Partial<Proposal> = {}): Proposal {
  return {
    narration: 'The lamplight gutters.',
    op: 'attack',
    target: MARGA,
    direction: 'out',
    ability: 'dexterity',
    difficulty: 12,
    damage: 4,
    introduces: null,
    tick: 'c_harbourmaster',
    milestone: 'none',
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

/** Finds a seed whose roll at this DC succeeds, so a test about damage is never vacuous. */
function seedThatSucceeds(dc: number, seq: number): ReturnType<typeof seed> {
  for (let s = 1; s < 5000; s++) {
    if (roll(seed(s), seq, 20, 0, dc).success) return seed(s);
  }
  throw new Error('no seed produced a success, which cannot happen');
}

test('damage beyond the cap is rewritten rather than trusted', () => {
  const s = { id: 'test', world: begin(SCENARIO, seedThatSucceeds(5, 1)) };
  const brief = briefFor(s.world, 'I attack');
  const { events, rulings } = adjudicate(s.world, brief, proposal({ difficulty: 5, damage: 9999 }));

  const damaged = events.find((e) => e.kind === 'damaged');
  assert.ok(damaged && damaged.kind === 'damaged', 'the roll must have succeeded for this test to mean anything');
  assert.ok(damaged.amount <= 24, `damage should be capped, saw ${damaged.amount}`);
  assert.ok(rulings.some((r) => r.kind === 'rewrite' && r.why === 'damage-out-of-band'));
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

test('a move is not ruled against for a target the op never reads', () => {
  const s = session();
  const brief = briefFor(s.world, 'I go down');
  const { events, rulings } = adjudicate(
    s.world,
    brief,
    proposal({ op: 'move', direction: 'down', target: MINT_SLOTS[0], introduces: null }),
  );

  assert.deepEqual(rulings, [], 'a legal move must produce no ruling, whatever sits in target');
  assert.ok(events.some((e) => e.kind === 'moved'), 'and it must actually move');
});

test('narrating is not ruled against for a target the op never reads', () => {
  const s = session();
  const brief = briefFor(s.world, 'I look around');
  const { rulings } = adjudicate(
    s.world,
    brief,
    proposal({ op: 'narrate_only', target: MINT_SLOTS[0], introduces: null, tick: 'none' }),
  );

  assert.deepEqual(rulings, []);
});

test('an op that does read the target is still ruled against for a bad one', () => {
  const s = session();
  const brief = briefFor(s.world, 'I swing at the shape in the dark');
  const { rulings } = adjudicate(
    s.world,
    brief,
    proposal({ op: 'attack', target: MINT_SLOTS[0], introduces: null }),
  );

  assert.ok(
    rulings.some((r) => r.kind === 'drop' && r.why === 'mint-without-lore'),
    'suppressing the ruling for move must not suppress it for violence',
  );
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

test('the schema offers a way into combat during exploration', () => {
  const w = begin(SCENARIO, seed(3));
  const schema = buildSchema(briefFor(w, 'hello')) as { properties: { op: { enum: string[] } } };
  assert.ok(
    schema.properties.op.enum.includes('engage'),
    'without engage in the schema the game can never enter combat at all',
  );
});

test('a target that is not in the world is dropped', () => {
  const w = begin(SCENARIO, seed(3));
  const { events, softFail } = adjudicate(
    w,
    briefFor(w, 'I stab the ghost'),
    proposal({ target: entityId('e_does_not_exist') }),
  );
  assert.ok(events.some((e) => e.kind === 'ruled' && e.why === 'absent-target'));
  assert.equal(softFail, true);
  assert.equal(events.some((e) => e.kind === 'damaged'), false);
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

test('the transcript records what the player said, not only what the DM said', async () => {
  const s = session();
  const dm = scriptedDirector([proposal({ difficulty: 5 })]);
  await takeTurn(s, 'I draw my blade and strike at Marga', dm);

  const said = project(s.world).transcript.filter((l) => l.kind === 'you');
  assert.equal(said.length, 1, 'the player utterance must appear exactly once');
  assert.equal(said[0]!.text, 'I draw my blade and strike at Marga');
});

test('the player utterance survives a reload, because it is in the log', async () => {
  const s = session();
  const dm = scriptedDirector([proposal({ difficulty: 5 })]);
  await takeTurn(s, 'I ask Olen about the harbourmaster', dm);

  const base = begin(SCENARIO, seed(42));
  const replayed = fold({ ...base, seq: 0, log: [] }, s.world.log);
  assert.ok(
    project(replayed).transcript.some((l) => l.kind === 'you' && l.text.includes('Olen')),
    'a rebuilt session must still show what the player typed',
  );
});

test('a meter clamps on construction rather than trusting its caller', () => {
  assert.equal(meter(50, 20).now, 20);
  assert.equal(meter(-5, 20).now, 0);
});

const HARBOUR = clockId('c_harbourmaster');
const DEBT = vowId('v_debt');

test('a vow gives the session a point, and the player can see the track', () => {
  const view = project(begin(SCENARIO, seed(3)));
  assert.equal(view.vows.length, 1, 'the player starts with something to achieve');
  assert.equal(view.vows[0]!.boxes, 0);
  assert.equal(view.vows[0]!.done, false);
  assert.match(view.vows[0]!.what, /debt/i);
});

test('a milestone claim is refused when the turn achieved nothing', () => {
  const w = begin(SCENARIO, seed(3));
  const { events } = adjudicate(
    w,
    briefFor(w, 'I muse about the harbourmaster'),
    proposal({ op: 'narrate_only', milestone: DEBT }),
  );

  assert.ok(events.some((e) => e.kind === 'ruled' && e.why === 'unearned-milestone'));
  assert.equal(events.some((e) => e.kind === 'progressed'), false, 'talk must not move the track');
});

test('a milestone lands when the turn actually produced something', () => {
  const w = begin(SCENARIO, seed(3));
  const { events } = adjudicate(
    w,
    briefFor(w, 'I slip down to the cellar to look for the ledger'),
    proposal({ op: 'move', direction: 'down', milestone: DEBT }),
  );

  assert.ok(events.some((e) => e.kind === 'moved'), 'this turn did something');
  const marked = events.find((e) => e.kind === 'progressed');
  assert.ok(marked && marked.kind === 'progressed');
  assert.equal(marked.by, TICKS_PER_MILESTONE.dangerous, 'the rank sets the step, not the model');
});

test('a vow the player never swore is refused', () => {
  const w = begin(SCENARIO, seed(3));
  const { events } = adjudicate(
    w,
    briefFor(w, 'I go down'),
    proposal({ op: 'move', direction: 'down', milestone: 'v_invented' }),
  );
  assert.ok(events.some((e) => e.kind === 'ruled' && e.why === 'no-such-vow'));
});

test('a vow can be fulfilled, once, and then leaves the enum', () => {
  let w = begin(SCENARIO, seed(3));
  let fulfilments = 0;

  for (let i = 0; i < 12; i++) {
    const dir = i % 2 === 0 ? 'down' : 'up';
    const { events } = adjudicate(
      w,
      briefFor(w, 'onward'),
      proposal({ op: 'move', direction: dir, milestone: DEBT }),
    );
    fulfilments += events.filter((e) => e.kind === 'fulfilled').length;
    w = fold(w, events);
  }

  assert.equal(w.vows.get(DEBT)!.done, true, 'the vow must be completable');
  assert.equal(fulfilments, 1, 'and fulfilled exactly once');
  assert.ok(!briefFor(w, 'x').vows.some((v) => v.id === DEBT), 'a kept vow leaves the enum');
});

test('the vow track replays rather than stamping the final value', () => {
  let w = begin(SCENARIO, seed(3));
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 === 0 ? 'down' : 'up';
    w = fold(w, adjudicate(w, briefFor(w, 'on'), proposal({ op: 'move', direction: dir, milestone: DEBT })).events);
  }

  const shown = project(w)
    .transcript.filter((l) => l.kind === 'vow')
    .map((l) => l.text.split('  ').at(-1));

  assert.deepEqual(shown, ['2/10', '4/10', '6/10'], 'each mark shows the track at that moment');
});

test('the DM can advance pressure that exists, one segment at a time', () => {
  const w = begin(SCENARIO, seed(3));
  const before = w.clocks.get(HARBOUR)!;
  assert.equal(before.filled, 0);

  const after = fold(w, adjudicate(w, briefFor(w, 'I shout'), proposal({ tick: HARBOUR })).events);
  assert.equal(after.clocks.get(HARBOUR)!.filled, 1, 'the engine decides the step, not the model');
});

test('a skill check still happens when the DM fumbles the target', () => {
  const w = begin(SCENARIO, seed(3));
  const { events, softFail } = adjudicate(
    w,
    briefFor(w, 'I slide a coin across the bar and ask quietly'),
    proposal({ op: 'skill_check', target: MINT_SLOTS[0], introduces: null, difficulty: 10 }),
  );

  // Telemetry from a real session showed op=skill_check target=~new1, and the whole turn
  // was thrown away. A check is against a difficulty, not against a person.
  assert.ok(events.some((e) => e.kind === 'rolled'), 'the check must still be rolled');
  assert.equal(softFail, false, 'the turn must not be wasted over a target that did not matter');
});

test('violence with no valid target is still refused', () => {
  const w = begin(SCENARIO, seed(3));
  const { events, softFail } = adjudicate(
    w,
    briefFor(w, 'I stab the ghost'),
    proposal({ op: 'attack', target: entityId('e_nobody') }),
  );
  assert.equal(softFail, true, 'an attack needs someone to attack');
  assert.equal(events.some((e) => e.kind === 'damaged'), false);
});

test('a clock the DM invented is refused', () => {
  const w = begin(SCENARIO, seed(3));
  const { events } = adjudicate(w, briefFor(w, 'I shout'), proposal({ tick: 'c_made_up' }));
  assert.ok(events.some((e) => e.kind === 'ruled' && e.why === 'no-such-clock'));
  assert.equal(events.some((e) => e.kind === 'ticked'), false);
});

test('none means none', () => {
  const w = begin(SCENARIO, seed(3));
  const { events } = adjudicate(w, briefFor(w, 'I sit quietly'), proposal({ tick: 'none' }));
  assert.equal(events.some((e) => e.kind === 'ticked'), false);
  assert.equal(events.some((e) => e.kind === 'ruled'), false, 'none is not an error');
});

test('a full clock pays off exactly once and then stops being offered', () => {
  let w = begin(SCENARIO, seed(3));
  const segments = w.clocks.get(HARBOUR)!.segments;

  let payoffs = 0;
  for (let i = 0; i < segments + 3; i++) {
    const { events } = adjudicate(w, briefFor(w, 'I am careless'), proposal({ tick: HARBOUR }));
    payoffs += events.filter((e) => e.kind === 'filled').length;
    w = fold(w, events);
  }

  assert.equal(payoffs, 1, 'a clock fires its payoff once, however hard it is pushed');
  assert.equal(w.clocks.get(HARBOUR)!.done, true);
  assert.ok(
    !briefFor(w, 'x').clocks.some((c) => c.id === HARBOUR),
    'a finished clock must leave the enum, or the DM keeps poking a spent threat',
  );
});

test('the transcript replays clock values rather than stamping the final one', () => {
  let w = begin(SCENARIO, seed(3));
  for (let i = 0; i < 3; i++) {
    w = fold(w, adjudicate(w, briefFor(w, 'again'), proposal({ tick: HARBOUR })).events);
  }

  const shown = project(w)
    .transcript.filter((l) => l.kind === 'clock')
    .map((l) => l.text);

  assert.deepEqual(
    shown.map((t) => t.split('  ').at(-1)),
    ['1/6', '2/6', '3/6'],
    'each tick must show the value at that moment, not the value now',
  );
});

test('a secret clock is tracked and never shipped to the browser', () => {
  let w = begin(SCENARIO, seed(3));
  const secret = clockId('c_secret');
  const clocks = new Map(w.clocks);
  clocks.set(secret, {
    id: secret, name: 'Something you cannot see', kind: 'danger',
    segments: 4, filled: 0, visibility: 'secret', payoff: 'It arrives.', done: false,
  });
  w = { ...w, clocks };

  w = fold(w, adjudicate(w, briefFor(w, 'x'), proposal({ tick: secret })).events);

  assert.equal(w.clocks.get(secret)!.filled, 1, 'the engine still tracks it');
  const shipped = JSON.stringify(project(w));
  assert.ok(!shipped.includes('Something you cannot see'), 'but the player never sees it');
  assert.ok(!shipped.includes('c_secret'));
});

test('clocks survive a replay of the log', () => {
  let w = begin(SCENARIO, seed(3));
  for (let i = 0; i < 2; i++) {
    w = fold(w, adjudicate(w, briefFor(w, 'again'), proposal({ tick: HARBOUR })).events);
  }
  const base = begin(SCENARIO, seed(3));
  const replayed = fold({ ...base, seq: 0, log: [] }, w.log);
  assert.equal(replayed.clocks.get(HARBOUR)!.filled, w.clocks.get(HARBOUR)!.filled);
});

test('moving takes the player somewhere real and remembers they went', () => {
  const w = begin(SCENARIO, seed(3));
  const start = w.here;
  const { events } = adjudicate(w, briefFor(w, 'I head down to the cellar'), proposal({ op: 'move', direction: 'down' }));

  const after = fold(w, events);
  assert.notEqual(after.here, start, 'the player must actually be somewhere else');
  assert.equal(after.locations.get(after.here)?.visited, true, 'arriving must mark the room visited');
  assert.equal(after.entities.get(after.protagonist)?.at, after.here, 'the player record must move too');
});

test('the DM can only propose exits that exist', () => {
  const w = begin(SCENARIO, seed(3));
  const schema = buildSchema(briefFor(w, 'I look about')) as {
    properties: { direction: { enum: string[] }; op: { enum: string[] } };
  };
  const real = [...w.locations.get(w.here)!.exits.keys()];

  assert.deepEqual([...schema.properties.direction.enum].sort(), [...real].sort());
  assert.ok(!schema.properties.direction.enum.includes('north'), 'the common room has no north exit');
  assert.ok(schema.properties.op.enum.includes('move'));
});

test('a direction that is not an exit is refused rather than inventing a door', () => {
  const w = begin(SCENARIO, seed(3));
  const { events, softFail } = adjudicate(
    w,
    briefFor(w, 'I go north'),
    proposal({ op: 'move', direction: 'north' }),
  );
  assert.equal(softFail, true);
  assert.ok(events.some((e) => e.kind === 'ruled' && e.why === 'no-such-exit'));
  assert.equal(events.some((e) => e.kind === 'moved'), false);
});

test('you cannot stroll out of a fight', () => {
  const w = inCombat(seed(53));
  const { events, softFail } = adjudicate(
    w,
    briefFor(w, 'I walk out'),
    proposal({ op: 'move', direction: 'out' }),
  );
  assert.equal(softFail, true);
  assert.ok(events.some((e) => e.kind === 'ruled' && e.why === 'pinned-in-combat'));
});

test('someone in another room is not in reach, and cannot be named', () => {
  const w = begin(SCENARIO, seed(3));
  const brief = briefFor(w, 'I look about');
  const names = brief.inReach.map((e) => e.name);

  assert.ok(names.includes('Marga'), 'Marga shares the common room');
  assert.ok(!names.includes('A customs officer'), 'the officer is out on the dock');

  const schema = buildSchema(brief) as { properties: { target: { enum: string[] } } };
  assert.ok(!schema.properties.target.enum.includes('e_customs'), 'and so cannot be targeted');
});

test('a foe left behind in another room stops swinging at you', () => {
  let w = inCombat(seed(59));
  // Force the player out without the combat guard, the way a scripted escape would.
  w = apply(w, { kind: 'mode', to: 'exploration' });
  w = fold(w, adjudicate(w, briefFor(w, 'I slip out'), proposal({ op: 'move', direction: 'out' })).events);
  w = apply(w, { kind: 'mode', to: 'combat' });

  const { events } = adjudicate(w, briefFor(w, 'I catch my breath'), proposal({ op: 'narrate_only' }));
  assert.equal(
    events.some((e) => e.kind === 'rolled' && e.actor === MARGA),
    false,
    'Marga is in the tavern and the player is in the yard',
  );
});

test('the map shows only rooms the player has stood in', () => {
  const w = begin(SCENARIO, seed(3));
  const before = project(w).map;
  assert.equal(before.length, 1, 'only the starting room is known');
  assert.equal(before[0]!.here, true);

  const after = project(
    fold(w, adjudicate(w, briefFor(w, 'down'), proposal({ op: 'move', direction: 'down' })).events),
  ).map;
  assert.equal(after.length, 2, 'the cellar joins the map once entered');
  assert.equal(after.filter((r) => r.here).length, 1, 'exactly one room is current');
});

test('the map never leaks the names of rooms not yet visited', () => {
  const view = project(begin(SCENARIO, seed(3)));
  const shipped = JSON.stringify(view);
  assert.ok(!shipped.includes('harbour dock'), 'an unvisited room must not appear');
  assert.ok(!shipped.includes('cellar'), 'nor its name');
});

test('movement survives a replay of the log', async () => {
  const s = { id: 't', world: begin(SCENARIO, seed(71)) };
  const dm = scriptedDirector([proposal({ op: 'move', direction: 'down' })]);
  await takeTurn(s, 'I go down', dm);

  const base = begin(SCENARIO, seed(71));
  const replayed = fold({ ...base, seq: 0, log: [] }, s.world.log);
  assert.equal(replayed.here, s.world.here, 'a rebuilt world must stand in the same room');
});

/** Puts the world into combat with Marga, which is the only state reprisals happen in. */
function inCombat(s: ReturnType<typeof seed>) {
  let w = begin(SCENARIO, s);
  w = fold(w, adjudicate(w, briefFor(w, 'I draw'), proposal({ op: 'engage', target: MARGA })).events);
  assert.equal(w.mode, 'combat');
  return w;
}

test('a hostile strikes back, so the world is not a punching bag', () => {
  const w = inCombat(seed(11));
  const { events } = adjudicate(w, briefFor(w, 'I swing again'), proposal({ difficulty: 5 }));

  const theirs = events.filter((e) => e.kind === 'rolled' && e.actor === MARGA);
  assert.equal(theirs.length, 1, 'the living hostile must roll against the player every turn');
});

test('the reprisal happens even when the player misses', () => {
  let found = null;
  for (let s = 1; s < 400 && found === null; s++) {
    const w = inCombat(seed(s));
    const { events } = adjudicate(w, briefFor(w, 'I swing'), proposal({ difficulty: 25 }));
    const mine = events.find((e) => e.kind === 'rolled' && e.actor === w.protagonist);
    if (mine && mine.kind === 'rolled' && !mine.roll.success) found = events;
  }
  assert.ok(found, 'expected some seed to produce a failed player roll');
  assert.ok(
    found.some((e) => e.kind === 'rolled' && e.actor === MARGA),
    'a foe must still act on a turn the player failed, or failure ends the fight',
  );
});

test('the reprisal happens even when the whole intent was dropped', () => {
  const w = inCombat(seed(17));
  const { events, softFail } = adjudicate(
    w,
    briefFor(w, 'I stab the ghost'),
    proposal({ target: entityId('e_nobody') }),
  );
  assert.equal(softFail, true);
  assert.ok(
    events.some((e) => e.kind === 'rolled' && e.actor === MARGA),
    'a dropped player intent must not also cancel the world turn',
  );
});

test('nobody strikes back outside combat', () => {
  const w = begin(SCENARIO, seed(3));
  assert.equal(w.mode, 'exploration');
  const { events } = adjudicate(w, briefFor(w, 'I look around'), proposal({ op: 'narrate_only' }));
  assert.equal(events.some((e) => e.kind === 'rolled' && e.actor === MARGA), false);
});

test('the dead do not strike back', () => {
  let w = inCombat(seed(23));
  w = apply(w, { kind: 'died', target: MARGA });
  const { events } = adjudicate(w, briefFor(w, 'I catch my breath'), proposal({ op: 'narrate_only' }));
  assert.equal(events.some((e) => e.kind === 'rolled' && e.actor === MARGA), false);
});

test('the player can actually be wounded, and eventually falls', () => {
  let w = inCombat(seed(29));
  let tookDamage = false;
  let fell = false;

  for (let turn = 0; turn < 60 && !fell; turn++) {
    const { events } = adjudicate(w, briefFor(w, 'I fight on'), proposal({ difficulty: 25 }));
    if (events.some((e) => e.kind === 'damaged' && e.target === w.protagonist)) tookDamage = true;
    if (events.some((e) => e.kind === 'died' && e.target === w.protagonist)) fell = true;
    w = fold(w, events);
  }

  assert.ok(tookDamage, 'the player must be able to take a wound');
  assert.ok(fell, 'the player must be able to lose');
  assert.equal(project(w).you.defeated, true, 'the view must tell the player they are down');
});

test('a fallen player is not hit again', () => {
  // Find a world where the foe's counterblow definitely lands, or this test passes on a
  // missed reprisal and proves nothing about the guard it is named for.
  let landed = null;
  for (let s = 1; s < 600 && landed === null; s++) {
    const w = inCombat(seed(s));
    const { events } = adjudicate(w, briefFor(w, 'I fight'), proposal({ difficulty: 25 }));
    if (events.some((e) => e.kind === 'damaged' && e.target === w.protagonist)) landed = seed(s);
  }
  assert.ok(landed, 'expected some seed to land a counterblow');

  let w = inCombat(landed);
  w = apply(w, { kind: 'died', target: w.protagonist });
  const { events } = adjudicate(w, briefFor(w, 'I lie still'), proposal({ difficulty: 25 }));

  assert.equal(
    events.some((e) => e.kind === 'damaged' && e.target === w.protagonist),
    false,
    'the engine must stop swinging at someone already down',
  );
});

test('the DM is told who is about to strike, so it can narrate the blow coming', () => {
  const peace = briefFor(begin(SCENARIO, seed(3)), 'hello');
  assert.equal(peace.reprisalBy, null, 'nobody threatens during peace');

  const war = briefFor(inCombat(seed(37)), 'I press on');
  assert.ok(war.reprisalBy, 'the brief must name the foe about to act');
  assert.equal(war.reprisalBy.id, MARGA);
});

test('a reprisal is seeded, so the same world produces the same counterblow', () => {
  const a = adjudicate(inCombat(seed(41)), briefFor(inCombat(seed(41)), 'x'), proposal({ difficulty: 5 }));
  const b = adjudicate(inCombat(seed(41)), briefFor(inCombat(seed(41)), 'x'), proposal({ difficulty: 5 }));

  const faceOf = (evs: typeof a.events) =>
    evs.filter((e) => e.kind === 'rolled' && e.actor === MARGA).map((e) => (e.kind === 'rolled' ? e.roll.face : 0));

  assert.deepEqual(faceOf(a.events), faceOf(b.events));
});

test('bookkeeping tokens never reach the player, even when the DM writes them', () => {
  const w = begin(SCENARIO, seed(3));
  const { events } = adjudicate(
    w,
    briefFor(w, 'I look around'),
    proposal({
      op: 'narrate_only',
      narration: '~new3 introduces. e_marga watches you, and ~new1 slips in behind e_olen.',
    }),
  );

  const narrated = events.find((e) => e.kind === 'narrated');
  assert.ok(narrated && narrated.kind === 'narrated');
  assert.ok(!/~new\d/.test(narrated.text), `mint slot leaked: ${narrated.text}`);
  assert.ok(!/\be_[a-z0-9_]+\b/i.test(narrated.text), `entity id leaked: ${narrated.text}`);
  assert.match(narrated.text, /Marga/, 'a known id should become the character name, not a placeholder');
});

test('an out-of-character message cannot start a fight, because engage is undecodable', () => {
  const w = begin(SCENARIO, seed(3));
  const brief = briefFor(w, '// wait, was that last message cut off?');
  assert.equal(brief.outOfCharacter, true);

  const schema = buildSchema(brief) as { properties: { op: { enum: string[] } } };
  assert.deepEqual(schema.properties.op.enum, ['narrate_only'], 'the op enum must collapse to one member');
  assert.ok(!schema.properties.op.enum.includes('engage'));
});

test('the out-of-character prefix is stripped before the DM sees it', () => {
  const w = begin(SCENARIO, seed(3));
  assert.equal(briefFor(w, '// what did you mean?').utterance, 'what did you mean?');
  assert.equal(briefFor(w, 'ooc: keep up').utterance, 'keep up');
});

test('the phrases a real player used to address the DM are recognised', () => {
  for (const meta of [
    'It seems like the last message was cut off.  His mouth forms a silent what?',
    'seriously? I just told you I stabbed him in the eye with a dagger. Keep up, DM.',
    'wait, you already said that',
  ]) {
    assert.equal(isOutOfCharacter(meta), true, `should be out of character: ${meta}`);
  }
});

test('ordinary play is never mistaken for an out-of-character aside', () => {
  for (const inCharacter of [
    'I draw my blade and strike at Marga',
    'I ask the barkeep what he knows about the harbourmaster',
    'I stab marga in his only remaining eye with my hidden dagger',
    'I tell the dockhand to keep up as we run',
  ]) {
    assert.equal(isOutOfCharacter(inCharacter), false, `should be in character: ${inCharacter}`);
  }
});

test('the DM decides the mechanics before it writes the prose', () => {
  const w = begin(SCENARIO, seed(3));
  const schema = buildSchema(briefFor(w, 'I attack')) as { properties: Record<string, unknown> };
  const order = Object.keys(schema.properties);

  assert.equal(order[0], 'op', 'op must be generated first');
  assert.equal(
    order.at(-1),
    'narration',
    'narration must be generated last, or the model picks an op to match prose it already wrote',
  );
});

test('the DM is told which pronouns each character uses', () => {
  const marga = SCENARIO.cast.find((c) => c.name === 'Marga');
  assert.ok(marga, 'Marga must exist in the scenario');
  assert.match(marga.lore, /\b(she|her)\b/i, 'real play had the DM calling Marga he all session');
});

test('a dropped intent reaches the log as a ruling, not just the return value', () => {
  const s = session();
  s.world = apply(s.world, { kind: 'died', target: MARGA });
  const { events } = adjudicate(s.world, briefFor(s.world, 'I stab her again'), proposal());

  const ruled = events.find((e) => e.kind === 'ruled');
  assert.ok(ruled && ruled.kind === 'ruled', 'the ruling must be an event, or it never reaches the log');
  assert.equal(ruled.why, 'already-dead');
});

test('a ruling survives even when the roll it preceded then fails', () => {
  let failing = null;
  for (let sd = 1; sd < 5000 && failing === null; sd++) {
    if (!roll(seed(sd), 1, 20, 0, 25).success) failing = seed(sd);
  }
  assert.ok(failing, 'expected some seed to fail a DC 25 roll');

  const w = begin(SCENARIO, failing);
  const { events } = adjudicate(w, briefFor(w, 'I pick the simple lock'), proposal({ difficulty: 30 }));

  const rolled = events.find((e) => e.kind === 'rolled');
  assert.ok(rolled && rolled.kind === 'rolled' && !rolled.roll.success, 'this test needs a failed roll');
  assert.ok(
    events.some((e) => e.kind === 'ruled' && e.why === 'difficulty-out-of-band'),
    'the clamp ruling must reach the log even though the turn then failed',
  );
});

test('an NPC invented this turn can be killed this turn', () => {
  const w = begin(SCENARIO, seedThatSucceeds(5, 1));
  const { events } = adjudicate(
    w,
    briefFor(w, 'I cut down whoever just came through the door'),
    proposal({
      op: 'attack',
      target: MINT_SLOTS[0],
      difficulty: 5,
      damage: 12,
      introduces: { name: 'A hired knife', lore: 'Paid in advance.', hostile: true },
    }),
  );

  const introduced = events.find((e) => e.kind === 'introduced');
  assert.ok(introduced && introduced.kind === 'introduced');
  assert.ok(
    events.some((e) => e.kind === 'died' && e.target === introduced.entity.id),
    'a freshly minted NPC taking lethal damage must be able to die',
  );
});

test('engage is the way into combat, and it is refused without a foe', () => {
  const w = begin(SCENARIO, seed(5));
  assert.equal(w.mode, 'exploration');

  const entered = adjudicate(w, briefFor(w, 'I go for my sword'), proposal({ op: 'engage', target: MARGA }));
  assert.ok(entered.events.some((e) => e.kind === 'mode' && e.to === 'combat'), 'engage must enter combat');

  const refused = adjudicate(
    w,
    briefFor(w, 'I attack the barkeep'),
    proposal({ op: 'engage', target: entityId('e_olen') }),
  );
  assert.ok(refused.events.some((e) => e.kind === 'ruled' && e.why === 'nothing-to-fight'));
  assert.equal(refused.softFail, true);
});

test('the blow that starts a fight is resolved, not discarded', () => {
  const w = begin(SCENARIO, seedThatSucceeds(5, 1));
  const { events } = adjudicate(
    w,
    briefFor(w, 'I stab Marga in the eye'),
    proposal({ op: 'engage', target: MARGA, difficulty: 5, damage: 4 }),
  );

  assert.ok(events.some((e) => e.kind === 'mode' && e.to === 'combat'), 'it must start combat');
  assert.ok(
    events.some((e) => e.kind === 'rolled'),
    'entering combat must not swallow the attack that started it',
  );
  assert.ok(
    events.some((e) => e.kind === 'damaged'),
    'the DM narrates a wound on this turn, so the world must take one',
  );
});

test('combat is reachable and exits when the last foe falls', () => {
  let w = begin(SCENARIO, seed(5));
  w = fold(w, adjudicate(w, briefFor(w, 'I draw'), proposal({ op: 'engage', target: MARGA })).events);
  assert.equal(w.mode, 'combat');

  w = apply(w, { kind: 'damaged', target: MARGA, amount: 11 });
  const killing = adjudicate(w, briefFor(w, 'I finish her'), proposal({ difficulty: 5, damage: 12 }));
  const after = fold(w, killing.events);

  if (killing.events.some((e) => e.kind === 'died')) {
    assert.equal(after.mode, 'exploration', 'combat must end when no hostile remains');
  }
});

test('a minted id is derived from the world, not from a clock or a module counter', () => {
  const a = begin(SCENARIO, seed(99));
  const mk = (w: typeof a) =>
    adjudicate(
      w,
      briefFor(w, 'someone arrives'),
      proposal({ op: 'introduce', target: MINT_SLOTS[0], introduces: { name: 'X', lore: 'Y', hostile: false } }),
    ).events.find((e) => e.kind === 'introduced');

  const first = mk(a);
  assert.ok(first && first.kind === 'introduced');

  // Assert the property directly. Comparing two ids only proves determinism by accident,
  // because a clock-based id also compares equal inside one millisecond and unequal across
  // a tick, so the earlier version of this test passed against a Date.now() mutant.
  assert.ok(
    first.entity.id.startsWith(`e_m${(99).toString(36)}_`),
    `the id must begin with the world seed, saw ${first.entity.id}`,
  );

  assert.equal(mk(begin(SCENARIO, seed(99)))?.entity.id, first.entity.id, 'same world, same id');
  assert.notEqual(mk(begin(SCENARIO, seed(100)))?.entity.id, first.entity.id, 'different seeds must not collide');
});

test('the DM is shown older dialogue, not just the most recent turn', async () => {
  const s = session();
  const dm = scriptedDirector([proposal({ op: 'talk' })]);
  await takeTurn(s, 'FIRST utterance', dm);
  await takeTurn(s, 'SECOND utterance', dm);
  await takeTurn(s, 'THIRD utterance', dm);

  const recent = briefFor(s.world, 'fourth').recent;
  assert.ok(recent.some((l) => l.includes('FIRST')), 'history must survive more than one turn of events');
  assert.ok(recent.some((l) => l.includes('Player:')), 'the DM must see what the player said, not only its own lines');
});
