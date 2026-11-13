# Phase 0 – Repository Stabilization Inventory

**Date:** 13 November 2026
**Base commit:** `746e13d` (`feat/rag-ai-search`)
**Working branch:** `codex/e5-distillation-m2`
**Status:** Stabilization checks complete; scoped checkpoint prepared

## 1. Working-Tree Classification

### A. Research protocol and offline controls

- `docs/research/e5_distillation/`
- `lib/research/e5-distillation/`
- `scripts/validate_distillation_protocol.ts`
- Research script entries in `package.json`

These are the intended Milestone 1/2 research artifacts.

### B. Benchmark data, results, and analysis

- `benchmark/`
- benchmark/report documents under `docs/`
- benchmark construction/evaluation/audit scripts under `scripts/`

These artifacts predate Phase 0 or span a broader benchmark scope. They require a separate staging review; Phase 0 must not automatically commit the entire directory.

### C. Production/search changes

- `lib/search/embedding-service.ts`
- `lib/search/hybrid-search.ts`
- `lib/search/reranker.ts`
- `lib/search/semantic-search.ts`
- `lib/search/types.ts`
- `lib/search/topic-interpreter.ts`

These are not automatically included in a research checkpoint. Phase 0 may apply minimal type-only fixes but must not silently change retrieval behavior.

### D. Dependency metadata

- `package.json`
- `package-lock.json`

These contain changes beyond the two new research commands, including existing benchmark/dependency work. Stage them only after reviewing the complete diff.

### E. Local/private/heavy artifacts

- `.env.local`
- `.next/`
- `node_modules/`
- TypeScript build info
- future provider raw responses, private external queries, model caches, checkpoints, and training runs

These must remain ignored and unstaged.

## 2. Phase 0 Checkpoint Policy

The first checkpoint will include only files whose ownership and purpose are unambiguous. Mixed files or broad pre-existing benchmark/production changes remain unstaged until their full diff is reviewed. No `git add -A` or blanket directory commit is allowed.

### Scoped checkpoint file set

- `.gitignore`
- `docs/research/e5_distillation/`
- `lib/research/e5-distillation/`
- `scripts/validate_distillation_protocol.ts`
- only the two research command entries from `package.json`
- Phase 0 lint-only fixes in four previously clean UI files

The checkpoint intentionally excludes the broad `benchmark/` tree, mixed production-search diffs, dependency changes, and pre-existing analysis scripts. Minimal working-tree type fixes inside mixed/untracked files remain unstaged for later ownership review.

## 3. Verification Checklist

- [x] Dedicated `codex/e5-distillation-m2` branch created.
- [x] `.gitignore` research/security rules added and verified.
- [x] Five current TypeScript errors resolved with minimal changes.
- [x] Repository-wide TypeScript check passes.
- [x] Full repository ESLint passes.
- [x] Research unit tests pass (16/16).
- [x] Offline repository-data validator passes.
- [x] Secret/network/database-call scan passes.
- [x] `git diff --check` passes (line-ending warnings only).
- [x] Exact checkpoint file list reviewed.
- [x] Scoped checkpoint commit prepared as the final Phase 0 action.
