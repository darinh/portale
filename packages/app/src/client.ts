/**
 * A direct line to the Portale API.
 *
 * This exists so the server can be exercised without a browser. The unit tests cover pure
 * logic and the browser harness covers the UI, which left the entire HTTP surface, its
 * status codes and its error paths untested by anything.
 *
 * `raw` is the important method. The typed helpers are a convenience for happy paths, but
 * a test that can only make successful requests cannot prove a 400, a 404, a 409 or a 403,
 * and those are most of what an API contract actually is.
 */

export interface RawResponse<T = unknown> {
  readonly status: number;
  readonly ok: boolean;
  readonly body: T;
  readonly text: string;
  readonly headers: Record<string, string>;
}

export interface Meter {
  readonly now: number;
  readonly max: number;
}

export interface ViewEntity {
  readonly id: string;
  readonly name: string;
  readonly hp: Meter;
  readonly dead: boolean;
}

export interface PlayerView {
  readonly seq: number;
  readonly mode: 'exploration' | 'combat';
  readonly scene: string;
  readonly you: { readonly name: string; readonly hp: Meter };
  readonly present: readonly ViewEntity[];
  /** What the player has discovered. Undiscovered clues are absent, never nulled. */
  readonly leads: readonly { readonly id: string; readonly what: string; readonly vow: string }[];
  readonly transcript: readonly { readonly kind: string; readonly text: string }[];
}

export interface Health {
  readonly ok: boolean;
  readonly dm: string;
  readonly scenarios: readonly string[];
}

export interface BeginResult {
  readonly id: string;
  readonly view: PlayerView;
}

export interface TurnResult {
  readonly view: PlayerView;
  readonly softFail: boolean;
  readonly breach: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(method: string, path: string, status: number, body: unknown) {
    super(`${method} ${path} -> ${status} ${JSON.stringify(body)}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ClientOptions {
  readonly timeoutMs?: number;
}

export function portaleClient(baseUrl: string, opts: ClientOptions = {}) {
  const base = baseUrl.replace(/\/+$/, '');
  const timeoutMs = opts.timeoutMs ?? 300_000;

  async function raw<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<RawResponse<T>> {
    const init: RequestInit = {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    };
    // Strings pass through unserialised so a test can send deliberately malformed JSON.
    if (typeof body === 'string') init.body = body;
    else if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();

    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* not every route returns JSON; static files do not */
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });

    return { status: res.status, ok: res.ok, body: parsed as T, text, headers };
  }

  async function expect<T>(method: string, path: string, want: number, body?: unknown): Promise<T> {
    const r = await raw<T>(method, path, body);
    if (r.status !== want) throw new ApiError(method, path, r.status, r.body);
    return r.body;
  }

  return {
    raw,

    health: () => expect<Health>('GET', '/api/health', 200),

    scenarios: () =>
      expect<{ scenarios: { id: string; title: string; scene: string }[] }>(
        'GET',
        '/api/scenarios',
        200,
      ),

    sessions: () =>
      expect<{ sessions: { id: string; scenario: string; turns: number }[] }>(
        'GET',
        '/api/sessions',
        200,
      ),

    begin: (req: { scenario?: string; seed?: number } = {}) =>
      expect<BeginResult>('POST', '/api/session', 201, req),

    turn: (id: string, utterance: string) =>
      expect<TurnResult>('POST', `/api/session/${id}/turn`, 200, { utterance }),

    view: (id: string) => expect<BeginResult>('GET', `/api/session/${id}`, 200),

    /** Waits for the server to answer, so a caller does not race a cold start. */
    async waitUntilReady(attempts = 60, delayMs = 100): Promise<Health> {
      let last: unknown = null;
      for (let i = 0; i < attempts; i++) {
        try {
          return await this.health();
        } catch (e) {
          last = e;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      throw new Error(`server never became ready at ${base}: ${String(last)}`);
    },
  };
}

export type PortaleClient = ReturnType<typeof portaleClient>;
