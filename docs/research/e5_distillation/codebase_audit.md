# Codebase Audit: Semantic Retrieval & Embedding Infrastructure
## Milestone 1 Evidence with Milestone 2 Offline Addendum (Revision 3.1)

**Project:** Worship Team Management System
**Date:** 13 November 2026
**Scope:** Static inspection, read-only aggregate database evidence, and the subsequent offline research-control scaffold
**Change boundary:** Production retrieval, database schema/rows, vectors, API providers, and models were not modified

---

## 1. Evidence Sources and Confidence

| Evidence | What was verified | Confidence |
| :--- | :--- | :---: |
| `benchmark/data/*.csv` | 90 queries, group distribution, 16 topics, 67 songs, 311 embedded section records | High |
| Read-only PostgreSQL aggregates | Approved songs, section count, table/model/target/dimension counts and distinct hashes | High for 13 Nov 2026 snapshot |
| `lib/search/*.ts`, indexing/setup scripts, migrations | Provider behavior, prefixes, routing, aggregation, fallback behavior, table definitions | High for current working tree |
| `topic_similarity_matrix.json` and audit script | Exact Exp D values and construction | High for stored artifact; run environment hash absent |
| Historical reports/logs | Prior benchmark behavior, including reranker fallback | Medium to high; reflects recorded runs, not current availability |
| Latency statements in prior Milestone 1 docs | No raw benchmark artifact found for 1.8s/8.7ms/16.3ms/60.3ms claims | Unverified |

The Git worktree already contained many modified/untracked research and search files. This revision does not assume they are committed or production-deployed.

---

## 2. Verified Corpus and Vector Counts

Read-only queries returned:

| Table/model | Target | Dimension | Rows | Distinct content hashes |
| :--- | :---: | :---: | ---: | ---: |
| `songs` (`approval_status='approved'`) | song | N/A | **67** | N/A |
| `song_sections` | section | N/A | **311** | N/A |
| `song_embeddings` / `gemini-embedding-001` | section | 768 | **311** | **311** |
| `song_embeddings` / `gemini-embedding-001` | song | 768 | **3** | **3** |
| `song_embeddings` / `semantic-projector-768` | section | 768 | **311** | **311** |
| `song_embeddings` / `semantic-projector-768` | song | 768 | **67** | **67** |
| `song_embeddings_e5` / `multilingual-e5-small` | section | 384 | **311** | **311** |
| `song_embeddings_e5` / `multilingual-e5-small` | song | 384 | **67** | **67** |

### 2.1. Reconciliation of 314, 378, 692, and 311+67

- **314** is the current `gemini-embedding-001` total in `song_embeddings`: 311 section vectors + only 3 song vectors. It is not the corpus section count and not an E5 count.
- **378** appears in two different model/table contexts:
  - `semantic-projector-768` in `song_embeddings`: 311 sections + 67 songs;
  - `multilingual-e5-small` in `song_embeddings_e5`: 311 sections + 67 songs.
- **692** is the total row count in the generic 768-dimensional `song_embeddings` table: 314 Gemini + 378 deterministic projector.
- The earlier report statement “311 Gemini + 378 deterministic = 692” was arithmetically incomplete because it omitted the three Gemini song rows. The database now explains the discrepancy exactly.

No duplicate content hashes were observed within any listed model/target group. The three Gemini song vectors create incomplete song-level coverage (3/67); Gemini song-target evaluation must therefore be blocked or explicitly limited until coverage is intentionally completed under approval.

---

## 3. Embedding Provider Audit

### 3.1. Interface

`lib/search/types.ts` defines separate `embedQuery` and `embedPassage` methods plus compatibility aliases. This supports E5’s asymmetric input convention.

### 3.2. Local E5 Provider

`LocalE5EmbeddingProvider` currently:

- loads `Xenova/multilingual-e5-small` through `@xenova/transformers`;
- declares 384 dimensions;
- prepends `query: ` and `passage: `;
- uses mean pooling and normalization;
- loads a singleton pipeline promise per process.

Installed `@xenova/transformers` is version 2.17.2, whose pipeline default is `quantized=true`. However, the application call does not explicitly pin `quantized`, model revision, cache artifact hash, or ONNX filename. Therefore “quantized ONNX under the installed runtime default” is supported, while a fully reproducible **specific INT8 artifact** is not yet pinned. The research preregistration must set and record these values explicitly.

### 3.3. Gemini Embedding Provider

The provider uses `gemini-embedding-001`, requests 768 output dimensions, and supplies `RETRIEVAL_QUERY`/`RETRIEVAL_DOCUMENT`. Availability, quota, latency, and price are time-dependent and were not tested in this revision. Prior claims of a fixed 1,000-request daily quota or 380–422 ms latency are not treated as current verified facts.

### 3.4. Deterministic Projector

`DeterministicSemanticProvider` remains present and selectable. It is annotated deprecated for production semantic retrieval/test fixtures, but current code still allows explicit selection. It must not be represented as E5 or Gemini and must never substitute for a failed research Teacher, Judge, or embedding baseline.

---

## 4. Retrieval Routing and Aggregation

`semantic-search.ts` routes only the exact model name `multilingual-e5-small` to `song_embeddings_e5`; every other model name routes to the generic 768-dimensional `song_embeddings` table. This is sufficient for the current pretrained E5 but **not sufficient for a future fine-tuned 384-dimensional model ID**. Without an approved routing/schema change, a fine-tuned Student would target the wrong table/vector dimension.

For section retrieval, the query selects the highest-scoring section per song via `DISTINCT ON (song_id)` ordered by similarity. This verifies that the current primary aggregation is max-section-to-song. Whole-song retrieval is separately supported through `target_type='song'`.

Research specifications therefore use:

- section-level encoding/judgment and evidence;
- maximum section score as the primary song score;
- a distinct experiment ID for whole-song vectors;
- an isolated future table/model route for fine-tuned 384-dimensional vectors.

---

## 5. Silent Fallback Audit

The current repository does **not** support a blanket claim that silent fallback has been removed.

- `getActiveEmbeddingProvider()` defaults to local E5 when no Gemini key/provider is available.
- `rerankCandidates()` defaults to `provider='auto'` and uses the deterministic reranker when no key exists or Gemini fails.
- Even `provider='gemini'` currently catches an error and returns deterministic fallback results.
- `callGeminiReranker()` iterates over multiple Gemini model IDs.
- Historical execution logs record 90/90 reranker queries using deterministic fallback after a Gemini model 404.

These behaviors may be operational choices for the application, but they are incompatible with controlled research attribution. The Milestone 1 protocol requires a separate fail-closed execution path with one explicit model ID and logged failure. Production code was not changed in this revision.

---

## 6. Benchmark and Topic Evidence

Verified `queries.csv` counts are G1=12, G2=42, G3=24, G4=12, total 90. Within G2, T11–T16 contain 14 rows, not 16. `topics.csv` has 16 rows; descriptions are blank for T01, T04, and T13–T16.

The stored Exp D topic-overlap results match `topic_similarity_matrix.json`, including T11→T10=0.9531 and all other values preserved in `topic_leakage_audit.md`. The audit script constructs `title + description + taxonomy`. Exp A–C have no result artifacts and remain pending.

`scripts/evaluate.ts` maps missing qrels lookups to numeric 0 during metric calculation. This may be acceptable only when the candidate pool is fully judged under that evaluator’s convention. It conflicts with the new external-set rule that unjudged is distinct from grade 0; the official external evaluator must preserve that distinction or use complete judgments.

The HNSW ablation SQL does not filter `model_name` while querying the shared 768-dimensional table. Because that table contains Gemini and deterministic rows, its 692-row storage statement is valid, but attribution of retrieval results to one model requires separate scrutiny. No benchmark was rerun here.

---

## 7. Unverified or Pending Claims

- No raw artifact was found supporting the prior p50/p95 E5 latency claims; `scripts/test_e5_local.ts` is a single-run diagnostic, not a percentile benchmark.
- Exact Gemini Primary Teacher model ID is pending; historical `gemini-2.5-flash-lite` 404 evidence makes the old pin unsuitable without re-verification.
- Exact independent GPT Judge model ID is pending and must be pinned before any call.
- `judge_prompt.md` remains outside this seven-file revision and is not yet aligned: it lists alternative GPT models and its example exposes a song title. It must be revised or superseded before an actually blind Judge run.
- `methodology.md` remains outside this revision and still uses broad “knowledge distillation”/Teacher-probability language. It must defer to the Revision 3.0 relevance-supervision definition or be updated before publication.
- Milestone 2 now implements offline schemas, leakage/evidence checks, consensus, split integrity, a known-relevance graph, and contrastive batch auditing under `lib/research/e5-distillation/`. It does not implement provider API clients, real generation/judgment runs, candidate pooling, a training loop, custom loss, ONNX export, or a fine-tuned-vector table.
- External author/reviewers, 30 queries, and qrels do not yet exist.
- Exp A–C remain pending.
- The proposed six-anchor-song split and T01–T10/T11–T16 split require explicit approval before implementation.

---

## 8. Milestone Boundary

The original Milestone 1 audit made read-only inspections and documentation changes. The subsequent Milestone 2 addendum introduced an isolated offline control module, tests, and a read-only CSV self-check. Across both stages, no Gemini/OpenAI call, real data generation, pilot, training, database write/schema change, benchmark rerun, model export, or production retrieval integration occurred.
