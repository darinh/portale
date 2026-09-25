# Model probe

Answers one architectural question with a number instead of an opinion: can a locally
hosted model be trusted to emit engine-valid DM actions?

```
node tools/model-probe/probe.mjs --model qwen2.5:3b-instruct --trials 8
node tools/model-probe/probe.mjs --endpoint http://127.0.0.1:11434/v1
```

Requires an Ollama server on `127.0.0.1:11434` and the model pulled. `--endpoint` and
`--model` match the defaults used by `tools/replay-probe` (`http://127.0.0.1:11434/v1`
and `qwen2.5:3b-instruct`). An unreachable endpoint fails fast with a clear error.

## Historical synthetic-shape experiment (not today's gate)

**These numbers are not evidence that the current production proposal conforms to today's
schema.** `probe.mjs` validates an old nested synthetic shape
`{ narration, intent: { kind, ability, difficulty } }`. That shape predates the flat
production proposal built by `buildSchema` in `packages/app/src/director.ts`
(`narration`, `op`, `target`, `ability`, `difficulty`, …). Keep the table as a historical
record of the constrained-decoding experiment; do not cite the 8/8 row as a pass on the
live director schema.

Run 2026-09-15 on the GPU-less dev box (16 vCPU EPYC 7763, no GPU), `qwen2.5:3b-instruct`,
8 trials per mode, against that synthetic nested shape:

| Mode | Parses as JSON | Engine-valid (synthetic shape) |
| --- | --- | --- |
| unconstrained plain prompt | 0/8 | 0/8 |
| `format: "json"` | 8/8 | 0/8 |
| `format: <json schema>` | 8/8 | 8/8 |

Generation ran at 14.5 tok/s, roughly 11s per turn, on CPU. The production target is a
4090 with a 14B-class model, so treat that latency as a floor, not a forecast.

## Why the middle row is the point

Plain JSON mode parsed cleanly on every trial and was still worthless. The model emitted
`"Narration"` with a capital N and omitted the required `intent` object. JSON-syntax
validity and schema-shape validity are different properties, and a gate that only calls
`JSON.parse` scores that output 8/8.

## What this settles, and what it does not

Constrained decoding eliminates the syntax-and-shape class of model failure at the
transport layer. The application does not need a parse-repair-retry ladder for it.

It does not eliminate the semantic class. A schema-valid action can still be illegal:
difficulty 30 to pick a simple lock, healing past max HP, spending gold the player does
not have, targeting an NPC who is already dead. Rules validation stays the engine's job
and is the only place model output can legitimately be rejected.


# Enum probe

`probe-enum.mjs` tests the follow-on risk: if the engine builds the target list per turn
as a closed enum, does a longer list degrade the model's ability to pick the right member?

```
node tools/model-probe/probe-enum.mjs --model qwen2.5:3b-instruct --trials 8
```

The scene is unambiguous. Marga the one-eyed smuggler has drawn a knife and is stepping
toward the player, everyone else is a bystander, and the player says they strike at the
smuggler. There is exactly one defensible target.

## Measured result

RETRACTED. The first run of this probe was confounded and its numbers should not be used.
See "The retraction" below. The corrected run, with the attractor present in every
condition, is:

| Enum size | Target inside enum | Target correct |
| --- | --- | --- |
| 3 | 8/8 | 6/8 |
| 6 | 8/8 | 3/8 |
| 8 | 8/8 | 3/8 |
| 10 | 8/8 | 4/8 |
| 25 | 8/8 | 6/8 |

`op` was correct 7/8 or 8/8 at every size. That enum has four members.

## The retraction

The first version of this script built each condition with `DISTRACTORS.slice(0, n-1)`
over an arbitrarily ordered list. `e_old_woman_knitting` sat at index 5, so it was absent
from the 3-entity condition and present in the larger ones. It then accounted for nearly
every wrong answer.

That produced a clean and completely spurious trend of 8/8, 4/8, 3/8 for sizes 3, 10 and
25, which was read as enum length degrading choice quality. Length was confounded with
distractor identity. The experiment never measured what it claimed.

The corrected run pins the attractor at index 0 so it appears in every condition. The
trend disappears. Size 25 scores the same as size 3.

## What actually holds

The decoder guarantee is real and absolute. Target-inside-enum was 8/8 in all five
conditions across both runs, and 40/40 overall.

Reference resolution is unreliable on this model and list length is not why. A 3B model
asked to bind "the one-eyed smuggler threatening me" to `e_marga_smuggler` gets it right
somewhere between 37% and 75% of the time, and a salient distractor pulls it off target
whether it is choosing among 3 candidates or 25.

Validity metrics cannot see any of this. In-enum conformance was perfect in every single
condition including the ones where the model attacked an unarmed bystander five times out
of eight.

## What this does NOT license

It does not license a cap on `inReach`, and `MAX_IN_REACH = 8` in
`packages/app/src/director.ts` currently has no evidence behind it. Capping the list does
not restore correctness because length is not the mechanism.

It also does not license strong claims from these numbers generally. Eight trials per
cell cannot separate 3/8 from 6/8. Treat every figure here as a smoke signal, not a
measurement, until it is re-run with more trials on the real 14B target.

## A hypothesis worth testing next

The enum values are opaque snake_case identifiers. The model must map a natural-language
description onto `e_marga_smuggler`. That mapping, rather than the list length, is the
plausible failure. Carrying human-readable labels alongside the ids, or supplying an
explicit name-to-id table in the prompt, is the cheaper fix to try before capping
anything.

## Caveat

This is a 3B model on CPU, weaker than the 14B production target. Re-run on the real host
before trusting any number here.
