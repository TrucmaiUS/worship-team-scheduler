import { z } from 'zod';
import { searchHybrid } from './hybrid-search';
import { SongSearchResult, SearchOptions, RerankerOptions } from './types';

// ============================================================================
// 1. ZOD SCHEMAS & CONTRACTS
// ============================================================================

export const RerankResultItemSchema = z.object({
  song_id: z.string().describe('Exact UUID of the candidate song'),
  relevance_score: z.number().min(0).max(1).describe('Relevance score between 0.00 and 1.00'),
  reason: z.string().describe('Short 1-sentence Vietnamese reason why this song matches the query intent'),
});

export const RerankResponseSchema = z.object({
  ranked_candidates: z.array(RerankResultItemSchema),
});

export type RerankResultItem = z.infer<typeof RerankResultItemSchema>;
export type RerankResponse = z.infer<typeof RerankResponseSchema>;

// ============================================================================
// 2. SYSTEM INSTRUCTIONS FOR LITURGICAL RE-SCORING
// ============================================================================

const RERANKER_SYSTEM_PROMPT = `Bạn là Trưởng ban Âm nhạc Phụng vụ và Chuyên gia Thần học Cơ Đốc (Christian Worship Director & Theological Evaluator).
Nhiệm vụ của bạn là đánh giá độ tương quan và tái xếp hạng (Two-Stage Reranking) danh sách bài hát ứng viên dựa trên Câu truy vấn / Chủ đề bài giảng của người dùng.

TIÊU CHÍ CHẤM ĐIỂM (0.00 -> 1.00):
- 0.90 - 1.00: Hoàn hảo. Khớp trực tiếp cả chủ đề thần học, ca từ lẫn bối cảnh tâm linh của câu truy vấn.
- 0.70 - 0.89: Rất phù hợp. Ca từ và tinh thần bài hát giải quyết hoặc liên quan chặt chẽ đến chủ đề.
- 0.40 - 0.69: Tương đối phù hợp. Có nhắc thoáng qua hoặc chung chung về chủ đề nhưng không phải trọng tâm.
- 0.00 - 0.39: Lệch chủ đề / Trùng từ khóa nhưng sai bối cảnh (Ví dụ: câu hỏi về sự tha thứ nhưng bài hát lại là bài than thở sầu bi).

QUY TẮC BẮT BUỘC:
1. CHỈ chấm điểm các bài trong danh sách ứng viên được cung cấp. Giữ nguyên 'song_id'.
2. Sắp xếp kết quả từ điểm cao nhất đến thấp nhất (Listwise Reranking).
3. 'reason' phải là 1 câu tiếng Việt ngắn gọn, giải thích chính xác vì sao bài hát phù hợp với câu truy vấn.
4. ĐẦU RA PHẢI LÀ JSON HỢP LỆ THEO SCHEMA:
{
  "ranked_candidates": [
    {
      "song_id": "UUID_chính_xác",
      "relevance_score": 0.95,
      "reason": "Lý do súc tích bằng tiếng Việt..."
    }
  ]
}`;

// ============================================================================
// 3. DETERMINISTIC FALLBACK RERANKER (ZERO-DOWNTIME GUARANTEE)
// ============================================================================

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intelligent deterministic reranker when offline or Gemini API times out.
 * Combines exact title/artist matching, token overlap with matched lyric snippet,
 * and base RRF fusion rank to ensure high-fidelity ranking without network calls.
 */
export function fallbackDeterministicReranker(
  query: string,
  candidates: SongSearchResult[]
): SongSearchResult[] {
  const normQuery = normalizeString(query);
  const queryTokens = new Set(normQuery.split(' ').filter((t) => t.length > 1));

  const scored = candidates.map((c, idx) => {
    let bonus = 0;
    const normTitle = normalizeString(c.display_title || '');
    const normCanon = normalizeString(c.canonical_title || '');
    const normSnippet = normalizeString(c.matched_evidence?.lyrics_snippet || '');

    // Title match bonus
    if (normTitle.includes(normQuery) || normCanon.includes(normQuery)) {
      bonus += 0.4;
    } else {
      let titleHits = 0;
      queryTokens.forEach((token) => {
        if (normTitle.includes(token) || normCanon.includes(token)) {
          titleHits++;
        }
      });
      if (queryTokens.size > 0) {
        bonus += (titleHits / queryTokens.size) * 0.25;
      }
    }

    // Snippet token overlap bonus
    let snippetHits = 0;
    queryTokens.forEach((token) => {
      if (normSnippet.includes(token)) snippetHits++;
    });
    if (queryTokens.size > 0) {
      bonus += (snippetHits / queryTokens.size) * 0.15;
    }

    // Stage 1 rank decay term (0.35 max)
    const rankDecay = Math.max(0, 0.35 - idx * 0.02);

    // Final normalized score between 0.10 and 0.98
    const finalScore = Math.min(0.98, Math.max(0.1, Number((bonus + rankDecay + 0.1).toFixed(3))));

    return {
      ...c,
      retrieval_method: 'reranked' as const,
      rerank_score: finalScore,
      rerank_reason:
        bonus > 0.3
          ? `Khớp trực tiếp tiêu đề bài hát và từ khóa trọng tâm với "${query}".`
          : c.matched_evidence
          ? `Phân đoạn ${c.matched_evidence.section_label} đối chiếu sát với chủ đề tìm kiếm.`
          : 'Xếp hạng tối ưu kết hợp giữa tần suất từ khóa và độ tương đồng ngữ nghĩa.',
    };
  });

  return scored
    .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0))
    .map((song, i) => ({
      ...song,
      rank: i + 1,
    }));
}

// ============================================================================
// 4. GEMINI FLASH LISTWISE RERANKER
// ============================================================================

async function callGeminiReranker(
  query: string,
  candidates: SongSearchResult[],
  apiKey: string,
  signal?: AbortSignal,
  temperature = 0.1
): Promise<SongSearchResult[]> {
  const candidateListText = candidates
    .map(
      (c, i) =>
        `${i + 1}. [ID: ${c.song_id}] "${c.display_title}" (${c.ministry_or_artist || 'Chưa rõ nghệ sĩ'}) - Thể loại: ${c.song_type}\n` +
        `   Phân đoạn khớp: ${c.matched_evidence ? `[${c.matched_evidence.section_label}] "${c.matched_evidence.lyrics_snippet.replace(/\n/g, ' ')}"` : 'Khớp metadata tiêu đề'}`
    )
    .join('\n\n');

  const userPrompt = `CÂU TRUY VẤN / CHỦ ĐỀ CẦN TÌM:
"${query}"

DANH SÁCH ${candidates.length} BÀI HÁT ỨNG VIÊN CẦN TÁI XẾP HẠNG (STAGE 1 CANDIDATES):
${candidateListText}

Hãy đánh giá độ tương quan của từng bài hát với câu truy vấn trên, chấm điểm từ 0.00 đến 1.00 và sắp xếp lại theo thứ tự từ cao đến thấp dưới dạng JSON:
{
  "ranked_candidates": [
    {
      "song_id": "UUID từ danh sách",
      "relevance_score": 0.95,
      "reason": "Giải thích ngắn gọn 1 câu tiếng Việt tại sao bài này phù hợp hoặc không phù hợp"
    }
  ]
}`;

  const models = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: signal || AbortSignal.timeout(6000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: RERANKER_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Reranker] Model ${model} returned HTTP ${res.status}: ${errText.slice(0, 100)}`);
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini response returned empty parts');
      }

      const parsed = JSON.parse(rawText);
      const validated = RerankResponseSchema.parse(parsed);

      const candidateMap = new Map(candidates.map((c) => [c.song_id, c]));
      const titleMap = new Map(candidates.map((c) => [normalizeString(c.display_title), c]));

      const rerankedList: SongSearchResult[] = [];
      const seenIds = new Set<string>();

      for (const item of validated.ranked_candidates) {
        let matched = candidateMap.get(item.song_id);
        if (!matched) {
          // Fallback title lookup if model returned title or truncated ID
          matched = titleMap.get(normalizeString(item.song_id));
        }

        if (matched && !seenIds.has(matched.song_id)) {
          seenIds.add(matched.song_id);
          rerankedList.push({
            ...matched,
            retrieval_method: 'reranked',
            rerank_score: item.relevance_score,
            rerank_reason: item.reason,
            rank: rerankedList.length + 1,
          });
        }
      }

      // Append any candidates omitted by the model at the end
      for (const c of candidates) {
        if (!seenIds.has(c.song_id)) {
          rerankedList.push({
            ...c,
            retrieval_method: 'reranked',
            rerank_score: 0.1,
            rerank_reason: 'Ứng viên dự bị từ vòng lọc Stage 1.',
            rank: rerankedList.length + 1,
          });
        }
      }

      return rerankedList;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Reranker] Model ${model} attempt failed: ${err.message}`);
    }
  }

  throw lastError || new Error('All Gemini Flash models failed to rerank');
}

// ============================================================================
// 5. PUBLIC SERVICE APIS
// ============================================================================

/**
 * Re-scores and re-orders a pool of candidate search results using Gemini Flash
 * (or offline deterministic fallback if unavailable).
 */
export async function rerankCandidates(
  query: string,
  candidates: SongSearchResult[],
  options?: RerankerOptions
): Promise<SongSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery || candidates.length <= 1) {
    return candidates.map((c, i) => ({
      ...c,
      retrieval_method: 'reranked' as const,
      rerank_score: c.score,
      rank: i + 1,
    }));
  }

  const topK = options?.topK ?? candidates.length;
  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (options?.provider === 'deterministic' || !apiKey) {
    const fallbackResults = fallbackDeterministicReranker(cleanQuery, candidates);
    return fallbackResults.slice(0, topK);
  }

  try {
    const reranked = await callGeminiReranker(
      cleanQuery,
      candidates,
      apiKey,
      options?.signal,
      options?.temperature ?? 0.1
    );
    return reranked.slice(0, topK);
  } catch (err: any) {
    console.warn(`[Reranker] Gemini rerank failed (${err.message}). Using intelligent deterministic fallback.`);
    const fallbackResults = fallbackDeterministicReranker(cleanQuery, candidates);
    return fallbackResults.slice(0, topK);
  }
}

/**
 * End-to-end Two-Stage Retrieval:
 * Stage 1: Hybrid RRF Search (over-fetches candidates from pgvector + FTS).
 * Stage 2: Cross-Attention LLM Reranking (Gemini Flash re-evaluates & sorts candidates).
 */
export async function searchTwoStage(
  query: string,
  options?: SearchOptions & RerankerOptions
): Promise<SongSearchResult[]> {
  const limit = options?.limit || 10;
  // Over-fetch 2x - 3x candidates to give the reranker a strong candidate pool
  const candidatePoolLimit = Math.max(limit * 2, 15);

  const candidates = await searchHybrid(query, {
    ...options,
    limit: candidatePoolLimit,
  });

  if (candidates.length === 0) {
    return [];
  }

  return rerankCandidates(query, candidates, {
    ...options,
    topK: limit,
  });
}
