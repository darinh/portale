/**
 * Exercises the real HTTP surface.
 *
 * The unit tests cover pure logic and never touch HTTP. The browser harness goes through
 * the UI. That left routing, status codes, input validation, the concurrency guard, path
 * traversal and session rebuild with no coverage at all, which is most of what an API
 * contract is.
 *
 * Every test here builds a real server on an ephemeral port with a scripted DM, so the
 * whole suite runs with no GPU, no model and no network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createApp, MAX_BODY_BYTES, MAX_UTTERANCE } from '../src/app.ts';
import type { App } from '../src/app.ts';
import { portaleClient } from '../src/client.ts';
import type { PortaleClient } from '../src/client.ts';
import { scriptedDirector } from '../src/director.ts';
import type { Director, Proposal } from '../src/director.ts';
import { DEMO_SCRIPT } from '../src/demo-script.ts';

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'portale-api-'));
}

async function boot(
  dir: string,
  director: Director = scriptedDirector(DEMO_SCRIPT),
): Promise<{ app: App; api: PortaleClient; dbPath: string }> {
  const dbPath = join(dir, 'api.db');
  const publicDir = join(dir, 'public');
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>portale test</title>');

  const app = createApp({ director, dbPath, publicDir });
  const port = await app.listen(0);
  return { app, api: portaleClient(`http://127.0.0.1:${port}`, { timeoutMs: 30_000 }), dbPath };
}

async function withApp(fn: (ctx: { app: App; api: PortaleClient; dbPath: string; dir: string }) => Promise<void>) {
  const dir = scratch();
  const ctx = await boot(dir);
  try {
    await fn({ ...ctx, dir });
  } finally {
    await ctx.app.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test('health reports which DM is wired in, so a harness can refuse to assert on a live model', async () => {
  await withApp(async ({ api }) => {
    const h = await api.health();
    assert.equal(h.ok, true);
    assert.equal(h.dm, 'scripted');
    assert.ok(h.scenarios.includes('lantern'));
  });
});

test('a new session is created with 201 and opens at full health', async () => {
  await withApp(async ({ api }) => {
    const r = await api.raw('POST', '/api/session', { seed: 42 });
    assert.equal(r.status, 201);

    const { id, view } = r.body as { id: string; view: { you: { hp: { now: number; max: number } } } };
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(view.you.hp.now, view.you.hp.max);
  });
});

test('an unknown scenario is refused instead of silently falling back', async () => {
  await withApp(async ({ api }) => {
    const r = await api.raw('POST', '/api/session', { scenario: 'atlantis' });
    assert.equal(r.status, 400);
    assert.match(JSON.stringify(r.body), /no such scenario/);
  });
});

test('a non-numeric seed is refused', async () => {
  await withApp(async ({ api }) => {
    assert.equal((await api.raw('POST', '/api/session', { seed: 'banana' })).status, 400);
    assert.equal((await api.raw('POST', '/api/session', { seed: Infinity })).status, 400);
  });
});

test('a turn produces mechanics and returns the updated view', async () => {
  await withApp(async ({ api }) => {
    const { id } = await api.begin({ seed: 42 });
    const result = await api.turn(id, 'I draw my blade and strike at Marga');

    assert.equal(result.breach, null);
    assert.ok(result.view.transcript.some((l) => l.kind === 'you'), 'the player utterance must come back');
    assert.ok(result.view.transcript.some((l) => l.kind === 'roll'), 'the engine must have rolled');
  });
});

test('an empty, missing, non-string or oversized utterance is refused', async () => {
  await withApp(async ({ api }) => {
    const { id } = await api.begin({ seed: 1 });
    const path = `/api/session/${id}/turn`;

    assert.equal((await api.raw('POST', path, {})).status, 400, 'missing');
    assert.equal((await api.raw('POST', path, { utterance: '   ' })).status, 400, 'blank');
    assert.equal((await api.raw('POST', path, { utterance: 42 })).status, 400, 'not a string');
    assert.equal(
      (await api.raw('POST', path, { utterance: 'x'.repeat(MAX_UTTERANCE + 1) })).status,
      400,
      'too long',
    );
  });
});

test('a turn against an unknown session is a 404, not a crash', async () => {
  await withApp(async ({ api }) => {
    const r = await api.raw('POST', '/api/session/00000000-0000-0000-0000-000000000000/turn', {
      utterance: 'hello',
    });
    assert.equal(r.status, 404);
  });
});

test('malformed JSON is a 400 rather than a 500', async () => {
  await withApp(async ({ api }) => {
    const { id } = await api.begin({ seed: 1 });
    const r = await api.raw('POST', `/api/session/${id}/turn`, '{"utterance": ');
    assert.equal(r.status, 400, 'a broken body is the caller1s fault, not the server1s'.replace(/1/g, "'"));
  });
});

test('a JSON array body is refused, because the routes expect an object', async () => {
  await withApp(async ({ api }) => {
    const r = await api.raw('POST', '/api/session', '[1,2,3]');
    assert.equal(r.status, 400);
  });
});

test('an oversized body is refused rather than buffered', async () => {
  await withApp(async ({ api }) => {
    const { id } = await api.begin({ seed: 1 });
    // The utterance stays short and legal. The padding is what makes the body oversized,
    // so only the byte limit can reject this. An oversized utterance would be caught by
    // the length check instead, and the byte limit would never be exercised.
    const huge = JSON.stringify({ utterance: 'hello', padding: 'x'.repeat(MAX_BODY_BYTES + 1024) });
    assert.ok(huge.length > MAX_BODY_BYTES, 'the body must actually exceed the limit');

    const r = await api.raw('POST', `/api/session/${id}/turn`, huge);
    assert.equal(r.status, 400, 'an over-large body must be refused before it is parsed');
  });
});

test('the wrong method on a real route is 405, not a silent fall through to static files', async () => {
  await withApp(async ({ api }) => {
    const { id } = await api.begin({ seed: 1 });
    assert.equal((await api.raw('GET', `/api/session/${id}/turn`)).status, 405);
    assert.equal((await api.raw('PUT', `/api/session/${id}`)).status, 405);
  });
});

test('a session can be deleted, and is gone for good', async () => {
  await withApp(async ({ api, dbPath }) => {
    const { id } = await api.begin({ seed: 1 });
    await api.turn(id, 'one');
    const keep = (await api.begin({ seed: 2 })).id;

    assert.equal((await api.raw('DELETE', `/api/session/${id}`)).status, 204);
    assert.equal((await api.raw('GET', `/api/session/${id}`)).status, 404, 'the cache must forget it too');
    assert.ok(!(await api.sessions()).sessions.some((s) => s.id === id));
    assert.ok((await api.sessions()).sessions.some((s) => s.id === keep), 'and only that one');

    const db = new DatabaseSync(dbPath);
    try {
      const left = db.prepare('SELECT COUNT(*) AS n FROM events WHERE session_id = ?').get(id) as { n: number };
      assert.equal(Number(left.n), 0, 'no events may outlive their session');
    } finally {
      db.close();
    }
  });
});

test('deleting a session that does not exist is a 404', async () => {
  await withApp(async ({ api }) => {
    assert.equal((await api.raw('DELETE', '/api/session/00000000-0000-0000-0000-000000000000')).status, 404);
  });
});

test('the session list puts the most recently played tale first', async () => {
  await withApp(async ({ api }) => {
    const older = (await api.begin({ seed: 1 })).id;
    const newer = (await api.begin({ seed: 2 })).id;
    assert.equal((await api.sessions()).sessions[0]?.id, newer, 'with nothing played, the newest leads');

    await api.turn(older, 'I look around');
    assert.equal((await api.sessions()).sessions[0]?.id, older, 'playing a tale brings it to the front');
  });
});

test('the session list says how each tale stands and what it is', async () => {
  const dir = scratch();
  const route = keepTheVow();
  const { app, api } = await boot(dir, scriptedDirector(route));
  try {
    const won = (await api.begin({ scenario: 'lantern', seed: 3 })).id;
    for (let i = 0; i < route.length; i++) await api.turn(won, 'onward');
    const open = (await api.begin({ scenario: 'delve', seed: 77 })).id;

    const { sessions } = await api.sessions();
    const byId = new Map(sessions.map((s) => [s.id, s]));
    assert.equal(byId.get(won)?.outcome, 'won');
    assert.equal(byId.get(won)?.title, 'The Drowned Lantern');
    assert.equal(byId.get(open)?.outcome, 'playing');
    assert.equal(byId.get(open)?.seed, 77, 'a delve is only reproducible if the list carries its seed');
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an unknown api route is a JSON 404, never the index page', async () => {
  await withApp(async ({ api, dir }) => {
    // A real static file under an /api/ path. Without it the route falls through to the
    // static handler, misses on disk, and 404s anyway, so the guard is never exercised.
    mkdirSync(join(dir, 'public', 'api'), { recursive: true });
    writeFileSync(join(dir, 'public', 'api', 'nope'), 'PORTALE_STATIC_CANARY');

    const r = await api.raw('GET', '/api/nope');
    assert.equal(r.status, 404);
    assert.match(r.headers['content-type'] ?? '', /application\/json/);
    assert.ok(!r.text.includes('PORTALE_STATIC_CANARY'), 'an api path must never be served from disk');
  });
});

test('a malformed path is a 400, not a server error', async () => {
  await withApp(async ({ api }) => {
    for (const path of ['/%ZZ', '/index.html%', '/%E0%A4%A']) {
      const r = await api.raw('GET', path);
      assert.equal(r.status, 400, `${path} answered ${r.status}`);
    }
  });
});

test('health answers HEAD as well as GET', async () => {
  await withApp(async ({ api }) => {
    const r = await api.raw('HEAD', '/api/health');
    assert.equal(r.status, 200);
  });
});

test('directory traversal cannot escape the public directory', async () => {
  const dir = scratch();
  // A real file outside the public directory. Without this the test proves nothing,
  // because a traversal that resolves to a path with no file there 404s on its own and
  // the guard is never exercised.
  writeFileSync(join(dir, 'SECRET.txt'), 'PORTALE_TRAVERSAL_CANARY');

  const ctx = await boot(dir);
  try {
    for (const attack of [
      '/../SECRET.txt',
      '/..%2fSECRET.txt',
      '/%2e%2e/SECRET.txt',
      '/public/../../SECRET.txt',
    ]) {
      const r = await ctx.api.raw('GET', attack);
      assert.ok(
        !r.text.includes('PORTALE_TRAVERSAL_CANARY'),
        `${attack} read a file outside the public directory`,
      );
      assert.ok(r.status === 403 || r.status === 404, `${attack} should be refused, got ${r.status}`);
    }
  } finally {
    await ctx.app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the index page is served at the root', async () => {
  await withApp(async ({ api }) => {
    const r = await api.raw('GET', '/');
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'] ?? '', /text\/html/);
    assert.match(r.text, /portale test/);
  });
});

test('two turns at once on one session are refused with 409', async () => {
  const dir = scratch();
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });

  const slow: Director = {
    name: 'slow',
    async propose() {
      await gate;
      return DEMO_SCRIPT[0] as Proposal;
    },
  };

  const { app, api } = await boot(dir, slow);
  try {
    const { id } = await api.begin({ seed: 1 });
    const first = api.raw('POST', `/api/session/${id}/turn`, { utterance: 'one' });
    // Give the first request time to claim the session before the second arrives.
    await new Promise((r) => setTimeout(r, 150));
    const second = await api.raw('POST', `/api/session/${id}/turn`, { utterance: 'two' });

    assert.equal(second.status, 409, 'the second turn must be refused while the first is in flight');

    release();
    assert.equal((await first).status, 200, 'the first turn must still complete normally');
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the in-flight guard is released, so the next turn still works', async () => {
  await withApp(async ({ api }) => {
    const { id } = await api.begin({ seed: 7 });
    await api.turn(id, 'first');
    const second = await api.raw('POST', `/api/session/${id}/turn`, { utterance: 'second' });
    assert.equal(second.status, 200);
  });
});

test('a session survives a full server restart, proving the cache holds no authority', async () => {
  const dir = scratch();
  const first = await boot(dir);
  let id: string;
  let seqBefore: number;

  try {
    const begun = await first.api.begin({ seed: 99 });
    id = begun.id;
    const turned = await first.api.turn(id, 'I draw my blade and strike at Marga');
    seqBefore = turned.view.seq;
    assert.ok(seqBefore > 1);
  } finally {
    await first.app.close();
  }

  // A brand new process-equivalent, same database, empty in-memory cache.
  const second = await boot(dir);
  try {
    const { view } = await second.api.view(id);
    assert.equal(view.seq, seqBefore, 'the rebuilt world must match what was persisted');
    assert.ok(
      view.transcript.some((l) => l.kind === 'you' && l.text.includes('strike at Marga')),
      'the turn must survive a restart, not merely a page reload',
    );
    assert.ok(view.transcript.some((l) => l.kind === 'roll'), 'the roll must survive too');
  } finally {
    await second.app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a turn that fails to save leaves the session exactly as it was', async () => {
  await withApp(async ({ api, dbPath }) => {
    const { id } = await api.begin({ seed: 7 });
    const side = new DatabaseSync(dbPath);
    try {
      // The player's words save, then the disk fails halfway through the rest of the turn.
      side.exec(`CREATE TRIGGER injected_failure BEFORE INSERT ON events
        WHEN json_extract(NEW.payload, '$.kind') = 'narrated'
        BEGIN SELECT RAISE(ABORT, 'injected disk failure'); END;`);

      const failed = await api.raw('POST', `/api/session/${id}/turn`, { utterance: 'I strike at Marga' });
      assert.equal(failed.status, 500, 'the fixture must actually fail the write');

      side.exec('DROP TRIGGER injected_failure');
      const kinds = (side.prepare('SELECT payload FROM events WHERE session_id = ? ORDER BY seq').all(id) as { payload: string }[]).map(
        (r) => (JSON.parse(r.payload) as { kind: string }).kind,
      );
      assert.deepEqual(kinds, ['began'], 'nothing from the failed turn may be half-written');
    } finally {
      side.close();
    }

    const { view } = await api.view(id);
    assert.equal(view.transcript.some((l) => l.kind === 'you'), false, 'the cache must not remember a turn the log does not');
  });
});

/** Walks the Drowned Lantern, turning up every clue and claiming ground each time. */
function keepTheVow(): Proposal[] {
  const step = (over: Partial<Proposal>): Proposal => ({
    narration: 'You keep going.',
    op: 'narrate_only',
    target: 'e_olen' as Proposal['target'],
    direction: 'out',
    ability: 'wisdom',
    difficulty: 5,
    damage: 0,
    introduces: null,
    tick: 'none',
    milestone: 'v_debt',
    reveals: 'none',
    ...over,
  });
  return [
    step({ reveals: 'c_ledger_page' }),
    step({ op: 'move', direction: 'down' }),
    step({ reveals: 'c_crate_mark' }),
    step({ op: 'move', direction: 'up' }),
    step({ op: 'move', direction: 'out' }),
    step({ reveals: 'c_boot_prints' }),
    step({ op: 'move', direction: 'north' }),
    step({ reveals: 'c_manifest' }),
    step({ op: 'move', direction: 'south' }),
  ];
}

test('a finished session refuses another turn, and says why', async () => {
  const dir = scratch();
  const route = keepTheVow();
  const { app, api } = await boot(dir, scriptedDirector(route));
  try {
    const { id } = await api.begin({ scenario: 'lantern', seed: 3 });
    let outcome = '';
    for (let i = 0; i < route.length; i++) outcome = (await api.turn(id, 'onward')).view.outcome;
    assert.equal(outcome, 'won', 'the fixture must actually win the session');

    const after = await api.raw<{ error: string; outcome: string }>('POST', `/api/session/${id}/turn`, { utterance: 'and then?' });
    assert.equal(after.status, 409);
    assert.equal(after.body.outcome, 'won');
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the session list counts turns, not raw events', async () => {
  await withApp(async ({ api }) => {
    const { id } = await api.begin({ seed: 3 });
    assert.equal((await api.sessions()).sessions.find((s) => s.id === id)?.turns, 0);

    await api.turn(id, 'one');
    await api.turn(id, 'two');

    const listed = (await api.sessions()).sessions.find((s) => s.id === id);
    assert.equal(listed?.turns, 2, 'a turn is a player utterance, not every event it produced');
  });
});

test('the API never ships DM-only lore to a caller', async () => {
  await withApp(async ({ api }) => {
    const { id } = await api.begin({ seed: 5 });
    const begun = await api.raw('GET', `/api/session/${id}`);
    const turned = await api.raw('POST', `/api/session/${id}/turn`, { utterance: 'I look around' });

    for (const r of [begun, turned]) {
      assert.ok(!r.text.includes('owes the harbourmaster'), 'private lore reached the wire');
      assert.ok(!r.text.includes('hostile'), 'the hostility flag is DM bookkeeping');
    }
  });
});

test('the same seed produces the same roll through the API', async () => {
  await withApp(async ({ api }) => {
    const a = await api.begin({ seed: 20260918 });
    const b = await api.begin({ seed: 20260918 });

    // Assert on the die face, not the whole line. The scripted director is one shared
    // object that advances per call, so the second session is adjudicated against the next
    // script entry and gets a different DC. The seed governs the die, not the DM.
    const faceOf = (v: { transcript: readonly { kind: string; text: string }[] }) => {
      const line = v.transcript.find((l) => l.kind === 'roll')?.text;
      return line === undefined ? null : /d20 . (\d+)/.exec(line)?.[1] ?? null;
    };

    const fa = faceOf((await api.turn(a.id, 'I strike at Marga')).view);
    const fb = faceOf((await api.turn(b.id, 'I strike at Marga')).view);

    assert.ok(fa, 'expected a roll');
    assert.equal(fa, fb, 'two sessions with one seed must roll the same die');
  });
});

test('a session id that is not a uuid is rejected by the route, not by the store', async () => {
  await withApp(async ({ api }) => {
    const r = await api.raw('GET', '/api/session/..%2f..%2fetc');
    assert.ok(r.status === 404 || r.status === 403, `got ${r.status}`);
  });
});
