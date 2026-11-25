# Research provenance sources

Only three historical scripts are retained here because the research audits rely on their behavior:

| Original path | Preserved path | Purpose |
|---|---|---|
| `scripts/generate_candidate_pool.ts` | `generate_candidate_pool.ts` | Hardcoded qrel mappings and exported `adjudicated` metadata; evidence that legacy qrels are not necessarily human gold |
| `scripts/audit_topic_leakage.ts` | `audit_topic_leakage.ts` | Source of the historical T11–T16 semantic-overlap audit |
| `scripts/evaluate.ts` | `evaluate.ts` | Historical retrieval metrics and treatment of unjudged pairs |

Source bytes are unchanged. Original imports, machine paths and API references describe the historical environment; these are provenance documents, not supported executable entry points. They are excluded from active application TypeScript/ESLint checks. Reusing a script requires a separate port and review. No model or database script was executed during cleanup.

Current offline validation: `npm run research:test`, `npm run research:validate`, and `npm run research:leakage:v2 -- --pilot-regression` from the repository root.

Superseded drafts, diagnostic scripts and legacy plans were deleted rather than archived, at the user's request. Original/current paths and source SHA-256 values are in `docs/repository_cleanup.json`.
