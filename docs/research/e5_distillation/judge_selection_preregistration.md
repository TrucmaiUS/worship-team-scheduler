# Judge Selection & Validation Preregistration

**Version:** `judge-selection-v3`
**Date revised:** 17 November 2026  
**Status:** Human Reference v2 validated; live candidate execution pending; no candidate selected

## Purpose

Select one Groq-hosted independent Judge for the later Teacher/Judge pipeline. Initial preferred candidate is `openai/gpt-oss-120b`; multilingual challenger is `qwen/qwen3.8-27b`. Preference does not count as evidence and is not a tie-breaker.

## Development-only reference set

The reference set is exactly 50 query–section pairs with the frozen human-label distribution `17/9/8/16` for grades `0/1/2/3`. All source query IDs must come from the existing 90-row development benchmark, while all rows tied to T11–T16 are excluded. The 30 external independent queries are prohibited. This set is for Judge selection only and never becomes Student training data.

The evaluator resolves every query ID, topic and exact query text against `benchmark/data/queries.csv`, and every internal section ID, section type and exact lyrics against the frozen `songs.csv` corpus. Self-declared `development_only` metadata is not trusted. Internal section IDs are used for validation/provenance but are removed from provider payloads.

Required balance before either model runs:

- at least eight final human-reference labels in each class 0, 1, 2 and 3; the received 50-pair set must also retain the exact `17/9/8/16` distribution;
- exactly 25 `en_query_vi_lyrics` and 25 `vi_query_vi_lyrics` pairs, reflecting the two observed development strata without inventing a third bucket;
- at least 15 distinct human-reviewed theological distinction tags; Human Reference v2 contains 15 tags across all 50 pairs;
- exact section text and a blind candidate alias, without title/artist/rank/provider clues.

Two named domain reviewers independently label every pair with the same 0–3 rubric and rationale. They cannot see either model output or each other's first label. A distinct adjudicator assigns the final reference label whenever the two initial labels differ. Reference labels and adjudication must be sealed before model execution.

Evidence is stored as `evidence_quotes: string[]`. Each item is one exact contiguous verbatim span after Unicode NFC canonicalization only; whitespace, case and punctuation are not normalized. This accommodates canonically equivalent Vietnamese combining sequences without accepting reconstructed text. Multiple non-contiguous spans use separate array items. Ellipsis, slash delimiters and reconstructed quotes are invalid. Grade 0 requires `[]`; grade 1 may use `[]`; grades 2–3 require at least one span.

## Blind candidate execution

Both candidates receive identical pair order, rubric, prompt, input, JSON mode, local strict-schema validation, token cap, sampling parameters and retry policy. Each model runs in its own sealed output file. Neither sees Gemini outputs, human rationale, reference label, or the other candidate. There is no model fallback and no partial run reported as complete.

After the same-model retry policy is exhausted, a pair-level JSON/schema/evidence-contract failure is stored as `schemaPass=false` and counts as an incorrect result; execution continues so all 50 frozen pairs are attempted. Authentication, provider/model mismatch, reference-hash mismatch and other protocol-integrity failures still stop the run fail-closed.

Exact agreement, Macro-F1, the reported confusion matrix and per-grade recall use all 50 pairs; schema failures are an explicit non-grade prediction and therefore count as incorrect/false negative. MAE and quadratic weighted kappa are additionally reported on score-producing pairs only, with `scoredPairs` and schema-pass rate making that conditional coverage explicit. Selection ranking is never reached unless the 100% schema-compliance hard gate passes. Query-cluster-aware 95% percentile intervals resample the frozen `sourceQueryId` clusters with 2,000 deterministic replicates (seed `20261113`).

The initial v2 execution attempt used provider-side strict JSON Schema. GPT-OSS completed 50 pairs, but Groq returned HTTP 400 for Qwen because the current Models API advertises `json_mode` but not `structured_outputs` for `qwen/qwen3.8-27b`. No v2 comparison or selection was performed. Version 3 therefore uses the strongest response format currently shared by both exact models (`json_object`) and applies the same strict Zod/evidence validation locally. Both candidates must be rerun under v3; v2 GPT-OSS outputs are not mixed into the comparison.

The first v3 preflight exposed missing field names in the prompt, so prompt v4.2 makes the six-key JSON contract explicit. A subsequent Qwen preflight returned an empty provider `failed_generation` at the 512-token cap. A 1024-token preflight passed three pairs per model, but the full Qwen run then exposed an account OTPM limit of 1000 that rejects a 1024 maximum-output request. Before any complete comparable run, the shared cap was set to 900 for both candidates. Outputs from all earlier partial runs are retained as failure evidence and excluded from comparison.

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

## Current readiness and blockers

Human Reference v2 passes structural validation with 50 frozen labels, the exact `17/9/8/16` distribution, reviewer/adjudicator provenance, source section IDs, two observed language strata and 15 human-reviewed distinction tags. The 25 G4 paraphrases have versioned reference-query IDs while retaining their original benchmark-query lineage. P006 retains an explicit versioned candidate-text correction; the other 49 candidates match corpus sections exactly.

Live execution requires a successful same-account Groq model-inventory preflight for both exact model IDs. Model evidence contextual support remains a separate human audit after raw outputs are sealed; code-computed verbatim validity does not replace that audit. Existing `qrels.csv` is not reused as section-level human ground truth.
