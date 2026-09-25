/**
 * Measures whether a local model can be trusted to emit engine-valid DM actions.
 *
 * The architectural question this answers: does schema-constrained decoding remove
 * malformed output as a failure mode the application has to handle, or does the API
 * tier need a repair-and-retry path?
 *
 * Usage:
 *   node tools/model-probe/probe.mjs --model qwen2.5:3b-instruct --trials 10
 *   node tools/model-probe/probe.mjs --endpoint http://127.0.0.1:11434/v1
 */

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    model: { type: "string", default: "qwen2.5:3b-instruct" },
    endpoint: { type: "string", default: "http://127.0.0.1:11434/v1" },
    trials: { type: "string", default: "10" },
  },
});

const TRIALS = Number(values.trials);
/** Native Ollama generate lives on the host root; strip a trailing /v1 if present. */
const HOST = values.endpoint.replace(/\/v1\/?$/, "");


/**
 * The shape the engine would accept from the DM. Deliberately includes a bounded
 * enum, a nested object, and an integer range, because those are what weak models
 * violate first.
 */
const DM_ACTION_SCHEMA = {
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

/**
 * Modes without a schema are told the required shape in prose. Without this the
 * comparison is confounded: schema mode receives the field names and the baselines do
 * not, so a baseline failure could mean "cannot follow a shape" or merely "was never
 * shown one". Stating it here makes the contrast measure compliance, not disclosure.
 */
const SHAPE_IN_PROSE = `

Reply with ONLY a JSON object, no prose outside it, using exactly these keys:
{"narration": <string>, "intent": {"kind": <one of "skill_check"|"attack"|"narrate_only">, "ability": <one of "strength"|"dexterity"|"constitution"|"intelligence"|"wisdom"|"charisma">, "difficulty": <integer between 5 and 30>}}`;

/** Validates against the real invariants the engine would enforce, not just JSON.parse. */
function validate(obj) {
  const errors = [];
  if (typeof obj?.narration !== "string" || obj.narration.length === 0) {
    errors.push("narration missing or empty");
  }
  const intent = obj?.intent;
  if (typeof intent !== "object" || intent === null) {
    errors.push("intent missing");
    return errors;
  }
  if (!["skill_check", "attack", "narrate_only"].includes(intent.kind)) {
    errors.push(`intent.kind not in enum: ${JSON.stringify(intent.kind)}`);
  }
  const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  if (!abilities.includes(intent.ability)) {
    errors.push(`intent.ability not in enum: ${JSON.stringify(intent.ability)}`);
  }
  if (!Number.isInteger(intent.difficulty) || intent.difficulty < 5 || intent.difficulty > 30) {
    errors.push(`intent.difficulty out of range: ${JSON.stringify(intent.difficulty)}`);
  }
  return errors;
}

async function runTrial(mode) {
  const body = {
    model: values.model,
    prompt: mode === "schema" ? PROMPT : PROMPT + SHAPE_IN_PROSE,
    stream: false,
    options: { temperature: 0.8 },
  };
  if (mode === "schema") body.format = DM_ACTION_SCHEMA;
  else if (mode === "json") body.format = "json";

  const started = performance.now();
  let res;
  try {
    res = await fetch(`${HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`endpoint unreachable (${values.endpoint}): ${msg}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const wallMs = performance.now() - started;

  let parsed = null;
  let parseError = null;
  try {
    parsed = JSON.parse(data.response);
  } catch (e) {
    parseError = e.message;
  }

  return {
    wallMs,
    evalCount: data.eval_count ?? 0,
    evalDurationMs: (data.eval_duration ?? 0) / 1e6,
    parsed,
    parseError,
    schemaErrors: parsed ? validate(parsed) : ["unparseable"],
    raw: data.response,
  };
}

async function runMode(mode, label) {
  const results = [];
  for (let i = 0; i < TRIALS; i++) {
    try {
      results.push(await runTrial(mode));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("endpoint unreachable") || msg.startsWith("HTTP ")) {
        console.error(`\nerror: ${msg}`);
        process.exit(2);
      }
      results.push({
        fatal: msg,
        schemaErrors: ["request failed"],
        wallMs: 0,
        evalCount: 0,
        evalDurationMs: 0,
      });
    }
    process.stdout.write(".");
  }
  process.stdout.write("\n");


  const parseOk = results.filter((r) => !r.parseError && !r.fatal).length;
  const validOk = results.filter((r) => r.schemaErrors.length === 0).length;
  const totalTokens = results.reduce((a, r) => a + r.evalCount, 0);
  const totalEvalMs = results.reduce((a, r) => a + r.evalDurationMs, 0);
  const avgWall = results.reduce((a, r) => a + r.wallMs, 0) / results.length;

  console.log(`\n=== ${label} ===`);
  console.log(`  JSON parses cleanly   ${parseOk}/${TRIALS}`);
  console.log(`  ENGINE-VALID          ${validOk}/${TRIALS}`);
  console.log(
    `  tokens/sec (gen)      ${totalEvalMs > 0 ? (totalTokens / (totalEvalMs / 1000)).toFixed(1) : "n/a"}`,
  );
  console.log(`  avg wall per turn     ${(avgWall / 1000).toFixed(1)}s`);

  const failures = results.filter((r) => r.schemaErrors.length > 0);
  if (failures.length > 0) {
    const reasons = new Map();
    for (const f of failures) {
      for (const e of f.schemaErrors) reasons.set(e, (reasons.get(e) ?? 0) + 1);
    }
    console.log(`  failure reasons:`);
    for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${n}x  ${reason}`);
    }
    console.log(`  first failing raw output:`);
    console.log(`    ${JSON.stringify(failures[0].raw ?? failures[0].fatal).slice(0, 300)}`);
  }
  return { label, parseOk, validOk, trials: TRIALS };
}

console.log(`model=${values.model}  endpoint=${values.endpoint}  host=${HOST}  trials=${TRIALS}`);

const summary = [];
summary.push(await runMode("none", "unconstrained (plain prompt)"));
summary.push(await runMode("json", "format:json (JSON mode)"));
summary.push(await runMode("schema", "format:<schema> (constrained decoding)"));

console.log(`\n================ VERDICT ================`);
for (const s of summary) {
  console.log(`  ${String(s.validOk).padStart(2)}/${s.trials} engine-valid   ${s.label}`);
}
