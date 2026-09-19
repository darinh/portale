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
    find: "  exploration: ['skill_check', 'talk', 'move', 'engage', 'narrate_only'],",
    replace: "  exploration: ['attack', 'skill_check', 'talk', 'move', 'engage', 'narrate_only'],",
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
    find: "    present: presentHere(w).map((e) => ({ id: e.id, name: e.name, hp: e.hp, dead: e.dead })),",
    replace: "    lore: [...w.entities.values()].map((e) => e.lore),\n    present: presentHere(w).map((e) => ({ id: e.id, name: e.name, hp: e.hp, dead: e.dead })),",
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
    find: "  exploration: ['skill_check', 'talk', 'move', 'engage', 'narrate_only'],",
    replace: "  exploration: ['skill_check', 'talk', 'move', 'narrate_only'],",
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
    find: "        enum: brief.outOfCharacter ? (['narrate_only'] as const) : ops,",
    replace: "        enum: ops,",
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
  {
    rule: "static serving cannot escape the public directory",
    file: "src/app.ts",
    find: "      if (resolved !== publicDir && !resolved.startsWith(publicDir + sep)) {",
    replace: "      if (false) {",
    test: "directory traversal cannot escape the public directory",
  },
  {
    rule: "one turn at a time per session",
    file: "src/app.ts",
    find: "        if (inFlight.has(session.id)) {",
    replace: "        if (false) {",
    test: "two turns at once on one session are refused with 409",
  },
  {
    rule: "the in-flight claim is always released",
    file: "src/app.ts",
    find: "          inFlight.delete(session.id);",
    replace: "          void 0;",
    test: "the in-flight guard is released, so the next turn still works",
  },
  {
    rule: "request bodies are bounded",
    file: "src/app.ts",
    find: "    if (size > MAX_BODY_BYTES) throw new BadRequest('request body too large');",
    replace: "    if (false) throw new BadRequest('request body too large');",
    test: "an oversized body is refused rather than buffered",
  },
  {
    rule: "an utterance must be a string",
    file: "src/app.ts",
    find: "        if (typeof raw !== 'string') return json(res, 400, { error: 'utterance must be a string' });",
    replace: "        if (false) return json(res, 400, { error: 'utterance must be a string' });",
    test: "an empty, missing, non-string or oversized utterance is refused",
  },
  {
    rule: "an unknown scenario is refused",
    file: "src/app.ts",
    find: "        if (wanted !== undefined && !SCENARIOS.some((s) => s.id === wanted)) {",
    replace: "        if (false) {",
    test: "an unknown scenario is refused instead of silently falling back",
  },
  {
    rule: "a session rebuilds from its log when the cache is cold",
    file: "src/app.ts",
    find: "    const session: Session = { id, world: stored.events.reduce(apply, base) };",
    replace: "    const session: Session = { id, world: base };",
    test: "a session survives a full server restart, proving the cache holds no authority",
  },
  {
    rule: "hostiles strike back at all",
    file: "src/rules.ts",
    find: "    if (working.mode === 'combat') {",
    replace: "    if (false) {",
    test: "a hostile strikes back, so the world is not a punching bag",
  },
  {
    rule: "a reprisal survives the player missing",
    file: "src/rules.ts",
    find: "  if (!outcome.success) {",
    replace: "  if (!outcome.success) { return { events, rulings, softFail: false };",
    test: "the reprisal happens even when the player misses",
  },
  {
    rule: "a reprisal survives a dropped intent",
    file: "src/rules.ts",
    find: "  if (targetId === null) {",
    replace: "  if (targetId === null) { return { events, rulings, softFail: true };",
    test: "the reprisal happens even when the whole intent was dropped",
  },
  {
    rule: "the dead do not strike back",
    file: "src/world.ts",
    find: "    if (e.id === w.protagonist || !e.hostile || e.dead || e.power <= 0) continue;",
    replace: "    if (e.id === w.protagonist || !e.hostile || e.power <= 0) continue;",
    test: "the dead do not strike back",
  },
  {
    rule: "a fallen player is not hit again",
    file: "src/rules.ts",
    find: "      if (you !== undefined && !you.dead) {",
    replace: "      if (you !== undefined) {",
    test: "a fallen player is not hit again",
  },
  {
    rule: "the brief names the foe about to strike",
    file: "src/director.ts",
    find: "    reprisalBy: w.mode === 'combat' ? (reprisalActor(w) ?? null) : null,",
    replace: "    reprisalBy: null,",
    test: "the DM is told who is about to strike, so it can narrate the blow coming",
  },
  {
    rule: "moving actually relocates the player",
    file: "src/world.ts",
    find: "      return { ...next, here: e.to, locations, entities, scene: dest.name };",
    replace: "      return { ...next, locations, entities };",
    test: "moving takes the player somewhere real and remembers they went",
  },
  {
    rule: "the direction enum is built from real exits",
    file: "src/director.ts",
    find: "  const dirs = brief.exits.length > 0 ? brief.exits : (['out'] as readonly Direction[]);",
    replace: "  const dirs = ['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out'] as readonly Direction[];",
    test: "the DM can only propose exits that exist",
  },
  {
    rule: "a direction with no exit is refused",
    file: "src/rules.ts",
    find: "    if (dest === undefined) {",
    replace: "    if (false) {",
    test: "a direction that is not an exit is refused rather than inventing a door",
  },
  {
    rule: "you cannot walk out of a fight",
    file: "src/rules.ts",
    find: "    const pinned = working.mode === 'combat';",
    replace: "    const pinned = false;",
    test: "you cannot stroll out of a fight",
  },
  {
    rule: "reach is scoped to the current room",
    file: "src/world.ts",
    find: "  return [...w.entities.values()].filter((e) => e.id !== w.protagonist && e.at === w.here);",
    replace: "  return [...w.entities.values()].filter((e) => e.id !== w.protagonist);",
    test: "someone in another room is not in reach, and cannot be named",
  },
  {
    rule: "a foe in another room does not strike",
    file: "src/world.ts",
    find: "    if (e.at !== w.here) continue;",
    replace: "    if (false) continue;",
    test: "a foe left behind in another room stops swinging at you",
  },
  {
    rule: "the map shows only visited rooms",
    file: "src/world.ts",
    find: "      .filter((l) => l.visited)",
    replace: "      .filter(() => true)",
    test: "the map never leaks the names of rooms not yet visited",
  },
  {
    rule: "the engine owns the tick size",
    file: "src/rules.ts",
    find: "    emit({ kind: 'ticked', clock: target.id, by: TICK_SIZE, why: proposal.op });",
    replace: "    emit({ kind: 'ticked', clock: target.id, by: 0, why: proposal.op });",
    test: "the DM can advance pressure that exists, one segment at a time",
  },
  {
    rule: "an invented clock is refused",
    file: "src/rules.ts",
    find: "    if (target === undefined) {",
    replace: "    if (false) {",
    test: "a clock the DM invented is refused",
  },
  {
    rule: "a clock pays off exactly once",
    file: "src/rules.ts",
    find: "    if (target.done) {",
    replace: "    if (false) {",
    test: "a full clock pays off exactly once and then stops being offered",
  },
  {
    rule: "a finished clock leaves the enum",
    file: "src/director.ts",
    find: "    clocks: [...w.clocks.values()].filter((c) => !c.done),",
    replace: "    clocks: [...w.clocks.values()],",
    test: "a full clock pays off exactly once and then stops being offered",
  },
  {
    rule: "secret clocks never reach the browser",
    file: "src/world.ts",
    find: "      .filter((c) => c.visibility === 'open')",
    replace: "      .filter(() => true)",
    test: "a secret clock is tracked and never shipped to the browser",
  },
  {
    rule: "the transcript replays clock values",
    file: "src/world.ts",
    find: "        const at = Math.max(0, Math.min((running.get(e.clock) ?? 0) + e.by, c.segments));",
    replace: "        const at = c.filled;",
    test: "the transcript replays clock values rather than stamping the final one",
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
