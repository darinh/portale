/**
 * Plays whole sessions with no model and reports how they end.
 *
 * Unit tests prove a rule holds on the turn they set up. They cannot say whether a session
 * can actually be finished, which is the question a softlock answers wrongly while every
 * rule's test stays green. This plays the model-free wandering DM through many seeds of
 * every scenario and counts the endings.
 *
 * Usage:
 *   node tools/playtest/run.mjs [--seeds 200] [--turns 80] [--scenario all|lantern|delve]
 *                               [--app packages/app] [--json out.json]
 *
 * --app points at another checkout's packages/app, so one command measures two revisions.
 */

import { parseArgs } from "node:util";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";

const { values: args } = parseArgs({
  options: {
    seeds: { type: "string", default: "200" },
    turns: { type: "string", default: "80" },
    scenario: { type: "string", default: "all" },
    app: { type: "string", default: join(import.meta.dirname, "..", "..", "packages", "app") },
    json: { type: "string" },
  },
});

const SEEDS = Number(args.seeds);
const TURNS = Number(args.turns);
const STALL = 15;
const src = (m) => pathToFileURL(join(resolve(args.app), "src", m)).href;

const { seed } = await import(src("dice.ts"));
const { begin, scenarioFor, takeTurn } = await import(src("engine.ts"));
const { wanderingDirector } = await import(src("director.ts"));
const { project } = await import(src("world.ts"));

const SAYINGS = ["I press on.", "I search the place.", "I strike.", "// where am I?", "I listen."];

function signature(w) {
  const you = w.entities.get(w.protagonist);
  const found = [...w.clues.values()].filter((c) => c.found).length;
  const vows = [...w.vows.values()].map((v) => v.progress).join(",");
  const clocks = [...w.clocks.values()].map((c) => c.filled).join(",");
  return `${w.here}|${w.mode}|${you?.hp.now}|${found}|${vows}|${clocks}`;
}

function foeHere(w) {
  return [...w.entities.values()].some((e) => e.id !== w.protagonist && e.hostile && !e.dead && e.at === w.here);
}

async function play(scenarioId, n) {
  const s = seed(n * 7919 + 17);
  const session = { id: `${scenarioId}-${n}`, world: begin(scenarioFor(scenarioId, s), s) };
  const dm = wanderingDirector();
  let same = 0;
  let pinned = false;
  let last = signature(session.world);

  for (let turn = 1; turn <= TURNS; turn++) {
    await takeTurn(session, SAYINGS[turn % SAYINGS.length], dm);
    const w = session.world;
    const view = project(w);
    if (w.mode === "combat" && !foeHere(w)) pinned = true;
    if (view.you.defeated) return { outcome: "lost", turns: turn, pinned };
    if (view.vows.length > 0 && view.vows.every((v) => v.done)) return { outcome: "won", turns: turn, pinned };

    const now = signature(w);
    same = now === last ? same + 1 : 0;
    last = now;
    if (same >= STALL) return { outcome: "stuck", turns: turn, pinned };
  }
  return { outcome: "timeout", turns: TURNS, pinned };
}

const scenarios = args.scenario === "all" ? ["lantern", "delve"] : [args.scenario];
const report = {};

for (const id of scenarios) {
  const tally = { runs: 0, won: 0, lost: 0, stuck: 0, timeout: 0, pinned: 0 };
  const wins = [];
  for (let n = 1; n <= SEEDS; n++) {
    const r = await play(id, n);
    tally.runs++;
    tally[r.outcome]++;
    if (r.pinned) tally.pinned++;
    if (r.outcome === "won") wins.push(r.turns);
  }
  wins.sort((a, b) => a - b);
  report[id] = { ...tally, medianTurnsToWin: wins.length === 0 ? null : wins[Math.floor(wins.length / 2)] };
}

console.log(`app=${resolve(args.app)} seeds=${SEEDS} turns=${TURNS} stall=${STALL}`);
console.log("scenario   runs   won  lost stuck timeout pinned  median-turns-to-win");
for (const [id, r] of Object.entries(report)) {
  const cols = [r.runs, r.won, r.lost, r.stuck].map((v) => String(v).padStart(5)).join(" ");
  console.log(`${id.padEnd(9)} ${cols} ${String(r.timeout).padStart(7)} ${String(r.pinned).padStart(6)}  ${r.medianTurnsToWin ?? "-"}`);
}
if (args.json) writeFileSync(args.json, JSON.stringify({ seeds: SEEDS, turns: TURNS, report }, null, 2));
