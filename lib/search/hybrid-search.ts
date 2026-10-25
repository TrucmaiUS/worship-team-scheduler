import { searchByKeyword } from './keyword-search';
import { searchBySemantic } from './semantic-search';
import { SearchOptions, SongSearchResult } from './types';

/**
 * Baseline 3: Hybrid Search with Reciprocal Rank Fusion (RRF)
 * Combines full-text keyword ranking (BM25/ts_rank) with vector semantic ranking.
 *
 * Formula:
 *   RRF_Score(d) = SUM_{m \in {keyword, semantic}} ( 1 / (k + rank_m(d)) )
 * Default k = 60 (standard Cormack et al. constant)
 */
export async function searchHybrid(
  query: string,
  options?: SearchOptions
): Promise<SongSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const limit = options?.limit || 10;
  const k = options?.rrfConstant ?? 60;
  // Over-fetch candidate pool to ensure robust rank fusion
  const fetchLimit = Math.max(limit * 3, 30);

  const subOptions: SearchOptions = {
    ...options,
    limit: fetchLimit,
  };

  // Run keyword and semantic searches concurrently
  const [keywordResults, semanticResults] = await Promise.all([
    searchByKeyword(cleanQuery, subOptions),
    searchBySemantic(cleanQuery, subOptions),
  ]);

  interface FusionEntry {
    song: SongSearchResult;
    rrfScore: number;
    keywordRank?: number;
    keywordScore?: number;
    semanticRank?: number;
    semanticScore?: number;
  }

  const fusionMap = new Map<string, FusionEntry>();

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
      // Prefer semantic evidence if available, or keep if already present
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

  // Sort candidates by combined RRF score descending
  const sorted = Array.from(fusionMap.values()).sort((a, b) => {
    if (b.rrfScore !== a.rrfScore) {
      return b.rrfScore - a.rrfScore;
    }
    // Secondary tie-breaker: semantic score then keyword score
    const bSem = b.semanticScore ?? 0;
    const aSem = a.semanticScore ?? 0;
    if (bSem !== aSem) return bSem - aSem;

    return (b.keywordScore ?? 0) - (a.keywordScore ?? 0);
  });

  // Format final ranked results
  return sorted.slice(0, limit).map((entry, idx) => {
    return {
      ...entry.song,
      score: Number(entry.rrfScore.toFixed(6)),
      rank: idx + 1,
      retrieval_method: 'hybrid' as const,
      keyword_score: entry.keywordScore,
      semantic_score: entry.semanticScore,
    };
  });
}
