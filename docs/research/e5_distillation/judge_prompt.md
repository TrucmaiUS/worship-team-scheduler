# Groq Independent Judge Prompt Specification
## Phase 2 – Blind Relevance Cross-Validation (Revision 4.2)

**Project:** LLM-Guided Relevance-Supervised Domain Adaptation for Local E5-small

**Role:** Independent blind relevance Judge

**Provider:** Groq API through its OpenAI-compatible Chat Completions endpoint

**Candidate model IDs:** `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`

**Prompt version:** `groq-independent-judge-v4.2`

**Execution status:** Adapter and synthetic two-model smoke test complete; Human Reference v2 ready; no development selection run yet

## 1. Provider, model, and role are separate

`groq` is the API provider. GPT-OSS 120B and Qwen 3.8 27B are two independent candidate models hosted by that provider. The stored role is `independent_judge`; it does not imply an OpenAI API call or a GPT model. The legacy role string `gpt_independent_judge` remains readable only for earlier offline fixtures.

Gemini remains the Teacher for synthetic query generation and relevance labeling. Local `Xenova/multilingual-e5-small` remains the Student. This is relevance-supervised fine-tuning, not vector distillation.

## 2. Independence rules

Both Judge candidates receive the exact same system prompt, blind input, JSON Schema and sampling parameters; only the exact `model` field differs. Neither receives:

- Gemini label, evidence, reasoning, raw response, or intended answer;
- the other Judge candidate's response;
- retriever identity, score, rank, or pool source;
- song title, artist, internal song/section ID, topic, or concept tags;
- development qrels, T11–T16 diagnostics, or external queries/qrels.

Aliases are randomized and resolved only after raw responses are sealed. Teacher and Judge artifacts remain separate until consensus construction.

## 3. Exact system prompt

```markdown
You are an independent semantic relevance judge for Christian worship lyrics.

Evaluate the relationship between one SEARCH QUERY and one anonymized LYRICS SECTION using only the text provided.

Mandatory rules:
1. Judge semantic and theological intent, not superficial keyword overlap.
2. Do not infer a song title, artist, retrieval rank, source topic, or expected answer.
3. Do not invent a concept that is absent or not reasonably implied by the lyrics.
4. Score only with the four-level rubric: 0, 1, 2, or 3.
5. Return evidence_quotes as an array. Each item must be one exact, contiguous, verbatim span from the supplied lyrics.
6. Use a separate array item for each non-contiguous span. Never use ellipsis, slash delimiters, or join disconnected text into one quote.
7. Scores 2 and 3 require at least one evidence quote. Score 1 may use an empty array. Score 0 must use an empty array.
8. Score 1 must explain both the partial connection and the missing core intent. It is not automatically a strong negative.
9. Score 0 must include a concise reason.
10. Return only one JSON object with exactly the six required fields. Do not rename, omit or add fields, and do not add prose outside JSON.

Required keys are `candidate_alias`, `relevance_score`, `relevance_label`, `evidence_quotes`, `reasoning_summary` and `is_lexical_overlap_only`. Copy the candidate alias exactly. Use only the frozen score-to-label mapping. Alternate keys such as `score`, `label`, `explanation`, `evidence` or `reasoning` are prohibited.
```

## 4. Shared rubric and blind schemas

| Score | Label | Operational definition |
| :---: | :--- | :--- |
| 3 | Highly Relevant | Directly and strongly expresses the core intent; an ideal selection |
| 2 | Relevant | Clearly supports a substantial part of the core intent |
| 1 | Partially Relevant | Peripheral, generic, incomplete, or a lexical hard negative |
| 0 | Not Relevant | No meaningful semantic/theological alignment |

Input contains only `query_text` and one candidate with `candidate_alias`, `section_type`, and `lyrics`. Strict output contains the alias, numeric score, matching label, an `evidence_quotes` array, short reasoning summary, and lexical-overlap flag. `request-contracts.ts` performs cross-field checks. `groq-judge.ts` independently requires each array item to be an exact contiguous substring and rejects ellipsis or slash delimiters.

Verbatim matching and contextual support are different measurements. Code verifies contiguous matching after Unicode NFC canonicalization only; it does not normalize whitespace, case or punctuation. For the Judge-selection experiment, a human reviewer separately marks whether each quoted span actually supports the assigned query/grade; the model cannot self-certify contextual support.

## 5. Frozen comparison envelope

- Endpoint: `https://api.groq.com/openai/v1/chat/completions`.
- Shared response mode: `response_format.type=json_object`; the same strict response schema and cross-field evidence rules are enforced locally for both models. This replaces provider-side strict JSON Schema because the current Groq inventory does not advertise `structured_outputs` for Qwen 3.8 27B.
- `max_completion_tokens=900`, `temperature=0.2`, `top_p=0.95`, `seed=20261113`. A 1024-token preflight passed, but the subsequent Qwen run exposed an account OTPM limit of 1000 that rejects any request capped at 1024. The shared cap is therefore 900 for both candidates; neither earlier partial run is used for comparison.
- `reasoning_effort=low`, `reasoning_format=hidden` for both candidates.
- Timeout 30 seconds; at most three same-model attempts for an approved experiment.
- Retry only 408/409/429/5xx or transport timeout. Model mismatch, 400/401/403/404, invalid pin/schema hash, or exhausted retries stops without fallback.
- Log provider, exact model, request/prompt/schema/response hashes, attempt, HTTP status, usage, latency, request ID, fingerprint and failure code. Never log the key.

These parameters are frozen before the human-reference labels are revealed to either candidate. Any parameter change creates a new experiment version and invalidates direct comparison.

## 6. Availability evidence as of 13 November 2026

Groq's official catalog and live account Models API both list the exact IDs as active. Official Structured Outputs documentation lists strict JSON Schema support for both. Published model limits are 131,072 context / 65,536 maximum output tokens for GPT-OSS 120B and approximately 131K context / 16,384 maximum output tokens for Qwen 3.8 27B. The account-specific model-list response does not expose quota counters; actual per-account rate headers must be recorded from live completion responses.

Official references: [Groq model catalog](https://console.groq.com/docs/models), [GPT-OSS 120B model card](https://console.groq.com/docs/model/openai/gpt-oss-120b), [Qwen 3.8 27B model card](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [Structured Outputs](https://console.groq.com/docs/structured-outputs), [OpenAI compatibility](https://console.groq.com/docs/openai), and [rate limits](https://console.groq.com/docs/rate-limits).

No alias substitution is allowed. In particular, deprecated `qwen/qwen3.6-27b` and `qwen/qwen3-32b` must not be used.

## 7. Consensus boundary

The selected Judge still does not create training truth alone. After Gemini Teacher and the selected blind Judge are sealed: Δ=0 remains high-confidence subject to evidence; Δ=1 stays separate; Δ≥2 is excluded and reviewed; invalid grade 2–3 evidence is excluded. Grade 1 is never silently converted to a strong negative.
