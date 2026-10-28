export interface MatchedSectionEvidence {
  section_id: string;
  section_type: string;
  section_label: string;
  section_order: number;
  lyrics_snippet: string;
  similarity_score?: number;
}

export interface SongSearchResult {
  song_id: string;
  canonical_title: string;
  display_title: string;
  ministry_or_artist: string | null;
  song_type: string;
  types: string[];
  approval_status: 'pending_review' | 'approved' | 'rejected';
  score: number;
  rank: number;
  retrieval_method: 'keyword' | 'semantic' | 'hybrid' | 'reranked';
  keyword_score?: number;
  semantic_score?: number;
  matched_evidence?: MatchedSectionEvidence;
  rerank_score?: number;
  rerank_reason?: string;
}

export interface SearchOptions {
  limit?: number;
  eligibilityStatus?: 'approved' | 'all';
  songTypeFilter?: 'all' | 'praise' | 'worship';
  semanticTarget?: 'section' | 'song';
  rrfConstant?: number; // Standard is 60
  embeddingProvider?: EmbeddingProvider;
  enableReranker?: boolean;
}

export interface RerankerOptions {
  topK?: number;
  temperature?: number;
  signal?: AbortSignal;
  provider?: 'gemini' | 'deterministic';
  apiKey?: string;
}

export interface EmbeddingProvider {
  name: string;
  dimension: number;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
