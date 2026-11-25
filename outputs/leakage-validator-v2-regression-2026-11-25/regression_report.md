# Leakage Validator v2 — Offline Pilot Regression

Ngày chạy UTC: 2026-11-25T11:17:45.771Z. Phiên bản: leakage-validator-v2.0.0. Commit nền: 1fd0059f6d4b70789683422d258dea6b0d859e02; dirty=true. Hash từng source trong regression_results.json.

## Kết quả

50 records; tự động: {"passed":49,"human_review":1}; sau adjudication: {"passed":50}.

Có 10 quyết định Human Adjudication có provenance; chỉ TP043 cần thay đổi quyết định tự động. Regression PASS; dữ liệu đầu vào bảo toàn: true.

| Record | Pipeline tự động | Sau adjudication | Quyết định được kế thừa |
|---|---|---|---|
| TP001 | passed | passed | final-human:TP001:2026-11-25 |
| TP002 | passed | passed | — |
| TP003 | passed | passed | — |
| TP004 | passed | passed | — |
| TP005 | passed | passed | final-human:TP005:2026-11-25 |
| TP006 | passed | passed | — |
| TP007 | passed | passed | — |
| TP008 | passed | passed | — |
| TP009 | passed | passed | — |
| TP010 | passed | passed | — |
| TP011 | passed | passed | — |
| TP012 | passed | passed | — |
| TP013 | passed | passed | — |
| TP014 | passed | passed | — |
| TP015 | passed | passed | — |
| TP016 | passed | passed | — |
| TP017 | passed | passed | — |
| TP018 | passed | passed | final-human:TP018:2026-11-25 |
| TP019 | passed | passed | — |
| TP020 | passed | passed | — |
| TP021 | passed | passed | — |
| TP022 | passed | passed | — |
| TP023 | passed | passed | — |
| TP024 | passed | passed | — |
| TP025 | passed | passed | — |
| TP026 | passed | passed | — |
| TP027 | passed | passed | — |
| TP028 | passed | passed | — |
| TP029 | passed | passed | — |
| TP030 | passed | passed | — |
| TP031 | passed | passed | — |
| TP032 | passed | passed | — |
| TP033 | passed | passed | — |
| TP034 | passed | passed | — |
| TP035 | passed | passed | — |
| TP036 | passed | passed | — |
| TP037 | passed | passed | — |
| TP038 | passed | passed | — |
| TP039 | passed | passed | — |
| TP040 | passed | passed | — |
| TP041 | passed | passed | final-human:TP041:2026-11-25 |
| TP042 | passed | passed | final-human:TP042:2026-11-25 |
| TP043 | human_review | passed | final-human:TP043:2026-11-25 |
| TP044 | passed | passed | final-human:TP044:2026-11-25 |
| TP045 | passed | passed | final-human:TP045:2026-11-25 |
| TP046 | passed | passed | final-human:TP046:2026-11-25 |
| TP047 | passed | passed | — |
| TP048 | passed | passed | — |
| TP049 | passed | passed | — |
| TP050 | passed | passed | final-human:TP050:2026-11-25 |

## Diễn giải và giới hạn

Vocabulary, lexical scores, semantic intent và protected supervision được ghi riêng. Không cách ly toàn bộ song hoặc section. TP043 kế thừa quyết định Human Adjudication ngày 25/11/2026 bằng fingerprint nội dung và registry, không có allowlist theo ID/topic.

Không chạy Teacher, Judge hoặc embedding. Không có semantic cosine thực đo trong lần chạy này; 140 protected records, trong đó 14 diagnostic. External coverage: not_available; không đọc external labels. Bộ quy tắc song ngữ có phạm vi hữu hạn, không phải bộ chứng minh semantic intent đầy đủ. Kết quả 50/50 trên pilot đã biết không ước lượng được recall với leakage mới. Unit fixtures kiểm tra các vi phạm được kiểm soát, không phải queries được tạo cho training.

32 mappings; 32 là legacy_unverified: adjudicated=true của qrels không chứng minh đã có human adjudication. Cùng mapping chỉ xác nhận khi có cùng intent/explicit supervision reuse và provenance phù hợp; cùng song/section riêng lẻ không đủ.

Leakage passed không đồng nghĩa được dùng training. TP012/TP040 vẫn invalid Judge outputs; TP018 vẫn rejected_validation trong pilot gốc. Không có cập nhật Human decisions, Human Reference, frozen Qwen, workbook hay snapshot pilot. Dừng tại checkpoint.
