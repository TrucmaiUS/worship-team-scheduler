# Repository cleanup — 25 November 2026

Scope: commit the existing workspace, organize superseded research files, remove verified duplicates and regenerable caches. No new Teacher/Judge execution, generation, training, database write or Judge Selection.

## Retained and organized

- Preserve qrels, query-source metadata, annotation workbooks, original model outputs, execution logs and benchmark results.
- Retain only three historical scripts under `scripts/provenance/`: qrel generation, the topic audit, and the historical metric evaluator. Their behavior is cited by the research audits; original bytes are preserved. Their old APIs/imports are not supported entry points, so this directory is excluded from application TypeScript/ESLint checks.
- Delete 24 superseded benchmark/diagnostic scripts, three old specifications, seven obsolete phase-2 draft/config/prompt files, and the unused legacy topic-interpreter helper. No bulk archive is retained. The user explicitly requested removal of low-importance obsolete files instead of archiving them.
- Rename `phase1.test.ts` to `artifacts-review.test.ts`, and `phase2.test.ts` to `candidate-contracts.test.ts`; preserve test contents.
- Preserve Leakage Validator v2 implementation, tests and its complete 50-record regression artifacts. Timestamped frozen run identifiers remain unchanged because manifests and provenance depend on them.

The exact five retained source/destination paths, deleted paths and original SHA-256 values are in [repository_cleanup.json](repository_cleanup.json). Source bytes must match after each retained move.

## Deleted duplicates

| Removed file | Verified retained evidence |
|---|---|
| `songs_database.zip` | All 69 extracted files are byte-identical and already tracked under `songs_database/` |
| `benchmark/reports/benchmark_summary.json` | Byte-identical `benchmark/results/reports/benchmark_summary.json` |
| `benchmark/experiments/e4_gemini_strict/run-2026-11-14T06-49-53-948Z/checkpoint.json` | Its 90 results exactly equal `run.json` → `runs`; its 95 attempt logs exactly equal `execution_log.jsonl`; model and counts also match |

These three files total 1,025,874 bytes. Original pilot snapshots, final Human Audit workbooks and annotation sources are retained.

## Reproducibility and build checks

Git previously stored LF while the Windows checkout restored CRLF in several hash-pinned inputs. Explicit `.gitattributes` now preserves the intended checkout bytes for frozen inputs and v2 source hashes on every platform. This changes checkout policy, not the human labels, Qwen configuration or pilot content. Final `outputs/` files retain their exact exported bytes.

The unused local-E5 adapter loads its optional Transformers.js runtime dynamically, after its existing pinned-version/cache checks. Website typechecking does not require installing that research-only runtime. No E5 model was loaded.

Verification results and input integrity are recorded in [repository_cleanup.json](repository_cleanup.json). The original v2 regression remains a historical result with its original command, dirty-tree provenance and code hashes; no original artifact was rewritten during organization.

The new work is committed on `feat/pipeline-hardening`; existing remote branches are retained. `.env.local`, dependencies, uploads, local research logs and active Excel lock files stay outside Git. Regenerable build cache can be removed after verification.
