# Milestone 2 – Offline Implementation Record

**Date:** 13 November 2026
**Status:** Offline control layer implemented; network and training stages remain gated

## Implemented

- Query normalization and lexical/edit-distance similarity metrics.
- Leakage policy for exact, substring, word-Jaccard, character-trigram, normalized Levenshtein, frozen-E5 cosine, and held-out intent.
- Fail-incomplete behavior when the required semantic leakage check is missing.
- Evidence quote verification for the 0–3 relevance rubric.
- Deterministic Teacher/Judge consensus: Δ0 high, Δ1 separate, Δ≥2 excluded.
- Grade-1 protection from automatic strong-negative use.
- T01–T10 source enforcement and T11–T16/anchor/protected-query rejection.
- Known-relevance graph and contrastive batch false-negative audit.
- Exact model/provider identity pinning with `allowFallback=false`.
- Offline unit tests and repository benchmark-count validation.

## Commands

```text
npm run research:test
npm run research:validate
```

`research:validate` reads only `benchmark/data/queries.csv` and `topics.csv` and uses synthetic self-check records. It does not load API keys, call a provider, or write the database.

## Verification Results

- `npm run research:test`: 16/16 tests passed.
- `npm run research:validate`: PASS; 90 queries, G1/G2/G3/G4 = 12/42/24/12, 16 topics, and 14 T11–T16 diagnostic rows.
- Targeted strict TypeScript check for the new module and validator: passed.
- Targeted ESLint check: passed.
- Network/database-call scan of the new TypeScript files: no call sites found.

The repository-wide TypeScript check still reports five unrelated existing errors in `lib/search/reranker.ts`, `scripts/phase1_error_analysis.ts`, and `scripts/test_reranker_direct.ts`. They were not changed as part of this isolated research scaffold.

## Not Implemented or Authorized

- Gemini/OpenAI clients or API calls.
- Model availability preflight.
- Real synthetic query generation or labeling.
- Candidate retrieval/pooling for the pilot.
- Training, checkpoint selection, ONNX export, vector indexing, or production routing.
- External query/qrel authoring.

These stages require the explicit gates in `methodology.md`.
