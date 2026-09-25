/**
 * Does the structured-output guarantee survive the transport the design actually ships?
 *
 * Both earlier probes measured Ollama's native /api/generate with `format: <schema>`.
 * The design's usage example points callers at the OpenAI-compatible /v1 endpoint, which
 * constrains output through `response_format` instead. Those are different mechanisms and
 * a result on one does not transfer to the other.
 *
 * Usage:
 *   node tools/model-probe/probe-transport.mjs --model qwen2.5:3b-instruct --trials 8
 *   node tools/model-probe/probe-transport.mjs --endpoint http://127.0.0.1:11434/v1
 */

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    model: { type: "string", default: "qwen2.5:3b-instruct" },
    endpoint: { type: "string", default: "http://127.0.0.1:11434/v1" },
    trials: { type: "string", default: "8" },
  },
});

const TRIALS = Number(values.trials);
/** Native Ollama generate lives on the host root; strip a trailing /v1 if present. */
const HOST = values.endpoint.replace(/\/v1\/?$/, "");

const SCHEMA = {
  type: "object",
  properties: {
    narration: { type: "string" },
    intent: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["skill_check", "attack", "narrate_only"] },
        ability: {
          type: "string",
          enum: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
        },
        difficulty: { type: "integer", minimum: 5, maximum: 30 },
      },
      required: ["kind", "ability", "difficulty"],
    },
  },
  required: ["narration", "intent"],
};

const PROMPT = `You are the Dungeon Master. The player says: "I try to pick the rusted lock on the cellar door, quietly, while the guard paces upstairs."

Decide what happens. Respond with the narration and the check the player must make.`;

function validate(obj) {
  const errors = [];
  if (typeof obj?.narration !== "string" || obj.narration.length === 0) errors.push("narration missing");
  const i = obj?.intent;
  if (typeof i !== "object" || i === null) return [...errors, "intent missing"];
  if (!["skill_check", "attack", "narrate_only"].includes(i.kind)) errors.push(`kind: ${JSON.stringify(i.kind)}`);
  const ab = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  if (!ab.includes(i.ability)) errors.push(`ability: ${JSON.stringify(i.ability)}`);
  if (!Number.isInteger(i.difficulty) || i.difficulty < 5 || i.difficulty > 30) {
    errors.push(`difficulty: ${JSON.stringify(i.difficulty)}`);
  }
  return errors;
}

async function fetchOrThrow(url, init) {
  let r;
  try {
    r = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`endpoint unreachable (${values.endpoint}): ${msg}`);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r;
}

const TRANSPORTS = {
  "native /api/generate + format:<schema>": async () => {
    const r = await fetchOrThrow(`${HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: values.model, prompt: PROMPT, stream: false, format: SCHEMA, options: { temperature: 0.8 } }),
    });
    return (await r.json()).response;
  },

  "/v1 chat + response_format:json_schema": async () => {
    const r = await fetchOrThrow(`${HOST}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "******" },
      body: JSON.stringify({
        model: values.model,
        messages: [{ role: "user", content: PROMPT }],
        temperature: 0.8,
        response_format: { type: "json_schema", json_schema: { name: "dm_action", strict: true, schema: SCHEMA } },
      }),
    });
    return (await r.json()).choices[0].message.content;
  },

  "/v1 chat + response_format:json_object": async () => {
    const r = await fetchOrThrow(`${HOST}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "******" },
      body: JSON.stringify({
        model: values.model,
        messages: [{ role: "user", content: PROMPT }],
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    });
    return (await r.json()).choices[0].message.content;
  },
};

const summary = [];
for (const [label, call] of Object.entries(TRANSPORTS)) {
  let valid = 0;
  let parsed = 0;
  let fatal = null;
  const reasons = new Map();

  for (let i = 0; i < TRIALS; i++) {
    try {
      const raw = await call();
      let obj = null;
      try {
        obj = JSON.parse(raw);
        parsed++;
      } catch {
        reasons.set("unparseable", (reasons.get("unparseable") ?? 0) + 1);
      }
      if (obj) {
        const errs = validate(obj);
        if (errs.length === 0) valid++;
        else for (const e of errs) reasons.set(e, (reasons.get(e) ?? 0) + 1);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("endpoint unreachable") || msg.startsWith("HTTP ")) {
        console.error(`\nerror: ${msg}`);
        process.exit(2);
      }
      fatal = msg;
      reasons.set(`REQUEST FAILED: ${msg}`, (reasons.get(`REQUEST FAILED: ${msg}`) ?? 0) + 1);
    }
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  console.log(`\n=== ${label} ===`);
  console.log(`  parses        ${parsed}/${TRIALS}`);
  console.log(`  ENGINE-VALID  ${valid}/${TRIALS}`);
  if (reasons.size > 0) {
    for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 4)) console.log(`    ${n}x  ${r}`);
  }
  summary.push({ label, valid, fatal });
}

console.log(`\n================ VERDICT ================`);
for (const s of summary) console.log(`  ${String(s.valid).padStart(2)}/${TRIALS} engine-valid   ${s.label}`);