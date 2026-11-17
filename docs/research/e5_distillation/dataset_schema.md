# Relevance-Supervision Dataset Schemas, Provenance & Loss Alignment
## Milestone 1 – Data Contract (Revision 3.0)

**Project:** LLM-Guided Relevance-Supervised Domain Adaptation for Local E5-small
**Date:** 13 November 2026
**Status:** Specification only; no synthetic dataset or training examples have been produced

---

## 1. Terminology and Immutable Principles

- A **generated query** is a Teacher-created candidate that has not yet passed leakage checks.
- A **judgment** is one model’s raw 0–3 assessment of a query–section candidate.
- A **consensus record** preserves both judgments and applies the deterministic disagreement policy.
- A **training example** is created only after schema, evidence, leakage, split, and false-negative checks pass.
- An **unjudged** candidate is not grade 0.
- Ordinal relevance supervision is not an embedding vector target.

Raw artifacts are append-only. Corrections create a new version linked to the superseded record; they do not overwrite Teacher/Judge outputs.

---

## 2. Generated Query Record

Illustrative values below are examples, not observed data.

```json
{
  "schema_version": "generated-query-v3.0",
  "query_id": "syn_<uuid>",
  "query_text": "<generated text>",
  "language": "vi",
  "query_type": "thematic",
  "source_topic_ids": ["T08"],
  "source_song_ids": ["<uuid>"],
  "source_section_ids": ["<uuid>"],
  "anchor_song_excluded": true,
  "generation": {
    "provider": "google",
    "model_id": "<pinned-gemini-model>",
    "provider_model_revision": "<returned-or-null>",
    "prompt_version": "gemini-query-generation-v3.0",
    "prompt_sha256": "<sha256>",
    "request_sha256": "<sha256>",
    "raw_response_sha256": "<sha256>",
    "parameters": {},
    "attempt": 1,
    "generated_at_utc": "<RFC3339>"
  },
  "leakage": {
    "reference_manifest_sha256": "<sha256>",
    "exact_match_found": false,
    "substring_match_found": false,
    "max_word_jaccard": 0.0,
    "max_char_trigram_jaccard": 0.0,
    "min_normalized_levenshtein_distance": 1.0,
    "max_frozen_e5_cosine": 0.0,
    "closest_reference_id": null,
    "held_out_intent_flag": false,
    "decision": "pending|passed|rejected|human_review",
    "human_review": null
  },
  "split": "train_candidate",
  "corpus_manifest_sha256": "<sha256>",
  "record_sha256": "<sha256>"
}
```

Only T01–T10 may appear in `source_topic_ids`. Development, diagnostic, and external query IDs are forbidden as sources.

---

## 3. Independent Judgment Record

Teacher and Judge use the same record shape but are stored separately. The independent Judge record must have no parent field referencing the Teacher result until after both raw files are sealed. New Judge records use role `independent_judge`, provider `groq`, and a separately stored exact model ID; the legacy `gpt_independent_judge`/`openai` example is retained only for old offline fixtures.

```json
{
  "schema_version": "relevance-judgment-v3.0",
  "judgment_id": "jud_<uuid>",
  "query_id": "syn_<uuid>",
  "candidate_alias": "CANDIDATE_07",
  "candidate_song_id": "<resolved-after-blind-run>",
  "candidate_section_id": "<resolved-after-blind-run>",
  "judge_role": "gemini_teacher|independent_judge",
  "provider": "google|groq",
  "model_id": "<exact-pinned-id>",
  "provider_model_revision": "<returned-or-null>",
  "prompt_version": "<version>",
  "prompt_sha256": "<sha256>",
  "request_sha256": "<sha256>",
  "raw_response_sha256": "<sha256>",
  "relevance_score": 0,
  "relevance_label": "Not Relevant",
  "evidence_quotes": [],
  "reasoning_summary": "<short rationale>",
  "evidence_validation": {
    "required": false,
    "all_quotes_are_substrings": true,
    "validated_against_section_sha256": "<sha256>",
    "status": "valid|invalid|not_required"
  },
  "schema_valid": true,
  "attempt": 1,
  "created_at_utc": "<RFC3339>",
  "record_sha256": "<sha256>"
}
```

`evidence_quotes` is always an array. Each item is one exact contiguous verbatim span; separate non-contiguous spans use separate items. Ellipsis, slash delimiters and reconstructed quotes are invalid. Grades 2–3 require at least one valid span. Grade 1 evidence is optional and its rationale identifies both the partial match and the missing intent. Grade 0 requires `[]` and a non-empty rationale.

---

## 4. Consensus Record and Disagreement Policy

```json
{
  "schema_version": "consensus-v3.0",
  "query_id": "syn_<uuid>",
  "candidate_song_id": "<uuid>",
  "candidate_section_id": "<uuid>",
  "teacher_judgment_id": "jud_<uuid>",
  "judge_judgment_id": "jud_<uuid>",
  "teacher_score": 3,
  "judge_score": 2,
  "absolute_delta": 1,
  "confidence_tier": "medium_confidence",
  "consensus_grade": null,
  "automatic_training_eligible": false,
  "exclusion_reasons": ["delta_one_separate_tier"],
  "human_adjudication": null,
  "record_sha256": "<sha256>"
}
```

| Condition | `confidence_tier` | `consensus_grade` | Automatic primary-training eligibility |
| :--- | :--- | :---: | :---: |
| Δ=0, both schema-valid, required evidence valid | `high_confidence` | agreed score | Yes, after all other controls |
| Δ=1, evidence valid | `medium_confidence` | `null` until adjudicated | No; separate ablation/review file |
| Δ≥2 | `major_disagreement` | `null` | No; `disagreement_cases.jsonl` |
| Any required evidence invalid | `invalid_evidence` | `null` | No |
| Any model ID differs from preregistration | `invalid_run_record` | `null` | No |

Human adjudication never erases the raw disagreement. It appends adjudicator ID, grade, evidence, rationale, timestamp, and policy version. Using adjudicated cases in primary training requires preregistration.

---

## 5. Known-Relevance Graph and False-Negative Control

Maintain two explicit indexes:

```json
{
  "query_id": "syn_<uuid>",
  "known_positive_song_ids": ["<uuid>"],
  "known_positive_section_ids": ["<uuid>"],
  "verified_negative_song_ids": ["<uuid>"],
  "verified_negative_section_ids": ["<uuid>"],
  "partial_or_unresolved_song_ids": ["<uuid>"],
  "unjudged_song_ids": ["<uuid>"]
}
```

Rules:

1. High-confidence grades 2–3 populate positives.
2. High-confidence grade 0 may populate explicit negatives.
3. Grade 1, Δ1, Δ≥2, invalid evidence, and unjudged candidates cannot become strong negatives automatically.
4. All positive sections from the same song are mutually compatible, never in-batch negatives.
5. A song known relevant to a query cannot become a negative merely because another section was sampled.
6. Batch construction must mask every known positive relation. If the chosen loss cannot do so, use a custom relevance-aware loss or explicit-negative objective.

Standard `MultipleNegativesRankingLoss` is allowed only after a batch-level audit proves that no known positive is treated as an in-batch negative. `CachedMultipleNegativesRankingLoss` changes memory behavior, not this semantic requirement.

---

## 6. Training Example Contracts

### 6.1. Contrastive Example

```json
{
  "training_example_id": "train_<uuid>",
  "query_id": "syn_<uuid>",
  "query_text": "<text>",
  "positive_song_id": "<uuid>",
  "positive_section_id": "<uuid>",
  "positive_passage_text": "<section text>",
  "explicit_negative_section_ids": ["<uuid>"],
  "source_consensus_record_ids": ["<sha256>"],
  "loss_family": "relevance_aware_contrastive",
  "query_prefix": "query: ",
  "passage_prefix": "passage: ",
  "false_negative_audit_passed": true,
  "split": "train"
}
```

### 6.2. Ordinal Pairwise Ranking Example

```json
{
  "training_example_id": "rank_<uuid>",
  "query_id": "syn_<uuid>",
  "higher_section_id": "<uuid>",
  "lower_section_id": "<uuid>",
  "higher_grade": 3,
  "lower_grade": 0,
  "experimental_margin": 1.0,
  "margin_policy_version": "ordinal-margin-v1",
  "loss_family": "pairwise_ordinal_ranking"
}
```

Margins such as 3-vs-0=`1.0`, 3-vs-1=`0.66`, 2-vs-0=`0.66`, and 2-vs-1=`0.33` are proposed experimental targets, not ground-truth cosine distances. They require preregistration and ablation. Do not construct pairs from equal grades, Δ1 without adjudication, Δ≥2, or unjudged candidates.

---

## 7. Song-Level and Section-Level Semantics

- Teacher/Judge assess a specific section.
- Training positives reference a specific evidence-bearing section.
- Evaluation qrels reference songs.
- A query–song grade may aggregate multiple section judgments, but the aggregation policy and all contributing section IDs must be stored.
- The primary retrieval aggregation is maximum eligible section score per song. Whole-song embeddings are a separate target type and experiment.

This separation prevents a relevant song with one strong section from being mislabeled because another section is weak, and prevents multiple sections from inflating song-level recall.

---

## 8. Dataset Manifests and Split Integrity

Every artifact directory must include a manifest with filename, byte length, row count, SHA-256, schema version, creation tool/commit, corpus hash, and upstream manifest hashes. Recommended logical artifacts:

- `generated_queries.jsonl`
- `leakage_decisions.jsonl`
- `teacher_judgments.jsonl`
- `judge_judgments.jsonl`
- `consensus_high_confidence.jsonl`
- `consensus_medium_confidence.jsonl`
- `disagreement_cases.jsonl`
- `known_relevance.jsonl`
- `training_examples.jsonl`
- `dataset_manifest.json`

The 90-query development benchmark, T11–T16 diagnostic, and 30-query external set are evaluation references only and must never be copied into `training_examples.jsonl`.

---

## 9. Current Status

All schemas above are proposed contracts. Exact Gemini/GPT model IDs, training library/version, loss implementation, batch sampler, dataset locations, and cryptographic manifests remain pending. No record shown here represents generated or judged production data.
