# Offline Milestone 2 research controls

This module implements the non-network safety layer for the E5 relevance-supervision research pipeline.

- `leakage.ts`: exact, substring, word-Jaccard, character-trigram, normalized-Levenshtein, frozen-E5 score gates, and held-out-intent decisions.
- `evidence.ts`: verbatim evidence verification for the 0–3 rubric.
- `consensus.ts`: Δ0/Δ1/Δ≥2 policy with grade-1 protection.
- `relevance-graph.ts`: known-positive/verified-negative graph and contrastive-batch false-negative audit.
- `split-integrity.ts`: T01–T10 source enforcement, T11–T16 rejection, anchor and protected-query checks.
- `research-config.ts`: concrete model pinning and fail-closed provider identity checks.
- `schemas.ts` and `types.ts`: strict Zod and TypeScript contracts for generated queries, judgments, and contrastive examples.

The module contains no API client and performs no database writes. Run:

```text
npm run research:test
npm run research:validate
```

The validation command reads only the checked-in benchmark CSV files and uses synthetic self-check records.
