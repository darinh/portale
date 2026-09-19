/**
 * Replays a real recorded session against the live model and scores the DM.
 *
 * Every earlier probe measured invented scenarios. This one measures the actual ten turns
 * a player typed, which exposed four defects no unit test could see: the DM never chose a
 * mechanical op, it repeated a narration verbatim, one narration was truncated mid
 * sentence, and it wrote dice mechanics into the prose.
 *
 * It imports the real director module, so it scores the shipped prompt rather than a copy.
 * It does NOT import rules.ts and never calls adjudicate, so it measures the model's
 * proposals in isolation rather than the played game. A change to the adjudicator cannot
 * move this score.
 *
 * ## One pass is a sample, not a verdict
 *
 * Ten turns at temperature 0.85. Measured on known-good code, three single passes gave 0,
 * 0 and 1 fatal failures, so a lone run reporting clean was luck a third of the time and a
 * lone run reporting a failure was a false alarm a third of the time. A single pass was
 * treated as a stable 10/10 baseline for a while, and it never was.
 *
 * Baseline measured 2026-09-19 on qwen2.5:3b-instruct, CPU, `--repeat 3` (30 turns):
 *
 *   violence silently dropped   0/12
 *   fight started over a meta   0/6
 *   op defensible               26/30
 *
 * Compare branches at equal and repeated sample sizes, or you are comparing coin flips.
 *
 * Usage:
 *   node tools/replay-probe/run.mjs --repeat 3
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { buildSchema, renderPrompt, briefFor, SAMPLING } from "../../packages/app/src/director.ts";
import { begin, SCENARIOS } from "../../packages/app/src/engine.ts";
import { apply } from "../../packages/app/src/world.ts";
import { seed } from "../../packages/app/src/dice.ts";

const { values } = parseArgs({
  options: {
    model: { type: "string", default: "qwen2.5:3b-instruct" },
    endpoint: { type: "string", default: "http://127.0.0.1:11434/v1" },
    /**
     * How many times to replay the whole fixture.
     *
     * One pass is ten turns at temperature 0.85, which is a sample, not a verdict. Three
     * control passes on known-good code produced 0, 0 and 1 fatal failures, so a single
     * pass reporting NO FATAL FAILURES was luck a third of the time and a regression alarm
     * a third of the time. Neither is a gate. Repeat and read the rate.
     */
    repeat: { type: "string", default: "1" },
  },
});

const REPEAT = Math.max(1, Number(values.repeat));

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "real-session.json"), "utf8"));

/** Prose that gives away the machinery. A player should never read any of this. */
const LEAK = /\b(DC|difficulty|roll(ed|ing)?|d20|check\s+is\s+set|modifier|saving throw)\b/i;
/** The DM handing the decision back instead of narrating a consequence. */
const MENU = /\b(choose your path|do you|will you|what do you do)\b[^.?!]*\?/i;
/**
 * The DM deciding the outcome itself. It narrates before the engine rolls, so any prose
 * that lands a blow can be contradicted by the die a moment later. Real play produced
 * "the hidden dagger pierces Marga's eye" on a turn the roll then failed.
 */
const OUTCOME = /\b(pierces|slices|sinks into|buries|connects|lands|strikes home|finds its mark|blood (?:pools|scatters|sprays)|crumples|collapses|staggers back(?:ward)?|screams in (?:pain|agony)|twists in agony)\b/i;

async function propose(brief) {
  const res = await fetch(`${values.endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer unused" },
    body: JSON.stringify({
      model: values.model,
      messages: [{ role: "user", content: renderPrompt(brief) }],
      ...SAMPLING,
      response_format: {
        type: "json_schema",
        json_schema: { name: "dm_proposal", strict: true, schema: buildSchema(brief) },
      },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return JSON.parse(body.choices[0].message.content);
}

console.log(`model=${values.model}\nreplaying ${fixture.turns.length} real turns x ${REPEAT} pass(es)\n`);

async function onePass() {
let world = begin(SCENARIOS[0], seed(20260917));
const seen = [];
const results = [];

for (const [i, turn] of fixture.turns.entries()) {
  world = apply(world, { kind: "said", text: turn.utterance });
  const brief = briefFor(world, turn.utterance);

  let p;
  try {
    p = await propose(brief);
  } catch (e) {
    console.log(`  ${i + 1}. REQUEST FAILED ${e.message}`);
    // Carry the category through, or a failed request silently shrinks the denominator
    // and a fatal-failure rate reads better than it is.
    results.push({
      opOk: false,
      truncated: false,
      repeated: false,
      leaked: false,
      menu: false,
      droppedViolence: turn.category === "violence",
      fightOverMeta: false,
      category: turn.category,
    });
    continue;
  }

  const text = p.narration ?? "";
  const truncated = text.length > 0 && !/[.!?"\u201d]\s*$/.test(text.trim());
  const repeated = seen.some((prev) => {
    let k = 0;
    while (k < Math.min(prev.length, text.length) && prev[k] === text[k]) k++;
    return k > 60;
  });
  const leaked = LEAK.test(text);
  const menu = MENU.test(text);
  const decidedOutcome = OUTCOME.test(text);
  const opOk = turn.accept.includes(p.op);

  // The two failures that are never defensible, whatever else the DM got right.
  const droppedViolence = turn.category === "violence" && p.op !== "engage";
  const fightOverMeta = turn.category === "meta" && (p.op === "engage" || p.op === "attack");

  seen.push(text);
  world = apply(world, { kind: "narrated", text });
  results.push({ opOk, truncated, repeated, leaked, menu, decidedOutcome, droppedViolence, fightOverMeta, category: turn.category });

  const flags = [
    opOk ? null : `op=${p.op} accept=${turn.accept.join("|")}`,
    droppedViolence ? "DROPPED-VIOLENCE" : null,
    fightOverMeta ? "FIGHT-OVER-META" : null,
    decidedOutcome ? "DECIDED-OUTCOME" : null,
    truncated ? "TRUNCATED" : null,
    repeated ? "REPEATED" : null,
    leaked ? "LEAKS-MECHANICS" : null,
    menu ? "MENU" : null,
  ].filter(Boolean);

  console.log(
    `  ${String(i + 1).padStart(2)}. ${opOk ? "ok  " : "BAD "} ${String(turn.category).padEnd(9)} op=${String(p.op).padEnd(12)} dc=${String(p.difficulty).padStart(2)} ${flags.length ? "| " + flags.join(" | ") : ""}`,
  );
}

  return results;
}

const passes = [];
for (let r = 0; r < REPEAT; r++) {
  if (REPEAT > 1) console.log(`--- pass ${r + 1}/${REPEAT} ---`);
  passes.push(await onePass());
}
const results = passes.flat();

const n = results.length;
const score = (k) => results.filter((r) => r[k]).length;
const inCat = (c) => results.filter((r) => r.category === c).length;
const fatalIn = (rs) => rs.filter((r) => r.droppedViolence || r.fightOverMeta).length;

console.log(`\n================ SCORE ================`);
console.log(`  NEVER ACCEPTABLE`);
console.log(`    violence silently dropped   ${score("droppedViolence")}/${inCat("violence")}   <- must be 0`);
console.log(`    fight started over a meta   ${score("fightOverMeta")}/${inCat("meta")}   <- must be 0`);
console.log(`  QUALITY`);
console.log(`    op defensible               ${score("opOk")}/${n}`);
console.log(`    decided the outcome itself  ${score("decidedOutcome")}/${n}   <- want 0, the die decides`);
console.log(`    truncated                   ${score("truncated")}/${n}   <- want 0`);
console.log(`    repeated earlier narration  ${score("repeated")}/${n}   <- want 0`);
console.log(`    leaked mechanics into prose ${score("leaked")}/${n}   <- want 0`);
console.log(`    handed back a menu          ${score("menu")}/${n}   <- want low`);

const fatal = score("droppedViolence") + score("fightOverMeta");

if (REPEAT > 1) {
  const perPass = passes.map(fatalIn);
  const clean = perPass.filter((f) => f === 0).length;
  console.log(`\n  fatal failures per pass       ${perPass.join(", ")}`);
  console.log(`  passes with none              ${clean}/${REPEAT}`);
}

/**
 * The gate is the RATE, not any single pass.
 *
 * Measured on known-good code, three passes gave 0, 0 and 1 fatal failures. So a one-pass
 * run reporting clean was luck a third of the time, and a one-pass run reporting a fatal
 * failure was a false alarm a third of the time. Comparing two branches by one pass each
 * is comparing two coin flips. Use --repeat and compare rates over equal sample sizes.
 */
console.log(`\n${fatal === 0 ? "NO FATAL FAILURES" : `${fatal} FATAL FAILURE(S)`} across ${n} turns`);
if (REPEAT === 1) {
  console.log(`(one pass is a sample, not a verdict. use --repeat 3 before believing it)`);
}
process.exit(fatal === 0 ? 0 : 1);


