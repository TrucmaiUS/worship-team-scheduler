# Topic Leakage Audit & Semantic Overlap Analysis
## Milestone 1 – Semantic Boundary and Leakage Control (Revision 3.0)

**Project:** LLM-Guided Relevance-Supervised Domain Adaptation for Local E5-small
**Date:** 13 November 2026
**Status:** Specification revised; Exp D evidence preserved; Exp A–C and all training activities remain pending
**Frozen audit model for existing Exp D:** `Xenova/multilingual-e5-small`, 384 dimensions, mean pooling, L2 normalization, `query: ` prefix
**Primary sources:** `benchmark/data/topics.csv`, `benchmark/data/queries.csv`, `benchmark/data/qrels.csv`, `scripts/audit_topic_leakage.ts`, `topic_similarity_matrix.json`

---

## 1. Classification and Evidence Boundary

T11–T16 are the **Distillation-Held-Out Topic Diagnostic**, not an independent generalization test.

- Synthetic query generation and relevance-supervised training may use T01–T10 only.
- T11–T16 are excluded from synthetic supervision, but their queries and qrels have already been exposed during development of FTS, vector retrieval, hybrid WRRF, reranking, intent routing, and topic expansion.
- Consequently, T11–T16 may diagnose topic-level transfer and regression, but cannot establish performance on unseen topics.
- The term **Independent Generalization Evaluation** is reserved for the separately authored, frozen 30-query external set described in `external_test_specification.md`.

Repository verification on 13 November 2026 found 42 G2 rows over 16 topics. T11–T16 account for **14**, not 16, query rows:

| Topic | Existing G2 rows | Query forms present |
| :---: | :---: | :--- |
| T11 | 3 | Raw Topic, Topic Description, Natural-language Intent |
| T12 | 3 | Raw Topic, Topic Description, Natural-language Intent |
| T13 | 2 | Raw Topic, Natural-language Intent |
| T14 | 2 | Raw Topic, Natural-language Intent |
| T15 | 2 | Raw Topic, Natural-language Intent |
| T16 | 2 | Raw Topic, Natural-language Intent |

The missing descriptions for T13–T16 are empty in `topics.csv`. They must not be reconstructed or invented merely to equalize counts. Any future completion is a new, versioned benchmark change requiring approval.

---

## 2. Topic Semantic Overlap: Taxonomy Versus Content

### 2.1. Ablation Matrix

| Experiment | Embedding input | Question answered | Status |
| :---: | :--- | :--- | :---: |
| **Exp A** | `Title` | How much overlap is caused by short labels and shared wording? | **Pending execution** |
| **Exp B** | `Description` | How much overlap appears in pastoral descriptions? | **Pending execution**; T01, T04, T13–T16 lack descriptions |
| **Exp C** | `Title + Description` | What content overlap remains when taxonomy text is removed? | **Pending execution** |
| **Exp D** | `Title + Description + Taxonomy` | What is the combined overlap including high-level taxonomy? | **Observed; preserved below** |

No result for Exp A, B, or C is inferred from Exp D. Missing descriptions and model/runtime hashes must be recorded when those experiments are eventually approved.

### 2.2. Exact Observed Exp D Results

The following values are preserved exactly from `topic_similarity_matrix.json`, produced by the existing audit script. They must not be presented as Exp A–C results.

| Held-out topic | Taxonomy | Highest T01–T10 match | Cosine | Second match | Cosine |
| :---: | :--- | :--- | :---: | :--- | :---: |
| **T11 – Holy Spirit as Witness** | Holy Spirit | **T10 – Holy Spirit as Teacher** | **0.9531** | **T09 – Holy Spirit as Helper** | **0.9459** |
| **T12 – Holy Spirit as Guide to all Truth** | Holy Spirit | **T09 – Holy Spirit as Helper** | **0.9366** | **T10 – Holy Spirit as Teacher** | **0.9250** |
| **T13 – Call of Discipleship** | Discipleship | **T03 – Pass it on** | **0.8929** | **T01 – THE SPIRIT’S POWER** | **0.8861** |
| **T14 – Cost of Discipleship** | Discipleship | **T01 – THE SPIRIT’S POWER** | **0.8745** | **T03 – Pass it on** | **0.8704** |
| **T15 – Command of Discipleship** | Discipleship | **T01 – THE SPIRIT’S POWER** | **0.8955** | **T03 – Pass it on** | **0.8882** |
| **T16 – Commission of Discipleship** | Discipleship | **T01 – THE SPIRIT’S POWER** | **0.8811** | **T03 – Pass it on** | **0.8765** |

Exp D includes literal taxonomy strings such as `Holy Spirit` and `Discipleship`; high scores therefore cannot be attributed solely to deeper theological equivalence.

### 2.3. Four Overlap Levels

1. **Shared foundational concepts:** broad Christian concepts such as grace, faith, obedience, guidance, and worship. These are allowed in training.
2. **Similar theological vocabulary:** shared words without proof of shared intent. These require semantic, not lexical-only, review.
3. **Similar topic intent:** closely related pastoral requests, such as teaching versus guiding into truth. These are a leakage risk for the diagnostic.
4. **Direct query-to-song supervision overlap:** a diagnostic or external query–song relationship appearing in training. This is the most serious form and is prohibited.

---

## 3. Leakage Controls for Synthetic Supervision

### 3.1. Allowed and Prohibited Content

| Level | Training rule | Example |
| :--- | :--- | :--- |
| Foundational vocabulary | **Allowed** | General references to faith, surrender, discipleship, or the Holy Spirit |
| T11–T16 specialized intent | **Prohibited as a generation target** | Witness about Christ; ultimate guide to all truth; call, cost, command, or commission of discipleship as defined by the held-out topics |
| Diagnostic query text or paraphrase | **Prohibited** | Exact, substring, close lexical, or high-semantic-similarity variants of the 14 existing diagnostic rows |
| Diagnostic qrels or query–song mapping | **Prohibited from Teacher/Judge payloads and training** | Using an existing T11–T16 positive song as supervision because it is positive in diagnostic qrels |

This prohibition does not require removing a song from the corpus merely because it is relevant to a held-out topic. It prohibits using the held-out relationship as supervision. Song-level isolation is a separate design choice documented in the evaluation protocol.

### 3.2. Deduplication and Review

Every generated query must be compared against all 90 development queries, the 14 T11–T16 diagnostic rows, and the frozen 30 external queries once they exist:

1. Unicode NFC, lowercase, punctuation and whitespace normalization.
2. Exact and bidirectional substring matching.
3. Word Jaccard and character-trigram Jaccard.
4. Normalized Levenshtein distance.
5. Cosine similarity from the frozen pretrained E5 audit model.

Preregistered design thresholds are: reject word Jaccard `> 0.35`, character-trigram Jaccard `> 0.45`, normalized Levenshtein distance `< 0.30`, or frozen-E5 cosine `> 0.80`; manually review cosine in `[0.75, 0.80]`. These thresholds are **design choices**, not validated performance guarantees. Each metric and decision must be stored per query.

Manual review distinguishes permitted foundational language from a prohibited specialized T11–T16 intent. Reviewer identity, timestamp, decision, and rationale are required.

---

## 4. Diagnostic Reporting Rules

- Report all 14 diagnostic query rows and macro results by each of the six topic IDs; do not merge them into an “unseen test” headline.
- Preserve unequal per-topic query counts and report both query-weighted and topic-macro summaries.
- Do not tune checkpoints, thresholds, losses, prompts, or stopping criteria on T11–T16.
- Any inspection of diagnostic results before model selection is complete must be logged as development exposure.
- A song-level result must be derived from a preregistered section aggregation rule; the primary rule is maximum eligible section score per song. Whole-song-vector retrieval is a separate ablation.

---

## 5. Current Status and Approval Gate

- Exp D: existing observed artifact verified and preserved.
- Exp A–C: pending; not run in this revision.
- Synthetic generation, Teacher/Judge labeling, pilot, and training: not run.
- T01–T10/T11–T16 split: proposed and documented, awaiting explicit approval before Milestone 2.
