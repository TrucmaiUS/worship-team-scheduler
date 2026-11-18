# E5 relevance-supervision research controls

This module implements the offline safety layer plus a separately gated Groq Judge adapter for the E5 relevance-supervision research pipeline.

- `leakage.ts`: exact, substring, word-Jaccard, character-trigram, normalized-Levenshtein, frozen-E5 score gates, and held-out-intent decisions.
- `evidence.ts`: verbatim evidence verification for the 0–3 rubric.
- `consensus.ts`: Δ0/Δ1/Δ≥2 policy with grade-1 protection.
- `relevance-graph.ts`: known-positive/verified-negative graph and contrastive-batch false-negative audit.
- `split-integrity.ts`: T01–T10 source enforcement, T11–T16 rejection, anchor and protected-query checks.
- `research-config.ts`: concrete model pinning and fail-closed provider identity checks.
- `schemas.ts` and `types.ts`: strict Zod and TypeScript contracts for generated queries, judgments, and contrastive examples.

The default validation path performs no provider call or database write. Run:

```text
npm run research:test
npm run research:validate
```

The validation command reads only the checked-in benchmark CSV files and uses synthetic self-check records.

`groq-judge.ts` is the fail-closed OpenAI-compatible adapter for the two
exact Groq candidate models. `judge-selection.ts` validates the frozen 50-pair
human-reference experiment and computes exact agreement, MAE, quadratic
weighted kappa, macro-F1, confusion matrix and per-grade metrics. Run
`npm run research:human-reference:validate` before any model call. Run
`npm run research:judge:smoke` for model inventory plus dry-run only. The
explicit `:live` variant sends the same synthetic demonstration pair once to
each candidate; it does not run development selection, the pilot, generation,
training, or external evaluation.

After a complete candidate run, a human auditor fills every grade 2–3 row in
`evidence_context_audit.csv` with `true` or `false`; unsupported evidence also
requires a note. The evaluator verifies that pair IDs, source text, scores and
evidence quotes are unchanged before applying the audit. Finalize a sealed run
with:

```text
npm run research:judge:finalize -- --run <judge-selection-run-directory>
```

Finalization writes audited evaluation copies, the final comparison, evidence
validation report, selection report and frozen Judge configuration. It refuses
to overwrite finalized artifacts and does not access the held-out test set.
