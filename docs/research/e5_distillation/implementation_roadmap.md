# Implementation Roadmap: LLM-Guided Relevance-Supervised E5 Adaptation

**Project:** Worship Team Search Engine
**Date:** 13 November 2026
**Current branch target:** `codex/e5-distillation-m2`
**Current position:** Milestone 1 design complete; Milestone 2 offline controls implemented; Phase 0 repository stabilization in progress

---

## 1. Non-Negotiable Research Boundaries

- Gemini is the Primary Teacher for synthetic query generation and relevance labeling.
- GPT is an independent blind Judge and never receives Gemini output, retrieval rank, title, artist, or expected label.
- Local multilingual E5-small is the Student.
- The method is relevance-supervised bi-encoder fine-tuning, not embedding-vector distillation.
- The 90-query benchmark is development/regression evidence only.
- T11–T16 are a 14-row distillation-held-out topic diagnostic, not an independent unseen test.
- The 30-query external set is the only planned independent generalization evaluation.
- No silent provider/model/heuristic fallback is permitted in research execution.
- No protected query, external query, diagnostic qrel, or anchor-song supervision may enter training.
- Production vectors are never overwritten; every Student version uses an isolated model/table identity.

---

## 2. Phase Map

| Phase | Objective | Current state | Exit gate |
| :---: | :--- | :---: | :--- |
| 0 | Stabilize repository and create a safe checkpoint | In progress | Branch, inventory, secret controls, green checks, scoped checkpoint |
| 1 | Complete offline end-to-end data controls | ~85% | Source → validated training candidate works offline with manifests |
| 2 | Preregister and freeze experimental decisions | Partial | Splits, models, prompts, thresholds, pool, budget, and stop rules approved |
| 3 | Implement API adapters and minimal preflight | Not started | Exact Gemini/GPT pins pass strict schema/evidence checks without fallback |
| 4 | Run the 50-query pilot | Not started | Pilot quality, leakage, agreement, failure, and cost criteria pass |
| 5 | Build the full supervised dataset | Not started | Versioned, hashed, reviewed dataset and dataset card |
| 6 | Fine-tune E5 | Not started | Reproducible checkpoints and a selected candidate without unacceptable regression |
| 7 | Development and diagnostic evaluation | Not started | Complete 90-query and T11–T16 reports with statistical analysis |
| 8 | External independent evaluation | Protocol only | Frozen 30-query qrels and one official scoring event |
| 9 | ONNX, pgvector, and production rollout | Not started | Parity, shadow test, observability, and rollback pass |

---

## 3. Phase 0 – Repository Stabilization

### 3.1. Work Items

1. Create branch `codex/e5-distillation-m2` from the current feature branch without discarding the dirty working tree.
2. Inventory modified and untracked files by ownership/scope:
   - research protocol and controls;
   - benchmark data/results/scripts;
   - production retrieval;
   - generated/private/heavy artifacts.
3. Harden `.gitignore` for secrets, provider raw responses, private external evaluation material, local model caches, checkpoints, and training runs.
4. Preserve `.env.example` as committable while ignoring real `.env*` files.
5. Fix current TypeScript errors with type-only/minimal behavior-preserving changes.
6. Run:
   - repository-wide TypeScript check;
   - targeted ESLint;
   - offline research tests;
   - offline repository-data validation;
   - secret/network/database-call scan for the research module.
7. Create a scoped checkpoint only after file ownership is clear. Do not automatically commit unrelated dirty changes.

### 3.2. Exit Criteria

- A dedicated branch exists.
- No key, `.env.local`, private external query, raw provider response, model cache, or checkpoint is staged.
- Research tests and validation pass.
- TypeScript errors are resolved or explicitly quarantined with evidence.
- The intended checkpoint file list is documented before commit.

---

## 4. Phase 1 – Complete the Offline Pipeline

### 4.1. Persistence and Provenance

Implement append-only JSONL storage with atomic writes, deterministic IDs, resume/checkpoint support, and SHA-256 manifests for prompts, requests, responses, corpus snapshots, records, and files.

Planned artifact layout:

```text
benchmark/distillation/
  manifests/
  generated_queries/
  leakage_decisions/
  teacher_judgments/
  judge_judgments/
  consensus/
  disagreement_cases/
  known_relevance/
  training_examples/
  logs/
```

Private/raw provider payloads must remain ignored or access-controlled; only approved derived artifacts and hashes may be committed.

### 4.2. Frozen E5 Leakage Scoring

- Pin model ID, revision, Transformers.js version, quantization, tokenizer, and model artifact hash.
- Cache embeddings of protected queries.
- Batch-encode candidate queries using `query: `.
- Supply actual cosine scores to the existing leakage gate.
- Return `incomplete`, never `passed`, when the semantic check or expected model hash is absent.

### 4.3. Split and Source Snapshot

- Resolve the exact database/corpus IDs of the six anchor songs.
- Produce a frozen T01–T10 eligible source manifest.
- Reject T11–T16, anchor songs, protected query IDs, and missing song/section relationships.
- Store source row counts and hashes.

### 4.4. Held-Out Intent Review

- Add conservative deterministic rules for explicit T11–T16 intent.
- Route ambiguous cases to human review.
- Never let a detector self-certify safety; it may reject or request review only.

### 4.5. Candidate Pool Builder

For each accepted query, build a deduplicated pool from:

- source-positive sections;
- FTS top candidates;
- frozen pretrained-E5 top candidates;
- lexical hard-negative candidates;
- fixed random/control candidates.

Randomize candidate aliases/order before both LLMs. Preserve internal ID mapping outside provider payloads.

### 4.6. Phase 1 Exit Gate

A synthetic fixture must travel offline through:

```text
source → generated-query record → leakage → pool → evidence
→ consensus → relevance graph → batch audit → training-example candidate
```

Every boundary must be schema-valid, hashed, resumable, and covered by integration tests.

---

## 5. Phase 2 – Preregistration and Experimental Freeze

Before any provider call, approve and hash:

### 5.1. Data Decisions

- T01–T10 training-source split.
- T11–T16 diagnostic split and its current 14 rows.
- Exact six-anchor-song ID list.
- Corpus snapshot and eligible section list.
- Development, diagnostic, validation, and external boundaries.

### 5.2. Provider Decisions

- Exact available Gemini model ID.
- Exact available GPT model ID.
- Prompt versions and SHA-256 values.
- Structured output schemas.
- Temperature, top-p, token limits, and seed behavior when supported.
- Same-model retry ceiling, timeout, and fail-closed conditions.

### 5.3. Pool and Review Decisions

- FTS/E5 pool depth.
- Random/control count and seed.
- Maximum candidates per query.
- Song/section deduplication.
- Human-review ownership and turnaround.

### 5.4. Budget and Stop Rules

- Maximum preflight requests/cost.
- Maximum pilot requests/cost.
- Maximum batch failure rate.
- Immediate-stop conditions for model mismatch, quota exhaustion, schema failure, missing evidence, or accidental fallback.

---

## 6. Phase 3 – API Adapters and Minimal Preflight

### 6.1. Secret Handling

- Store Google and OpenAI keys only in `.env.local` or an approved secret store.
- Never paste keys into documentation, logs, provider payload archives, or Git.
- Validate that Git ignores the key files before any request.

### 6.2. Strict Clients

Implement separate clients for:

- Gemini query generation;
- Gemini relevance labeling;
- GPT independent blind labeling.

Each client must enforce exact provider/model identity, structured JSON, timeout, bounded same-model retries, usage/cost logging, checkpointing, and no fallback.

### 6.3. Preflight Scope

Use only a few synthetic demonstration requests:

1. one generation request;
2. one Teacher-label request;
3. one Judge-label request;
4. local failure/schema tests.

No benchmark, diagnostic, external, or real pilot row is used in preflight.

### 6.4. Exit Gate

- Returned provider/model identity matches the pin.
- JSON and evidence validation pass.
- Usage and cost metadata are captured.
- Failure stops without model substitution or placeholder output.

---

## 7. Phase 4 – Fifty-Query Pilot

### 7.1. Execution

1. Generate up to 50 balanced candidates over approved T01–T10 sources.
2. Run all leakage stages.
3. Human-review the ambiguity band.
4. Build and randomize candidate pools.
5. Run Gemini Teacher labels.
6. Run blind GPT labels.
7. Verify evidence and schemas.
8. Build Δ0/Δ1/Δ≥2 tiers.
9. Build the known-relevance graph.
10. Simulate/audit training batches.

### 7.2. Suggested Acceptance Criteria to Freeze Before Running

- 100% provenance/schema completeness.
- Zero protected-query or held-out supervision accepted.
- 100% grade 2–3 evidence validity.
- Zero fallback or model-identity mismatch.
- Zero unjudged/grade-1 candidate used as a strong negative.
- Δ1 fully separated and Δ≥2 fully excluded.
- Failure and cost remain under approved caps.

### 7.3. Prohibited During Pilot

- No model training.
- No full-scale generation.
- No tuning on T11–T16.
- No external query access.
- No automatic use of medium-confidence records.

---

## 8. Phase 5 – Full Dataset Construction

- Freeze a new prompt/config version after pilot review.
- Generate in bounded resumable batches.
- Run leakage, review, candidate pooling, Teacher, Judge, and evidence validation.
- Materialize high-confidence, medium-confidence, disagreement, invalid, and unjudged artifacts separately.
- Build a global known-relevance graph.
- Split by topic/source family, never randomly by individual row.
- Produce immutable manifests, statistics, and a dataset card.

Exit only when every training row traces back to approved source, judgments, evidence, consensus, and manifest hashes.

---

## 9. Phase 6 – Fine-Tuning

Create an isolated Python training package with locked dependencies, dataset preparation, sampler, loss, evaluation, and export scripts.

Recommended experiment order:

1. **T0:** frozen pretrained E5 baseline.
2. **T1:** Δ0 grade 2–3 positives with relevance-aware contrastive training.
3. **T2:** T1 plus verified grade-0 explicit negatives.
4. **T3:** ordinal pairwise-ranking ablation.
5. **T4:** combined objective only if simpler experiments justify it.

Requirements:

- preserve `query: ` and `passage: ` prefixes;
- audit every batch for known-positive collisions;
- use fixed seeds and multiple seeds for important configurations when feasible;
- select checkpoints only on development/validation data;
- record dataset/model/code hashes and all hyperparameters.

---

## 10. Phase 7 – Development and Diagnostic Evaluation

### 10.1. Development/Regression

Report G1/G2/G3/G4 with nDCG@3, Hit@3, MRR@10, Recall@10, latency, and per-query changes.

### 10.2. T11–T16 Diagnostic

- Report all 14 rows.
- Report each of six topics.
- Provide query-weighted and topic-macro results.
- Do not call this unseen generalization.
- Do not use it for checkpoint selection.

### 10.3. Regression Controls

- Six anchor songs versus the other 61 songs.
- Title/artist and exact/partial lyric retrieval.
- Cross-language behavior.
- Win/loss/tie and error analysis.

Select a checkpoint only when thematic gains do not create unacceptable lookup/lyric regression under preregistered thresholds.

---

## 11. Parallel External-Evaluation Track

Start personnel coordination early, while keeping all content sealed from model developers:

- one independent query author;
- two independent reviewers;
- one adjudicator.

The author creates 30 queries without seeing development/training artifacts. After leakage screening, freeze a query manifest/hash and keep text access-controlled. After the Student checkpoint is frozen, prefer full 30 × 67 = 2,010 query–song judgments; otherwise use the preregistered multi-system pool. Preserve raw reviewer grades, evidence, adjudication, and qrel hashes.

---

## 12. Phase 8 – External Official Evaluation

- Use the frozen checkpoint, corpus, code, queries, qrels, metrics, and aggregation rule.
- Do not tune thresholds, model weights, prompts, routing, or corpus after seeing scores.
- Preserve raw logs and documented infrastructure-failure reruns.
- Once viewed, the external set cannot remain independent if used for further optimization.

---

## 13. Phase 9 – ONNX and Production Rollout

1. Export the selected checkpoint to ONNX and quantize INT8.
2. Compare PyTorch and ONNX embeddings/rankings/metrics.
3. Create an isolated 384-dimensional table such as `song_embeddings_e5_ft_v1`.
4. Replace exact-name table routing with an explicit model registry.
5. Index without overwriting pretrained vectors.
6. Run shadow evaluation, observability, regression checks, and rollback drills.
7. Change the production default only after acceptance.

---

## 14. Immediate Execution Order

1. Finish Phase 0 branch/inventory/ignore/type-check/checkpoint work.
2. Implement JSONL persistence, atomic writes, manifests, and resume.
3. Wire the frozen local E5 semantic leakage scorer.
4. Resolve anchor IDs and build the eligible-source snapshot.
5. Implement the offline candidate-pool builder.
6. Add an end-to-end offline integration test.
7. Freeze the Phase 2 preregistration package.
8. Only then add API keys and run the minimal preflight.
