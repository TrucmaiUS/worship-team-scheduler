# Teacher–Judge Pilot Report

- **Run:** `teacher-judge-pilot-v1-2026-11-19T10-54-35-956Z`
- **Teacher:** `gemini-3.1-flash-lite`
- **Frozen Judge:** `qwen/qwen3.8-27b`
- **Pairs:** 50

## Checkpoint result

- Positive candidates (Grade ≥ 2 after mechanical generation filters): 43/50 (86.0%).
- Grade 1 uncertain/review: 4.
- Rejected candidates or validation failures: 1.
- Invalid Judge outputs excluded without inferred grades: 2.
- Frozen Judge score distribution: {"1":4,"2":8,"3":36,"schema_failure":2}.
- No rejected pair was promoted to a hard negative. No training was started.

## Diversity and coverage

- Languages: {"vi":30,"en":20}.
- Coverage categories: {"semantic_paraphrase":10,"sermon_topic":10,"cross_lingual":20,"theological_concept":10}.
- Topics: 10/10; source songs: 44; source sections: 50.
- Exact/near generated duplicates: 0; mean pairwise word Jaccard: 0.0929.

## Validation and risk

- Mechanical generation pass: 49/50.
- Judge schema pass: 48/50; invalid outputs: 2.
- Protected-query leakage rejected: 1; held-out vocabulary requiring human review: 9.
- Copied lyric spans (4+ normalized words): 0; title/artist leakage: 0.
- Evidence verbatim valid where supplied: 48.
- Automated false-acceptance flags: 0; all 43 positive candidates still carry unmeasured contextual/theological false-acceptance risk until human audit.
- False-rejection screening flags: 4; the one validation reject also requires human review because the substring leakage rule is conservative.
- Contextual evidence support and theological consistency remain pending human audit for the checkpoint workbook. Positive candidates are not training-ready until those fields are reviewed.

## Leakage and provenance

- All six anchor songs and all 42 Human Reference source sections were excluded.
- The Teacher received no development, Human Reference, diagnostic T11–T16, or held-out query text.
- The local leakage audit compared generated queries against 90 benchmark queries plus 50 Human Reference queries.
- No frozen external held-out query artifact was present; no replacement data was invented.

## Limitations

This pilot contains 50 source-linked pairs, not an independently sampled gold test set. Judge score is a filtering signal, not human ground truth. Risk counts are screening indicators. They do not estimate population-level error rates. Human review is required before expansion or fine-tuning.
