# Judge Selection & Validation Preregistration

**Version:** `judge-selection-v2`  
**Date revised:** 17 November 2026  
**Status:** Human labels received; provenance/metadata validation incomplete; no candidate selected

## Purpose

Select one Groq-hosted independent Judge for the later Teacher/Judge pipeline. Initial preferred candidate is `openai/gpt-oss-120b`; multilingual challenger is `qwen/qwen3.8-27b`. Preference does not count as evidence and is not a tie-breaker.

## Development-only reference set

The reference set is exactly 50 query–section pairs with the frozen human-label distribution `17/9/8/16` for grades `0/1/2/3`. All source query IDs must come from the existing 90-row development benchmark, while all rows tied to T11–T16 are excluded. The 30 external independent queries are prohibited. This set is for Judge selection only and never becomes Student training data.

The evaluator resolves every query ID, topic and exact query text against `benchmark/data/queries.csv`, and every internal section ID, section type and exact lyrics against the frozen `songs.csv` corpus. Self-declared `development_only` metadata is not trusted. Internal section IDs are used for validation/provenance but are removed from provider payloads.

Required balance before either model runs:

- at least eight final human-reference labels in each class 0, 1, 2 and 3; the received 50-pair set must also retain the exact `17/9/8/16` distribution;
- at least eight Vietnamese, eight English and eight cross-lingual pairs;
- at least 15 difficult theological distinctions, each with an explicit tag (for example trust vs generic hope, Spirit guidance vs generic guidance, resurrection hope vs generic optimism, congregational unity vs generic friendship, mission/sending vs general service);
- exact section text and a blind candidate alias, without title/artist/rank/provider clues.

Two named domain reviewers independently label every pair with the same 0–3 rubric and rationale. They cannot see either model output or each other's first label. A distinct adjudicator assigns the final reference label whenever the two initial labels differ. Reference labels and adjudication must be sealed before model execution.

Evidence is stored as `evidence_quotes: string[]`. Each item is one exact contiguous verbatim span. Multiple non-contiguous spans use separate array items. Ellipsis, slash delimiters and reconstructed quotes are invalid. Grade 0 requires `[]`; grade 1 may use `[]`; grades 2–3 require at least one span.

## Blind candidate execution

Both candidates receive identical pair order, rubric, prompt, input, schema, token cap, sampling parameters and retry policy. Each model runs in its own sealed output file. Neither sees Gemini outputs, human rationale, reference label, or the other candidate. There is no model fallback and no partial run reported as complete.

## Metrics

Report exact counts and denominators plus:

- exact accuracy: exact matches divided by all frozen pairs; schema failures count as incorrect;
- quadratic weighted kappa over labels 0–3, only for a complete schema-valid run;
- macro F1, unweighted mean across all four labels, only for a complete run;
- evidence verbatim-match rate among model outputs scored 2–3, independently computed from exact section text;
- evidence contextual-support rate among model outputs scored 2–3, separately audited by a human against query, grade and quote;
- critical-disagreement rate: absolute model/reference difference ≥2 divided by all frozen pairs;
- schema pass rate divided by all frozen pairs;
- total input/output tokens from provider usage; mean and p95 latency when available.

## Selection criteria fixed before evaluation

Hard gates:

1. schema pass rate = 100%;
2. verbatim evidence validity = 100% for grades 2–3;
3. contextual evidence support ≥95% for grades 2–3;
4. critical-disagreement rate ≤5%;
5. complete run with computable kappa and macro F1.

If exactly one candidate passes, select it. If both pass, compare in this order: higher quadratic weighted kappa, higher macro F1, higher exact accuracy, higher contextual evidence support, fewer total tokens, then lower mean latency. An exact tie remains unresolved for human decision; it does not default to GPT-OSS. If neither passes, select neither and revise the protocol as a new version before rerunning.

## Current blockers

The received CSV contains 50 frozen labels and the required `17/9/8/16` distribution. Model execution remains blocked until the source package supplies or explicitly waives the missing reviewer/adjudicator identities, candidate section IDs, cross-lingual bucket metadata and difficult-theological-distinction tags. Evidence whitespace mismatches found by validation must be resolved in a new source version without changing the 50 labels. Existing `qrels.csv` is not reused as section-level human ground truth.
