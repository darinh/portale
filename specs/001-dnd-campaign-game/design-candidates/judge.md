# Cross-judge verdict

Judge: `gpt-5.6-sol`, read-only, different model family from the coordinator. It saw the candidates
by directory label only. Mapping, recorded after judging: `a` is `claude-opus-5`, `b` is `gpt-6-astra`,
`c` is `grok-4.6`. Rubric and counting convention as given to the judge.

| Criterion | A | B | C |
| --- | --- | --- | --- |
| R1 small-model burden | 5. Exploration 3 fields (move of at most 12, band of 5); combat 2; structured 1, no enum | 5. Free text 2 fields (candidate of at most 6); structured 1 | 2. Nine fields on free text; structured still carries reveals and tick |
| R2 one content path | 5. One `ClassDef`/`Effect` path; `scripted` refused for campaign and player provenance | 5. Scoped definitions, recipes, closed `Intrinsic` union, capability closure at admission | 4. Common IR, but `code` handlers lack a provenance gate |
| R3 replay and persistence | 4. Digest-pinned packs, derived sheet, succession on the save; rules revisions unpinned, transition idempotence asserted more than proven | 5. Genesis pins content and rules revision; durable operations; death-keyed replacement | 3. Stores current and max meters beside derivation |
| R4 contract sync | 5. One `parsePack`, frozen digest test, conformance corpus | 5. One `admit` with quality and support; stale-export fixtures | 4. Digest hashes only a version number |
| R5 migration | 5. The 3B ballot falsified first, with a kill criterion | 4. Playable units, but the biggest risk (the effect language) is unit 2 | 4. Schema collapse first; legacy policy wavers |
| R6 constitution and depth | 3. One command resolves a whole round, a temporal-decomposition flaw for initiative, bonus actions and reactions | 4. Resumable combat state machine; `adjudicate` and `transition` are two decision points | 3. The model still nominates clocks and discoveries; secrets reach the prompt |
| Total | 27 | 28 | 20 |

The judge recommended B as the base, grafting A's invariant that free-text candidates are projections of
the same engine-owned offers, and C's single settlement funnel. It listed four defects to fix in B:
unify `adjudicate` and `transition`, make the candidate cap contractual, move the effect-language
feasibility slice ahead of implementation, and settle the Artificer's name.

The coordinator scored A 30, B 26 and C 20 on the same rubric, and chose A as the base. The reasons and
the grafts are in `../plan.md`, under "Synthesis decision".
