/**
 * The entry point. Reads the environment, builds the app, and listens.
 *
 * All behaviour lives in app.ts so it can be constructed in a test. Keep this file boring.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createApp } from './app.ts';
import { ollamaDirector, scriptedDirector, wanderingDirector } from './director.ts';
import type { Director } from './director.ts';
import { DEMO_SCRIPT } from './demo-script.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env['PORT'] ?? 8787);
const DB = process.env['PORTALE_DB'] ?? join(HERE, '..', '..', '..', 'data', 'portale.db');

const dm = process.env['PORTALE_DM'];
const director: Director =
  dm === 'scripted'
    ? scriptedDirector(DEMO_SCRIPT)
    : dm === 'wander'
      ? wanderingDirector()
      : ollamaDirector({
          endpoint: process.env['OLLAMA_ENDPOINT'] ?? 'http://127.0.0.1:11434/v1',
          model: process.env['OLLAMA_MODEL'] ?? 'qwen2.5:3b-instruct',
        });

const app = createApp({ director, dbPath: DB });

const actual = await app.listen(PORT);
console.log(`portale listening on http://127.0.0.1:${actual}  dm=${director.name}  db=${DB}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
