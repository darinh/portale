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
