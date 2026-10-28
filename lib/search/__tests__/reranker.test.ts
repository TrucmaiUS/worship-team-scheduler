import { describe, it, expect } from 'vitest';
import { 
  fallbackDeterministicReranker, 
  rerankCandidates, 
  searchTwoStage,
  RerankResponseSchema 
} from '../reranker';
import { SongSearchResult } from '../types';

describe('Pillar C: Two-Stage Retrieval with Reranker', () => {
  const mockCandidates: SongSearchResult[] = [
    {
      song_id: '11111111-1111-1111-1111-111111111111',
      canonical_title: 'Bài Ca Cảm Tạ',
      display_title: 'Bài Ca Cảm Tạ',
      ministry_or_artist: 'Hội Thánh',
      song_type: 'praise',
      types: ['praise'],
      approval_status: 'approved',
      score: 0.033,
      rank: 1,
      retrieval_method: 'hybrid',
      matched_evidence: {
        section_id: 'sec-1',
        section_type: 'chorus',
        section_label: 'Điệp khúc',
        section_order: 1,
        lyrics_snippet: 'Cảm tạ ơn Chúa vì Ngài ban ơn lành và bình an muôn thuở.',
      },
    },
    {
      song_id: '22222222-2222-2222-2222-222222222222',
      canonical_title: 'Xin Tha Tội Cho Con',
      display_title: 'Xin Tha Tội Cho Con',
      ministry_or_artist: 'Văn Phẩm Nguồn Sống',
      song_type: 'worship',
      types: ['worship'],
      approval_status: 'approved',
      score: 0.028,
      rank: 2,
      retrieval_method: 'hybrid',
      matched_evidence: {
        section_id: 'sec-2',
        section_type: 'verse',
        section_label: 'Lời 1',
        section_order: 1,
        lyrics_snippet: 'Lòng con ăn năn, xin huyết Giê-xu bôi xóa hết mọi gian ác lỗi lầm.',
      },
    },
    {
      song_id: '33333333-3333-3333-3333-333333333333',
      canonical_title: 'Ngợi Khen Chúa Sáng Tạo',
      display_title: 'Ngợi Khen Chúa Sáng Tạo',
      ministry_or_artist: 'Hillsong',
      song_type: 'praise',
      types: ['praise'],
      approval_status: 'approved',
      score: 0.021,
      rank: 3,
      retrieval_method: 'hybrid',
    },
  ];

  describe('Zod Schema Validation', () => {
    it('should validate valid listwise reranker response JSON', () => {
      const validPayload = {
        ranked_candidates: [
          {
            song_id: '22222222-2222-2222-2222-222222222222',
            relevance_score: 0.96,
            reason: 'Bài hát phản ánh trực tiếp tinh thần ăn năn và cầu xin ơn tha tội qua huyết Chúa Giê-xu.',
          },
          {
            song_id: '11111111-1111-1111-1111-111111111111',
            relevance_score: 0.45,
            reason: 'Bài hát tạ ơn chung chung, không tập trung vào chủ đề ăn năn.',
          },
        ],
      };

      const result = RerankResponseSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ranked_candidates).toHaveLength(2);
        expect(result.data.ranked_candidates[0].relevance_score).toBe(0.96);
      }
    });

    it('should reject scores outside [0, 1]', () => {
      const invalidPayload = {
        ranked_candidates: [
          {
            song_id: '111',
            relevance_score: 1.5, // Exceeds 1.0
            reason: 'Invalid',
          },
        ],
      };

      const result = RerankResponseSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Deterministic Fallback Reranker', () => {
    it('should elevate the song with matching title and lyrics above others', () => {
      const query = 'Ăn năn tha tội lỗi lầm';
      const reranked = fallbackDeterministicReranker(query, mockCandidates);

      expect(reranked).toHaveLength(3);
      // "Xin Tha Tội Cho Con" should rank #1 despite starting at rank #2 in Stage 1
      expect(reranked[0].display_title).toBe('Xin Tha Tội Cho Con');
      expect(reranked[0].rank).toBe(1);
      expect(reranked[0].retrieval_method).toBe('reranked');
      expect(reranked[0].rerank_score).toBeGreaterThan(reranked[1].rerank_score ?? 0);
      expect(reranked[0].rerank_reason).toBeDefined();
    });

    it('should handle queries matching exact song titles', () => {
      const query = 'Bài Ca Cảm Tạ';
      const reranked = fallbackDeterministicReranker(query, mockCandidates);

      expect(reranked[0].display_title).toBe('Bài Ca Cảm Tạ');
      expect(reranked[0].rerank_score).toBeGreaterThan(0.7);
    });
  });

  describe('rerankCandidates Function', () => {
    it('should return immediately if candidate pool is empty or has 1 item', async () => {
      const empty = await rerankCandidates('Chúa yêu con', []);
      expect(empty).toHaveLength(0);

      const single = await rerankCandidates('Chúa yêu con', [mockCandidates[0]]);
      expect(single).toHaveLength(1);
      expect(single[0].rank).toBe(1);
    });

    it('should respect topK slicing parameter', async () => {
      const top2 = await rerankCandidates('Chúa', mockCandidates, {
        topK: 2,
        provider: 'deterministic',
      });

      expect(top2).toHaveLength(2);
      expect(top2[0].rank).toBe(1);
      expect(top2[1].rank).toBe(2);
    });

    it('should fallback gracefully to deterministic mode when provider is deterministic', async () => {
      const results = await rerankCandidates('Cảm tạ', mockCandidates, {
        provider: 'deterministic',
      });

      expect(results).toHaveLength(3);
      expect(results[0].display_title).toBe('Bài Ca Cảm Tạ');
      expect(results[0].rerank_score).toBeDefined();
    });
  });

  describe('End-to-End searchTwoStage Integration', () => {
    it('should retrieve database songs via Hybrid search and rerank them with zero errors', async () => {
      const results = await searchTwoStage('thập tự giá yêu thương', {
        limit: 5,
        eligibilityStatus: 'all',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
      expect(results[0].rank).toBe(1);
      expect(results[0].retrieval_method).toBe('reranked');
      expect(results[0].rerank_score).toBeDefined();
    }, 20000);
  });
});
