/**
 * Proves each rule is actually covered by the test named for it.
 *
 * Running the whole suite against a mutant is not enough. A mutant can be killed by some
 * unrelated test while the test that carries the rule's name passes happily, which leaves
 * the rule uncovered and the suite looking green. So each mutation here runs exactly one
 * test, selected by name, and that test must fail.
 *
 * Usage:
 *   node tools/mutate/run.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP = join(import.meta.dirname, "..", "..", "packages", "app");

const MUTANTS = [
  {
    rule: "difficulty outside the band is clamped",
    file: "src/rules.ts",
    find: "if (dc < DC_FLOOR || dc > DC_CEILING) {",
    replace: "if (false) {",
    test: "the engine overrules a difficulty the DM invented outside the band",
  },
  {
    rule: "the dead cannot be attacked again",
    file: "src/rules.ts",
    find: "} else if (named.dead && proposal.op === 'attack') {",
    replace: "} else if (false) {",
    test: "the engine refuses to let the DM damage someone already dead",
  },
  {
    rule: "an invented NPC with no lore is dropped",
    file: "src/rules.ts",
    find: "if (proposal.introduces === null) {",
    replace: "if (false) {",
    test: "a mint slot with no lore is dropped rather than inventing a blank person",
  },
  {
    rule: "attack is undecodable outside combat",
    file: "src/director.ts",
    find: "exploration: ['skill_check', 'talk', 'introduce', 'narrate_only'],",
    replace: "exploration: ['attack', 'skill_check', 'talk', 'introduce', 'narrate_only'],",
    test: "exploration mode does not offer the attack op at all",
  },
  {
    rule: "a natural 1 always fails",
    file: "src/dice.ts",
    find: "success: critical === 'hit' ? true : critical === 'miss' ? false : total >= dc,",
    replace: "success: total >= dc,",
    test: "a natural 1 fails even when the modifier would clear the DC",
  },
  {
    rule: "hit points clamp on construction",
    file: "src/world.ts",
    find: "return { now: Math.max(0, Math.min(now, max)), max };",
    replace: "return { now, max };",
    test: "hit points cannot be healed above the maximum",
  },
  {
    rule: "player-facing projection excludes DM-only lore",
    file: "src/world.ts",
    find: "    present: [...w.entities.values()]",
    replace: "    lore: [...w.entities.values()].map((e) => e.lore),\n    present: [...w.entities.values()]",
    test: "the player view never carries DM-only lore",
  },
];

function runOne(testName) {
  try {
    execFileSync(
      process.execPath,
      ["--test", "--test-name-pattern", testName, "test/**/*.test.ts"],
      { cwd: APP, stdio: "pipe", encoding: "utf8" },
    );
    return "PASSED";
  } catch {
    return "FAILED";
  }
}

let survivors = 0;
console.log(`Running ${MUTANTS.length} mutants, each against only its own test.\n`);

for (const m of MUTANTS) {
  const path = join(APP, m.file);
  const original = readFileSync(path, "utf8");

  if (!original.includes(m.find)) {
    console.log(`  ?? SKIPPED  ${m.rule}`);
    console.log(`              anchor not found in ${m.file}, the mutation list is stale`);
    survivors++;
    continue;
  }

  writeFileSync(path, original.replace(m.find, m.replace));
  const mutated = runOne(m.test);
  writeFileSync(path, original);
  const restored = runOne(m.test);

  const killed = mutated === "FAILED" && restored === "PASSED";
  if (!killed) survivors++;

  console.log(`  ${killed ? "KILLED  " : "SURVIVED"}  ${m.rule}`);
  console.log(`              mutant ${mutated}, restored ${restored}`);
}

console.log(`\n${MUTANTS.length - survivors}/${MUTANTS.length} rules provably covered by their own named test.`);
process.exit(survivors === 0 ? 0 : 1);
