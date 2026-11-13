# Benchmark Stratification, Leakage Audit & Evaluation Protocol
## Milestone 1 – Preregistered Research Design (Revision 3.0)

**Project:** LLM-Guided Relevance-Supervised Domain Adaptation for Local E5-small
**Date:** 13 November 2026
**Status:** Design only; implementation, pilot, training, and official evaluation are not authorized
**Roles:** Gemini Primary Teacher; independent blind GPT Judge; local multilingual E5-small Student

---

## 1. Methodological Claim

This project performs **LLM-guided, relevance-supervised fine-tuning of a bi-encoder**. Gemini generates synthetic queries and assigns ordinal relevance labels; an independent GPT Judge assigns the same labels without seeing Gemini outputs; the local E5-small Student learns from accepted query–passage and ranking supervision.

This is **not embedding-vector distillation** unless a later approved experiment explicitly trains the Student to reproduce Teacher embedding vectors or continuous Teacher logits. The current 0–3 relevance grades are ordinal judgments, not Gemini vector targets. `MarginMSELoss` with margins derived from these grades is ranking supervision and must not be described as direct vector imitation.

---

## 2. Evaluation Strata

### 2.1. Development & Regression Benchmark: 90 Queries

`benchmark/data/queries.csv` contains exactly:

| Group | Count | Primary role |
| :---: | :---: | :--- |
| G1 | 12 | Title/artist lookup regression |
| G2 | 42 | Topic and theological-intent development |
| G3 | 24 | Lyrics retrieval regression |
| G4 | 12 | Ambiguity and edge cases |

These queries and qrels were exposed through repeated system development. They are an in-distribution development/regression benchmark, never an untouched test set, and must not appear in training.

### 2.2. Distillation-Held-Out Topic Diagnostic: T11–T16

This is a subset of G2, not an additional benchmark. The repository contains 14 rows: T11=3, T12=3, and T13–T16=2 each. Synthetic supervision excludes these six topic intents, but prior exposure means the set diagnoses transfer/regression only. Report per topic and both query-weighted and topic-macro summaries.

### 2.3. External Independent Generalization Set: 30 Queries

The only independent final set is 30 newly authored queries, frozen before model selection and governed by `external_test_specification.md`. It supports claims about new queries/topics over the fixed corpus. It does not support song-generalization claims unless songs are also held out under a separately approved protocol.

---

## 3. Supervision Architecture and Blindness

1. **Gemini Primary Teacher – generation:** creates candidate synthetic queries only from approved T01–T10 sources and eligible corpus material.
2. **Gemini Primary Teacher – labeling:** scores randomized query–section candidates on a 0–3 rubric and cites verbatim evidence for grades 2–3.
3. **GPT Independent Judge:** receives the query, anonymized section text, and rubric only. It must not receive Gemini scores, explanations, candidate rank, retriever identity, source topic, intended concepts, song title, or artist.
4. **Evidence verifier:** deterministic code checks that each cited quote is a normalized substring of the supplied section.
5. **Consensus builder:** applies the disagreement policy below without changing raw judgments.
6. **Local E5-small Student:** trains only on schema-valid, leakage-cleared examples authorized by the applicable confidence tier.

The exact Teacher and Judge model identifiers, provider revisions, prompts, generation parameters, and API response metadata must be frozen in the preregistration. No model substitution is allowed within a run.

---

## 4. Consensus and Disagreement Policy

Let `Δ = |score_gemini - score_gpt|`.

| Condition | Confidence tier | Automatic use in primary training |
| :--- | :--- | :--- |
| `Δ = 0` and required evidence is valid | `high_confidence` | Eligible, subject to leakage and multi-positive checks |
| `Δ = 1` and required evidence is valid | `medium_confidence` | **No**; store separately for approved ablation or human adjudication |
| `Δ ≥ 2` | `major_disagreement` | **Excluded** from automatic training; queue for human review |
| Any grade 2–3 with invalid/missing evidence | `invalid_evidence` | Excluded regardless of Δ |
| Schema failure, truncated response, or unknown model | `invalid_run_record` | Excluded |

Agreement on grade 1 does not turn the item into a strong negative. Grade 1 remains partial relevance/hard-negative territory and must not be silently collapsed into grade 0.

---

## 5. Leakage Controls

Every synthetic query must pass the following checks against the 90 development rows, the T11–T16 diagnostic rows, and the frozen external set once available:

1. Unicode NFC, lowercase, punctuation and whitespace normalization.
2. Exact and bidirectional substring rejection.
3. Word Jaccard `> 0.35` or character-trigram Jaccard `> 0.45`: reject.
4. Normalized Levenshtein distance `< 0.30`: reject.
5. Frozen pretrained-E5 cosine `> 0.80`: reject; cosine `[0.75, 0.80]`: human review.
6. Specialized T11–T16 intent or diagnostic query–song supervision: reject.

The thresholds are preregistered design thresholds and must be versioned. They are not claimed to be empirically optimal. All component measurements, not only the final pass/fail decision, must be retained.

The six anchor songs—*Way Maker, Build My Life, Raise A Hallelujah, Who You Say I Am, Do It Again,* and *I Surrender*—remain excluded from query generation, positive pairs, explicit negatives, and hard-negative mining under the current proposed protocol. They remain in the inference corpus for regression measurement. This split requires explicit approval before implementation.

---

## 6. Multi-Positive and False-Negative Control

Training examples are section-grounded, while retrieval qrels are song-level. A query may have multiple relevant songs and multiple relevant sections per song.

- Grades 2–3 with valid evidence define known positives.
- Grade 0 with a valid rationale may define an explicit negative.
- Grade 1 is not a strong negative by default.
- Before batching, construct a query-to-relevant-song and query-to-relevant-section lookup over all judged candidates.
- Never allow a known relevant song or section to become an in-batch negative for the same query.
- Sections from the same song must not be treated as mutually negative.
- If the selected training library cannot mask all known positives, use a custom relevance-aware contrastive loss or explicit-negative objective. Do not claim standard `MultipleNegativesRankingLoss` is safe without this check.

Any sampled “negative” that was never judged remains `unjudged`, not grade 0.

---

## 7. Song-versus-Section Retrieval and Aggregation

The primary unit of evidence is a lyric section; the primary reporting unit is a song.

1. Encode each eligible section with `passage: `.
2. Rank section scores for a query encoded with `query: `.
3. Aggregate to song score using the **maximum eligible section score per song**, matching the current `best_sections`/`DISTINCT ON (song_id)` implementation.
4. Return the winning section as evidence.
5. Whole-song-vector retrieval is a separate ablation and must use a separate experiment ID.

Section and whole-song scores must never be pooled into one run without a preregistered fusion rule. External qrels are song-level, but grade 2–3 judgments must preserve supporting section IDs and evidence quotes.

---

## 8. Baselines, Metrics, and Statistical Analysis

### 8.1. Baseline Metadata

| Baseline | Frozen identifier | Dimension | Query/document convention | Storage |
| :--- | :--- | :---: | :--- | :--- |
| FTS | PostgreSQL `tsvector`/GIN | N/A | lexical | `songs`, `song_sections` |
| Pretrained E5 | `Xenova/multilingual-e5-small` plus pinned revision/runtime | 384 | `query: ` / `passage: ` | `song_embeddings_e5` |
| Gemini embedding baseline | `gemini-embedding-001` if still accessible at preregistration | 768 | `RETRIEVAL_QUERY` / `RETRIEVAL_DOCUMENT` | `song_embeddings` |
| Fine-tuned Student | approved checkpoint hash | 384 | `query: ` / `passage: ` | planned isolated table |

An inaccessible baseline is reported as unavailable; it is not silently replaced.

### 8.2. Metrics

Report nDCG@3, Hit@3, MRR@10, Recall@10, and latency with the same corpus snapshot, qrels semantics, and aggregation rule. Unjudged documents must remain distinguishable from grade 0.

For G2, paired bootstrap resampling uses topic ID as the cluster (`B=1,000`) and reports 95% confidence intervals. For T11–T16, show each topic and use a paired permutation analysis as sensitivity; six topics provide limited power. A confidence interval containing zero means the observed data do not establish a non-zero difference, not that the systems are equivalent. Also report win/loss/tie counts and absolute changes.

---

## 9. Preregistration and Fail-Closed Execution

Before any pilot or training, freeze and hash:

- corpus export and row counts;
- all query sets and qrels;
- split and anchor-song lists;
- Teacher/Judge model IDs, prompt versions, parameters, and retry policy;
- Student base model revision, tokenizer, runtime, quantization setting, loss, sampler, seed, batch size, epochs, and stopping rule;
- candidate generation/pooling, section aggregation, metrics, statistical tests, and acceptance criteria;
- code commit and environment lockfile.

Research runs must use explicit providers and **fail closed** on model unavailability, quota exhaustion, invalid JSON, evidence failure, or schema mismatch. Production fallback behavior must not be reused in the research pipeline. Retries may target only the same pinned model and must be logged.

---

## 10. Milestone Gate

Milestone 1 ends with reviewed specifications only. The following require new explicit approval: model-availability preflight, external-query authoring, reviewer recruitment, 50-query pilot, synthetic generation, Teacher/Judge API calls, training, ONNX export, database writes, and production integration.
