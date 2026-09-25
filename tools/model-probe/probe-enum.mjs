/**
 * Tests candidate 1's central architectural claim and its stated risk.
 *
 * The claim: build the JSON schema per turn from live world state, so illegal targets
 * become undecodable rather than merely rejected.
 *
 * The risk it flagged: a long target enum in a crowded room may degrade the model's
 * ability to pick the RIGHT target. The enum guarantees it picks something valid. It
 * cannot guarantee it picks something sensible.
 *
 * So validity is not the measurement here. Correctness of choice is.
 *
 * Usage:
 *   node tools/model-probe/probe-enum.mjs --model qwen2.5:3b-instruct --trials 10
 *   node tools/model-probe/probe-enum.mjs --endpoint http://127.0.0.1:11434/v1
 */

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    model: { type: "string", default: "qwen2.5:3b-instruct" },
    endpoint: { type: "string", default: "http://127.0.0.1:11434/v1" },
    trials: { type: "string", default: "10" },
    /**
     * Drop the tempting wrong answer from the distractor pool.
     *
     * The 30-trial run showed correctness flat across enum sizes (15, 11, 13, 8, 15 out
     * of 30 for sizes 3, 6, 8, 10, 25) while ONE distractor caused most of the errors.
     * That kills list length as the mechanism. This flag tests the surviving hypothesis:
     * that what matters is which distractors are present, not how many.
     */
    "no-attractor": { type: "boolean", default: false },
  },
});

const TRIALS = Number(values.trials);
/** Native Ollama generate lives on the host root; strip a trailing /v1 if present. */
const HOST = values.endpoint.replace(/\/v1\/?$/, "");


/** The unambiguously correct answer. The scene names her and only her as the threat. */
const CORRECT = "e_marga_smuggler";

/**
 * The attractor MUST be index 0 so it is present in every condition including the
 * smallest. A first version of this script sliced distractors from an arbitrary order,
 * which left the tempting wrong answer out of the 3-entity case entirely and confounded
 * enum length with distractor identity. The 8/8 it reported was not measuring length.
 */
const DISTRACTORS_ALL = [
  "e_old_woman_knitting", "e_barkeep_olen", "e_drunk_by_hearth", "e_lute_player",
  "e_dock_hand_sel", "e_card_sharp", "e_militia_corporal",
  "e_fishwife_bren", "e_hooded_scribe", "e_apprentice_cooper", "e_off_duty_guard",
  "e_beggar_at_door", "e_travelling_priest", "e_wine_merchant", "e_deaf_porter",
  "e_twin_sister_a", "e_twin_sister_b", "e_rat_catcher", "e_mute_stablehand",
  "e_tax_collector", "e_bard_asleep", "e_cheese_seller", "e_goat_in_corner",
  "e_militia_sergeant",
];

const ATTRACTOR = "e_old_woman_knitting";
const DISTRACTORS = values["no-attractor"]
  ? DISTRACTORS_ALL.filter((d) => d !== ATTRACTOR)
  : DISTRACTORS_ALL;

const SCENE = `The common room of the Drowned Lantern. Marga, a one-eyed smuggler, has just
drawn a curved knife and is stepping toward you. Everyone else in the room is a bystander
going about their evening.`;

const PLAYER = `I draw my sword and strike at the one-eyed smuggler threatening me.`;

/** Builds the per-turn schema exactly as candidate 1's design prescribes. */
function buildSchema(inReach) {
  return {
    type: "object",
    properties: {
      narration: { type: "string" },
      op: { type: "string", enum: ["attack", "talk", "flee", "wait"] },
      target: { type: "string", enum: inReach },
    },
    required: ["narration", "op", "target"],
  };
}

function shuffled(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function runTrial(inReach) {
  const body = {
    model: values.model,
    prompt: `You are the Dungeon Master.\n\nScene: ${SCENE}\n\nPlayer: "${PLAYER}"\n\nDecide what happens and who the action targets.`,
    stream: false,
    format: buildSchema(inReach),
    options: { temperature: 0.8 },
  };

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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  let parsed = null;
  try {
    parsed = JSON.parse(data.response);
  } catch {
    /* falls through to invalid */
  }

  const inEnum = parsed !== null && inReach.includes(parsed.target);
  return {
    wallMs: performance.now() - started,
    evalCount: data.eval_count ?? 0,
    evalDurationMs: (data.eval_duration ?? 0) / 1e6,
    inEnum,
    correct: parsed?.target === CORRECT,
    opCorrect: parsed?.op === "attack",
    chose: parsed?.target ?? "<unparseable>",
  };
}

async function runSize(n, label) {
  const results = [];
  for (let i = 0; i < TRIALS; i++) {
    const inReach = shuffled([CORRECT, ...DISTRACTORS.slice(0, n - 1)], i + 1);
    try {
      results.push(await runTrial(inReach));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("endpoint unreachable") || msg.startsWith("HTTP ")) {
        console.error(`\nerror: ${msg}`);
        process.exit(2);
      }
      results.push({ inEnum: false, correct: false, opCorrect: false, chose: `ERROR ${msg}`, wallMs: 0, evalCount: 0, evalDurationMs: 0 });
    }
    process.stdout.write(".");
  }
  process.stdout.write("\n");


  const inEnum = results.filter((r) => r.inEnum).length;
  const correct = results.filter((r) => r.correct).length;
  const opCorrect = results.filter((r) => r.opCorrect).length;
  const tokens = results.reduce((a, r) => a + r.evalCount, 0);
  const evalMs = results.reduce((a, r) => a + r.evalDurationMs, 0);

  console.log(`\n=== ${label} (enum size ${n}) ===`);
  console.log(`  target inside enum    ${inEnum}/${TRIALS}   <- decoder guarantee`);
  console.log(`  target CORRECT        ${correct}/${TRIALS}   <- the thing at risk`);
  console.log(`  op correct (attack)   ${opCorrect}/${TRIALS}`);
  console.log(`  tokens/sec            ${evalMs > 0 ? (tokens / (evalMs / 1000)).toFixed(1) : "n/a"}`);

  const wrong = results.filter((r) => !r.correct);
  if (wrong.length > 0) {
    const counts = new Map();
    for (const w of wrong) counts.set(w.chose, (counts.get(w.chose) ?? 0) + 1);
    console.log(`  wrong picks:`);
    for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`    ${v}x  ${k}`);
  }
  return { n, label, inEnum, correct, trials: TRIALS };
}

console.log(`model=${values.model}  endpoint=${values.endpoint}  trials=${TRIALS}  correct answer=${CORRECT}`);

console.log(`NOTE: 3B on CPU is WEAKER than the 14B production target, so this is a`);
console.log(`conservative direction. If it holds here it should hold there.\n`);

const out = [];
const only = process.env.PROBE_SIZES ? process.env.PROBE_SIZES.split(",").map(Number) : null;
const PLAN = [[3, "small room"], [6, "at the proposed cap"], [8, "at the decoder-visible bound"], [10, "busy room"], [25, "crowded room"]];
for (const [n, label] of PLAN) {
  if (only !== null && !only.includes(n)) continue;
  out.push(await runSize(n, label));
}

console.log(`\n================ VERDICT ================`);
for (const s of out) {
  console.log(
    `  enum ${String(s.n).padStart(2)}  in-enum ${s.inEnum}/${s.trials}  correct ${s.correct}/${s.trials}   ${s.label}`,
  );
}
console.log(`\nThe attractor e_old_woman_knitting is present in EVERY condition, so the`);
console.log(`only variable across rows is list length.`);

