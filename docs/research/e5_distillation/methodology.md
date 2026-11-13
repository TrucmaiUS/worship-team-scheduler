# Research Methodology: LLM-Guided Relevance-Supervised Fine-Tuning
## Milestone 2 – Offline Control Layer and Gated Execution (Revision 3.0)

**Project:** Worship Team Management System
**Student:** Local multilingual E5-small bi-encoder
**Supervision:** Gemini Primary Teacher plus independent blind GPT Judge
**Date:** 13 November 2026
**Current status:** Offline validation infrastructure implemented; API generation, pilot, and training remain inactive

---

## 1. Methodological Definition

The project adapts E5-small using LLM-created queries and LLM relevance judgments. The Student learns from accepted query–section positives, verified negatives, and optionally preregistered ordinal ranking margins.

This is **relevance-supervised bi-encoder fine-tuning**, not embedding-vector distillation. No current objective asks E5 to reproduce Gemini/GPT embedding vectors or continuous hidden representations. If a future experiment introduces such targets, it requires a new name, protocol, and approval.

---

## 2. Gated Architecture

```text
Approved T01–T10 sources + eligible non-anchor sections
                         |
                         v
              Gemini query generation
                         |
                         v
       deterministic leakage and split controls
        exact / substring / Jaccard / NLD / E5
                         |
                         v
           randomized candidate construction
                    /           \
                   v             v
      Gemini relevance label   blind GPT label
                   \             /
                    v           v
             evidence verification
                         |
                         v
        Δ0 high / Δ1 separate / Δ≥2 excluded
                         |
                         v
       known-relevance graph and batch audit
                         |
                         v
         local E5 relevance-supervised training
                         |
                         v
      development + diagnostic + external evaluation
```

Every arrow is a materialized, hashed artifact boundary. Raw generation and judgment records are append-only.

---

## 3. Implemented Offline Control Layer

The repository now contains `lib/research/e5-distillation/` with:

- Unicode normalization and similarity primitives;
- multi-stage leakage decisions with a required semantic-check gate;
- verbatim evidence validation;
- deterministic consensus policy;
- T01–T10/T11–T16 and anchor/protected-query split checks;
- known-positive/verified-negative graph construction;
- contrastive batch false-negative detection;
- exact model pinning and no-fallback configuration validation;
- offline unit tests and a repository-data self-check command.

These controls contain no Teacher/Judge API client and perform no database writes.

---

## 4. Supervision Policy

### 4.1. Generation

Gemini may generate queries only from approved T01–T10 and eligible non-anchor source material. Generated text is a candidate until all lexical, edit-distance, semantic, held-out-intent, and human-review gates pass.

### 4.2. Independent Labeling

Gemini and GPT independently score anonymized query–section pairs with the same rubric. GPT never sees Gemini output, titles/artists, retriever scores/ranks, topic IDs, or expected labels. Grades 2–3 require independently verified verbatim evidence.

### 4.3. Agreement

| Condition | Dataset tier | Primary automatic training |
| :--- | :--- | :---: |
| Δ=0, valid evidence | High confidence | Eligible, except grade 1 remains excluded from strong positive/negative use |
| Δ=1 | Medium confidence | No; separate review/ablation only |
| Δ≥2 | Major disagreement | No |
| Invalid schema/model/evidence | Invalid | No |

---

## 5. Training Objectives

### 5.1. Relevance-Aware Contrastive Objective

Use section-grounded grade 2–3 positives and verified grade-0 explicit negatives. Before any batch enters the loss:

- all known relevant songs/sections for each query are masked from negatives;
- sections from the same relevant song are not treated as mutually negative;
- grade 1, Δ1, Δ≥2, and unjudged candidates are not strong negatives;
- the batch audit must pass without an in-batch false positive-to-negative collision.

Standard `MultipleNegativesRankingLoss` is allowed only if the sampler/loss masks every known positive. Otherwise use a custom relevance-aware objective or explicit negatives.

### 5.2. Optional Ordinal Ranking Objective

Pairwise margins derived from 0–3 grades are experimental ordinal targets, not Teacher cosine ground truth. Margin policy, loss, weights, and ablations must be preregistered. Do not call this embedding-vector distillation.

### 5.3. E5 Invariants

- Query: `query: <text>`
- Passage: `passage: <section text>`
- Primary retrieval: section similarity, maximum section score per song
- Whole-song vectors: separate ablation
- Fine-tuned vectors: isolated 384-dimensional table and explicit model routing

---

## 6. Evaluation Boundary

- **90-query Development & Regression Benchmark:** exposed development evidence; no training rows.
- **T11–T16 Distillation-Held-Out Topic Diagnostic:** 14 current G2 rows over six topics; diagnostic only.
- **30-query External Independent Generalization Set:** frozen new queries with independent human qrels; the only planned independent final claim.

Checkpoint selection, thresholds, prompts, and stopping rules must not be tuned on T11–T16 or the external set.

---

## 7. Execution Sequence and Approval Gates

### Gate A – Completed Offline Scaffold

- Schemas and deterministic policies implemented.
- Unit tests and repository-data validation available.
- Judge prompt and methodology aligned with Revision 3.0.

### Gate B – Pending Model Preflight Approval

- Obtain Google and OpenAI API keys outside Git/chat.
- Verify one exact Gemini model and one exact GPT model with minimal requests.
- Freeze model IDs, prompt/config hashes, retry policy, cost ceiling, and stop rules.

### Gate C – Pending 50-Query Pilot Approval

- Generate/label only the approved pilot volume.
- Inspect leakage, evidence validity, agreement distribution, failure rate, and cost.
- Do not train during the pilot.

### Gate D – Pending Dataset and Training Approval

- Approve scale after pilot review.
- Build immutable manifests and training examples.
- Audit every contrastive batch.
- Train isolated experiments and retain all logs/checkpoints.

### Gate E – Pending External Evaluation and Deployment Approval

- Freeze the selected checkpoint before external scoring.
- Run the preregistered external evaluation.
- Export/verify ONNX and index a separate fine-tuned vector table only after acceptance.

---

## 8. Current Integrity Statement

The Milestone 2 implementation added offline controls and tests only. It made no Gemini/OpenAI request, generated no real synthetic query, ran no pilot, trained no model, changed no database row/schema, and integrated no model into production retrieval.
