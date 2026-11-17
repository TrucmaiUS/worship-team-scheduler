# Gemini Primary Teacher Prompt Specification
## Milestone 1 – Synthetic Query Generation and Relevance Labeling (Revision 3.0)

**Project:** LLM-Guided Relevance-Supervised Domain Adaptation for Local E5-small
**Role:** Primary Teacher for (A) synthetic query generation and (B) relevance labeling
**Provider:** Google Gemini
**Exact model ID:** **Pending availability verification and preregistration**
**Prompt versions:** `gemini-query-generation-v3.0`, `gemini-relevance-label-v3.0`
**Execution status:** Inactive; no API call is authorized in Milestone 1

> Historical benchmark logs show that `gemini-2.5-flash-lite` returned HTTP 404 in a prior reranker run. That identifier must not be reused as the Teacher without a separately approved availability check. The selected Gemini ID must be pinned exactly; failure must stop the run, never trigger a silent model fallback.

---

## 1. Shared Safety and Provenance Rules

- Generation sources are limited to approved T01–T10 material and eligible non-anchor corpus content.
- Development, T11–T16 diagnostic, and external query/qrel text must not be included in Teacher payloads.
- Relevance labeling is blind to song title, artist, source topic, intended concept tags, retriever identity/rank, and GPT Judge output.
- Every request records model ID, provider-reported model/version metadata, prompt hash, payload hash, parameters, timestamp, attempt number, and raw-response hash.
- Structured output must pass schema validation before use.
- Retries use the same pinned model only. Quota, model-not-found, invalid JSON, or exhausted retries stop/checkpoint the batch.

Generation and labeling are separate tasks with separate prompts and response files. A generation response is never treated as a relevance judgment.

---

## 2. Task A – Synthetic Query Generation

### 2.1. System Prompt

```markdown
Bạn là chuyên gia thiết kế truy vấn tìm kiếm bài hát thờ phượng Cơ Đốc.

Hãy tạo các truy vấn tìm kiếm tự nhiên dựa duy nhất trên NGUỒN ĐƯỢC CUNG CẤP. Truy vấn phải diễn đạt nhu cầu của một người phụ trách thờ phượng, không sao chép lời bài hát và không tiết lộ tên bài hát, ca sĩ, mã nội bộ hoặc đáp án.

Quy tắc bắt buộc:
1. Chỉ diễn đạt ý định thuộc các chủ đề T01–T10 được phép trong payload.
2. Không tạo truy vấn nhắm vào các ý định held-out bị cấm: Thánh Linh làm chứng về Đấng Christ; Thánh Linh là Đấng dẫn vào mọi lẽ thật; lời kêu gọi, cái giá, điều răn hoặc đại mạng lệnh của môn đồ hóa theo T11–T16.
3. Không chép nguyên văn hoặc gần nguyên văn một câu lyric. Không dùng tiêu đề hoặc tên nghệ sĩ.
4. Không khẳng định một bài hát cụ thể là đáp án duy nhất.
5. Mỗi truy vấn phải tự nhiên, rõ ý định và có thể được trả lời bởi ít nhất một phân đoạn nguồn.
6. Chỉ trả về JSON đúng schema. Không thêm văn bản ngoài JSON.
```

### 2.2. Generation Input

The payload may contain source section text, an allowed T01–T10 topic description, language target, and requested query style. Internal IDs are retained by the orchestrator but need not be shown to the model.

```json
{
  "allowed_topic": {
    "topic_id": "T08",
    "title": "Purpose: How can I make a difference?",
    "description": "<approved source text>"
  },
  "source_sections": [
    {
      "section_alias": "SOURCE_A",
      "lyrics": "<verbatim eligible section text>"
    }
  ],
  "target_language": "vi",
  "query_style": "natural_thematic_request",
  "requested_count": 3
}
```

### 2.3. Generation Output Schema

```json
{
  "queries": [
    {
      "query_text": "<new natural query>",
      "language": "vi",
      "query_type": "thematic",
      "source_section_aliases": ["SOURCE_A"],
      "brief_intent_summary": "<short description grounded in the source>",
      "contains_title_or_artist": false,
      "contains_verbatim_lyric_span": false,
      "possible_held_out_intent": false
    }
  ]
}
```

These self-reported flags are not trusted as final filters. Deterministic deduplication, held-out-intent screening, and human review run afterward.

### 2.4. Generation Configuration

The exact temperature, top-p, seed behavior (if supported), maximum tokens, and number of candidates must be chosen and frozen before the pilot. A provider that does not guarantee deterministic seeding must be documented as such; a seed field must not be fabricated.

---

## 3. Task B – Blind Relevance Labeling

### 3.1. System Prompt

```markdown
Bạn là chuyên gia đánh giá mức độ liên quan ngữ nghĩa của lời bài hát thờ phượng Cơ Đốc.

Hãy đánh giá mối liên hệ giữa một TRUY VẤN và một PHÂN ĐOẠN LỜI BÀI HÁT dựa duy nhất trên nội dung được cung cấp.

Quy tắc bắt buộc:
1. Không suy đoán tiêu đề, ca sĩ, thứ hạng hoặc nguồn của ứng viên.
2. Trùng từ khóa bề mặt không đủ cho điểm 2 hoặc 3.
3. Chủ đề Cơ Đốc chung chung không đủ cho một ý định thần học chuyên biệt.
4. Không bịa đặt ý nghĩa không có hoặc không được hàm ý hợp lý trong lời ca.
5. Điểm 2 hoặc 3 bắt buộc có trích dẫn nguyên văn thể hiện ý liên quan.
6. Điểm 1 phải nêu phần phù hợp và phần còn thiếu; không tự động coi là negative mạnh.
7. Điểm 0 có thể để trống evidence nhưng phải giải thích vì sao không phù hợp.
8. Chỉ trả về JSON đúng schema. Không thêm văn bản ngoài JSON.
```

### 3.2. Operational Rubric

| Score | Label | Decision rule |
| :---: | :--- | :--- |
| 3 | Highly Relevant | Directly and strongly expresses the core intent; an ideal selection |
| 2 | Relevant | Clearly supports a substantial part of the core intent |
| 1 | Partially Relevant | Peripheral, generic, incomplete, or lexical hard negative |
| 0 | Not Relevant | No meaningful semantic/theological alignment |

### 3.3. Blind Input

Candidate aliases are randomly assigned per request. Title, artist, topic ID, source song ID, retriever score/rank, intended concepts, and GPT output are prohibited.

```json
{
  "query_text": "Tìm bài hát về việc tin cậy sự dẫn dắt của Chúa giữa hoàn cảnh bế tắc",
  "candidate": {
    "candidate_alias": "CANDIDATE_07",
    "section_type": "bridge",
    "lyrics": "Dù trước mắt là biển sâu nghìn trùng\nBàn chân con vẫn bước đi không nao núng\nVì Thần Ngài soi dẫn lối trong đêm trường\nBan sức thiêng cho kẻ đặt trọn niềm tin"
  }
}
```

The example lyrics above are synthetic demonstration text and are not corpus or anchor-song lyrics.

### 3.4. Label Output Schema

```json
{
  "candidate_alias": "CANDIDATE_07",
  "relevance_score": 3,
  "relevance_label": "Highly Relevant",
  "evidence_quotes": [
    "Vì Thần Ngài soi dẫn lối trong đêm trường",
    "Ban sức thiêng cho kẻ đặt trọn niềm tin"
  ],
  "reasoning_summary": "Phân đoạn trực tiếp nói về sự dẫn dắt và niềm tin giữa nghịch cảnh.",
  "is_lexical_overlap_only": false
}
```

Labeling uses temperature `0` when supported. All other parameters remain pending preregistration.

---

## 4. Evidence Verification

For grades 2–3, every item in `evidence_quotes` must be an exact contiguous span of the supplied lyrics, including case and whitespace. Multiple non-contiguous spans use separate array items. Ellipsis, slash delimiters and reconstructed quotes are invalid. Grade 0 requires an empty array; grade 1 evidence is optional. A single generic token is insufficient even if it technically matches.

If any required quote fails verification, mark `teacher_evidence_valid=false` and exclude the judgment from automatic training. Do not ask the model to “repair” evidence in place without creating a new logged attempt.

---

## 5. Failure, Retry, and No-Fallback Policy

- Retry only transient failures against the same model with bounded exponential backoff and jitter; honor `Retry-After` when present.
- Maximum attempts must be preregistered; the proposed ceiling is five.
- HTTP 404/model unavailable: stop immediately and require a new approved preregistration. Do not try a model list.
- Persistent 429/503, schema failure, empty output, safety truncation, or exhausted retries: checkpoint and stop the batch.
- Never substitute a deterministic heuristic, another Gemini model, GPT, cached labels, or synthetic placeholder output.
- Partial results remain labeled incomplete and cannot be represented as a completed Teacher run.

---

## 6. Approval Gate

Before any Teacher call: approve the exact Gemini model ID, generation/labeling parameters, prompt hashes, candidate sampling plan, pilot size, estimated request volume/cost, retry ceiling, and stop conditions. This document authorizes none of those calls.
