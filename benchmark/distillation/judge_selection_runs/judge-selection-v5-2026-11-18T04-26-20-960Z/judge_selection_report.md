# Judge Selection Report

**Run:** `judge-selection-v5-2026-11-18T04-26-20-960Z`

**Development set:** 50 frozen Human Reference v2 pairs

**Held-out test used:** No

**Selected Judge:** `qwen/qwen3.8-27b`

## Decision

Qwen is selected because it is the only candidate that passes every preregistered hard gate. GPT-OSS fails contextual evidence support (20/22, 90.91%) and critical disagreement (3/50, 6.00%). Qwen achieves 20/20 contextual evidence support and 2/50 critical disagreements.

| Metric | GPT-OSS 120B | Qwen 3.8 27B |
| --- | ---: | ---: |
| Exact agreement | 62.00% | 66.00% |
| MAE | 0.4400 | 0.3800 |
| Quadratic weighted kappa | 0.7956 | 0.8188 |
| Macro-F1 | 0.6145 | 0.6666 |
| Schema pass | 100.00% | 100.00% |
| Verbatim evidence | 100.00% | 100.00% |
| Contextual evidence support | 90.91% | 100.00% |
| Critical disagreement | 6.00% | 4.00% |
| Total tokens | 42579 | 55055 |
| Mean latency | 1276.76 ms | 1956.50 ms |

## Frozen configuration

The exact model ID, observed provider metadata, prompt hash, schema hash, decoding settings, reference hash, audit hash, selection criteria and execution/evaluation commits are recorded in `frozen_judge_config.json`. Groq did not expose an immutable model revision digest, so the exact API model ID is frozen with observed inventory metadata and alias drift must be checked before reuse.

## Checkpoint

This report completes Judge Selection on the 50-pair Development Set. The 240-pair held-out test set was not accessed or executed.
