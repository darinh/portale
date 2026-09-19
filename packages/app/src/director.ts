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

import type { Direction, Entity, EntityId, Location, Mode, World } from './world.ts';
import { presentHere, reprisalActor } from './world.ts';

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
      narration: { type: 'string' },
    },
    required: ['op', 'target', 'direction', 'ability', 'difficulty', 'damage', 'introduces', 'narration'],
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
  const reprisal =
    brief.reprisalBy === null
      ? ''
      : `\n${brief.reprisalBy.name} is going to come at you this turn, whatever you do. Work that into the narration as a threat in motion. Do NOT say whether it connects; the engine decides that after you speak.\n`;

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
${scenery}${history}${reprisal}
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

export function briefFor(w: World, utterance: string): SceneBrief {
  const protagonist = w.entities.get(w.protagonist);
  if (protagonist === undefined) throw new Error('world has no protagonist');
  const place = w.locations.get(w.here);
  if (place === undefined) throw new Error(`world has no location ${w.here}`);

  // Scoped to this room. Somebody two rooms away is not someone the DM may act upon, and
  // keeping them out of the enum makes that structural rather than a rule to remember.
  const others = presentHere(w);
  const ranked = [...others].sort((a, b) => Number(b.hostile) - Number(a.hostile) || Number(a.dead) - Number(b.dead));

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
    reprisalBy: w.mode === 'combat' ? (reprisalActor(w) ?? null) : null,
    place,
    exits: [...place.exits.keys()],
    outOfCharacter: isOutOfCharacter(utterance),
  };
}
