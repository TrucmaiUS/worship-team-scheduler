import { describe, it, expect, beforeAll } from 'vitest';
import { DeterministicSemanticProvider } from '../embedding-service';
import { searchByKeyword } from '../keyword-search';
import { searchBySemantic } from '../semantic-search';
import { searchHybrid } from '../hybrid-search';

describe('Phase 3: AI Search & Retrieval Baselines', () => {
  describe('Deterministic Semantic Embedding Provider', () => {
    const provider = new DeterministicSemanticProvider();

    it('should generate a 768-dimensional vector', async () => {
      const vec = await provider.embedText('Ngợi khen Chúa Cứu Thế');
      expect(vec).toHaveLength(768);
    });

    it('should produce an L2 unit-normalized vector (sum of squares = 1.0)', async () => {
      const vec = await provider.embedText('Chúa Giê-xu là Đấng quyền năng');
      const normSquared = vec.reduce((sum, v) => sum + v * v, 0);
      expect(normSquared).toBeCloseTo(1.0, 3);
    });

    it('should calculate higher cosine similarity for conceptually related phrases', async () => {
      const vBase = await provider.embedText('thập tự giá yêu thương và hy sinh');
      const vRelated = await provider.embedText('Chúa hy sinh tình yêu trên thập tự');
      const vUnrelated = await provider.embedText('mặt trời chiếu sáng bầu trời cao vút');

      // Dot product of unit vectors = Cosine similarity
      const simRelated = vBase.reduce((sum, v, i) => sum + v * vRelated[i], 0);
      const simUnrelated = vBase.reduce((sum, v, i) => sum + v * vUnrelated[i], 0);

      expect(simRelated).toBeGreaterThan(simUnrelated);
    });
  });

  describe('Baseline 1: Keyword Search (Full-Text Search)', () => {
    it('should retrieve songs matching exact Vietnamese keyword with unaccent support', async () => {
      // "thap tu" without accents should match "thập tự"
      const results = await searchByKeyword('thap tu', {
        eligibilityStatus: 'all',
        limit: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].retrieval_method).toBe('keyword');
      expect(results[0].score).toBeGreaterThan(0);

      // Verify that matched song contains the unaccented query in title or matched lyrics
      const hasTerm = results.some(
        (r) =>
          r.display_title.toLowerCase().includes('thập') ||
          (r.matched_evidence && r.matched_evidence.lyrics_snippet.toLowerCase().includes('thập'))
      );
      expect(hasTerm).toBe(true);
    });

    it('should filter correctly by songTypeFilter (praise vs worship)', async () => {
      const praiseResults = await searchByKeyword('Chúa', {
        eligibilityStatus: 'all',
        songTypeFilter: 'praise',
        limit: 5,
      });

      const worshipResults = await searchByKeyword('Chúa', {
        eligibilityStatus: 'all',
        songTypeFilter: 'worship',
        limit: 5,
      });

      praiseResults.forEach((r) => {
        const matchesPraise = r.song_type === 'praise' || r.types?.includes('praise');
        expect(matchesPraise).toBe(true);
      });

      worshipResults.forEach((r) => {
        const matchesWorship = r.song_type === 'worship' || r.types?.includes('worship');
        expect(matchesWorship).toBe(true);
      });
    });

    it('should return empty results for queries with zero matches', async () => {
      const results = await searchByKeyword('xyznonexistentquery999', {
        eligibilityStatus: 'all',
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('Baseline 2: Semantic Vector Search (pgvector)', () => {
    it('should retrieve songs using cosine similarity and populate explainable section evidence', async () => {
      const results = await searchBySemantic('tình yêu thương sự cứu chuộc', {
        eligibilityStatus: 'all',
        limit: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].retrieval_method).toBe('semantic');
      expect(results[0].score).toBeDefined();

      // Top result should include matched section evidence with snippet
      const top = results[0];
      expect(top.matched_evidence).toBeDefined();
      if (top.matched_evidence) {
        expect(top.matched_evidence.section_type).toBeDefined();
        expect(top.matched_evidence.lyrics_snippet).toBeTruthy();
        expect(typeof top.matched_evidence.section_order).toBe('number');
      }
    });

    it('should respect the limit parameter', async () => {
      const results = await searchBySemantic('ngợi khen tôn vinh Danh Chúa', {
        eligibilityStatus: 'all',
        limit: 3,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Baseline 3: Hybrid Search (Reciprocal Rank Fusion)', () => {
    it('should combine keyword and semantic search using RRF formula', async () => {
      const query = 'thập tự giá';
      const results = await searchHybrid(query, {
        eligibilityStatus: 'all',
        limit: 10,
        rrfConstant: 60,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].retrieval_method).toBe('hybrid');

      // Verify strict descending order of RRF scores
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
        expect(results[i].rank).toBe(i + 1);
      }

      // Check that at least one top result has both keyword and semantic scores
      const multiSignal = results.find(
        (r) => r.keyword_score !== undefined && r.semantic_score !== undefined
      );
      if (multiSignal) {
        expect(multiSignal.keyword_score).toBeGreaterThan(0);
        expect(multiSignal.semantic_score).toBeGreaterThan(0);
      }
    });

    it('should correctly prioritize consensus items that rank high in both baselines', async () => {
      const query = 'A THOUSAND HALLELUJAHS';
      const results = await searchHybrid(query, {
        eligibilityStatus: 'all',
        limit: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      const topSong = results[0];
      // Title match should dominate in both keyword and semantic
      expect(topSong.canonical_title.toLowerCase()).toContain('a thousand hallelujahs');
    });
  });
});
