# Leakage Validator v2 — Pipeline Hardening

Ngày: 25/11/2026. Phiên bản: `leakage-validator-v2.0.0`.

## Phạm vi và quyết định

V2 chuyển các nguyên tắc từ `topic_leakage_audit.md`, `evaluation_protocol.md`, `external_test_specification.md` và final pilot adjudication sang API có schema, bằng chứng và regression offline. Không thay đổi Human Reference, frozen Qwen, Teacher/Judge outputs, workbook hoặc pilot snapshot. Không cấp training eligibility.

| Tín hiệu | Cách xử lý |
|---|---|
| Foundational vocabulary: faith, grace, Holy Spirit, Thánh Linh, môn đồ | Cho phép; ghi nhận riêng, không blacklist |
| Lexical similarity / morphology / containment | Ghi toàn bộ điểm và candidates; threshold riêng lẻ không kết luận leakage |
| Sao chép nguyên một protected query có nội dung đủ dài | `confirmed_leakage`; loại title/artist/topic label ngắn khỏi quy tắc sao chép |
| Specialized held-out intent T11–T16 có quan hệ được diễn đạt rõ | `confirmed_leakage` bằng bounded bilingual relational templates |
| Partial intent, phủ định hoặc đối tượng làm chứng chưa xác định | `human_review` nếu chưa có adjudication ràng buộc đúng nội dung |
| Cosine ≥ 0.75 do caller cung cấp | Chỉ tạo candidate; `human_review` nếu chưa có bằng chứng equivalent/different, tuyệt đối không tự confirm từ threshold |
| Cùng song hoặc cùng section | Không đủ để flag |
| Cùng intent và cùng target trong protected mapping đã được xác minh | `confirmed_leakage` |
| Explicit reuse của diagnostic query–song supervision | `confirmed_leakage` khi trùng target; chỉ ID mapping đã đăng ký được chấp nhận |
| Mapping provenance legacy chưa xác minh | Không tự gọi là human gold; quan hệ tương đương cần xác minh provenance, trừ khi đã có bằng chứng intent bị cấm độc lập hoặc explicit reuse |
| Thiếu external registry / semantic scores khi caller yêu cầu | `incomplete`, chặn thông qua |

`passed` là kết quả trong phạm vi coverage được báo cáo, không phải chứng nhận không có mọi dạng semantic leakage. `human_review` chỉ dành cho bằng chứng intent/provenance chưa đủ; shared vocabulary không tự tạo review.

## Implementation và API

- `lib/research/e5-distillation/leakage-v2.ts`: Zod schemas, lexical signals, morphological dictionary có kiểm soát, intent rules, mapping checks, quyết định và provenance.
- `lib/research/e5-distillation/leakage-v2-pilot.ts`: adapter đọc frozen pilot; kiểm tra SHA-256 từ manifest và registry fingerprint trước khi kế thừa Human Adjudication.
- `scripts/validate_leakage_v2.ts`: batch CLI offline, xuất kết quả riêng; không import provider, không load `.env.local`, không gọi embedding.
- `lib/research/e5-distillation/__tests__/leakage-v2.test.ts`: regression 50 records và unit fixtures cho các vi phạm/false positives.

API `auditQueryLeakageV2({candidate, registry, adjudications?, semanticScores?, intentEvidence?, supervisionMappingIds?, requireSemanticScores?, requireExternalCoverage?})` được export từ research index. Các field không biết trong candidate/registry/adjudication bị từ chối. Candidate gồm `queryId`, `queryText`, `songId`, `sectionId`, `lyrics`.

Normalization dùng Unicode NFC, lowercase, dấu câu thành token boundaries, giữ dấu tiếng Việt. Không dùng substring nằm trong một token. Morphology dùng dictionary cho các động từ liên quan intent; không stem `faithfulness` thành `faithful`. Các điểm lexical dùng lại module `normalization.ts` hiện có.

Lexical screening giữ mốc v1: word Jaccard > 0.35, character Jaccard > 0.45, edit distance < 0.30. Chúng chỉ là candidate signals. Quy tắc sao chép trực tiếp yêu cầu nguyên query ≥ 4 tokens, hoặc containment hai chiều với cả hai phía ≥ 8 tokens; không áp dụng title/artist/topic label. Những mốc độ dài này là guard thiết kế, chưa phải ngưỡng đã được chứng minh tối ưu. Phủ định trong intent chuyển sang review.

Mapping bao gồm reference ID, song ID, optional section IDs, source hash và provenance trust. Song-level qrels không được tự chuyển thành section-level human judgment. Hai quan hệ khác intent trên cùng section được phép theo protocol fixed corpus. Semantic equivalence evidence phải có authority, rationale, candidate fingerprint và reference text hash; các evidence mâu thuẫn bị từ chối. Đây là đầu vào đáng tin cậy do caller quản lý, không phải kết quả tự suy ra từ cosine.

## Kế thừa Human Adjudication

Nguồn duy nhất của pilot: `outputs/teacher-judge-pilot-v1-2026-11-19T10-54-35-956Z-final-2026-11-25/leakage_audit_final.json`, được kiểm chứng bởi pinned final artifact manifest hash. Chỉ 10 records thực sự có change history được chuyển thành scoped approvals; 40 original passes không được tạo approval nhân tạo.

Approval ràng buộc SHA-256 của đầy đủ query ID/text, song, section, lyrics và toàn bộ protected registry. Sửa bất kỳ field nào hoặc registry sẽ không kế thừa approval. TP043 giữ quyết định Human Adjudication ngày 25/11/2026, trọng tâm T09, không tái hiện đầy đủ specialized T11. Không có allowlist theo TP ID, song, section hoặc topic.

Registry pilot có 90 benchmark queries + 50 Human Reference records (14 diagnostic nằm trong 90); 32 diagnostic positive mappings legacy. Trường `adjudicated=true` trong qrels không chứng minh provenance human: script historical `scripts/generate_candidate_pool.ts` có hardcoded T11 mapping và xuất reviewer/adjudicated metadata. V2 ghi `legacy_unverified`, không diễn giải các qrels pending/grade 0 thành negatives. Chỉ dùng mappings trong validator offline, không đưa vào Teacher/Judge/generation payloads; không đọc external test labels.

## Cách tái lập

```powershell
npm run research:test
npm run research:leakage:v2 -- --pilot-regression
```

Mỗi lần CLI tạo thư mục output riêng; từ chối ghi đè thư mục đã có hoặc ghi vào vùng immutable. Artifacts gồm report, per-record signals, registry snapshot, scoped adjudications, source/code hashes, integrity và execution log. Git commit là commit nền; khi source chưa commit, phải dùng kèm code hashes, không coi HEAD là toàn bộ implementation.

Nếu checkout không có `benchmark/data/qrels.csv` (file historical có thể đang untracked), dùng registry snapshot được xuất từ lần chạy đã kiểm chứng:

```powershell
npm run research:leakage:v2 -- --pilot-regression --registry <run-directory>/protected_registry.json
```

Snapshot phải khớp pinned pilot registry fingerprint. Candidate text/labels vẫn lấy nguyên từ snapshot pilot và final audit, không sửa để đạt regression. Các workbook authoring historical không cần cho tính toán được liệt kê nếu không có; các input cốt lõi và final workbook bắt buộc có và hash đúng.

Batch offline cho một dataset đã được ủy quyền, với candidate JSONL theo schema và registry riêng:

```powershell
npm run research:leakage:v2 -- --candidates <candidate.jsonl> --registry <registry.json> --out <new-directory>
```

CLI không tính cosine. Khi cần semantic coverage bắt buộc, caller API phải cung cấp đủ frozen encoder scores và bật `requireSemanticScores`; thiếu scores trả `incomplete`. `--require-external` chặn CLI khi chưa đăng ký external references. Protected external text/mappings phải ở boundary validator tách khỏi generation; tuyệt đối không lấy external labels làm generation supervision.

## Regression và giới hạn còn lại

Pilot regression dự kiến: pipeline thuần 49 `passed`, TP043 `human_review`; sau kế thừa adjudication: 50 `passed`. TP018 không còn substring match `Faithful`/`faithfulness` nhưng vẫn giữ `rejected_validation` trong pilot. TP012/TP040 vẫn invalid Judge outputs. Không có cập nhật training dataset.

50 records đã biết và đa số không leakage không cung cấp ước lượng leakage recall/precision ngoài mẫu; đây là regression, không phải một benchmark độc lập để tune. Unit fixtures là test inputs cho rules, không synthetic training queries. Bounded templates không hiểu hết paraphrase, tiếng Việt không dấu, ẩn dụ, liên hệ chủ thể xa hoặc nhiều phủ định. Cross-lingual intent screening chưa có frozen encoder thực đo trong lần này. Cosine cao có thể tạo review candidates cần bằng chứng bổ sung; không phải confirmed leakage. Thay đổi registry yêu cầu review lại approvals và ghi version mới.

Không có external query registry frozen trong lần chạy; không tuyên bố external leakage coverage đầy đủ. Trước expansion cần chốt registry/coverage policy và một run orchestrator gọi API v2 với checks bắt buộc phù hợp. Không tự động bắt đầu expansion.

## Change log

- Thêm API v2 có version; giữ nguyên `leakage.ts`, `held-out-intent.ts` và runner pilot v1 để tái lập lịch sử. Runner v1 không phải entry point được phê duyệt cho expansion; API v2/CLI là entry point hardening mới.
- Thay substring/score rejection bằng full-token lexical screening và xác minh intent/mapping.
- Bổ sung registry và mapping schemas/provenance, explicit missing-coverage states, scoped approvals và input hashing.
- Đồng bộ quy tắc v2 trong ba protocol documents, giữ các báo cáo frozen nguyên vẹn.
- Thêm regression offline và artifacts riêng; không gọi model, không sửa snapshot, không cấp training eligibility.
