/**
 * The API tier. UI client talks to this; this talks to the database and the model.
 * The browser never reaches the model directly and never receives a World.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

import { seed } from './dice.ts';
import { ollamaDirector, scriptedDirector } from './director.ts';
import type { Director, Proposal } from './director.ts';
import { SCENARIOS, begin, takeTurn } from './engine.ts';
import type { Session } from './engine.ts';
import { openStore } from './store.ts';
import { apply, project } from './world.ts';
import type { World } from './world.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');

const PORT = Number(process.env['PORT'] ?? 8787);
const DB = process.env['PORTALE_DB'] ?? join(HERE, '..', '..', '..', 'data', 'portale.db');

/**
 * Verification and tests need a DM that cannot vary. This is the same seam the unit tests
 * use, exposed so a harness can drive the real HTTP surface without a GPU or a model.
 *
 * The second entry is deliberately illegal. The director repeats its last entry once the
 * script runs out, so turn one shows an ordinary roll and every turn after it exercises
 * the engine overruling the DM. Without that, the engine-authority proof has nothing to
 * photograph.
 */
const SCRIPT: Proposal[] = [
  {
    narration: 'Marga sees your hand move and is already rising, the curved knife catching the lamplight.',
    op: 'attack',
    target: 'e_marga' as Proposal['target'],
    ability: 'dexterity',
    difficulty: 12,
    damage: 4,
    introduces: null,
  },
  {
    narration: 'She twists away, and for a moment the whole room seems to hold its breath.',
    op: 'attack',
    target: 'e_marga' as Proposal['target'],
    ability: 'dexterity',
    difficulty: 30,
    damage: 999,
    introduces: null,
  },
];

const director: Director =
  process.env['PORTALE_DM'] === 'scripted' ? scriptedDirector(SCRIPT) : ollamaDirector({
    endpoint: process.env['OLLAMA_ENDPOINT'] ?? 'http://127.0.0.1:11434/v1',
    model: process.env['OLLAMA_MODEL'] ?? 'qwen2.5:3b-instruct',
  });

const store = openStore(DB);
const live = new Map<string, Session>();
const inFlight = new Set<string>();

function scenarioById(id: string) {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}

function rebuild(id: string): Session | null {
  const cached = live.get(id);
  if (cached !== undefined) return cached;

  const stored = store.load(id);
  if (stored === null) return null;

  const scenario = scenarioById(stored.scenario);
  const entities = new Map(begin(scenario, seed(stored.seed)).entities);
  const base: World = {
    seq: 0,
    seed: seed(stored.seed),
    mode: scenario.mode,
    scene: scenario.scene,
    protagonist: begin(scenario, seed(stored.seed)).protagonist,
    entities,
    log: [],
  };

  const session: Session = { id, world: stored.events.reduce(apply, base) };
  live.set(id, session);
  return session;
}

function json(res: import('node:http').ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

/** Bodies are tiny by design. An unbounded read is a denial of service with extra steps. */
const MAX_BODY_BYTES = 16 * 1024;
const MAX_UTTERANCE = 2000;

class BadRequest extends Error {}

async function readJson(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BadRequest('request body too large');
    chunks.push(c as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new BadRequest('body must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    throw e instanceof BadRequest ? e : new BadRequest('body was not valid JSON');
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/health') {
      return json(res, 200, { ok: true, dm: director.name, scenarios: SCENARIOS.map((s) => s.id) });
    }

    if (req.method === 'GET' && path === '/api/sessions') {
      return json(res, 200, { sessions: store.list() });
    }

    if (req.method === 'POST' && path === '/api/session') {
      const body = await readJson(req);
      const scenario = scenarioById(String(body['scenario'] ?? SCENARIOS[0]!.id));
      const s = seed(typeof body['seed'] === 'number' ? body['seed'] : Math.floor(Math.random() * 0xffffffff));
      const id = randomUUID();

      const world = begin(scenario, s);
      store.create(id, scenario.id, s);
      store.append(id, world.log);
      live.set(id, { id, world });

      return json(res, 201, { id, view: project(world) });
    }

    const turnMatch = /^\/api\/session\/([\w-]+)\/turn$/.exec(path);
    if (req.method === 'POST' && turnMatch) {
      const session = rebuild(turnMatch[1]!);
      if (session === null) return json(res, 404, { error: 'no such session' });

      const body = await readJson(req);
      const utterance = String(body['utterance'] ?? '').trim();
      if (utterance.length === 0) return json(res, 400, { error: 'utterance required' });
      if (utterance.length > MAX_UTTERANCE) return json(res, 400, { error: 'utterance too long' });

      // One turn at a time per session. takeTurn mutates session.world before awaiting the
      // model, which can take tens of seconds, so a double submit would interleave two
      // turns into one log and desynchronise the database.
      if (inFlight.has(session.id)) return json(res, 409, { error: 'a turn is already in flight' });
      inFlight.add(session.id);
      try {
        const before = session.world.log.length;
        const result = await takeTurn(session, utterance, director);
        store.append(session.id, session.world.log.slice(before));
        return json(res, 200, result);
      } finally {
        inFlight.delete(session.id);
      }
    }

    const viewMatch = /^\/api\/session\/([\w-]+)$/.exec(path);
    if (req.method === 'GET' && viewMatch) {
      const session = rebuild(viewMatch[1]!);
      if (session === null) return json(res, 404, { error: 'no such session' });
      return json(res, 200, { id: session.id, view: project(session.world) });
    }

    const file = path === '/' ? 'index.html' : path.slice(1);
    const resolved = normalize(join(PUBLIC, file));
    // The separator matters. A bare prefix test would also accept a sibling directory
    // whose name merely starts with "public".
    if (resolved !== PUBLIC && !resolved.startsWith(PUBLIC + sep)) {
      return json(res, 403, { error: 'forbidden' });
    }

    const ext = resolved.slice(resolved.lastIndexOf('.'));
    const content = await readFile(resolved);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    return res.end(content);
  } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, { error: e.message });
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return json(res, 404, { error: 'not found' });
    return json(res, 500, { error: String(e) });
  }
});

server.listen(PORT, () => {
  console.log(`portale listening on http://127.0.0.1:${PORT}  dm=${director.name}  db=${DB}`);
});
