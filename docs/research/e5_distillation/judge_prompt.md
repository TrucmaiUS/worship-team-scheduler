# GPT Independent Judge Prompt Specification
## Milestone 2 – Blind Relevance Cross-Validation (Revision 3.0)

**Project:** LLM-Guided Relevance-Supervised Domain Adaptation for Local E5-small
**Role:** Independent blind relevance Judge
**Provider:** OpenAI API
**Exact model ID:** Pending availability verification and preregistration
**Prompt version:** `gpt-independent-judge-v3.0`
**Execution status:** Inactive; no API call is authorized until a separate preflight approval

---

## 1. Independence Rules

The Judge receives only the query, an anonymized lyric section, and the shared 0–3 rubric. The payload must not reveal:

- Gemini score, evidence, explanation, or raw response;
- retriever identity, score, rank, or candidate-pool source;
- song title, artist, source song ID, source topic, or intended concept tags;
- whether the candidate is expected to be positive, negative, or difficult;
- development, diagnostic, or external qrels.

Candidate aliases are randomized before the Judge request and resolved to internal IDs only after the raw response is sealed. Teacher and Judge raw files remain separate until consensus construction.

---

## 2. System Prompt

```markdown
You are an independent semantic relevance judge for Christian worship lyrics.

Evaluate the relationship between one SEARCH QUERY and one anonymized LYRICS SECTION using only the text provided.

Mandatory rules:
1. Judge semantic and theological intent, not superficial keyword overlap.
2. Do not infer a song title, artist, retrieval rank, source topic, or expected answer.
3. Do not invent a concept that is absent or not reasonably implied by the lyrics.
4. Score only with the four-level rubric: 0, 1, 2, or 3.
5. Scores 2 and 3 require one or more verbatim evidence quotes from the supplied lyrics.
6. Score 1 must explain both the partial connection and the missing core intent. It is not automatically a strong negative.
7. Score 0 may use an empty evidence list, but must include a concise reason.
8. Return only JSON that matches the required schema. Do not add prose outside JSON.
```

---

## 3. Shared Rubric

| Score | Label | Operational definition |
| :---: | :--- | :--- |
| 3 | Highly Relevant | Directly and strongly expresses the core intent; an ideal selection |
| 2 | Relevant | Clearly supports a substantial part of the core intent |
| 1 | Partially Relevant | Peripheral, generic, incomplete, or a lexical hard negative |
| 0 | Not Relevant | No meaningful semantic/theological alignment |

---

## 4. Blind Input Schema

```json
{
  "query_text": "Tìm bài hát về việc tin cậy Chúa khi tương lai mờ mịt",
  "candidate": {
    "candidate_alias": "CANDIDATE_19",
    "section_type": "bridge",
    "lyrics": "Dù đường xa con chưa nhìn thấy\nLời Ngài vẫn soi bước chân con\nCon trao ngày mai trong tay Chúa\nVững lòng đi tiếp chẳng sợ chi"
  }
}
```

The example is synthetic demonstration text, not corpus or anchor-song lyrics.

---

## 5. Strict Output Schema

```json
{
  "candidate_alias": "CANDIDATE_19",
  "relevance_score": 3,
  "relevance_label": "Highly Relevant",
  "evidence_quotes": [
    "Con trao ngày mai trong tay Chúa",
    "Vững lòng đi tiếp chẳng sợ chi"
  ],
  "reasoning_summary": "The section directly expresses trust in God despite an unseen future.",
  "is_lexical_overlap_only": false
}
```

The orchestrator validates the JSON schema and independently verifies evidence quotes against the exact supplied lyrics. Model self-attestation is not sufficient.

---

## 6. Consensus Boundary

The Judge does not compute consensus. After Teacher and Judge files are sealed:

- Δ=0: high-confidence tier, subject to evidence, leakage, and grade-specific rules;
- Δ=1: separate medium-confidence tier, excluded from primary automatic training;
- Δ≥2: major disagreement, excluded from automatic training and queued for review;
- any grade 2–3 with invalid evidence: excluded regardless of Δ;
- agreed grade 1: retained as partial relevance, not converted into a strong negative.

---

## 7. Model Pinning and Failure Policy

Before the first request, freeze the exact OpenAI model ID, prompt hash, parameters, response schema, retry ceiling, and estimated cost. A placeholder or family alias is insufficient.

- Labeling temperature is `0` when supported by the selected model/API.
- Retries target only the same pinned model and are fully logged.
- Model mismatch, unavailable model, quota failure, invalid JSON, missing evidence, or exhausted retries stops/checkpoints the run.
- Never substitute another GPT model, Gemini, a heuristic, cached labels, or placeholder data.
- Partial output cannot be reported as a completed Judge run.

This document defines the prompt contract only and does not authorize network execution.
