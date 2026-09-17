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
    find: "  exploration: ['skill_check', 'talk', 'introduce', 'engage', 'narrate_only'],",
    replace: "  exploration: ['attack', 'skill_check', 'talk', 'introduce', 'engage', 'narrate_only'],",
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
  {
    rule: "a ruling becomes an event, not just a return value",
    file: "src/rules.ts",
    find: "emit({ kind: 'ruled', why: r.why, detail: r.detail });",
    replace: "void 0;",
    test: "a dropped intent reaches the log as a ruling, not just the return value",
  },
  {
    rule: "a ruling survives a subsequent failed roll",
    file: "src/rules.ts",
    find: "emit({ kind: 'ruled', why: r.why, detail: r.detail });",
    replace: "void 0;",
    test: "a ruling survives even when the roll it preceded then fails",
  },
  {
    rule: "lookups see entities introduced earlier in the same turn",
    file: "src/rules.ts",
    find: "    const target = working.entities.get(targetId);",
    replace: "    const target = w.entities.get(targetId);",
    test: "an NPC invented this turn can be killed this turn",
  },
  {
    rule: "engage is offered during exploration",
    file: "src/director.ts",
    find: "  exploration: ['skill_check', 'talk', 'introduce', 'engage', 'narrate_only'],",
    replace: "  exploration: ['skill_check', 'talk', 'introduce', 'narrate_only'],",
    test: "the schema offers a way into combat during exploration",
  },
  {
    rule: "engage is refused when there is no hostile target",
    file: "src/rules.ts",
    find: "    if (foe === undefined || !foe.hostile || foe.dead) {",
    replace: "    if (false) {",
    test: "engage is the way into combat, and it is refused without a foe",
  },
  {
    rule: "minted ids derive from the world, not a clock",
    file: "src/rules.ts",
    find: "  return entityId(`e_m${w.seed.toString(36)}_${w.seq.toString(36)}`);",
    replace: "  return entityId(`e_m${Date.now().toString(36)}`);",
    test: "a minted id is derived from the world, not from a clock or a module counter",
  },
  {
    rule: "damage is capped before it is applied",
    file: "src/rules.ts",
    find: "    if (damage > MAX_DAMAGE) {",
    replace: "    if (false) {",
    test: "damage beyond the cap is rewritten rather than trusted",
  },
  {
    rule: "an absent target is dropped",
    file: "src/rules.ts",
    find: "    if (named === undefined) {",
    replace: "    if (false) {",
    test: "a target that is not in the world is dropped",
  },
  {
    rule: "DM history is filtered before it is truncated",
    file: "src/director.ts",
    find: "    recent: spoken.slice(-RECENT_LINES),",
    replace: "    recent: spoken.slice(-1),",
    test: "the DM is shown older dialogue, not just the most recent turn",
  },
  {
    rule: "the player's own words are recorded",
    file: "src/engine.ts",
    find: "  session.world = apply(session.world, { kind: 'said', text: utterance });",
    replace: "",
    test: "the transcript records what the player said, not only what the DM said",
  },
  {
    rule: "an out-of-character message collapses the op enum",
    file: "src/director.ts",
    find: "        enum: brief.outOfCharacter ? (['narrate_only'] as const) : OPS_BY_MODE[brief.mode],",
    replace: "        enum: OPS_BY_MODE[brief.mode],",
    test: "an out-of-character message cannot start a fight, because engage is undecodable",
  },
  {
    rule: "the phrases a real player used are detected as out of character",
    file: "src/director.ts",
    find: "  /\\bdm\\b[,.!?]?\\s*$/i,",
    replace: "",
    test: "the phrases a real player used to address the DM are recognised",
  },
  {
    rule: "op is generated before narration",
    file: "src/director.ts",
    find: "      narration: { type: 'string' },",
    replace: "",
    test: "the DM decides the mechanics before it writes the prose",
  },
  {
    rule: "characters carry pronouns the DM can read",
    file: "src/engine.ts",
    find: "She owes the harbourmaster a debt, and she refers to herself as she.",
    replace: "Owes the harbourmaster a debt.",
    test: "the DM is told which pronouns each character uses",
  },
  {
    rule: "the blow that starts a fight is resolved",
    file: "src/rules.ts",
    find: "  if (proposal.op === 'attack' || proposal.op === 'engage') {",
    replace: "  if (proposal.op === 'attack') {",
    test: "the blow that starts a fight is resolved, not discarded",
  },
  {
    rule: "bookkeeping tokens are scrubbed from narration",
    file: "src/rules.ts",
    find: "  emit({ kind: 'narrated', text: scrubTokens(proposal.narration, w) });",
    replace: "  emit({ kind: 'narrated', text: proposal.narration });",
    test: "bookkeeping tokens never reach the player, even when the DM writes them",
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
