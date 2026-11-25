# Final Pilot Quality Assessment

Ngày đóng Human Audit và Leakage Adjudication: **25/11/2026**, múi giờ Asia/Bangkok.

Run gốc: `teacher-judge-pilot-v1-2026-11-19T10-54-35-956Z`.

**Kết luận:** Hoàn tất checkpoint Human Audit và Leakage Adjudication. Có **43 positive candidates đạt các tiêu chí audit đã thu thập**, nhưng chưa materialize hoặc phê duyệt training dataset. **NO-GO cho việc thực thi ngay Synthetic Data Expansion 240 queries** cho đến khi hoàn tất các điều kiện vận hành tại mục 11. Kết luận này không phủ nhận quyết định Human về TP043 và không mở lại Judge Selection.

## 1. Teacher–Judge Pilot overview

- Teacher: `gemini-3.1-flash-lite`; nhiệm vụ sinh query, không có ordinal Teacher relevance labels trong run này.
- Judge: frozen `qwen/qwen3.8-27b`; prompt `groq-independent-judge-v4.3`, schema `evidence_quotes`, decoding và cấu hình được giữ nguyên.
- 50 query–source-section pairs; 44 songs, 50 sections; 5 queries cho mỗi topic T01–T10.
- Ngôn ngữ: 30 Vietnamese, 20 English/cross-lingual.
- Coverage: 10 semantic paraphrase, 10 sermon topic, 10 theological concept, 20 cross-lingual; đây là allocation, không phải chứng nhận semantic coverage độc lập.
- Original pilot đã loại 6 anchor songs và 42 Human Reference sections khỏi nguồn generation.
- Không gọi model, tạo query, tạo hard negative, thay validator hoặc training trong lần đóng checkpoint này.

Các nguồn gốc được giữ tại `benchmark/distillation/teacher_judge_pilot_runs/teacher-judge-pilot-v1-2026-11-19T10-54-35-956Z/`: `run_manifest.json`, `model_configs.json`, `gemini_teacher_raw.json`, `qwen_judge_raw.json`, `pilot_pairs.jsonl`, `pilot_metrics.json` và execution logs. Đường dẫn này là snapshot lịch sử; các trạng thái pending trong manifest gốc không bị ghi đè.

## 2. Human Audit distribution

| Human decision | Số lượng | Tỷ lệ trên 50 |
|---|---:|---:|
| accept | 43 | 86% |
| reject | 4 | 8% |
| uncertain | 1 | 2% |
| invalid | 2 | 4% |

Các decisions, evidence context, theological consistency và reviewer notes được giữ nguyên từ workbook v2 mới nhất. TP021 đã đúng `Review!A33=TP021`, `B33=uncertain_review`, `C33=T05` ngay trong input và không cần sửa lại.

## 3. Human–Judge binary agreement

Quy ước phân tích: Qwen Grade ≥2 là dự đoán positive; Grade 0–1 là không-positive. Human accept/reject là hai nhãn để đối chiếu. Phép quy đổi này chỉ phục vụ phân tích, không biến Grade 1 thành strong negative.

| Qwen output | Human accept | Human reject | Human uncertain | Human invalid |
|---|---:|---:|---:|---:|
| Grade 0 | 0 | 0 | 0 | 0 |
| Grade 1 | 0 | 4 | 0 | 0 |
| Grade 2 | 8 | 0 | 0 | 0 |
| Grade 3 | 35 | 0 | 1 | 0 |
| Invalid output | 0 | 0 | 0 | 2 |

Trên **47 records có Human accept/reject và Judge score hợp lệ**: TP=43, FP=0, FN=0, TN=4; binary agreement=47/47=100%; positive precision=43/43=100%; positive recall=43/43=100%; binary F1=100%.

Loại khỏi mẫu tính: TP018 (Human uncertain), TP012 và TP040 (Judge invalid). Không có false acceptance hoặc false rejection được quan sát trên 47 records quyết định rõ này. Không diễn giải kết quả thành hiệu suất tổng quát 100% hoặc 50/50 agreement. Exact ordinal agreement, MAE và QWK không tính được vì không thu Human grades 0–3. Không suy diễn accept=3 hoặc reject=0.

## 4. Evidence context support

- Toàn bộ Human context flags: 45 true, 4 false, 1 not_applicable.
- Trên **44 Judge positives Grade 2–3 có output hợp lệ**, context support=44/44=100%. Nhóm này có TP018, dù TP018 chưa được Human accept.
- Trên **43 positive candidates được Human accept**, context support=43/43=100%.
- Có 4 Grade-1 records bị đánh dấu context=false: TP021, TP044, TP047, TP050. Optional evidence ở Grade 1 không bảo đảm query core intent được hỗ trợ.
- TP040 có context=true theo Human nhưng Judge output invalid và evidence array lưu là rỗng. Giữ nguyên ô này; notes giải thích source lyrics phù hợp về nội dung. Không dùng TP040 để tính valid submitted-evidence support.
- TP012 có context=not_applicable. Không sửa hoặc tự phục hồi evidence.

Context support do Human xác nhận và verbatim validation là hai phép kiểm tra riêng. Original Judge adapter kiểm tra verbatim sau chuẩn hóa Unicode NFC. Báo cáo không thay đổi định nghĩa validator đó.

## 5. Theological consistency

50/50 records được Human đánh dấu theological consistency=true. Đây là đánh giá không mâu thuẫn thần học, không đồng nghĩa 50/50 source sections hỗ trợ đủ query. TP044, TP047 và TP050 minh họa query có thể hợp lý về thần học nhưng suy diễn vượt nội dung lyrics.

## 6. Judge output validity

- Valid Judge outputs: **48/50=96%**.
- Invalid Judge outputs: **2/50=4%**, giữ nguyên TP012 và TP040.
- TP012: evidence chứa slash từ source lyrics, vi phạm frozen schema.
- TP040: evidence không đạt verbatim substring validation.
- Hai records này không có score hợp lệ và tiếp tục bị loại khỏi positive candidate eligibility. Human xác nhận relevance không sửa được output validity.

Không áp dụng hồi tố hard gates của Judge Selection thành ngưỡng mới cho pilot. Tỷ lệ 4% là failure rate đã quan sát; ngưỡng chấp nhận của run 240 phải được xác định trước run. Frozen Qwen không bị thay đổi hoặc đánh giá lựa chọn lại.

## 7. Leakage adjudication results

**50/50 records leakage passed; 0 human_review, 0 rejected và 0 confirmed_leakage còn mở.**

TP043 được giải quyết bằng **Human Adjudication ngày 25/11/2026**, do người dùng quyết định cuối cùng: không phải data leakage. T11 bảo vệ specialized intent và query–song supervision, không cách ly toàn bộ song/section. TP043 tập trung vào sự đồng hành và ban năng lực của Chúa Thánh Linh thuộc T09, không tái hiện đầy đủ specialized intent T11 làm chứng cho Đấng Christ.

Thay đổi cuối: `Review!M55: human_review → passed`, `Raw Data!W47: human_review → passed`, xóa active reason ở `Raw Data!X47`. Reason gốc và ngày/authority/rationale adjudication được giữ trong `leakage_audit_final.json` và `change_log_final.json`.

9 reclassifications trước được giữ nguyên: TP001, TP005, TP041, TP042, TP044, TP045, TP046, TP050, TP018. TP018 trước đó là rejected, không phải human_review. Quyết định leakage passed không thay Human uncertain hoặc historical bucket rejected_validation của TP018.

Nguồn quy tắc: `docs/research/e5_distillation/topic_leakage_audit.md`, dòng 64–84: cho phép foundational vocabulary, cấm specialized held-out intent và protected supervision; song-level isolation là thiết kế riêng. Same-song/same-passage overlap của TP043 được lưu như evidence lịch sử, không bị xóa bởi adjudication. Chất lượng/provenance T11 qrels vẫn là giới hạn của evaluation; adjudication này không chứng nhận qrels là independently human-adjudicated gold.

## 8. Failure pattern analysis

| Pattern | Records | Ý nghĩa |
|---|---|---|
| Semantic relevance thiếu hỗ trợ core intent | TP021, TP044, TP047, TP050 | Human đồng ý Grade 1 và reject; không dùng làm hard negatives |
| Khác chủ thể thần học | TP044 | Lyrics nói về Jesus; query yêu cầu vai trò cụ thể của Holy Spirit |
| Overinterpretation từ Word/will sang chức năng cụ thể | TP047, TP050 | Tính trường tồn của Lời/ý Chúa chưa thiết lập soi sáng tâm trí hoặc vai trò hiểu biết của Spirit |
| Evidence syntax/contiguity | TP012, TP040 | Giữ invalid outputs dù query có thể phù hợp |
| Vocabulary-only leakage false positives | 8 records đã được reclassify trước | Human clearance không sửa được implementation tự động cho run mới |
| Character substring false positive | TP018 | Faithful nằm trong faithfulness; leakage đã clear nhưng Human uncertain chưa được đổi |
| Boundary intent/mapping | TP043 | Đã được Human adjudicate passed ngày 25/11/2026 |

## 9. Final candidate eligibility

| Chiều đánh giá | Kết quả | Ý nghĩa |
|---|---:|---|
| Human acceptance | 43/50 | Human chấp nhận pair |
| Judge output validity | 48/50 | Có output hợp lệ |
| Leakage eligibility | 50/50 | Hoàn tất leakage clearance, gồm Human decisions |
| Positive candidates thỏa các checks đã thu thập | 43/50 | Human accept, Qwen Grade ≥2 hợp lệ, context/theology true, leakage passed, historical positive_candidate |
| Training examples được materialize/phê duyệt trong nhiệm vụ này | 0 | Chưa xuất training dataset hoặc bật training eligibility |

Các chiều này không được gộp thành một tỷ lệ chất lượng duy nhất. Danh sách 43 candidate IDs nằm trong `final_pilot_quality_metrics.json`; đây là danh sách phục vụ assessment, không phải training examples.

7 records chưa phải positive candidates: TP012, TP018, TP021, TP040, TP044, TP047, TP050. TP018 vẫn Human uncertain và rejected_validation. TP012/TP040 vẫn invalid. Bốn rejects vẫn được giữ trong audit, không tạo hard negatives. Mọi original `trainingEligible=false` và `hardNegativeEligible=false` vẫn nguyên trạng.

## 10. Limitations và remaining risks

- N=50, được sinh theo source-linked sampling; không phải independently sampled held-out gold set. Không có Grade-0 cases, chỉ 4 Human rejects, nên chưa đánh giá rộng false acceptance/false rejection.
- Human workbook hiển thị Judge output và rationale; không thể coi agreement là một independent blind reliability study. Chưa có multiple human ordinal judgments để tính inter-rater reliability/QWK.
- Binary metrics loại 3 unresolved/invalid observations theo định nghĩa; không che giấu chúng bằng denominator 50. Không tuyên bố statistical superiority hoặc population-level precision=100%.
- Final leakage passed là kết quả validator kết hợp user-approved reassessment/adjudication, không phải 50 automatic passes của implementation hiện tại.
- Pilot tắt semantic checking và chưa có protected query–song registry trong validator. Việc reclassify pilot không tự sửa được false positives hoặc semantic false negatives ở dữ liệu mới.
- Source song/section overlap không phải mặc định leakage trong fixed-corpus protocol; benchmark này không chứng minh generalization sang unseen songs/passages. T11–T16 là diagnostic đã có development exposure.
- Run manifest ghi external held-out query set chưa có; không được tuyên bố đã sàng lọc pilot với một external set chưa tồn tại. Workspace hiện chưa có frozen external query artifact được xác minh.
- Pilot Teacher chỉ generation; không có Teacher ordinal label stage, pooled-candidate labeling, Δ0/Δ1 consensus hoặc batch false-negative audit của protocol cũ. Không tự tạo các kết quả còn thiếu. Cần version rõ workflow intended cho expansion/training.
- Token/latency số liệu gốc chủ yếu phản ánh successful requests; thiếu token usage cho một số failed attempts và có rate-limit waits/resume. Không trình bày là all-in audited cost hoặc unbiased latency estimate.
- Các header/trạng thái lịch sử trong snapshot gốc và pilot buckets được giữ nguyên. Final assessment và leakage audit final mới là bản tổng hợp đóng Human Audit/leakage checkpoint.

## 11. GO/NO-GO và đề xuất bước tiếp theo

**GO để đóng Human Audit + Leakage Adjudication của pilot. NO-GO để thực thi ngay run 240 queries bằng pipeline hiện tại.** Không còn leakage case chờ Human trong 50 pairs; blockers dưới đây thuộc readiness của giai đoạn mới.

1. **Leakage validator chưa phản ánh policy đã adjudicate.** Cần version hóa normalization/short-title handling, intent criteria, mapping checks và traceability; similarity chỉ là screening signal. Cho phép foundations và chỉ đưa ambiguity thật vào review. Kiểm thử bằng fixtures tổng hợp; không tune dựa trên diagnostic retrieval scores. Không sửa code trong checkpoint này.
2. **External evaluation isolation chưa được freeze/xác minh.** `phase2_preregistration.md:68` yêu cầu freeze và bảo vệ external query texts trước real synthetic generation; `phase2_freeze.json` còn externalQueryManifestSha256=null. Cần independent author/custodian và protected-screening manifest, hoặc một protocol revision được duyệt rõ ràng trước run. Tài liệu freeze cũ có các trường Judge Selection lỗi thời; không dùng chúng để phủ nhận selected frozen Qwen hiện tại. Không thể khắc phục hồi tố exposure của pilot bằng cách freeze muộn mà không ghi limitation.
3. **Chưa có preregistration riêng cho 240 synthetic queries.** Cần freeze scope, sampling, schemas, prompt hashes, cost/request/time caps, retry/invalid-output handling, quality gates và sampling cho Human audit. Chọn rõ generator-only Teacher + Qwen + Human workflow hay một supervised-label protocol được version hóa; không tự yêu cầu chạy lại pilot hiện có.

Kế hoạch đề xuất sau khi các điều kiện trên được xử lý và người dùng duyệt run:

- 240 **synthetic candidate queries**, không phải 240-pair Held-out Test Set; dùng namespace riêng, chỉ T01–T10 và eligible internal corpus.
- Phân bổ đề xuất: 24 queries/topic; 144 Vietnamese và 96 English/cross-lingual. Giữ balance coverage pilot: 48 semantic paraphrase, 48 sermon topic, 48 theological concept, 96 cross-lingual. Allocation này là đề xuất cần freeze trước run, không phải yêu cầu đã được phê duyệt.
- Chạy 4 batches ×60 có checkpoint và manifests; đếm đủ 240 generated candidates, không tự sinh bù để đạt 240 accepted positives. Lưu toàn bộ accepted/rejected/uncertain/invalid outputs và không tune từ held-out scores.
- Gemini generation theo Teacher config được freeze; frozen Qwen grading giữ nguyên; validator/review policy mới chạy trước khi xem xét eligibility. Model availability/identity check không phải Judge Selection mới.
- Human audit bao phủ accepted và rejected theo sampling plan được freeze, cùng toàn bộ genuine ambiguities/invalid outputs; không biến rejects thành hard negatives.
- Kết thúc bằng dataset quality checkpoint mới. Materialization training dataset, relevance-graph/batch collision checks và fine-tuning là các công việc riêng, chưa được phép thực thi trong nhiệm vụ hiện tại.

## 12. Artifacts và tính toàn vẹn

- `teacher_judge_human_audit_final.xlsx`: bản cuối từ workbook v2 mới nhất; chỉ ba ô leakage được cập nhật.
- `leakage_audit_final.json`: 50 records và cumulative history; TP043 Human Adjudication ngày 25/11/2026.
- `change_log_final.json`: trạng thái cũ/mới, authority, rationale; xác nhận TP021 đã đúng trong input.
- `final_pilot_quality_metrics.json`: các metrics có denominator và eligibility dimensions riêng.
- `integrity_verification_final.json`: kiểm tra toàn bộ cells, native workbook parts, source hashes, original pilot, Human Reference, frozen Qwen và validator.
- `artifact_manifest_final.json`: SHA-256 và kích thước các artifacts cuối.

Bản gốc và bản v2 được giữ nguyên. Không có Teacher/Judge calls, không generate thêm queries, không tạo hard negatives, không materialize training dataset hoặc fine-tune E5-small.

Lưu ý provenance khi lưu repository: workbook v2 đã được Human cập nhật metadata sau lần kiểm tra v2 ban đầu. `integrity_validation_report_v2.json` là báo cáo lịch sử cho bản workbook tại thời điểm đó, không phải xác nhận hash cho bản v2 đã chỉnh tiếp. Bản v2 thực tế được dùng làm đầu vào final có SHA-256 `41ab69fbda69598378ce6576c163805a7947c02fb4abf0ad92b13419156d685c`; hash này được kiểm tra trong final manifest và final integrity report. Không sửa hồi tố báo cáo v2.
