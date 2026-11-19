# Gemini 3.1 Flash-Lite Supplemental Judge Report

This is a supplemental development-set experiment. It does not change the frozen Qwen Judge and does not use the held-out test set.

| Metric | GPT-OSS 120B | Qwen 3.8 27B | Gemini 3.1 Flash-Lite |
| --- | ---: | ---: | ---: |
| Exact agreement | 62.00% | 66.00% | 74.00% |
| MAE | 0.4400 | 0.3800 | 0.2800 |
| QWK | 0.7956 | 0.8188 | 0.8953 |
| Macro-F1 | 0.6145 | 0.6666 | 0.7004 |
| Positive precision (grade >= 2) | 90.91% | 100.00% | 91.67% |
| Positive recall (grade >= 2) | 83.33% | 83.33% | 91.67% |
| Evidence verbatim validity | 100.00% | 100.00% | 100.00% |
| Evidence contextual support | 90.91% | 100.00% | pending human audit |
| Critical disagreement | 6.00% | 4.00% | 2.00% |
| Schema pass | 100.00% | 100.00% | 100.00% |
| Total tokens | 42579 | 55055 | 41279 |
| Mean latency | 1276.76 ms | 1956.50 ms | 4592.36 ms |

## Confusion matrix

Rows are Human grades 0–3; columns are Gemini grades 0–3 plus schema failure.

- Human 0: 14, 3, 0, 0, 0
- Human 1: 2, 5, 2, 0, 0
- Human 2: 0, 1, 5, 2, 0
- Human 3: 0, 1, 2, 13, 0

## Direct comparison with Qwen

Observed exact-agreement delta (Gemini - Qwen): 0.0800. The query-cluster bootstrap 95% interval is [-0.0800, 0.2456]. McNemar exact p=0.4545 (10 Gemini-only correct vs 6 Qwen-only correct).

## Evidence and decision boundary

Verbatim evidence is code-validated. Contextual evidence support is not inferred by the model and remains pending an independent human audit. This experiment cannot change the frozen Qwen Judge configuration.

## Statistical limitations

- Only 50 development pairs and 15 sourceQueryId clusters are available; confidence intervals are wide.
- The grade distribution is fixed at 17/9/8/16, so per-grade estimates have small denominators.
- At 50 pairs, one error changes a rate by two percentage points and the 5% critical-disagreement gate effectively permits at most two errors.
- This is one seeded API run; provider nondeterminism and future model alias drift are not measured.
- Gemini contextual evidence support requires a separate human audit before all hard gates can be evaluated.
- Sampling and low-reasoning controls are matched by value where supported, but provider semantics and token accounting are not identical.
