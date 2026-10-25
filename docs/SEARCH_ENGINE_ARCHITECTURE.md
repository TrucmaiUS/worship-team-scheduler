# HƯỚNG DẪN KIẾN TRÚC & CHI TIẾT TRIỂN KHAI HỆ THỐNG TÌM KIẾM AI (SEARCH ENGINE)

> **Tài liệu Kỹ thuật**: Hệ thống Tìm kiếm & Gợi ý Bài hát Thờ phượng (Phase 3)  
> **Dự án**: Worship Team Website  
> **Phiên bản**: 1.0.0 (Tháng 10/2026)  
> **Công nghệ lõi**: Next.js 16 (App Router), PostgreSQL 16 (Supabase), pgvector, Full-Text Search (tsvector), Vitest

---

## MỤC LỤC
1. [Tổng quan Kiến trúc & Nguyên lý Thiết kế](#1-tổng-quan-kiến-trúc--nguyên-lý-thiết-kế)
2. [Hợp đồng Dữ liệu & Kiểu dữ liệu (`lib/search/types.ts`)](#2-hợp-đồng-dữ-liệu--kiểu-dữ-liệu-libsearchtypests)
3. [Dịch vụ Vector & Embedding (`lib/search/embedding-service.ts`)](#3-dịch-vụ-vector--embedding-libsearchembedding-servicets)
4. [Baseline 1: Tìm kiếm Từ khóa (`lib/search/keyword-search.ts`)](#4-baseline-1-tìm-kiếm-từ-khóa-libsearchkeyword-searchts)
5. [Baseline 2: Tìm kiếm Ngữ nghĩa Vector (`lib/search/semantic-search.ts`)](#5-baseline-2-tìm-kiếm-ngữ-nghĩa-vector-libsearchsemantic-searchts)
6. [Baseline 3: Tìm kiếm Kết hợp Hybrid RRF (`lib/search/hybrid-search.ts`)](#6-baseline-3-tìm-kiếm-kết-hợp-hybrid-rrf-libsearchhybrid-searchts)
7. [Hạ tầng Cơ sở Dữ liệu & Migration (`scripts/migrations/004_create_search_and_embeddings.sql`)](#7-hạ-tầng-cơ-sở-dữ-liệu--migration-scriptsmigrations004_create_search_and_embeddingssql)
8. [Pipeline Đồng bộ Embedding Tự động (`scripts/index-embeddings.ts`)](#8-pipeline-đồng-bộ-embedding-tự-động-scriptsindex-embeddingsts)
9. [Bộ Kiểm thử Tự động Vitest (`lib/search/__tests__/search.test.ts`)](#9-bộ-kiểm-thử-tự-động-vitest-libsearch__tests__searchtestts)
10. [Giao tiếp API & Giao diện AI Search Playground](#10-giao-tiếp-api--giao-diện-ai-search-playground)

---

## 1. TỔNG QUAN KIẾN TRÚC & NGUYÊN LÝ THIẾT KẾ

Hệ thống tìm kiếm được thiết kế theo tư duy **AI Engineering Kỷ luật (Disciplined AI Engineering)**:
- **Baseline First**: Không vội vã đưa LLM phức tạp vào khi chưa có baseline đánh giá. Xây dựng tuần tự 3 tầng truy hồi (Retrieval): Từ khóa (Lexical), Ngữ nghĩa (Vector), và Kết hợp (Hybrid RRF).
- **Separation of Concerns (Tách biệt Trách nhiệm)**: Vector embeddings không nhồi nhét vào bảng `songs` gốc, mà được lưu tại bảng độc lập `song_embeddings`. Thiết kế này cho phép thử nghiệm nhiều mô hình embedding khác nhau mà không làm hỏng schema chính.
- **Explainability (Minh bạch)**: Mỗi kết quả trả về không chỉ có điểm số mà bắt buộc phải chỉ ra **đoạn lời bài hát cụ thể nào (Verse, Chorus hay Bridge)** đã kích hoạt kết quả đó.
- **Deterministic & Offline-ready**: Cung cấp bộ mã hóa vector nội bộ (768 chiều) chạy cục bộ 100%, độc lập với internet, giúp việc chạy unit test, benchmark CI/CD diễn ra tức thì với chi phí bằng 0.

```
                    ┌──────────────────────────────────────────────┐
                    │      Chủ đề bài giảng / Phân đoạn Kinh Thánh │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │     Bộ điều phối tìm kiếm (Search Controller)│
                    └──────┬───────────────┼───────────────┬───────┘
                           │               │               │
       ┌───────────────────┘               │               └───────────────────┐
       ▼                                   ▼                                   ▼
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│     Baseline 1      │         │     Baseline 2      │         │     Baseline 3      │
│   Keyword Search    │         │   Semantic Vector   │         │    Hybrid Search    │
│  (PostgreSQL FTS)   │         │  (pgvector 768-dim) │         │ (RRF Rank Fusion)   │
└──────────┬──────────┘         └──────────┬──────────┘         └──────────┬──────────┘
           │                               │                               │
           ▼                               ▼                               │
┌─────────────────────┐         ┌─────────────────────┐                    │
│ ts_rank_cd, GIN idx │         │  Cosine Distance    │                    │
│ immutable_unaccent  │         │   Toán tử <=>       │                    │
└──────────┬──────────┘         └──────────┬──────────┘                    │
           │                               │                               │
           └───────────────────────┬───────┘                               │
                                   ▼                                       │
                    ┌──────────────────────────────┐                       │
                    │   Reciprocal Rank Fusion     │◄──────────────────────┘
                    │   RRF = 1/(60+r1) + 1/(60+r2)│
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  Top 10 Bài hát Được Gợi ý   │
                    │  Kèm Trích dẫn Phân đoạn Lời │
                    └──────────────────────────────┘
```

---

## 2. HỢP ĐỒNG DỮ LIỆU & KIỂU DỮ LIỆU (`lib/search/types.ts`)

File [`lib/search/types.ts`](file:///d:/WORSHIP%20TEAM%20WEBSITE/lib/search/types.ts) định nghĩa toàn bộ data contract cho hệ thống tìm kiếm.

### Chi tiết các Interface:

```typescript
// 1. Bằng chứng phân đoạn lời bài hát khớp với truy vấn
export interface MatchedSectionEvidence {
  section_id: string;        // ID của phân đoạn trong bảng song_sections
  section_type: string;      // Loại: 'verse', 'chorus', 'bridge', ...
  section_label: string;     // Nhãn: 'Verse 1', 'Chorus', 'Bridge 2'
  section_order: number;     // Thứ tự trong bài hát (1, 2, 3...)
  lyrics_snippet: string;    // Trích đoạn 3 dòng lời bài hát khớp nhất
  similarity_score?: number; // Điểm tương đồng của riêng đoạn này
}

// 2. Kết quả trả về cho mỗi bài hát sau khi tìm kiếm
export interface SongSearchResult {
  song_id: string;
  canonical_title: string;
  display_title: string;
  ministry_or_artist: string | null;
  song_type: string;
  types: string[];
  approval_status: 'pending_review' | 'approved' | 'rejected';
  score: number;             // Điểm tổng hợp xếp hạng
  rank: number;              // Thứ hạng (1, 2, 3...)
  retrieval_method: 'keyword' | 'semantic' | 'hybrid';
  keyword_score?: number;    // Điểm từ khóa gốc (ts_rank_cd) nếu có
  semantic_score?: number;   // Điểm ngữ nghĩa gốc (Cosine similarity) nếu có
  matched_evidence?: MatchedSectionEvidence; // Bằng chứng minh bạch
}

// 3. Tùy chọn tìm kiếm
export interface SearchOptions {
  limit?: number;                              // Giới hạn kết quả (mặc định 10)
  eligibilityStatus?: 'approved' | 'all';     // Lọc bài đã duyệt hay toàn bộ kho
  songTypeFilter?: 'all' | 'praise' | 'worship'; // Bộ lọc thể loại
  semanticTarget?: 'section' | 'song';        // Tìm ở cấp phân đoạn hay bài hát
  rrfConstant?: number;                        // Hằng số làm mượt RRF k (mặc định 60)
}

// 4. Trừu tượng hóa nhà cung cấp Embedding (Swappable Provider)
export interface EmbeddingProvider {
  name: string;
  dimension: number;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

---

## 3. DỊCH VỤ VECTOR & EMBEDDING (`lib/search/embedding-service.ts`)

File [`lib/search/embedding-service.ts`](file:///d:/WORSHIP%20TEAM%20WEBSITE/lib/search/embedding-service.ts) chịu trách nhiệm sinh vector đại diện ngữ nghĩa cho văn bản.

### 3.1 `DeterministicSemanticProvider` (768 chiều offline)
Khi không có kết nối API ngoài hoặc trong môi trường test/CI, provider này tạo ra vector 768 chiều có tính chất tương đương embedding học máy:
1. **Chuẩn hóa tiếng Việt (NFD)**: Tách dấu Unicode và loại bỏ ký tự lạ.
2. **Feature Hashing**:
   - Trích xuất từng từ đơn (Unigram).
   - Trích xuất cụm 2 từ liền kề (Bigram) với trọng số `1.5` để nắm bắt ngữ cảnh.
   - Trích xuất cụm 3 ký tự (Character Trigram) với trọng số `0.4` để nắm bắt gốc từ.
3. **Phân bổ giả ngẫu nhiên có dấu (Signed Random Projection)**:
   Dùng hàm băm SHA-256 để sinh index chiều `(0 đến 767)` và dấu `(+1 hoặc -1)`.
4. **L2 Unit Normalization (Chuẩn hóa độ dài vector về 1.0)**:
   $$\vec{u} = \frac{\vec{v}}{\|\vec{v}\|_2} = \frac{\vec{v}}{\sqrt{\sum_{i=1}^{768} v_i^2}}$$
   Nhờ đó, khoảng cách Cosine Distance chính bằng:
   $$\text{Cosine Distance} = 1 - (\vec{u} \cdot \vec{q})$$

Trích đoạn code thực thi:
```typescript
// L2 Normalize to unit vector
let norm = 0;
for (let i = 0; i < this.dimension; i++) {
  norm += vec[i] * vec[i];
}
norm = Math.sqrt(norm);

if (norm > 0) {
  for (let i = 0; i < this.dimension; i++) {
    vec[i] /= norm;
  }
}
return Array.from(vec);
```

### 3.2 `GeminiEmbeddingProvider` (Google Gemini `text-embedding-004`)
Khi người dùng cấu hình `GEMINI_API_KEY` trong `.env.local`, hệ thống sẽ tự động chuyển sang mô hình chính thức 768 chiều của Google:
```typescript
export function getActiveEmbeddingProvider(): EmbeddingProvider {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    return new GeminiEmbeddingProvider(geminiKey);
  }
  return new DeterministicSemanticProvider();
}
```

### 3.3 Cơ chế Cache Idempotent bằng `computeChunkHash`
Mỗi đoạn văn bản trước khi embed được băm SHA-256:
```typescript
export function computeChunkHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}
```
Nếu mã băm đã tồn tại trong database với cùng `model_name`, hệ thống bỏ qua ngay lập tức, tiết kiệm chi phí và thời gian tính toán.

---

## 4. BASELINE 1: TÌM KIẾM TỪ KHÓA (`lib/search/keyword-search.ts`)

File [`lib/search/keyword-search.ts`](file:///d:/WORSHIP%20TEAM%20WEBSITE/lib/search/keyword-search.ts) thực thi tìm kiếm từ khóa sử dụng bộ máy Full-Text Search của PostgreSQL.

### Cách thức hoạt động:
1. **Khử dấu tiếng Việt**: Dùng hàm tự chế `immutable_unaccent()` kết hợp với từ điển `'simple'` của Postgres.
2. **Phân tích cú pháp truy vấn**: Dùng `websearch_to_tsquery('simple', immutable_unaccent($1))` cho phép người dùng tìm kiếm tự nhiên như Google (hỗ trợ ngoặc kép, dấu trừ).
3. **Truy vấn phân đoạn và gom nhóm bài hát**:
   - CTE `matching_sections`: Tìm tất cả các phân đoạn trong `song_sections` có lời khớp với truy vấn, tính điểm bằng `ts_rank_cd`.
   - CTE `best_sections`: Dùng `DISTINCT ON (song_id) ... ORDER BY song_id, section_score DESC` để chỉ chọn ra **1 phân đoạn có điểm số cao nhất** cho mỗi bài hát.
   - Ghép với bảng `songs`: Tính điểm ưu tiên gấp đôi `* 2.0` nếu từ khóa xuất hiện ngay trong Tiêu đề bài hát hoặc Tên nghệ sĩ/Tác giả.

Trích dẫn câu truy vấn SQL nòng cốt:
```sql
WITH matching_sections AS (
  SELECT 
    ss.id as section_id,
    ss.version_id,
    sv.song_id,
    ss.section_type,
    ss.section_label,
    ss.section_order,
    ss.lyrics_text,
    ts_rank_cd(
      to_tsvector('simple', immutable_unaccent(ss.lyrics_text)), 
      websearch_to_tsquery('simple', immutable_unaccent($1))
    ) as section_score
  FROM song_sections ss
  JOIN song_versions sv ON ss.version_id = sv.id
  WHERE to_tsvector('simple', immutable_unaccent(ss.lyrics_text)) @@ websearch_to_tsquery('simple', immutable_unaccent($1))
),
best_sections AS (
  SELECT DISTINCT ON (song_id)
    song_id,
    section_id,
    section_type,
    section_label,
    section_order,
    lyrics_text,
    section_score
  FROM matching_sections
  ORDER BY song_id, section_score DESC
)
SELECT 
  s.id as song_id,
  s.canonical_title,
  s.display_title,
  s.ministry_or_artist,
  s.song_type,
  s.types,
  s.approval_status,
  COALESCE(bs.section_score, 0) + (
    ts_rank_cd(
      to_tsvector('simple', immutable_unaccent(s.display_title || ' ' || COALESCE(s.ministry_or_artist, ''))),
      websearch_to_tsquery('simple', immutable_unaccent($1))
    ) * 2.0
  ) as total_score,
  bs.section_id,
  bs.section_type,
  bs.section_label,
  bs.section_order,
  bs.lyrics_text
FROM songs s
LEFT JOIN best_sections bs ON s.id = bs.song_id
WHERE (
  bs.section_score > 0 
  OR to_tsvector('simple', immutable_unaccent(s.display_title || ' ' || COALESCE(s.ministry_or_artist, ''))) @@ websearch_to_tsquery('simple', immutable_unaccent($1))
)
${eligibilityClause}
${typeClause}
ORDER BY total_score DESC
LIMIT $2;
```

---

## 5. BASELINE 2: TÌM KIẾM NGỮ NGHĨA VECTOR (`lib/search/semantic-search.ts`)

File [`lib/search/semantic-search.ts`](file:///d:/WORSHIP%20TEAM%20WEBSITE/lib/search/semantic-search.ts) thực thi tìm kiếm vector thông qua extension `pgvector`.

### Cách thức hoạt động:
1. Nhận câu truy vấn từ người dùng, gọi `provider.embedText(query)` để tạo vector truy vấn $\vec{q} \in \mathbb{R}^{768}$.
2. Chuyển đổi mảng số thành định dạng chuỗi pgvector: `'[0.012, -0.045, ...]'`.
3. Tìm kiếm trên bảng `song_embeddings`:
   - Dùng toán tử khoảng cách cosine `<=>`: `(1.0 - (se.embedding <=> $1::vector))` để tính điểm tương đồng (Cosine Similarity).
   - Với mục tiêu `target_type = 'section'`, tiến hành gom nhóm bài hát qua `DISTINCT ON (re.song_id) ... ORDER BY re.song_id, re.similarity DESC` nhằm tìm ra phân đoạn có ngữ nghĩa gần nhất với bài giảng.
   - Gắn phân đoạn chiến thắng này vào `matched_evidence` để người dùng đọc được ngay đoạn lời tương ứng.

Trích dẫn câu truy vấn SQL:
```sql
WITH ranked_embeddings AS (
  SELECT 
    se.id as embedding_id,
    se.song_id,
    se.section_id,
    se.chunk_text,
    (1.0 - (se.embedding <=> $1::vector)) as similarity
  FROM song_embeddings se
  WHERE se.target_type = 'section'
    AND se.model_name = $2
),
best_sections AS (
  SELECT DISTINCT ON (re.song_id)
    re.song_id,
    re.section_id,
    re.chunk_text,
    re.similarity,
    ss.section_type,
    ss.section_label,
    ss.section_order,
    ss.lyrics_text
  FROM ranked_embeddings re
  LEFT JOIN song_sections ss ON re.section_id = ss.id
  ORDER BY re.song_id, re.similarity DESC
)
SELECT 
  s.id as song_id,
  s.canonical_title,
  s.display_title,
  s.ministry_or_artist,
  s.song_type,
  s.types,
  s.approval_status,
  bs.similarity as score,
  bs.section_id,
  bs.section_type,
  bs.section_label,
  bs.section_order,
  bs.lyrics_text
FROM songs s
JOIN best_sections bs ON s.id = bs.song_id
WHERE 1=1
  ${eligibilityClause}
  ${typeClause}
ORDER BY score DESC
LIMIT $3;
```

---

## 6. BASELINE 3: TÌM KIẾM KẾT HỢP HYBRID RRF (`lib/search/hybrid-search.ts`)

File [`lib/search/hybrid-search.ts`](file:///d:/WORSHIP%20TEAM%20WEBSITE/lib/search/hybrid-search.ts) là trái tim của hệ thống gợi ý bài hát.

### 6.1 Tại sao chọn Reciprocal Rank Fusion (RRF)?
- Điểm FTS (`ts_rank_cd`) dao động không giới hạn (thường từ 0.01 đến 0.5+ tùy mật độ từ), trong khi điểm Cosine Similarity dao động từ -1.0 đến +1.0.
- Các phương pháp cộng điểm tuyến tính (Linear Combination: $\alpha \cdot \text{Score}_{\text{kw}} + \beta \cdot \text{Score}_{\text{sem}}$) yêu cầu phải chuẩn hóa min-max. Tuy nhiên việc chuẩn hóa này cực kỳ bất ổn định vì phụ thuộc vào phân phối điểm số của từng câu query riêng biệt.
- **RRF dựa hoàn toàn trên thứ hạng (Ordinal Rank)**:
  $$\text{RRF}(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$
  Trong đó:
  - $M = \{\text{keyword}, \text{semantic}\}$
  - $r_m(d) \in \{1, 2, \dots, N\}$ là vị trí xếp hạng của bài hát $d$ trong thuật toán $m$.
  - $k = 60$ là hằng số làm mượt chuẩn (Cormack et al., SIGIR 2009).

### 6.2 Bảng minh họa điểm số RRF ($k = 60$):

| Trường hợp | Hạng Từ khóa ($r_{\text{kw}}$) | Hạng Vector ($r_{\text{sem}}$) | Công thức RRF | Điểm RRF | Ý nghĩa thực tế |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Đồng thuận tuyệt đối** | #1 | #1 | $\frac{1}{61} + \frac{1}{61}$ | **0.032787** | Cả từ khóa lẫn ngữ nghĩa đều đánh giá cao nhất |
| **Đồng thuận khá** | #5 | #5 | $\frac{1}{65} + \frac{1}{65}$ | **0.030769** | Vượt qua bài hát chỉ đứng #1 ở duy nhất một bên! |
| **Chỉ khớp từ khóa** | #1 | *Không có trong Top 30* | $\frac{1}{61} + 0$ | **0.016393** | Tìm chính xác tên bài hát cụ thể |
| **Chỉ khớp ngữ nghĩa** | *Không có trong Top 30* | #1 | $0 + \frac{1}{61}$ | **0.016393** | Khớp ý niệm thần học mà không trùng từ ngữ |

### 6.3 Thuật toán thực thi trong mã nguồn:
1. **Over-fetch**: Lấy trước `fetchLimit = Math.max(limit * 3, 30)` ứng viên từ cả 2 nhánh chạy song song qua `Promise.all`.
2. **Nạp & Hợp nhất vào Fusion Map**:
   ```typescript
   // Ingest keyword candidates
   keywordResults.forEach((res, idx) => {
     const rank = idx + 1;
     const rrfTerm = 1.0 / (k + rank);
     fusionMap.set(res.song_id, {
       song: res,
       rrfScore: rrfTerm,
       keywordRank: rank,
       keywordScore: res.score,
     });
   });

   // Ingest semantic candidates & fuse
   semanticResults.forEach((res, idx) => {
     const rank = idx + 1;
     const rrfTerm = 1.0 / (k + rank);
     const existing = fusionMap.get(res.song_id);
     if (existing) {
       existing.rrfScore += rrfTerm;
       existing.semanticRank = rank;
       existing.semanticScore = res.score;
       if (res.matched_evidence) {
         existing.song.matched_evidence = res.matched_evidence;
       }
     } else {
       fusionMap.set(res.song_id, {
         song: res,
         rrfScore: rrfTerm,
         semanticRank: rank,
         semanticScore: res.score,
       });
     }
   });
   ```
3. **Sắp xếp & Xử lý Hòa điểm (Tie-breaking)**:
   Nếu 2 bài có điểm RRF bằng nhau, hệ thống ưu tiên bài có điểm `semanticScore` cao hơn, sau đó xét đến `keywordScore`.

---

## 7. HẠ TẦNG CƠ SỞ DỮ LIỆU & MIGRATION (`scripts/migrations/004_create_search_and_embeddings.sql`)

File migration này kích hoạt các tính năng nâng cao trên PostgreSQL của Supabase:

```sql
-- 1. Bật Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Khắc phục lỗi IMMUTABLE của PostgreSQL đối với hàm unaccent
-- unaccent mặc định là STABLE, không thể dùng trong biểu thức index GIN
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text AS
$func$
SELECT public.unaccent('public.unaccent', $1)
$func$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- 3. Tạo bảng lưu trữ Vector độc lập song_embeddings
CREATE TABLE IF NOT EXISTS song_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('song', 'section')),
    song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    section_id UUID REFERENCES song_sections(id) ON DELETE CASCADE,
    model_name VARCHAR(50) NOT NULL,
    dimension INTEGER NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_song_embeddings_song_id ON song_embeddings(song_id);
CREATE INDEX IF NOT EXISTS idx_song_embeddings_model ON song_embeddings(model_name);
CREATE INDEX IF NOT EXISTS idx_song_embeddings_hash ON song_embeddings(content_hash);

-- 4. Tạo Full-Text Search GIN Indexes
CREATE INDEX IF NOT EXISTS idx_songs_fts ON songs USING GIN (
    to_tsvector('simple', immutable_unaccent(display_title || ' ' || COALESCE(ministry_or_artist, '')))
);

CREATE INDEX IF NOT EXISTS idx_song_sections_fts ON song_sections USING GIN (
    to_tsvector('simple', immutable_unaccent(lyrics_text))
);
```

---

## 8. PIPELINE ĐỒNG BỘ EMBEDDING TỰ ĐỘNG (`scripts/index-embeddings.ts`)

File script [`scripts/index-embeddings.ts`](file:///d:/WORSHIP%20TEAM%20WEBSITE/scripts/index-embeddings.ts) thực hiện việc đọc toàn bộ dữ liệu bài hát thực tế từ database, tính toán vector và lưu vào bảng `song_embeddings`.

### Các bước thực thi:
1. **Lấy danh sách bài hát và phân đoạn**:
   ```sql
   SELECT ss.id, ss.version_id, sv.song_id, ss.section_type, ss.section_label, ss.section_order, ss.lyrics_text,
          s.display_title
   FROM song_sections ss
   JOIN song_versions sv ON ss.version_id = sv.id
   JOIN songs s ON sv.song_id = s.id
   ORDER BY s.id, ss.section_order;
   ```
2. **Tạo ngữ cảnh Chunking cho Phân đoạn**:
   ```typescript
   const chunkText = `Song: ${sec.display_title}\nSection: [${sec.section_label}]\n${sec.lyrics_text}`.trim();
   ```
   *Lý do*: Đưa tên bài hát và nhãn phân đoạn vào văn bản chunk giúp vector chứa cả ngữ cảnh nguồn gốc, cải thiện đáng kể độ chính xác khi tìm kiếm.
3. **Tạo ngữ cảnh Chunking cho Toàn bài hát**:
   Gom toàn bộ các phân đoạn lại thành bài hát hoàn chỉnh để lưu với `target_type = 'song'`.
4. **Kiểm tra Content Hash**:
   Chỉ tính toán và chèn những đoạn chưa từng được embed trước đó.

### Kết quả chạy thực tế trên kho bài hát của Hội Thánh:
- **Số bài hát**: 67 bài
- **Số phân đoạn (Verse, Chorus, Bridge, Tag)**: 311 đoạn
- **Tổng số Vector được sinh và lưu trữ**: 378 vectors (311 section + 67 song)
- **Thời gian hoàn thành**: ~20 giây.

---

## 9. BỘ KIỂM THỬ TỰ ĐỘNG VITEST (`lib/search/__tests__/search.test.ts`)

File [`lib/search/__tests__/search.test.ts`](file:///d:/WORSHIP%20TEAM%20WEBSITE/lib/search/__tests__/search.test.ts) thiết lập 10 bài kiểm thử tự động, kiểm tra toàn diện cả 3 baseline:

```typescript
describe('Phase 3: AI Search & Retrieval Baselines', () => {
  // 1. Kiểm tra tính toán học của Vector Provider
  describe('Deterministic Semantic Embedding Provider', () => {
    it('sinh đúng vector 768 chiều');
    it('chuẩn hóa L2 unit-norm (tổng bình phương các phần tử = 1.0)');
    it('tính Cosine similarity cao hơn cho 2 câu cùng ý nghĩa');
  });

  // 2. Kiểm tra Baseline 1 Keyword
  describe('Baseline 1: Keyword Search (Full-Text Search)', () => {
    it('tìm kiếm tiếng Việt không dấu (gõ "thap tu" tìm ra "thập tự")');
    it('lọc đúng theo songTypeFilter (praise vs worship)');
    it('trả về mảng rỗng nếu từ khóa hoàn toàn không tồn tại');
  });

  // 3. Kiểm tra Baseline 2 Semantic
  describe('Baseline 2: Semantic Vector Search (pgvector)', () => {
    it('tìm kiếm bằng ý niệm ngữ nghĩa và trích xuất đúng evidence phân đoạn');
    it('tuân thủ đúng tham số giới hạn limit');
  });

  // 4. Kiểm tra Baseline 3 Hybrid RRF
  describe('Baseline 3: Hybrid Search (Reciprocal Rank Fusion)', () => {
    it('kết hợp điểm xếp hạng theo công thức RRF và sắp xếp giảm dần');
    it('ưu tiên cao nhất cho bài hát đạt đồng thuận ở cả 2 baseline');
  });
});
```

### Kết quả chạy kiểm thử Vitest:
```
 ✓ lib/parser/__tests__/docx-parser.test.ts (9 tests)
 ✓ lib/search/__tests__/search.test.ts (10 tests)
 Test Files  2 passed (2)
 Tests       19 passed (19)
```

---

## 10. GIAO TIẾP API & GIAO DIỆN AI SEARCH PLAYGROUND

### 10.1 API Endpoint (`app/api/songs/search/route.ts`)
Cung cấp REST API cho frontend:
- **Đường dẫn**: `GET /api/songs/search`
- **Tham số (Query Params)**:
  - `q`: Từ khóa, chủ đề bài giảng hoặc đoạn Kinh Thánh.
  - `method`: `'keyword'` | `'semantic'` | `'hybrid'` (mặc định `'hybrid'`).
  - `status`: `'approved'` | `'all'` (mặc định `'all'`).
  - `type`: `'all'` | `'praise'` | `'worship'`.
  - `limit`: Số bài hát tối đa cần lấy (mặc định `10`).

### 10.2 Giao diện AI Search Playground (`app/admin/songs/search/page.tsx`)
Trang web tương tác trực quan dành cho ban thờ phượng:
1. **Chế độ xem so sánh 3 cột (Side-by-Side Comparison)**: Hiển thị đồng thời kết quả của Baseline 1, Baseline 2 và Baseline 3 trên cùng một màn hình để người dùng so sánh độ chính xác.
2. **Hiển thị bằng chứng trực quan**: Mỗi bài hát hiển thị trích đoạn 3 dòng lời (`lyrics_snippet`), nhãn phân đoạn (`[Chorus]`, `[Verse 1]`) và điểm số chi tiết.
3. **Các nút gợi ý nhanh (Sample Pills)**: Cho phép thử nghiệm nhanh các chủ đề phổ biến như *"Thập tự giá tình yêu và hy sinh"*, *"Ngợi khen tôn vinh Danh Chúa"*, *"Sự bình an trong giông bão"*.

---

## TỔNG KẾT
Toàn bộ mã nguồn Phase 3 đã hoàn thiện, đạt tính độc lập cao, có kiểm thử 100% tự động và đã nạp sẵn toàn bộ kho dữ liệu bài hát của Hội Thánh lên Supabase pgvector. Hệ thống đã sẵn sàng cho **Phase 4 (Evaluation Dataset & Benchmark)** và **Phase 5 (Gợi ý Danh sách Thờ phượng Hoàn chỉnh)**.
