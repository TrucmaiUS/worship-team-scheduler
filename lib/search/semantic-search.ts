import db from '@/lib/db';
import { SearchOptions, SongSearchResult } from './types';
import { getActiveEmbeddingProvider, DeterministicSemanticProvider } from './embedding-service';

/**
 * Executes vector search in PostgreSQL pgvector
 */
async function executeVectorQuery(
  queryVector: number[],
  modelName: string,
  limit: number,
  eligibility: 'approved' | 'all',
  typeFilter: 'all' | 'praise' | 'worship',
  targetType: 'section' | 'song'
): Promise<SongSearchResult[]> {
  const vectorStr = `[${queryVector.join(',')}]`;
  const params: any[] = [vectorStr, modelName, limit];
  let paramIdx = 4;

  let eligibilityClause = '';
  if (eligibility === 'approved') {
    eligibilityClause = `AND s.approval_status = 'approved'`;
  }

  let typeClause = '';
  if (typeFilter !== 'all') {
    typeClause = `AND ($${paramIdx} = ANY(s.types) OR s.song_type = $${paramIdx})`;
    paramIdx++;
    params.push(typeFilter);
  }

  let sql = '';

  if (targetType === 'song') {
    sql = `
      SELECT 
        s.id as song_id,
        s.canonical_title,
        s.display_title,
        s.ministry_or_artist,
        s.song_type,
        s.types,
        s.approval_status,
        (1.0 - (se.embedding <=> $1::vector)) as score,
        se.chunk_text
      FROM songs s
      JOIN song_embeddings se ON s.id = se.song_id AND se.target_type = 'song' AND se.model_name = $2
      WHERE 1=1
        ${eligibilityClause}
        ${typeClause}
      ORDER BY score DESC
      LIMIT $3;
    `;
  } else {
    sql = `
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
    `;
  }

  try {
    const res = await db.query(sql, params);

    return res.rows.map((row, idx) => ({
      song_id: row.song_id,
      canonical_title: row.canonical_title,
      display_title: row.display_title,
      ministry_or_artist: row.ministry_or_artist,
      song_type: row.song_type,
      types: row.types || [row.song_type],
      approval_status: row.approval_status,
      score: parseFloat(row.score || '0'),
      rank: idx + 1,
      retrieval_method: 'semantic' as const,
      semantic_score: parseFloat(row.score || '0'),
      matched_evidence: row.section_id
        ? {
            section_id: row.section_id,
            section_type: row.section_type || 'section',
            section_label: row.section_label || 'Section',
            section_order: row.section_order ?? 0,
            lyrics_snippet: (row.lyrics_text || row.chunk_text || '')
              .split('\n')
              .filter(Boolean)
              .slice(0, 3)
              .join('\n'),
            similarity_score: parseFloat(row.score || '0'),
          }
        : undefined,
    }));
  } catch (err: any) {
    console.error('Error executing semantic vector query:', err);
    return [];
  }
}

/**
 * Baseline 2: Semantic Vector Search
 * Embeds user query and searches song_embeddings using pgvector cosine distance (<=>).
 * Retrieves the best-matching lyrics section per song and provides explainable evidence.
 * Supports graceful fallback to offline deterministic projector if cloud provider fails.
 */
export async function searchBySemantic(
  query: string,
  options?: SearchOptions
): Promise<SongSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const limit = options?.limit || 10;
  const eligibility = options?.eligibilityStatus || 'approved';
  const typeFilter = options?.songTypeFilter || 'all';
  const targetType = options?.semanticTarget || 'section';

  let provider = options?.embeddingProvider || getActiveEmbeddingProvider();
  let queryVector: number[] | null = null;

  try {
    queryVector = await provider.embedText(cleanQuery);
  } catch (err: any) {
    console.warn(`[SemanticSearch] Active provider ${provider.name} failed: ${err.message}. Falling back to DeterministicSemanticProvider.`);
    provider = new DeterministicSemanticProvider();
    queryVector = await provider.embedText(cleanQuery);
  }

  // Execute search query
  let results = await executeVectorQuery(
    queryVector,
    provider.name,
    limit,
    eligibility,
    typeFilter,
    targetType
  );

  // If 0 results were found and active provider is external (e.g. Gemini),
  // it means the database hasn't been indexed with this cloud model yet.
  // Fall back to the cached offline 'semantic-projector-768' embeddings in DB.
  if (results.length === 0 && provider.name !== 'semantic-projector-768') {
    const fallbackProvider = new DeterministicSemanticProvider();
    const fallbackVector = await fallbackProvider.embedText(cleanQuery);
    results = await executeVectorQuery(
      fallbackVector,
      fallbackProvider.name,
      limit,
      eligibility,
      typeFilter,
      targetType
    );
  }

  return results;
}
