# Research

The evidence the D&D redesign rests on. Read the relevant report before changing a rule, a content
format or a generator step, and cite it when a decision depends on it.

| File | What it establishes |
| --- | --- |
| [`rules-srd-5.2.1.md`](rules-srd-5.2.1.md) | The legal rules base is SRD 5.2.1 (CC-BY-4.0), with its required attribution. What it contains and lacks, the machine-readable datasets and their licenses, the 2014 to 2024 differences an engine must model, the Artificer's licensing, and the encounter and advancement tables. |
| [`campaign-design.md`](campaign-design.md) | How campaigns and modules are structured (campaign as series, module as season), the quality rules a validator can check with a support grade for each, a generation procedure that keeps a small model to short local text, and solo-play adaptations including death and succession. |
| `srd-5.2.1-data/` | Name lists counted from the SRD 5.2.1 PDF (339 spells, 330 stat blocks, 258 magic items, 155 glossary entries) and the script that recounts them. These are the fixtures for a build-time content check. |
| `campaign-design-verification/` | The claim lists and scripts that re-fetched the cited pages. The page caches were scratch and are not kept, so `check_campaign_report.py` needs a fresh fetch to run. |

Both reports were written on 2026-09-25 by research agents working from primary sources, and every
count in the rules report was produced by script from the official PDFs.

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the
Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative
Commons Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode. The tables reproduced in these reports were
reformatted and the rules text paraphrased.
