# Model probe

Answers one architectural question with a number instead of an opinion: can a locally
hosted model be trusted to emit engine-valid DM actions?

```
node tools/model-probe/probe.mjs --model qwen2.5:3b-instruct --trials 8
```

Requires an Ollama server on `127.0.0.1:11434` and the model pulled.

## Measured result

Run 2026-09-15 on the GPU-less dev box (16 vCPU EPYC 7763, no GPU), `qwen2.5:3b-instruct`,
8 trials per mode.

| Mode | Parses as JSON | Engine-valid |
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

| Room | Target inside enum | Target correct |
| --- | --- | --- |
| 3 entities | 8/8 | 8/8 |
| 10 entities | 8/8 | 4/8 |
| 25 entities | 8/8 | 3/8 |

`op` was correct 8/8 at every size. That enum has four members and never degraded.

## What this means

The decoder guarantee is absolute and misleading. Validity held at 24/24 across every
condition while correctness fell to 37%. The most common wrong answer was
`e_old_woman_knitting`, an unarmed bystander.

Measuring validity alone would have scored this run perfect. The failure is only visible
if the probe knows which answer was *right*, which is why this script asserts on a known
correct target rather than on schema conformance.

So `inReach` is a load-bearing policy decision, not a convenience. Scope it to the few
entities the player could plausibly mean and let the prompt mention the rest as scenery.
A generous `inReach` is actively harmful, and it is harmful in a way no validity metric
will ever report.

## Caveat

This is a 3B model on CPU, weaker than the 14B production target. The absolute numbers
should improve on a 4090. The shape of the degradation is the finding, and the mitigation
costs nothing, so apply it regardless and re-run this probe on the real host before
trusting any specific cap.
