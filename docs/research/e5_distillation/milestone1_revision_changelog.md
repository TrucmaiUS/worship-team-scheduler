# Milestone 1 – Revision Changelog and Verification Record
## Seven-Document Coherence Pass (Revision 3.0)

**Project:** LLM-Guided Relevance-Supervised Domain Adaptation for Local E5-small
**Date:** 13 November 2026
**Scope:** Seven Markdown specifications under `docs/research/e5_distillation`
**Boundary:** Documentation and read-only verification only

---

## 1. Document Changes

| File | Revision 3.0 changes | Status |
| :--- | :--- | :---: |
| `topic_leakage_audit.md` | Reclassified T11–T16 as a diagnostic; corrected its observed G2 row count to 14; preserved exact Exp D values; kept Exp A–C pending; defined leakage levels and thresholds without presenting them as validated | Revised |
| `evaluation_protocol.md` | Defined Gemini Teacher, blind GPT Judge, and local E5 Student roles; distinguished relevance-supervised fine-tuning from vector distillation; aligned 90/14/30 evaluation strata; added Δ policy, evidence gates, multi-positive controls, aggregation, preregistration, and fail-closed execution | Revised |
| `external_test_specification.md` | Defined the 30-query independent claim boundary, author isolation, full-corpus or pooled qrels, two blind reviewers plus adjudication, section evidence/song qrels, preregistration, and one-time official evaluation | Revised |
| `teacher_prompt.md` | Split Gemini work into query generation and blind relevance labeling; removed the unavailable historical model pin; added held-out controls, strict schemas, evidence verification, provenance, bounded retries, and no fallback | Revised |
| `dataset_schema.md` | Added append-only generated-query, judgment, consensus, known-relevance, contrastive, and ordinal-ranking contracts; made Δ0/Δ1/Δ≥2 deterministic; separated unjudged from grade 0; added multi-positive/false-negative and song/section semantics | Revised |
| `codebase_audit.md` | Reconciled live 314/378/692 counts; documented actual routing, max-section aggregation, incomplete Gemini song vectors, current fallback paths, quantization reproducibility limits, evaluator and HNSW caveats, and unverified latency claims | Revised |
| `milestone1_revision_changelog.md` | Expanded scope from five to seven files and replaced completion claims with verified evidence, blockers, and approval gates | Revised |

---

## 2. Verified Evidence

### 2.1. Repository Data

- `queries.csv`: 90 rows — G1=12, G2=42, G3=24, G4=12.
- `topics.csv`: 16 topic rows.
- T11–T16: 14 G2 rows — 3, 3, 2, 2, 2, 2 by topic.
- `songs.csv`: 67 songs and 311 embedded lyric sections.
- `qrels.csv`: 1,495 rows in the current development artifact.
- `topic_similarity_matrix.json`: exact Exp D results preserved; no Exp A–C artifacts found.

### 2.2. Read-Only Database Snapshot

- Approved songs: 67.
- Sections: 311.
- `gemini-embedding-001`: 311 section + 3 song = **314** vectors.
- `semantic-projector-768`: 311 section + 67 song = **378** vectors.
- Generic `song_embeddings`: 314 + 378 = **692** vectors.
- `multilingual-e5-small` in `song_embeddings_e5`: 311 section + 67 song = **378** vectors.
- Distinct content-hash count equaled row count in each model/target group queried.

This resolves the earlier ambiguity: the two values “378” refer to different models/tables, while “314” is the incomplete Gemini total, not an E5 count.

### 2.3. Code

- E5 prefixes, 384 dimensions, mean pooling, normalization, and provider interface were verified.
- Installed Transformers.js 2.17.2 defaults to quantized model loading, but the app does not explicitly pin quantization, model revision, or artifact hash.
- Section retrieval currently uses maximum-scoring section per song.
- Fine-tuned 384-dimensional model routing/table support is not implemented by the current exact-name router.
- Production reranker still has deterministic fallback paths and model-list fallback; research must use a separate fail-closed path.
- Historical logs record 90/90 fallback in the cited reranker run.

---

## 3. Methodological Decisions Now Consistent Across the Seven Files

1. **Teacher/Judge/Student:** Gemini is the primary query generator and relevance labeler; GPT judges independently and blindly; E5-small is the local Student.
2. **Training claim:** relevance-supervised bi-encoder adaptation, not embedding-vector distillation.
3. **Evaluation strata:** 90-query development/regression benchmark; T11–T16 diagnostic subset with 14 current rows; 30-query independent external set.
4. **Disagreement:** Δ0 high confidence; Δ1 stored separately as medium confidence; Δ≥2 excluded from automatic training.
5. **Evidence:** grades 2–3 require verified verbatim section evidence from each model.
6. **Contrastive safety:** multi-positive lookup and false-negative masking are mandatory; unjudged and grade 1 are not strong negatives.
7. **Retrieval unit:** section-level evidence, song-level qrels/reporting, primary max-section aggregation; whole-song retrieval is a separate ablation.
8. **External qrels:** full 2,010-pair review preferred; otherwise a preregistered multi-system pool, two independent blind reviewers, and adjudication.
9. **Reproducibility:** manifests, hashes, exact model IDs, prompt/config versions, code/lockfile, corpus snapshot, seeds, and stop rules must be preregistered.
10. **No silent fallback:** research runs fail closed and never substitute another model, heuristic, cached label, or placeholder.

---

## 4. Unresolved Blockers

1. Exact available Gemini Teacher model ID and exact GPT Judge model ID are not verified or frozen.
2. The T01–T10/T11–T16 split and six-anchor-song exclusion need explicit approval.
3. Exp A–C have not run; missing descriptions for T01, T04, T13–T16 require an explicit missing-data policy.
4. External query author, two reviewers, adjudicator, query-balance plan, and full-versus-pooled judgment budget are unassigned.
5. Training framework/version, relevance-aware loss or mask implementation, batch sampler, ordinal-margin ablation, and stopping criteria are not frozen.
6. Fine-tuned E5 table/routing and model-version isolation are not implemented.
7. Existing evaluator behavior conflates missing qrels with 0; external evaluation needs complete judgments or an unjudged-aware evaluator.
8. Prior latency percentiles lack a raw reproducible artifact and must not be claimed as verified.
9. Gemini whole-song embeddings cover only 3 of 67 songs; song-target Gemini evaluation is currently incomplete.
10. The HNSW ablation query did not filter `model_name`; model-specific attribution requires a corrected, separately approved rerun.
11. `judge_prompt.md` and `methodology.md` were not among the requested seven files and still contain older model-choice/blindness/distillation language; they must be revised or explicitly superseded before execution/publication.

---

## 5. Approval Gates

Explicit approval is required before each of the following:

- provider/model availability preflight;
- external authoring and reviewer work;
- any schema/code/database change;
- 50-query pilot;
- Gemini or GPT API calls;
- synthetic query generation or relevance labeling;
- training, checkpoint selection, ONNX export, vector indexing, or production integration;
- Exp A–C or any benchmark rerun.

---

## 6. Execution Integrity for This Revision

- Teacher API calls: **0**.
- Judge API calls: **0**.
- Synthetic queries generated: **0**.
- Pilot queries run: **0**.
- Training epochs: **0**.
- Benchmark/topic ablations rerun: **0**.
- Production code changes: **0**.
- Database writes/schema changes: **0**.
- Database access: read-only aggregate verification only.

Milestone 1 remains a reviewed design package, not an implementation or experimental result.
