/**
 * The API tier, as a thing you can construct rather than a thing that happens on import.
 *
 * The UI client talks to this. This talks to the database and the model. The browser never
 * reaches the model directly and never receives a World.
 *
 * Everything the app needs is passed in, so a test can build one on an ephemeral port with
 * a scripted DM and a throwaway database, and the HTTP surface gets exercised for real
 * rather than mocked.
 */

import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

import { seed } from './dice.ts';
import type { Director } from './director.ts';
import { SCENARIOS, begin, takeTurn } from './engine.ts';
import type { Session } from './engine.ts';
import { openStore } from './store.ts';
import type { Store } from './store.ts';
import { apply, project } from './world.ts';
import type { World } from './world.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Bodies are tiny by design. An unbounded read is a denial of service with extra steps. */
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_UTTERANCE = 2000;

export interface AppDeps {
  readonly director: Director;
  /** Path to the SQLite file, or ':memory:' for a test. */
  readonly dbPath: string;
  /** Overridable so a test can point at a fixture directory. */
  readonly publicDir?: string;
}

export interface App {
  readonly server: Server;
  readonly store: Store;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

class BadRequest extends Error {}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function json(res: ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BadRequest('request body too large');
    chunks.push(c as Buffer);
  }
  if (chunks.length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BadRequest('body was not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequest('body must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

export function createApp(deps: AppDeps): App {
  const publicDir = normalize(deps.publicDir ?? join(HERE, '..', 'public'));
  const store = openStore(deps.dbPath);
  const live = new Map<string, Session>();
  const inFlight = new Set<string>();

  const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;

  /**
   * Rebuilds a session from its event log. The live map is only a cache, so deleting it
   * must change nothing a caller can observe. That property is what the restart test
   * actually checks, and it is the one an in-memory cache is most likely to hide.
   */
  function rebuild(id: string): Session | null {
    const cached = live.get(id);
    if (cached !== undefined) return cached;

    const stored = store.load(id);
    if (stored === null) return null;

    const scenario = scenarioById(stored.scenario);
    // Derive the blank world from begin() rather than hand-building one. A hand-built base
    // has to be updated every time World grows a field, and silently loses whatever it
    // forgot.
    const fresh = begin(scenario, seed(stored.seed));
    const base: World = { ...fresh, seq: 0, log: [] };

    const session: Session = { id, world: stored.events.reduce(apply, base) };
    live.set(id, session);
    return session;
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname;

    try {
      if (req.method === 'GET' && path === '/api/health') {
        return json(res, 200, {
          ok: true,
          dm: deps.director.name,
          scenarios: SCENARIOS.map((s) => s.id),
        });
      }

      if (req.method === 'GET' && path === '/api/scenarios') {
        return json(res, 200, {
          scenarios: SCENARIOS.map((s) => ({ id: s.id, title: s.title, scene: s.scene })),
        });
      }

      if (req.method === 'GET' && path === '/api/sessions') {
        return json(res, 200, { sessions: store.list() });
      }

      if (req.method === 'POST' && path === '/api/session') {
        const body = await readJson(req);

        const wanted = body['scenario'];
        if (wanted !== undefined && !SCENARIOS.some((s) => s.id === wanted)) {
          return json(res, 400, { error: `no such scenario: ${String(wanted)}` });
        }

        const rawSeed = body['seed'];
        if (rawSeed !== undefined && (typeof rawSeed !== 'number' || !Number.isFinite(rawSeed))) {
          return json(res, 400, { error: 'seed must be a finite number' });
        }

        const scenario = scenarioById(String(wanted ?? SCENARIOS[0]!.id));
        const s = seed(typeof rawSeed === 'number' ? rawSeed : Math.floor(Math.random() * 0xffffffff));
        const id = randomUUID();

        const world = begin(scenario, s);
        store.create(id, scenario.id, s);
        store.append(id, world.log);
        live.set(id, { id, world });

        return json(res, 201, { id, view: project(world) });
      }

      const turnMatch = /^\/api\/session\/([\w-]+)\/turn$/.exec(path);
      if (turnMatch && req.method === 'POST') {
        const session = rebuild(turnMatch[1]!);
        if (session === null) return json(res, 404, { error: 'no such session' });

        const body = await readJson(req);
        const raw = body['utterance'];
        if (typeof raw !== 'string') return json(res, 400, { error: 'utterance must be a string' });
        const utterance = raw.trim();
        if (utterance.length === 0) return json(res, 400, { error: 'utterance required' });
        if (utterance.length > MAX_UTTERANCE) return json(res, 400, { error: 'utterance too long' });

        // One turn at a time per session. takeTurn mutates session.world before awaiting
        // the model, which can take tens of seconds, so a double submit would interleave
        // two turns into one log and desynchronise the database.
        if (inFlight.has(session.id)) {
          return json(res, 409, { error: 'a turn is already in flight' });
        }
        inFlight.add(session.id);
        try {
          const before = session.world.log.length;
          const result = await takeTurn(session, utterance, deps.director);
          store.append(session.id, session.world.log.slice(before));
          return json(res, 200, result);
        } finally {
          inFlight.delete(session.id);
        }
      }
      if (turnMatch) return json(res, 405, { error: 'method not allowed' });

      const viewMatch = /^\/api\/session\/([\w-]+)$/.exec(path);
      if (viewMatch && req.method === 'GET') {
        const session = rebuild(viewMatch[1]!);
        if (session === null) return json(res, 404, { error: 'no such session' });
        return json(res, 200, { id: session.id, view: project(session.world) });
      }
      if (viewMatch) return json(res, 405, { error: 'method not allowed' });

      if (path.startsWith('/api/')) return json(res, 404, { error: 'no such endpoint' });

      const file = path === '/' ? 'index.html' : decodeURIComponent(path.slice(1));
      const resolved = normalize(join(publicDir, file));
      // The separator matters. A bare prefix test would also accept a sibling directory
      // whose name merely starts with the public directory's name.
      if (resolved !== publicDir && !resolved.startsWith(publicDir + sep)) {
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

  return {
    server,
    store,
    listen(port) {
      return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
          const addr = server.address();
          resolve(typeof addr === 'object' && addr !== null ? addr.port : port);
        });
      });
    },
    async close() {
      // Order matters. Drop live connections first, then stop accepting, then close the
      // database. Closing the store inside the server's close callback tripped a libuv
      // assertion on Windows, because the handle was still tearing down.
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      store.close();
    },
  };
}
