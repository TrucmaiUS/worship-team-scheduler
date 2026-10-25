import db from '@/lib/db';
import { SearchOptions, SongSearchResult } from './types';

/**
 * Baseline 1: Keyword Full-Text Search
 * Uses PostgreSQL tsvector & tsquery with immutable_unaccent to match keywords
 * across song titles, artists, and individual lyrics sections.
 */
export async function searchByKeyword(
  query: string,
  options?: SearchOptions
): Promise<SongSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const limit = options?.limit || 10;
  const eligibility = options?.eligibilityStatus || 'approved';
  const typeFilter = options?.songTypeFilter || 'all';

  // Prepare SQL params
  const params: any[] = [cleanQuery, limit];
  let paramIdx = 3;

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

  // We query songs matching either title/artist OR lyrics in sections
  const sql = `
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
  `;

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
      score: parseFloat(row.total_score || '0'),
      rank: idx + 1,
      retrieval_method: 'keyword' as const,
      keyword_score: parseFloat(row.total_score || '0'),
      matched_evidence: row.section_id
        ? {
            section_id: row.section_id,
            section_type: row.section_type,
            section_label: row.section_label,
            section_order: row.section_order,
            lyrics_snippet: (row.lyrics_text || '').split('\n').slice(0, 3).join('\n'),
          }
        : undefined,
    }));
  } catch (err: any) {
    console.error('Error executing keyword search:', err);
    return [];
  }
}
