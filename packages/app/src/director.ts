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

import type { Entity, EntityId, Mode, World } from './world.ts';

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

export interface SceneBrief {
  readonly scene: string;
  readonly mode: Mode;
  readonly protagonist: Entity;
  /** The only entities the model may name. Everything else is scenery in the prompt. */
  readonly inReach: readonly Entity[];
  readonly scenery: readonly Entity[];
  readonly recent: readonly string[];
  readonly utterance: string;
}

export type Target = EntityId | MintSlot;

export interface Proposal {
  readonly narration: string;
  readonly op: 'attack' | 'engage' | 'skill_check' | 'talk' | 'introduce' | 'narrate_only';
  readonly target: Target;
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
 */
const OPS_BY_MODE: Record<Mode, readonly Proposal['op'][]> = {
  exploration: ['skill_check', 'talk', 'introduce', 'engage', 'narrate_only'],
  combat: ['attack', 'skill_check', 'narrate_only'],
};

export function buildSchema(brief: SceneBrief): object {
  const targets = [...brief.inReach.map((e) => e.id as string), ...MINT_SLOTS];
  return {
    type: 'object',
    properties: {
      narration: { type: 'string' },
      op: { type: 'string', enum: OPS_BY_MODE[brief.mode] },
      target: { type: 'string', enum: targets },
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
    },
    required: ['narration', 'op', 'target', 'ability', 'difficulty', 'damage', 'introduces'],
  };
}

export function renderPrompt(brief: SceneBrief): string {
  const roster = brief.inReach
    .map((e) => `  ${e.id} = ${e.name}. ${e.lore}${e.dead ? ' (DEAD)' : ''} [${e.hp.now}/${e.hp.max} hp]`)
    .join('\n');
  const scenery = brief.scenery.length === 0 ? '' : `\nAlso present but not targetable: ${brief.scenery.map((e) => e.name).join(', ')}.\n`;
  const history = brief.recent.length === 0 ? '' : `\nRecently:\n${brief.recent.map((r) => `  ${r}`).join('\n')}\n`;

  return `You are the Dungeon Master of a tabletop RPG. Narrate vividly in second person, two or three sentences, and never speak for the player's decisions.

Scene: ${brief.scene}
Mode: ${brief.mode}

The player is ${brief.protagonist.name}, ${brief.protagonist.hp.now}/${brief.protagonist.hp.max} hp.

You may target ONLY these, and you must use the identifier on the left, not the name:
${roster}
  ~new1, ~new2 = use one of these ONLY if you are introducing someone new, and fill in "introduces".
${scenery}${history}
The player says: "${brief.utterance}"

Decide what happens. Set "difficulty" to how hard the attempt genuinely is, 5 for trivial and 25 for near impossible. Do not roll dice yourself and do not state an outcome; the engine rolls and decides. If nothing mechanical happens, use op "narrate_only".`;
}

export interface OllamaOptions {
  readonly endpoint?: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly timeoutMs?: number;
}

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
          temperature: opts.temperature ?? 0.8,
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

  const others = [...w.entities.values()].filter((e) => e.id !== w.protagonist);
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
    utterance,
  };
}
