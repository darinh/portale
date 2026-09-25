#!/usr/bin/env node
/**
 * Talk to the Portale API directly, without a browser.
 *
 * Use this to poke the server by hand, to reproduce a bug from a real session, or to smoke
 * a build. It can boot its own throwaway server, so there is nothing to set up first.
 *
 *   node tools/api-cli/run.mjs --serve scripted smoke
 *   node tools/api-cli/run.mjs --serve wander smoke
 *   node tools/api-cli/run.mjs --serve live play
 *   node tools/api-cli/run.mjs --url http://127.0.0.1:8787 health
 *   node tools/api-cli/run.mjs raw GET /api/sessions
 *
 * Flags:
 *   --url <base>        talk to an already running server (default http://127.0.0.1:8787)
 *   --serve scripted    boot a throwaway server with a fixed DM, no model needed
 *   --serve wander      boot a throwaway server with the model-free wandering DM
 *   --serve live        boot a throwaway server against the local model
 *   --db <path>         database for --serve (default: a temp file, deleted on exit)
 *   --seed <n>          seed for begin, play and smoke
 *   --json              print raw JSON instead of a readable transcript
 */

import { createInterface } from "node:readline/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApp } from "../../packages/app/src/app.ts";
import { portaleClient } from "../../packages/app/src/client.ts";
import { ollamaDirector, scriptedDirector, wanderingDirector } from "../../packages/app/src/director.ts";
import { DEMO_SCRIPT } from "../../packages/app/src/demo-script.ts";


const argv = process.argv.slice(2);
function flag(name, fallback = undefined) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
}
function bool(name) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return false;
  argv.splice(i, 1);
  return true;
}

const serveMode = flag("serve");
const asJson = bool("json");
const seedArg = flag("seed");
const dbArg = flag("db");
let url = flag("url", "http://127.0.0.1:8787");

let app = null;
let scratchDir = null;

async function bootIfAsked() {
  if (serveMode === undefined) return;
  if (serveMode !== "scripted" && serveMode !== "wander" && serveMode !== "live") {
    throw new Error(`--serve takes "scripted", "wander", or "live", got ${serveMode}`);
  }

  const director =
    serveMode === "scripted"
      ? scriptedDirector(DEMO_SCRIPT)
      : serveMode === "wander"
        ? wanderingDirector()
        : ollamaDirector({
            endpoint: process.env.OLLAMA_ENDPOINT ?? "http://127.0.0.1:11434/v1",
            model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b-instruct",
          });


  let dbPath = dbArg;
  if (dbPath === undefined) {
    scratchDir = mkdtempSync(join(tmpdir(), "portale-cli-"));
    dbPath = join(scratchDir, "cli.db");
  }

  app = createApp({ director, dbPath });
  const port = await app.listen(0);
  url = `http://127.0.0.1:${port}`;
  console.error(`# throwaway server on ${url}  dm=${director.name}`);
}

let closed = false;
async function shutdown(code) {
  if (code !== 0 || process.exitCode === undefined) process.exitCode = code;
  if (closed) return;
  closed = true;
  if (app !== null) await app.close();
  if (scratchDir !== null) rmSync(scratchDir, { recursive: true, force: true });
  // Deliberately no process.exit. Letting the loop drain avoids racing socket teardown,
  // which tripped a libuv assertion on Windows.
}

function renderView(view) {
  if (asJson) {
    console.log(JSON.stringify(view, null, 2));
    return;
  }
  console.log(`\n  [${view.mode}]  you ${view.you.hp.now}/${view.you.hp.max}  seq ${view.seq}`);
  for (const line of view.transcript) {
    const tag = { you: ">", dm: " ", roll: "*", mech: "!", ruled: "~" }[line.kind] ?? "?";
    console.log(`  ${tag} ${line.text}`);
  }
  const cast = view.present.map(
    (p) => `${p.name} ${p.hp.now}/${p.hp.max}${p.dead ? " (dead)" : ""}`,
  );
  if (cast.length > 0) console.log(`  -- ${cast.join("  |  ")}`);
}

const HELP = [
  "commands:",
  "  health                     is the server up, and which DM is wired in",
  "  scenarios                  what can be played",
  "  sessions                   list sessions and their turn counts",
  "  begin                      start a session, prints its id",
  "  view <id>                  show a session",
  "  turn <id> <text...>        take one turn",
  "  play                       start a session and keep taking turns",
  "  smoke                      drive a full scenario and assert the basics",
  "  raw <METHOD> <path> [body] anything else, prints status and body",
].join("\n");

async function main() {
  await bootIfAsked();
  const api = portaleClient(url);
  const [cmd, ...rest] = argv;

  switch (cmd) {
    case undefined:
    case "help":
      console.log(HELP);
      break;

    case "health":
      console.log(JSON.stringify(await api.health(), null, 2));
      break;

    case "scenarios":
      console.log(JSON.stringify(await api.scenarios(), null, 2));
      break;

    case "sessions": {
      const { sessions } = await api.sessions();
      if (sessions.length === 0) console.log("(none)");
      for (const s of sessions) console.log(`  ${s.id}  ${s.scenario}  turns=${s.turns}`);
      break;
    }

    case "begin": {
      const r = await api.begin(seedArg === undefined ? {} : { seed: Number(seedArg) });
      console.log(r.id);
      renderView(r.view);
      break;
    }

    case "view":
      renderView((await api.view(rest[0])).view);
      break;

    case "turn": {
      const [id, ...words] = rest;
      const r = await api.turn(id, words.join(" "));
      renderView(r.view);
      if (r.softFail) console.log("  (nothing came of that)");
      if (r.breach) console.log(`  BREACH: ${r.breach}`);
      break;
    }

    case "play": {
      const started = await api.begin(seedArg === undefined ? {} : { seed: Number(seedArg) });
      console.error(`# session ${started.id}`);
      renderView(started.view);

      const rl = createInterface({ input: process.stdin, output: process.stdout });
      for (;;) {
        const line = (await rl.question("\n> ")).trim();
        if (line === "") continue;
        if (line === "quit" || line === "exit") break;
        try {
          const r = await api.turn(started.id, line);
          renderView(r.view);
          if (r.softFail) console.log("  (nothing came of that)");
          if (r.breach) console.log(`  BREACH: ${r.breach}`);
        } catch (e) {
          console.log(`  error: ${e.message}`);
        }
      }
      rl.close();
      break;
    }

    case "smoke": {
      const checks = [];
      const record = (name, ok, detail = "") => {
        checks.push(ok);
        console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
      };

      const h = await api.health();
      record("health responds", h.ok === true, `dm=${h.dm}`);

      const { id, view } = await api.begin({ seed: seedArg === undefined ? 42 : Number(seedArg) });
      record("session begins at full health", view.you.hp.now === view.you.hp.max);
      record("the opening scene has narration", view.transcript.length > 0);

      const t1 = await api.turn(id, "I draw my blade and strike at Marga");
      record("the turn echoes the player", t1.view.transcript.some((l) => l.kind === "you"));
      record("the engine rolled a die", t1.view.transcript.some((l) => l.kind === "roll"));
      record("no director breach", t1.breach === null);

      const reread = await api.view(id);
      record("the turn persisted", reread.view.seq === t1.view.seq);

      const bad = await api.raw("POST", `/api/session/${id}/turn`, { utterance: "" });
      record("an empty utterance is refused", bad.status === 400, `got ${bad.status}`);

      const missing = await api.raw("GET", "/api/session/does-not-exist");
      record("an unknown session is a 404", missing.status === 404, `got ${missing.status}`);

      record("no DM-only lore on the wire", !JSON.stringify(reread).includes("owes the harbourmaster"));

      const failed = checks.filter((ok) => !ok).length;
      console.log(`\n${failed === 0 ? "SMOKE PASSED" : `SMOKE FAILED (${failed})`}  ${checks.length} checks`);
      await shutdown(failed === 0 ? 0 : 1);
      break;
    }

    case "raw": {
      const [method, path, body] = rest;
      const r = await api.raw(String(method).toUpperCase(), path, body);
      console.log(String(r.status));
      console.log(typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2));
      await shutdown(r.ok ? 0 : 1);
      break;
    }

    default:
      throw new Error(`unknown command "${cmd}", try: help`);
  }

  await shutdown(0);
}

main().catch(async (e) => {
  console.error(`error: ${e.message}`);
  await shutdown(1);
});
