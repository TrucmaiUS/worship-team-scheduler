# External Independent Generalization Evaluation
## Milestone 1 – Thirty-Query Test Specification (Revision 3.0)

**Project:** LLM-Guided Relevance-Supervised Domain Adaptation for Local E5-small
**Date:** 13 November 2026
**Status:** Designed only; queries, qrels, reviewers, and official run do not yet exist
**Target:** 30 newly authored, frozen queries over the approved corpus snapshot

---

## 1. Claim Supported by This Set

The external set is the only planned evidence for **independent query/topic generalization**. It evaluates whether a frozen Student retrieves relevant songs for new wording and topic intents that were not used in generation, labeling, training, checkpoint selection, or threshold tuning.

Under the default fixed-corpus design, existing songs may have appeared in training under other queries. Therefore this set supports:

- new-query generalization;
- new-topic-intent generalization, subject to documented semantic overlap;
- fixed-corpus song retrieval.

It does **not** support a claim of generalization to unseen songs. A strict song-held-out experiment would require a separately approved song split before any synthetic supervision is created.

---

## 2. Independence and Authoring Protocol

### 2.1. Independent Author

The 30 queries must be authored by a worship-domain contributor who did not create the synthetic training queries, did not tune the retriever, and has not seen Teacher/Judge outputs.

The author may receive the frozen corpus’s song titles, artists, and raw lyrics only to ensure answerability. The author must not receive:

- the 90 development queries or qrels;
- T11–T16 diagnostic qrels;
- synthetic queries, training pairs, or generated concepts;
- Teacher/Judge prompts, judgments, or disagreement cases;
- retriever rankings, routing rules, or model scores.

If the author has prior exposure to any prohibited material, that exposure is recorded and a replacement author or limitation statement is required.

### 2.2. Query Design and Freeze

Before authoring begins, preregister the intended balance across languages, query forms, and theological/pastoral intents. The exact allocation is currently **pending approval** and must not be invented retroactively.

Each query record must include `external_query_id`, text, language, author ID/pseudonym, authoring timestamp, intended information need, and an answerability note. The intended information need is withheld from retrieval systems and used only by human reviewers.

After authoring:

1. normalize and deduplicate internally;
2. screen against the 90 development rows, T11–T16, and all synthetic queries using the registered leakage checks;
3. replace rejected queries before qrels creation;
4. freeze exactly 30 accepted rows;
5. publish a SHA-256 manifest without releasing query text to model developers;
6. prohibit all subsequent training or tuning use.

---

## 3. Qrels Construction

### 3.1. Judgment Unit

The qrel unit is **query–song**, while evidence is captured at **section level**. A grade 2 or 3 requires at least one valid section ID and a verbatim evidence quote. Multiple supporting sections may be stored.

Use the shared 0–3 rubric:

- **3 – Highly relevant:** directly and strongly satisfies the information need.
- **2 – Relevant:** clearly satisfies a substantial part of the need.
- **1 – Partially relevant:** peripheral, generic, or a plausible hard negative.
- **0 – Not relevant:** no meaningful alignment.
- **Unjudged:** no human judgment; never silently mapped to 0.

### 3.2. Candidate Coverage

The preferred design is full-corpus judgment: **30 × 67 = 2,010 query–song pairs**, using the currently verified approved corpus size. This eliminates pooling omissions at the cost of reviewer effort.

If full judgment is not approved, use a preregistered union pool containing, at minimum:

- top candidates from FTS;
- top candidates from frozen pretrained E5;
- top candidates from the frozen fine-tuned Student;
- top candidates from every additional reported baseline;
- songs proposed independently by the query author or reviewers;
- a fixed random sample and known control items.

Pool depth, deduplication, and random seed must be frozen before judgments. Reviewer interfaces must hide which system contributed each candidate and its rank. A pooled design must report coverage limitations and may not call unjudged songs irrelevant.

### 3.3. Independent Human Review

Each pair is judged independently by **two human reviewers** with worship/theological domain competence. They must be blind to system identity, candidate rank, Teacher/Judge scores, and each other’s initial grade.

- Exact agreement is retained.
- A one-grade disagreement is reviewed after independent submission; the final grade and rationale are recorded.
- A disagreement of two or more grades, or a disputed theological interpretation, goes to a third adjudicator.
- Grade 2–3 evidence quotes are verified deterministically against the frozen lyric section.
- LLM Teacher/Judge outputs may not serve as external ground truth.

Store raw reviewer grades, final adjudicated grade, reviewer IDs/pseudonyms, timestamps, evidence, rationale, and adjudication history.

---

## 4. Song/Section Aggregation During Evaluation

The primary run ranks sections and assigns each song the maximum eligible section score. The winning section is returned as retrieval evidence. Whole-song-vector retrieval, score averaging, or hybrid section/song fusion must be separate preregistered runs with distinct experiment IDs.

Qrels remain song-level so that multiple relevant sections do not inflate recall. Section-level evidence is retained for audit and error analysis.

---

## 5. Preregistration Package

Before the external text is revealed to model developers, freeze:

- corpus snapshot/hash and the eligible 67-song list;
- 30-query manifest hash and leakage-screen report;
- qrels protocol, pool contributors/depth or full-judgment decision;
- reviewer roster rules and adjudication policy;
- Student checkpoint hash and all baseline identifiers;
- query/document prefixes and section-to-song aggregation;
- metrics, confidence intervals, exclusion rules, and report template;
- code commit, lockfile, execution environment, and random seeds;
- infrastructure-failure and rerun policy.

Any change creates a new protocol version before the official run. Changes after viewing official scores invalidate the “one-time independent” claim for that version.

---

## 6. Official Evaluation and Reruns

Infrastructure preflight must use development or synthetic queries, never the 30 external queries. The official event runs all frozen systems without tuning.

A run may be declared `INFRASTRUCTURE_FAILURE` only for documented interruption such as process crash, database outage, corrupted output, or hardware failure. A model/API being unavailable is not permission to substitute another model: the affected baseline is marked unavailable or the run is rescheduled unchanged. Any rerun must preserve checkpoint, code, parameters, corpus, and query manifest and retain the failed raw logs.

After results are opened:

- do not update the Student, prompts, thresholds, or routing using these queries/qrels;
- report all registered metrics and exclusions;
- label any later use as development and create a new independent set for future claims.

---

## 7. Current Blockers

- Independent author not assigned.
- Two reviewers and third adjudicator not assigned.
- Query-balance plan not approved.
- Full 2,010-pair judgment versus pooled judgment not approved.
- Exact Student checkpoint and baseline model identifiers do not yet exist/freeze.
- No external query or qrel has been generated in Milestone 1.
