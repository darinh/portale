/**
 * Everything that knows an LLM exists.
 *
 * Two layers guard the world and they are not variations of each other.
 *
 * Layer 1 is shape, and it belongs to the runtime. The schema is passed per request and
 * constrains decoding, so a mis-shaped proposal is not something this code handles. It is
 * something that cannot be produced. Measured at 8/8 against 0/8 for both alternatives,
 * on both the native and the OpenAI-compatible transport. See tools/model-probe.
 *
 * Layer 2 is rules legality, and it belongs to rules.ts. A schema-valid proposal can still
 * be illegal, and that is the only place a proposal may be rejected.
 *
 * Because the schema is built per turn from live world state, whole classes of illegal
 * action stop being rejected and become undecodable. A target that is not present cannot
 * be named, because it is not in the enum.
 */

import type { Clock, Clue, Direction, Entity, EntityId, Location, Mode, Vow, World } from './world.ts';
import { cluesHere, presentHere, reprisalActor } from './world.ts';

/**
 * Pre-allocated slots for NPCs the DM invents mid-scene. They exist so the target field
 * stays a closed enum. An open string would hand the decoder a free-form field and give
 * back exactly the failure class the schema is there to remove.
 */
export const MINT_SLOTS = ['~new1', '~new2'] as const;
export type MintSlot = (typeof MINT_SLOTS)[number];

/**
 * Deliberately NOT presented as an evidence-backed number.
 *
 * An earlier experiment appeared to show choice quality degrading with list length and
 * was confounded: the tempting distractor was absent from the smallest condition. The
 * corrected run found no length effect at all (6/8, 3/8, 3/8, 4/8, 6/8 across sizes 3 to
 * 25). What it did find is that reference resolution is unreliable at every size on a
 * small model.
 *
 * So this cap is a hedge, not a finding. The real mitigation is the id-to-name table in
 * the prompt below. Re-measure on the production model before treating either as settled.
 */
export const MAX_IN_REACH = 8;

/** Spoken lines of history the DM is shown. Counted after filtering, not before. */
export const RECENT_LINES = 8;

/** The explicit, reliable way to speak to the DM without acting. Shown in the UI. */
export const OOC_PREFIXES = ['//', 'ooc:', '(ooc)'] as const;

/**
 * Phrases that address the narrator rather than the world. Deliberately conservative,
 * because a false positive silently disarms a real action, which is the worse failure.
 * The prefix above is the reliable path; this only catches the obvious cases real play
 * produced.
 */
const META_SIGNALS = [
  /\bdm\b[,.!?]?\s*$/i,
  /\byou (?:forgot|repeated|already said|lost the thread)\b/i,
  /\b(last|previous|that) (message|reply|response)\b/i,
  /\b(cut off|cutoff|got truncated)\b/i,
  /^\s*(wait|hold on|hang on)[,.!]/i,
];

export function isOutOfCharacter(utterance: string): boolean {
  const t = utterance.trim();
  const lower = t.toLowerCase();
  if (OOC_PREFIXES.some((p) => lower.startsWith(p))) return true;
  return META_SIGNALS.some((re) => re.test(t));
}

export function stripOocPrefix(utterance: string): string {
  const t = utterance.trim();
  const lower = t.toLowerCase();
  const hit = OOC_PREFIXES.find((p) => lower.startsWith(p));
  return hit === undefined ? t : t.slice(hit.length).trim();
}

export interface SceneBrief {
  readonly scene: string;
  readonly mode: Mode;
  readonly protagonist: Entity;
  /** The only entities the model may name. Everything else is scenery in the prompt. */
  readonly inReach: readonly Entity[];
  readonly scenery: readonly Entity[];
  readonly recent: readonly string[];
  readonly utterance: string;
  /**
   * The player is addressing the DM rather than acting in the world. Asking what it meant,
   * reporting a cut-off message, complaining it lost the thread.
   *
   * Real play showed this is not a rare edge case and that asking the model to spot it does
   * not work. A player who typed "I just told you I stabbed him in the eye, keep up" was
   * attacked for it, because the sentence is full of violence. So the op enum collapses to
   * a single member when this is set, and starting a fight becomes undecodable rather than
   * merely discouraged. That is the same move the rest of the contract makes.
   */
  readonly outOfCharacter: boolean;
  /**
   * Who the engine has already decided will strike back this turn, or null in peace.
   * The DM is told so it can narrate the blow coming. It is NOT asked to choose, because
   * a world that only fights back when the narrator remembers to is not a world.
   */
  readonly reprisalBy: Entity | null;
  /** Where the player is standing, and the only ways out of it. */
  readonly place: Location;
  readonly exits: readonly Direction[];
  /** Clocks still running. The DM may advance one of these, and invent none. */
  readonly clocks: readonly Clock[];
  /** Vows still open. The DM may claim progress on one; the engine decides if it counts. */
  readonly vows: readonly Vow[];
  /**
   * Undiscovered clues in THIS room. The DM may reveal one of these and no others, so it
   * cannot invent evidence, cannot hand over a clue that lives three rooms away, and
   * cannot re-reveal something already known.
   */
  readonly cluesHere: readonly Clue[];
}

export type Target = EntityId | MintSlot;

export interface Proposal {
  readonly narration: string;
  readonly op: 'attack' | 'engage' | 'skill_check' | 'talk' | 'introduce' | 'move' | 'narrate_only';
  readonly target: Target;
  readonly direction: Direction;
  readonly ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
  readonly difficulty: number;
  readonly damage: number;
  readonly introduces: { readonly name: string; readonly lore: string; readonly hostile: boolean } | null;
  /**
   * A clock this turn's events should advance, or 'none'. The enum is built from the
   * clocks currently in play, so the DM can apply pressure that already exists but cannot
   * invent it, and cannot quietly resolve a threat because the moment felt dramatic.
   */
  readonly tick: string;
  /**
   * A vow this turn advanced, or 'none'. Enum built from vows still open.
   *
   * The engine refuses the claim unless the turn actually produced something. For a vow
   * that still has clues waiting to be found, "something" means finding one: the player
   * has to learn a thing, not win a fight. Otherwise a narrator could talk the player to
   * their goal, which is the yes-manning failure with extra ceremony.
   */
  readonly milestone: string;
  /**
   * A clue revealed this turn, or 'none'. Enum built from undiscovered clues in the
   * current room, so evidence cannot be conjured and cannot arrive from elsewhere.
   */
  readonly reveals: string;
}

export interface Director {
  readonly name: string;
  propose(brief: SceneBrief): Promise<Proposal>;
}

/** Raised when Layer 1 fails, which means the transport is broken rather than the DM. */
export class DirectorContractBreach extends Error {
  readonly detail: unknown;

  constructor(message: string, detail: unknown) {
    super(message);
    this.name = 'DirectorContractBreach';
    this.detail = detail;
  }
}

/**
 * `engage` is the only way into combat, and it exists because `attack` is deliberately
 * undecodable during exploration. Without it the game could never leave peace, which is
 * exactly what happened before this op was added.
 *
 * `move` is absent from combat on purpose. Walking away mid-fight is a real thing a player
 * might want, but it is the player's call to make in words, not the DM's to narrate for
 * them.
 *
 * There is deliberately no `introduce` op. Minting is keyed on the TARGET being a slot, so
 * a separate op bought nothing and the model reached for it constantly, then left
 * `introduces` null and earned a refusal. Removing the choice removed the failure.
 */
const OPS_BY_MODE: Record<Mode, readonly Proposal['op'][]> = {
  exploration: ['skill_check', 'talk', 'move', 'engage', 'narrate_only'],
  combat: ['attack', 'skill_check', 'narrate_only'],
};

/**
 * Field order is load-bearing. Constrained decoding emits properties in the order the
 * schema declares them, so whatever comes first is decided with the least context and
 * everything after is written to be consistent with it.
 *
 * `narration` used to come first. The model wrote several hundred words of prose and only
 * then chose an op to match what it had already said, which meant prose about a tavern
 * conversation always resolved to `narrate_only`. Replaying a real ten-turn session scored
 * `narrate_only` 10 times out of 10 and recognised combat intent 0 times out of 4.
 *
 * Deciding the mechanics first and narrating last inverts that dependency.
 */
export function buildSchema(brief: SceneBrief): object {
  const targets = [...brief.inReach.map((e) => e.id as string), ...MINT_SLOTS];
  // JSON Schema forbids an empty enum, and a room with no exits is legal, so fall back to
  // a single dead value. `move` is withheld in that case anyway, so it is never chosen.
  const dirs = brief.exits.length > 0 ? brief.exits : (['out'] as readonly Direction[]);
  const ops = OPS_BY_MODE[brief.mode].filter((o) => o !== 'move' || brief.exits.length > 0);

  return {
    type: 'object',
    properties: {
      op: {
        type: 'string',
        enum: brief.outOfCharacter ? (['narrate_only'] as const) : ops,
      },
      target: { type: 'string', enum: targets },
      direction: { type: 'string', enum: dirs },
      ability: {
        type: 'string',
        enum: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
      },
      difficulty: { type: 'integer', minimum: 5, maximum: 25 },
      damage: { type: 'integer', minimum: 0, maximum: 12 },
      introduces: {
        type: ['object', 'null'],
        properties: {
          name: { type: 'string' },
          lore: { type: 'string' },
          hostile: { type: 'boolean' },
        },
        required: ['name', 'lore', 'hostile'],
      },
      tick: { type: 'string', enum: brief.outOfCharacter ? ['none'] : ['none', ...brief.clocks.map((c) => c.id as string)] },
      milestone: { type: 'string', enum: brief.outOfCharacter ? ['none'] : ['none', ...brief.vows.map((v) => v.id as string)] },
      reveals: { type: 'string', enum: brief.outOfCharacter ? ['none'] : ['none', ...brief.cluesHere.map((c) => c.id as string)] },
      narration: { type: 'string' },
    },
    required: ['op', 'target', 'direction', 'ability', 'difficulty', 'damage', 'introduces', 'tick', 'milestone', 'reveals', 'narration'],
  };
}

export function renderPrompt(brief: SceneBrief): string {
  const roster = brief.inReach
    .map((e) => `  ${e.id} = ${e.name}. ${e.lore}${e.dead ? ' (DEAD)' : ''} [${e.hp.now}/${e.hp.max} hp]`)
    .join('\n');
  const scenery =
    brief.scenery.length === 0
      ? ''
      : `\nAlso present but not targetable: ${brief.scenery.map((e) => e.name).join(', ')}.\n`;
  const history = brief.recent.length === 0 ? '' : `\nWhat has happened so far:\n${brief.recent.map((r) => `  ${r}`).join('\n')}\n`;
  const clocks =
    brief.clocks.length === 0
      ? ''
      : `\nPressure already in play. You may advance ONE of these with "tick", or "none":\n${brief.clocks
          .map((c) => `  ${c.id} = ${c.name} (${c.filled}/${c.segments})`)
          .join('\n')}\n`;
  const vows =
    brief.vows.length === 0
      ? ''
      : `\nWhat the player is trying to achieve. You may claim ONE of these advanced this turn with "milestone", or "none":\n${brief.vows
          .map((v) => `  ${v.id} = ${v.what} (${v.rank})`)
          .join('\n')}\n`;
  const reprisal =
    brief.reprisalBy === null
      ? ''
      : `\n${brief.reprisalBy.name} is going to come at you this turn, whatever you do. Work that into the narration as a threat in motion. Do NOT say whether it connects; the engine decides that after you speak.\n`;
  const clues =
    brief.cluesHere.length === 0
      ? ''
      : `\nThings in THIS ROOM the player has not discovered yet. If what they are doing would plausibly turn one up, name it with "reveals" and describe it in your narration. Otherwise "none". Never describe one of these without revealing it:\n${brief.cluesHere
          .map((c) => `  ${c.id} = ${c.what}`)
          .join('\n')}\n`;

  if (brief.outOfCharacter) {
    return `You are the Dungeon Master of a tabletop RPG. The player has stopped playing for a moment and is speaking to YOU, not acting in the world.

Where the player is standing: ${brief.place.name}
${history}
The player says to you, out of character: "${brief.utterance}"

They are asking a question about your narration, telling you something was unclear or cut
off, or pointing out that you lost the thread. Answer them.

The scene does NOT move. Nobody acts, nobody is attacked, no time passes. If they are
telling you that you got something wrong, accept it plainly and restate what is actually
true in the fiction right now, including anything you skipped.

Write two or three sentences. Do not mention dice, rules or machinery. Do not ask them what
they want to do next.`;
  }

  return `You are the Dungeon Master of a tabletop RPG. You decide what the world does. You never decide what the player does.

Where the player is standing: ${brief.place.name}
${brief.place.description}
${brief.exits.length === 0 ? 'There is no way out of here.' : `Ways out: ${brief.exits.join(', ')}.`}
Mode: ${brief.mode}

The player is ${brief.protagonist.name}, ${brief.protagonist.hp.now}/${brief.protagonist.hp.max} hp.

You may target ONLY these, and you must use the identifier on the left, not the name:
${roster}
  ~new1, ~new2 = someone NEW walking into the scene. Use one of these as "target" with
                 whatever op fits, and fill in "introduces" with their name and who they
                 are. Leave "introduces" null for everything else.
${scenery}${history}${clocks}${vows}${clues}${reprisal}
The player says: "${brief.utterance}"

FIRST choose "op". Choose it from what the player is TRYING TO DO, before you write any prose.

  engage        the player commits violence against SOMEONE PRESENT. Attacks, strikes,
                stabs, shoves, draws a weapon on someone, or says they want to fight.
                Dancing, boasting, apologising and surrendering are not violence on their
                own. But if there is any doubt at all, choose engage. A fight that starts
                a moment early can be talked down. An attack you quietly file as something
                else is erased, and the player watches their action vanish.
                ALWAYS choose engage for violence, however precise, clever or comic the
                attempt is. A called shot to the eye is still an attack, not a skill check.
                This starts combat.
  skill_check   a NON-VIOLENT attempt with a real chance of failure and a real consequence.
                Sneaking, lying convincingly, picking a lock, forcing a door, climbing.
  talk          the player speaks to someone in the room and the outcome turns on what is
                said.
  move          the player goes somewhere else. Set "direction" to one of the ways out
                listed above. Only these exist. You cannot invent a door.
  narrate_only  no stakes, no audience, no consequence. ALSO use this whenever the player
                is speaking to YOU rather than acting in the world: asking what you meant,
                saying a message was cut off, complaining that you lost the thread, or
                asking how a rule works. Answer them inside the fiction and let the scene
                stand still. NEVER treat a complaint or a question about your own text as
                an action, and never start a fight over one.

If the player commits violence, you must choose "engage". Do not narrate an attack and
then label it "narrate_only" or "skill_check". That silently throws the action away.

Set "difficulty" to how hard the attempt genuinely is, 5 for trivial and 25 for near
impossible. Judge the attempt, not the drama you want.

Set "tick" to a clock this turn genuinely advances, or "none". Advance a danger clock when
the player is loud, violent, careless or slow. Advance a progress clock when they earn
ground toward it. Do not tick a clock every turn out of habit, and do not tick one just
because the scene felt tense. A clock that moves for no reason teaches the player to ignore
it.

Set "milestone" to a vow this turn genuinely moved forward, or "none". Real ground earned
counts: a secret prised loose, an obstacle beaten, a door opened. Talking about the goal
does not count, and the engine will refuse the claim if nothing actually happened.

THEN write "narration", two or three vivid sentences in second person, consistent with the
op you already chose.

Hard rules for the narration:
  Never mention dice, DCs, difficulty numbers, rolls, checks, modifiers or any other
  machinery. The player must never see the mechanism. Write only what a person in the room
  would perceive.

  Never write an identifier in the narration. Words like e_marga, ~new1 and ~new2 are
  bookkeeping and the player must never read one. Use the character's name, or a
  description if they have not been named yet.

  Write the ATTEMPT, never the RESULT. You narrate up to the moment of contact and stop.
  The engine rolls after you speak and decides what actually happened, so any outcome you
  write can be contradicted a second later.
    Wrong: "Your dagger pierces her eye. Blood scatters and she crumples."
    Right: "You drive the dagger up toward her good eye, and she is already twisting away."
  Do not say a blow lands, wounds, staggers, drops or kills anyone. Do not say a lie is
  believed, a lock opens or a leap is cleared. Leave it hanging.

  Never end by asking the player what they choose, and never offer them a list of options.
  Describe what the world does in response and stop.
  Never repeat a sentence you have already written this session. If the situation has not
  moved, move it.`;
}

export interface OllamaOptions {
  readonly endpoint?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
}

/**
 * One source of truth for sampling, shared by the server and by tools/replay-probe, so a
 * probe result cannot be produced under settings the game does not actually use.
 */
export const SAMPLING = {
  temperature: 0.85,
  // A narration was truncated mid-sentence in real play. Constrained decoding then closed
  // the JSON string cleanly, so the output stayed schema-valid and the damage was invisible
  // to every shape check. Give generation room, and give the context room to hold history.
  max_tokens: 700,
  // The model emitted one narration twice, all 1171 characters identical, and the player
  // noticed before any gate did. Constraining the narration harder made this worse rather
  // than better, because a narrower brief leaves fewer ways to open a sentence, so these
  // are tuned against the replay probe rather than guessed.
  frequency_penalty: 0.8,
  presence_penalty: 0.6,
} as const;

/**
 * Talks to the OpenAI-compatible endpoint, which measured 8/8 engine-valid with
 * response_format json_schema, matching the native transport.
 */
export function ollamaDirector(opts: OllamaOptions = {}): Director {
  const endpoint = opts.endpoint ?? 'http://127.0.0.1:11434/v1';
  const model = opts.model ?? 'qwen2.5:3b-instruct';

  return {
    name: `ollama:${model}`,
    async propose(brief) {
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer unused' },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: renderPrompt(brief) }],
          ...SAMPLING,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'dm_proposal', strict: true, schema: buildSchema(brief) },
          },
        }),
      });

      if (!res.ok) {
        throw new DirectorContractBreach(`model endpoint returned HTTP ${res.status}`, await res.text());
      }

      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new DirectorContractBreach('model response had no content', body);
      }

      try {
        return JSON.parse(content) as Proposal;
      } catch (cause) {
        throw new DirectorContractBreach('constrained decoding produced unparseable output', content);
      }
    },
  };
}

/** The seam that makes the whole suite runnable with no GPU and no model. */
export function scriptedDirector(script: readonly Proposal[]): Director {
  let i = 0;
  return {
    name: 'scripted',
    async propose() {
      const next = script[Math.min(i, script.length - 1)];
      i += 1;
      if (next === undefined) throw new Error('scriptedDirector was given an empty script');
      return next;
    },
  };
}

/**
 * A model-free DM that reads the brief and picks something legal.
 *
 * `scriptedDirector` returns fixed proposals, which means its script is welded to one
 * scenario. Pointed at a generated delve it names a smuggler who is not there and a clock
 * that does not exist, and every turn is correctly refused. That makes it useless for
 * exercising generated content.
 *
 * This one derives its answer from the brief, so it is valid in any scenario, and it is
 * still deterministic. It fights when something hostile is in the room and explores
 * otherwise, which is enough to walk a whole dungeon in a test.
 */
export function wanderingDirector(): Director {
  let turn = 0;
  return {
    name: 'wandering',
    async propose(brief) {
      turn += 1;
      const foe = brief.inReach.find((e) => e.hostile && !e.dead);
      const anyone = brief.inReach[0];
      const clock = brief.clocks[0];
      const vow = brief.vows[0];
      const clue = brief.cluesHere[0];

      const base = {
        target: (foe?.id ?? anyone?.id ?? MINT_SLOTS[0]) as Target,
        direction: brief.exits[turn % Math.max(1, brief.exits.length)] ?? 'out',
        ability: 'dexterity' as const,
        difficulty: 12,
        damage: 4,
        introduces: null,
        tick: turn % 3 === 0 && clock !== undefined ? (clock.id as string) : 'none',
        milestone: turn % 4 === 0 && vow !== undefined ? (vow.id as string) : 'none',
        // Always reveal when there is something here to reveal. A model-free DM that never
        // finds anything cannot walk a clue chain, which makes it useless for testing one.
        reveals: clue !== undefined ? (clue.id as string) : 'none',
      };

      if (brief.outOfCharacter) {
        return { ...base, op: 'narrate_only', narration: 'You are told what you asked.' };
      }
      if (foe !== undefined) {
        return {
          ...base,
          op: brief.mode === 'combat' ? 'attack' : 'engage',
          narration: `${foe.name} moves, and the room narrows to the space between you.`,
        };
      }
      if (brief.exits.length > 0) {
        return { ...base, op: 'move', narration: 'You take the passage and keep going.' };
      }
      return { ...base, op: 'narrate_only', narration: 'Nothing here but the sound of water.' };
    },
  };
}

/**
 * Words in an entity's name that are worth matching against what the player typed.
 *
 * Short words and articles match everything and would rank the whole room as mentioned,
 * which is the same as ranking nobody.
 */
const NAME_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'at', 'by', 'to']);

function nameWords(name: string): readonly string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((wd) => wd.length >= 3 && !NAME_STOPWORDS.has(wd));
}

/**
 * Did the player name this entity in the sentence they just typed?
 *
 * This is the highest-leverage half of the scoping design. Measurement showed the model
 * does not lose to list LENGTH, it loses to whichever person in the list is most
 * narratively salient: at enum size 8 with one memorable bystander removed, target
 * correctness went from 13/30 to 27/30, and at size 25 a different bystander simply took
 * over. Length only matters because a longer list is likelier to hold a strong attractor.
 *
 * So the entity the player just named is the one that must never fall off the end of the
 * list, whatever else does.
 */
export function mentions(utterance: string, e: Entity): boolean {
  const said = utterance.toLowerCase();
  return nameWords(e.name).some((wd) => said.includes(wd));
}

export function briefFor(w: World, utterance: string): SceneBrief {
  const protagonist = w.entities.get(w.protagonist);
  if (protagonist === undefined) throw new Error('world has no protagonist');
  const place = w.locations.get(w.here);
  if (place === undefined) throw new Error(`world has no location ${w.here}`);

  // Scoped to this room. Somebody two rooms away is not someone the DM may act upon, and
  // keeping them out of the enum makes that structural rather than a rule to remember.
  //
  // Ordering decides who survives MAX_IN_REACH, and the measurement says ordering is the
  // mitigation rather than the cap. Whoever the player just named comes first, because
  // they are the one answer that must always be reachable; hostiles next, because a fight
  // is the case where a wrong target costs the most; the dead last.
  const aside = isOutOfCharacter(utterance);
  const others = presentHere(w);
  const said = stripOocPrefix(utterance);
  const ranked = [...others].sort(
    (a, b) =>
      Number(mentions(said, b)) - Number(mentions(said, a)) ||
      Number(b.hostile) - Number(a.hostile) ||
      Number(a.dead) - Number(b.dead),
  );

  // Filter first, then take the last few. Slicing raw events first would have counted
  // rolls and damage against the budget, so a single busy turn could evict every earlier
  // line and leave the DM with no memory of the conversation.
  const spoken = w.log.flatMap((e) =>
    e.kind === 'narrated'
      ? [`DM: ${e.text}`]
      : e.kind === 'began'
        ? [`DM: ${e.narration}`]
        : e.kind === 'said'
          ? [`Player: ${e.text}`]
          : [],
  );

  return {
    scene: w.scene,
    mode: w.mode,
    protagonist,
    inReach: ranked.slice(0, MAX_IN_REACH),
    scenery: ranked.slice(MAX_IN_REACH),
    recent: spoken.slice(-RECENT_LINES),
    utterance: stripOocPrefix(utterance),
    reprisalBy: w.mode === 'combat' && !aside ? (reprisalActor(w) ?? null) : null,
    place,
    exits: [...place.exits.keys()],
    clocks: [...w.clocks.values()].filter((c) => !c.done),
    vows: [...w.vows.values()].filter((v) => !v.done),
    // Nobody searches a room while a knife is coming at them. Offering discoveries during
    // a fight is not just implausible, it is prompt noise on the turns where getting the
    // op right matters most, and it invites the DM to answer a swing with a found object.
    cluesHere: w.mode === 'combat' ? [] : cluesHere(w),
    outOfCharacter: aside,
  };
}
